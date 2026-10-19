// Site-wide facts used by metadata, structured data, the sitemap and asset URLs.

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

/** Canonical origin. Override with NEXT_PUBLIC_SITE_URL once a custom domain exists. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (productionHost
    ? `https://${productionHost}`
    : 'https://frontend-play-ground.vercel.app')
).replace(/\/$/, '');

/** Empty on Vercel; `/frontend-play-ground` for a GitHub Pages export. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const SITE_NAME = 'Frontend Play Ground';
export const SITE_SHORT_NAME = 'FPG';
export const SITE_DESCRIPTION =
  'A place to learn new tech, build animations and small projects, and make things just for the fun of it.';
export const REPO_URL = 'https://github.com/DpAkyJ1A/frontend-play-ground';
export const THEME_COLOR = '#0b0a10';

export const AUTHOR = {
  name: 'Aleksey',
  url: 'https://github.com/DpAkyJ1A',
};

/** Prefixes a root-relative public asset path with the deployment base path. */
export const withBasePath = (path: string) => `${BASE_PATH}${path}`;

/** Absolute URL for a root-relative path (the home page without a trailing slash). */
export const absoluteUrl = (path = '/') =>
  `${SITE_URL}${BASE_PATH}${path === '/' ? '' : path}`;

// A static export ends every route with a slash (`trailingSlash` in next.config.ts).
const trailingSlash = process.env.STATIC_EXPORT === '1';

/** Absolute URL of a page, for JSON-LD and the sitemap, written like the canonical
 * Next renders for it. */
export const pageUrl = (path = '/') =>
  trailingSlash ? `${absoluteUrl(path)}/` : absoluteUrl(path);
