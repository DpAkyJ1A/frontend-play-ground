import type { MetadataRoute } from 'next';
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  THEME_COLOR,
  withBasePath,
} from '@/lib/site';

// Rendered once at build time (also required by `output: 'export'`).
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: withBasePath('/'),
    display: 'browser',
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: withBasePath('/icon.svg'), type: 'image/svg+xml', sizes: 'any' },
      {
        src: withBasePath('/apple-icon.png'),
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  };
}
