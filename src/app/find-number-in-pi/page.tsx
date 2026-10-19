import JsonLd from '@/components/JsonLd';
import { EXPERIMENTS, experimentJsonLd, experimentMetadata } from '@/lib/seo';
import FindNumberInPi from '@/views/FindNumberInPi';

const experiment = EXPERIMENTS.findNumberInPi;

export const metadata = experimentMetadata(experiment);

export default function Page() {
  return (
    <>
      <JsonLd data={experimentJsonLd(experiment)} />
      <FindNumberInPi />
    </>
  );
}
