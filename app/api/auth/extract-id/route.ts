import { NextResponse } from 'next/server';
import { readImage } from '@/lib/kyc/ocr';
import { extractIdentity } from '@/lib/kyc/extract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

/**
 * Reads an uploaded ID proof and returns the fields OCR could lift. No account
 * exists yet at this point — this only powers the "check your details" review
 * step of registration.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Please upload an image of your ID.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was received.' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'That file was empty.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That image is too large. Please use one under 12 MB.' }, { status: 400 });
  }
  // Reject only clearly non-image payloads. Many browsers and tools send AVIF/HEIF
  // as application/octet-stream, so the real gate is whether the bytes decode as
  // an image below — not the declared MIME type.
  if (/^(application\/pdf|text\/|video\/|audio\/)/.test(file.type)) {
    return NextResponse.json(
      { error: 'Please upload a photo or scan of the ID (JPG, PNG, WebP or AVIF).' },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ocr = await readImage(buffer);
    const identity = extractIdentity(ocr);
    // Never send the raw OCR dump to the browser.
    const { rawText: _rawText, ...safe } = identity;
    return NextResponse.json({ identity: safe });
  } catch (error) {
    console.error('[extract-id] failed', error);
    return NextResponse.json(
      { error: 'We could not read that image. Try a clearer, well-lit photo.' },
      { status: 500 },
    );
  }
}
