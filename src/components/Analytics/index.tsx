'use client';

import { Analytics as WebAnalytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

// URLs go to Vercel without the query (a Pi search carries the number, often a
// birthday or a phone number) and the hash (a shared Game of Life board); UTM
// tags stay.
const scrub = <T extends { url: string }>(event: T) => {
  const url = new URL(event.url);
  for (const key of [...url.searchParams.keys()]) {
    if (!key.startsWith('utm_')) url.searchParams.delete(key);
  }
  url.hash = '';
  return { ...event, url: url.href };
};

/** Vercel Web Analytics (page views) and Speed Insights (Core Web Vitals from
 * real visits). */
export default function Analytics() {
  return (
    <>
      <WebAnalytics beforeSend={scrub} />
      <SpeedInsights beforeSend={scrub} />
    </>
  );
}
