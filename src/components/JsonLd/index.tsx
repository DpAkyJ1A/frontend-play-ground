import type { Thing, WithContext, Graph } from 'schema-dts';

type Props = { data: WithContext<Thing> | Graph };

// Structured data for search engines, rendered on the server.
export default function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      // `<` is escaped so the JSON can't close the script tag early.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
