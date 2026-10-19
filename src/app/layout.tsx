import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import {
  AUTHOR,
  BASE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  THEME_COLOR,
} from '@/lib/site';
import Analytics from '@/components/Analytics';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz', 'wdth'],
});

const geist = Geist({
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
});

const family = (font: { style: { fontFamily: string } }) =>
  font.style.fontFamily.split(',')[0];

// Font stacks for globals.css and the CSS modules. They skip next/font's
// metric-matched Arial fallbacks, so glyphs the faces lack (π) still come from
// the system fonts, as they did with the Google Fonts stylesheet.
const fontStacks = {
  '--font-bricolage': family(bricolage),
  '--font-geist': family(geist),
  '--font-mono': `${family(geistMono)}, ui-monospace, monospace`,
} as React.CSSProperties;

// Vercel serves the analytics collectors; a static export has nowhere to send.
const withAnalytics = process.env.STATIC_EXPORT !== '1';

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}${BASE_PATH}/`),
  title: {
    default: `${SITE_NAME} — creative frontend experiments`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [AUTHOR],
  creator: AUTHOR.name,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // globals.css scrolls smoothly; this lets route changes jump to the top instantly
      data-scroll-behavior="smooth"
      style={fontStacks}
    >
      <body>
        <div id="root">{children}</div>
        {withAnalytics && <Analytics />}
      </body>
    </html>
  );
}
