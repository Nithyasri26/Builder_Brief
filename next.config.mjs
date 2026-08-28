import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to THIS folder. Without it, Next.js sees a stray
  // package-lock.json in the home directory and warns that it guessed the root.
  outputFileTracingRoot: projectRoot,
  // Native / worker-spawning packages must not be bundled by webpack: tesseract
  // spawns a Node worker script and sharp loads native binaries. Leaving them
  // external fixes the ".next/worker-script" not-found error and speeds OCR up.
  serverExternalPackages: ['tesseract.js', 'sharp'],
  // Ship the Tesseract English language data inside the OCR function so it reads
  // it from disk instead of downloading ~5 MB from a CDN on every cold start
  // (which made the ID-upload step hang on Vercel). ocr.ts loads it via
  // langPath = process.cwd().
  outputFileTracingIncludes: {
    '/api/auth/extract-id': ['./eng.traineddata'],
  },
  experimental: {
    // Keeps demo state consistent on a single server instance during the prototype.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
