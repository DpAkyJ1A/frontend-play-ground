import JsonLd from '@/components/JsonLd';
import { EXPERIMENTS, experimentJsonLd, experimentMetadata } from '@/lib/seo';
import EyeControl from '@/views/EyeControl';

const experiment = EXPERIMENTS.eyeControl;

export const metadata = experimentMetadata(experiment);

export default function Page() {
  return (
    <>
      <JsonLd data={experimentJsonLd(experiment)} />
      <EyeControl />
    </>
  );
}
