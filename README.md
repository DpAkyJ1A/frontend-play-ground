# frontend-play-ground

This is my creative platform where I'll be mastering new technologies, creating new animations, working on mini projects, and just creating for the sake of it!

Experiments: **Your Secrets**, **The Game of Life Ultimate**, **Find Your Number in Pi**, **Eye Control**.

## Stack

Next.js (App Router) · React · TypeScript · CSS Modules · lucide-react · MediaPipe Tasks Vision · pnpm. Deployed on Vercel.

## Analytics

Vercel Web Analytics (page views) and Speed Insights (Core Web Vitals from real visits), both in `src/components/Analytics`. Turn both on in the Vercel project's dashboard. URLs go out without the query and the hash, so searched numbers and shared boards stay in the browser.

## Scripts

```bash
pnpm install          # also copies the MediaPipe WASM runtime into public/mediapipe
pnpm dev              # http://localhost:3000
pnpm build && pnpm start
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint .
pnpm check            # typecheck + lint + build
```

## Configuration

| Variable | Default | What it does |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Vercel production URL, else `https://frontend-play-ground.vercel.app` | Canonical origin for metadata, Open Graph, JSON-LD, sitemap and robots |
| `NEXT_PUBLIC_BASE_PATH` | empty | Path prefix for hosting under a sub-path (e.g. `/frontend-play-ground`) |
| `STATIC_EXPORT` | unset | `1` builds a static export into `out/` for a static host |

A full static copy for GitHub Pages (instead of the redirect below):

```bash
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/frontend-play-ground NEXT_PUBLIC_SITE_URL=https://dpakyj1a.github.io pnpm build
touch out/.nojekyll   # Jekyll would drop the _next/ folder
pnpm dlx gh-pages@6.3.0 -d out --dotfiles
```

GitHub Pages serves the extensionless Open Graph images as `application/octet-stream`, so some link previews may skip them there; Vercel serves them as PNG.

## Old GitHub Pages address

The site used to live at `https://dpakyj1a.github.io/frontend-play-ground/`. `pnpm redirect:github-pages [new-origin]` builds a small redirect site that forwards every old URL (path, query and hash) to the new host; publish it with `pnpm dlx gh-pages@6.3.0 -d .github-pages-redirect --dotfiles`.
