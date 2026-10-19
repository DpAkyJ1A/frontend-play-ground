import type { MetadataRoute } from 'next';
import { EXPERIMENTS } from '@/lib/seo';
import { pageUrl } from '@/lib/site';

// Rendered once at build time (also required by `output: 'export'`).
export const dynamic = 'force-static';

// No lastmod: a build date on every URL would claim every page changed on each
// deploy, and search engines learn to ignore lastmod that isn't accurate.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: pageUrl('/'), changeFrequency: 'monthly', priority: 1 },
    ...Object.values(EXPERIMENTS).map(({ path }) => ({
      url: pageUrl(path),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
