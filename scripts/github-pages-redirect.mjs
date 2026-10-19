// Builds a tiny static site that forwards the old GitHub Pages address
// (https://dpakyj1a.github.io/frontend-play-ground/...) to the new host, keeping the
// path, query and hash. Usage:
//
//   pnpm redirect:github-pages [https://new-host.example]
//   pnpm dlx gh-pages@6.3.0 -d .github-pages-redirect --dotfiles   # publishes it
//
// The target defaults to NEXT_PUBLIC_SITE_URL, then to the Vercel production URL.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = (
  process.argv[2] ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://frontend-play-ground.vercel.app'
).replace(/\/$/, '');
const basePath = '/frontend-play-ground';
const routes = [
  '/',
  '/the-game-of-life-ultimate',
  '/find-number-in-pi',
  '/eye-control',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.github-pages-redirect');

const html = ({ fallback, script }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Frontend Play Ground has moved</title>
    <link rel="canonical" href="${fallback}" />
    <meta http-equiv="refresh" content="0; url=${fallback}" />
    <script>${script}</script>
  </head>
  <body style="background:#0b0a10;color:#edeaf6;font-family:system-ui,sans-serif;padding:48px">
    <p>Frontend Play Ground has moved to <a style="color:#c4b0ff" href="${fallback}">${fallback}</a>.</p>
  </body>
</html>
`;

const routePage = (route) => {
  const to = `${target}${route}`;
  return html({
    fallback: to,
    script: `location.replace(${JSON.stringify(to)} + location.search + location.hash);`,
  });
};

// Unknown paths land on 404.html: forward whatever follows the base path.
const notFoundPage = html({
  fallback: `${target}/`,
  script: `var path = location.pathname.replace(${JSON.stringify(
    basePath
  )}, '') || '/'; location.replace(${JSON.stringify(
    target
  )} + path + location.search + location.hash);`,
});

rmSync(out, { recursive: true, force: true });
for (const route of routes) {
  const dir = join(out, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), routePage(route));
}
writeFileSync(join(out, '404.html'), notFoundPage);
writeFileSync(join(out, '.nojekyll'), '');

console.log(`GitHub Pages redirect → ${target}`);
console.log(`written to ${out}; publish with:`);
console.log('  pnpm dlx gh-pages@6.3.0 -d .github-pages-redirect --dotfiles');
