import JsonLd from '@/components/JsonLd';
import { homeJsonLd, homeMetadata } from '@/lib/seo';
import Home from '@/views/Home';

export const metadata = homeMetadata;

export default function Page() {
  return (
    <>
      <JsonLd data={homeJsonLd} />
      <Home />
    </>
  );
}
