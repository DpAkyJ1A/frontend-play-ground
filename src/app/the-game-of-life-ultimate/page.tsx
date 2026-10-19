import JsonLd from '@/components/JsonLd';
import { EXPERIMENTS, experimentJsonLd, experimentMetadata } from '@/lib/seo';
import TheGameOfLifeUltimate from '@/views/TheGameOfLifeUltimate/ClientGame';

const experiment = EXPERIMENTS.gameOfLife;

export const metadata = experimentMetadata(experiment);

export default function Page() {
  return (
    <>
      <JsonLd data={experimentJsonLd(experiment)} />
      <TheGameOfLifeUltimate />
    </>
  );
}
