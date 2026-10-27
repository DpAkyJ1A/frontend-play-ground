import { useEffect, useRef, useState } from 'react';
import { lookAt } from '../Eyes';
import { readPaste } from '../probes/clipboard';
import { isShared, shared, values } from '../probes/score';
import type { Access, Probe, ProbeResult } from '../probes/types';
import { permissionState } from '../probes/utils';
import styles from './index.module.css';

export const ACCESS: Record<Access, { label: string; rank: number }> = {
  none: { label: 'No permission', rank: 0 },
  gesture: { label: 'One click', rank: 1 },
  permission: { label: 'Permission', rank: 2 },
};

type Status = 'collecting' | 'revealed' | 'empty' | 'failed';

const statusOf = (result: ProbeResult | undefined): Status =>
  !result
    ? 'collecting'
    : result.failed
      ? 'failed'
      : shared(result)
        ? 'revealed'
        : 'empty';

export function AccessDot({ access }: { access: Access }) {
  return <i className={styles.dot} data-access={access} aria-hidden="true" />;
}

type ActionProps = {
  probe: Probe;
  onResult: (result: ProbeResult) => void;
};

function PasteAction({ onResult }: ActionProps) {
  const [pasted, setPasted] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image]
  );

  return (
    <div className={styles.action}>
      <textarea
        className={styles.paste}
        rows={2}
        aria-label="Paste anything here"
        placeholder={
          pasted
            ? 'Paste again to see something else'
            : 'Paste anything here: text, a link, a screenshot'
        }
        onPaste={(e) => {
          e.preventDefault();
          const file = e.clipboardData.files[0];
          setImage(
            file?.type.startsWith('image/') ? URL.createObjectURL(file) : null
          );
          setPasted(true);
          onResult(readPaste(e.clipboardData));
        }}
      />
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob, nothing to optimise
        <img className={styles.thumb} src={image} alt="What you pasted" />
      )}
    </div>
  );
}

function HintAction({ probe }: ActionProps) {
  return (
    <div className={styles.action}>
      <p className={styles.hint}>{probe.action}</p>
    </div>
  );
}

function FileAction({ probe, onResult }: ActionProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(false);

  return (
    <div className={styles.action}>
      <input
        ref={input}
        type="file"
        accept={probe.accept}
        hidden
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (!file) return;
          setBusy(true);
          try {
            onResult(await probe.readFile!(file));
            setPicked(true);
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        type="button"
        className={styles.allow}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {picked ? 'Pick another' : probe.action}
      </button>
      {probe.note && <p className={styles.note}>{probe.note}</p>}
    </div>
  );
}

const errorName = (error: unknown) => (error as DOMException | null)?.name;

const refused = (error: unknown) =>
  (error as GeolocationPositionError | null)?.code === 1 ||
  errorName(error) === 'NotAllowedError';

const cancelled = (error: unknown) =>
  errorName(error) === 'AbortError' || errorName(error) === 'NotFoundError';

function RequestAction({ probe, onResult }: ActionProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(
    probe.note ?? 'Your browser will ask first.'
  );

  useEffect(() => {
    if (!probe.permission) return;
    let active = true;
    permissionState(probe.permission).then((state) => {
      if (!active) return;
      if (state === 'granted') setNote('Already allowed for this site.');
      if (state === 'denied')
        setNote('Blocked for this site. Change it in the site settings.');
    });
    return () => {
      active = false;
    };
  }, [probe.permission]);

  return (
    <div className={styles.action}>
      <button
        type="button"
        className={styles.allow}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            onResult(await probe.request!());
          } catch (error) {
            setNote(
              refused(error)
                ? 'You said no, so the page knows nothing more.'
                : cancelled(error)
                  ? 'Nothing picked, so the page knows nothing more.'
                  : 'Your browser couldn’t get this. Check the site settings.'
            );
            setBusy(false);
          }
        }}
      >
        {probe.action}
      </button>
      <p className={styles.note} aria-live="polite">
        {note}
      </p>
    </div>
  );
}

export type CardProps = {
  probe: Probe;
  result: ProbeResult | undefined;
  hidden: boolean;
  hideEmpty: boolean;
  lit: string | null;
  dimmed: boolean;
  cardRef: (node: HTMLElement | null) => void;
  onResult: (id: string, result: ProbeResult) => void;
  onInfo: (probe: Probe) => void;
};

export default function Card({
  probe,
  result,
  hidden,
  hideEmpty,
  lit,
  dimmed,
  cardRef,
  onResult,
  onInfo,
}: CardProps) {
  const [answered, setAnswered] = useState(false);
  const status = statusOf(result);
  const total = values(result).length;
  const count = shared(result);
  const score = `${count} of ${total} shared`;
  const lead = result
    ? result.lead ||
      (result.failed
        ? 'No answer'
        : probe.access === 'none'
          ? 'Kept back'
          : 'Not yet')
    : ' ';
  const report = (next: ProbeResult) => {
    if (probe.request) setAnswered(true);
    onResult(probe.id, next);
  };
  const Action =
    probe.id === 'clipboard'
      ? PasteAction
      : probe.readFile
        ? FileAction
        : answered || result?.final
          ? null
          : probe.request
            ? RequestAction
            : probe.access === 'gesture'
              ? HintAction
              : null;

  return (
    <article
      ref={cardRef}
      className={styles.card}
      data-access={probe.access}
      data-status={status}
      data-lit={lit ?? undefined}
      data-dimmed={dimmed ? '' : undefined}
      hidden={hidden}
      onPointerEnter={(e) => lookAt(e.currentTarget, 1200)}
    >
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{probe.title}</h3>
        {result && (
          <span
            className={styles.ticks}
            role="img"
            aria-label={score}
            title={score}
          >
            {Array.from({ length: total }, (_, i) => (
              <i key={i} data-on={i < count ? '' : undefined} />
            ))}
          </span>
        )}
      </div>
      <p
        className={styles.lead}
        data-missing={
          result && (!result.lead || result.guarded) ? '' : undefined
        }
      >
        {lead}
      </p>
      <dl className={styles.facts}>
        {result?.facts.map(([label, value]) => {
          const missing = !isShared(value);
          if (missing && hideEmpty) return null;
          return (
            <div
              key={label}
              data-missing={missing ? '' : undefined}
              title={missing ? 'Your browser keeps this back' : undefined}
            >
              <dt>{label}</dt>
              <dd>{missing ? '—' : value}</dd>
            </div>
          );
        })}
      </dl>
      {result?.link && (
        <a
          className={styles.link}
          href={result.link.href}
          target="_blank"
          rel="noreferrer"
        >
          {result.link.label}
        </a>
      )}
      {result?.image && (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL made on the page
        <img
          className={styles.thumb}
          src={result.image.src}
          alt={result.image.alt}
        />
      )}
      {Action && <Action probe={probe} onResult={report} />}
      <div className={styles.foot}>
        <span className={styles.accessLabel}>
          <AccessDot access={probe.access} />
          {ACCESS[probe.access].label}
        </span>
        <button
          type="button"
          className={styles.info}
          aria-label={`How it knows: ${probe.title}`}
          onClick={() => onInfo(probe)}
        >
          How it knows
        </button>
      </div>
    </article>
  );
}
