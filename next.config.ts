import type { NextConfig } from 'next';

// Vercel by default. For a static host (GitHub Pages) see the README: build with
// STATIC_EXPORT=1, NEXT_PUBLIC_BASE_PATH and NEXT_PUBLIC_SITE_URL.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;
const staticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  basePath,
  output: staticExport ? 'export' : undefined,
  pageExtensions: staticExport
    ? ['tsx', 'ts', 'jsx', 'js']
    : ['tsx', 'ts', 'jsx', 'js', 'server.ts'],
  // Static hosts serve folders: /route/ → /route/index.html.
  trailingSlash: staticExport,
  // The experiments were written without StrictMode: canvases, the camera and the
  // engines start in effects that are not meant to run twice. Keep dev identical to prod.
  reactStrictMode: false,
};

export default nextConfig;
