import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

// Rendered once at build time (also required by `output: 'export'`).
export const dynamic = 'force-static';

export const alt = `${SITE_NAME} — creative frontend experiments`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    motif: 'home',
  });
}
