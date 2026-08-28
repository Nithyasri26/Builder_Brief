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
  experimental: {
    // Keeps demo state consistent on a single server instance during the prototype.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
