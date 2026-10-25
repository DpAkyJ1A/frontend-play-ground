import Sheet from '../Sheet';
import Compat from './Compat';
import type { Access, Probe, ProbeResult } from '../probes/types';

const ACCESS_TEXT: Record<Access, string> = {
  none: 'Any page can read this the moment it loads. Nothing is shown to you.',
  gesture:
    'The page gets this when you do something: paste, click, press a key.',
  permission:
    'Your browser asks you first. Until you allow it, the page sees nothing.',
};

export type InfoSheetProps = {
  probe: Probe | null;
  result: ProbeResult | undefined;
  open: boolean;
  onClose: () => void;
};

export default function InfoSheet({
  probe,
  result,
  open,
  onClose,
}: InfoSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={probe?.title}>
      {probe && (
        <>
          <h3>What the page used</h3>
          <code>{probe.how}</code>
          <h3>Why it matters</h3>
          <p>{probe.why}</p>
          <h3>Access</h3>
          <p>{ACCESS_TEXT[probe.access]}</p>
          {probe.compat && (
            <>
              <h3>Where it works</h3>
              <Compat keys={probe.compat} />
            </>
          )}
          {result?.raw && (
            <>
              <h3>Raw value</h3>
              <code>{result.raw}</code>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
