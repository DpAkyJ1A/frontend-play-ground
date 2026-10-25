import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';
import { EXPERIMENTS } from '@/lib/seo';

// Rendered once at build time (also required by `output: 'export'`).
export const dynamic = 'force-static';

const { name, description } = EXPERIMENTS.yourSecrets;

export const alt = name;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ title: name, description, motif: 'secrets' });
}
