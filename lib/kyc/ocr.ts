import 'server-only';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';

/**
 * Optical character recognition for uploaded ID proofs.
 *
 * `sharp` decodes whatever the citizen uploads — JPEG, PNG, WebP, AVIF/HEIF,
 * even a PDF's first page won't come through here (we ask for an image) — and
 * normalises it for OCR: upscaled so small cards are legible, greyscaled and
 * contrast-stretched so faint print reads, lightly sharpened.
 *
 * Tesseract is expensive to spin up, so one worker is cached for the process
 * and recognition calls are serialised through a small queue (a worker handles
 * one image at a time).
 */

export interface OcrResult {
  text: string;
  confidence: number;
}

const globalOcr = globalThis as unknown as {
  __nammasahaayOcr?: { worker: Promise<Worker>; queue: Promise<unknown> };
};

async function makeWorker(): Promise<Worker> {
  // On serverless hosts (Vercel) the project directory is read-only; only the
  // OS temp dir is writable, so Tesseract's cache must live there.
  const cachePath = join(tmpdir(), 'nammasahaay-tesseract');
  // Load the language data from the copy bundled with the app (see
  // `outputFileTracingIncludes` in next.config.mjs) instead of downloading
  // ~5 MB from a CDN on every cold start — that download is what made the ID
  // step hang for a minute on Vercel. `gzip: false` because our file is the
  // raw, uncompressed `eng.traineddata`.
  const langPath = process.cwd();
  const worker = await createWorker('eng', 1, { cachePath, langPath, gzip: false });
  return worker;
}

function ocrState() {
  if (!globalOcr.__nammasahaayOcr) {
    globalOcr.__nammasahaayOcr = { worker: makeWorker(), queue: Promise.resolve() };
  }
  return globalOcr.__nammasahaayOcr;
}

/** Decodes and cleans an uploaded image into a PNG buffer suited to OCR. */
export async function normalizeForOcr(input: Buffer): Promise<Buffer> {
  const image = sharp(input, { failOn: 'none' });
  const meta = await image.metadata();
  const targetWidth = Math.max(meta.width ?? 1000, 1600);
  return sharp(input, { failOn: 'none' })
    .rotate() // honour EXIF orientation
    .resize({ width: targetWidth, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

/** Runs OCR on an already-decoded/normalised PNG buffer. */
export async function recognize(png: Buffer): Promise<OcrResult> {
  const state = ocrState();
  // Chain onto the queue so only one recognition runs on the worker at a time.
  const run = state.queue.then(async () => {
    const worker = await state.worker;
    const { data } = await worker.recognize(png);
    return { text: data.text ?? '', confidence: data.confidence ?? 0 };
  });
  // Keep the queue alive even if this call rejects.
  state.queue = run.catch(() => undefined);
  return run;
}

/** Convenience: normalise + OCR a raw uploaded buffer in one call. */
export async function readImage(input: Buffer): Promise<OcrResult> {
  const png = await normalizeForOcr(input);
  return recognize(png);
}
