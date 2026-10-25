import type { Viewport } from 'next';
import JsonLd from '@/components/JsonLd';
import { EXPERIMENTS, experimentJsonLd, experimentMetadata } from '@/lib/seo';
import YourSecrets from '@/views/YourSecrets';

const experiment = EXPERIMENTS.yourSecrets;

// a static export has no server for the IP route (see next.config.ts)
const hasServer = process.env.STATIC_EXPORT !== '1';

export const metadata = experimentMetadata(experiment);

// a light page: white cards on cool grey paper
export const viewport: Viewport = {
  themeColor: '#f3f4f6',
  colorScheme: 'light',
};

export default function Page() {
  return (
    <>
      <JsonLd data={experimentJsonLd(experiment)} />
      <YourSecrets hasServer={hasServer} />
    </>
  );
}
