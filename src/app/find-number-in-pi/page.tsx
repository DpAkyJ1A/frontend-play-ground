import type { Viewport } from 'next';
import JsonLd from '@/components/JsonLd';
import { EXPERIMENTS, experimentJsonLd, experimentMetadata } from '@/lib/seo';
import FindNumberInPi from '@/views/FindNumberInPi';

const experiment = EXPERIMENTS.findNumberInPi;

export const metadata = experimentMetadata(experiment);

// a light page: printout paper
export const viewport: Viewport = {
  themeColor: '#fbfcf9',
  colorScheme: 'light',
};

export default function Page() {
  return (
    <>
      <JsonLd data={experimentJsonLd(experiment)} />
      <FindNumberInPi />
    </>
  );
}
