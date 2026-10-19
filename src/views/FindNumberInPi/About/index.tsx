import { useEffect, useRef } from 'react';
import Icon from '@/components/Icon';
import { ArrowRightIcon, ExternalLinkIcon, XIcon } from 'lucide-react';
import styles from './index.module.css';

const SAMPLE_QUERY = '31121999';
const SAMPLE_PLACE = '498,894,645';
const SAMPLE_ROWS = [
  '343522582150924695633380',
  '261131121999074899434730',
  '308596158340626218374515',
];

const STATS = [
  { value: '5 billion', label: 'decimal places searched' },
  { value: '100 trillion', label: 'digits you can scroll through' },
  { value: '~50×', label: 'how often a typical DDMMYYYY date appears' },
];

const CREDITS = [
  {
    mark: 'JK',
    name: 'PiSearch',
    author: 'by Josh Keegan',
    text: 'A suffix-array search engine over the first five billion digits of π that answers in milliseconds. Every deep search and every occurrence count on this page comes from his API.',
    href: 'https://pisearch.joshkeegan.co.uk/',
    label: 'pisearch.joshkeegan.co.uk',
  },
  {
    mark: 'π',
    name: 'pi.delivery',
    author: 'by Emma Haruka Iwao & Google Cloud',
    text: '100 trillion digits of π — a world record when they were computed in 2022 — served through a free public API. Every digit you see past five million comes from here.',
    href: 'https://pi.delivery/',
    label: 'pi.delivery',
  },
];

const renderSampleRow = (row: string) => {
  const from = row.indexOf(SAMPLE_QUERY);
  if (from === -1) return row;
  const to = from + SAMPLE_QUERY.length;
  return (
    <>
      {row.slice(0, from)}
      <mark>{row.slice(from, to)}</mark>
      {row.slice(to)}
    </>
  );
};

type Props = {
  open: boolean;
  /** Gets the dialog's `returnValue`: `'start'` from the footer button. */
  onClose: (returnValue: string) => void;
};

export default function About({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pointerOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const handleClose = () => onClose(dialog.returnValue);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current!;
    if (open && !dialog.open) {
      dialog.returnValue = '';
      dialog.showModal();
      bodyRef.current!.scrollTop = 0;
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="about-title"
      onPointerDown={(e) => {
        pointerOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pointerOnBackdrop.current && e.target === e.currentTarget) {
          dialogRef.current?.close();
        }
      }}
    >
      <div className={styles.frame}>
        <header className={styles.head}>
          <div>
            <p className={styles.eyebrow}>About</p>
            <h2 id="about-title">A place, not just a position</h2>
          </div>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <Icon icon={XIcon} aria-hidden="true" />
          </button>
        </header>

        <div ref={bodyRef} className={styles.body}>
          <p className={styles.lead}>
            Most π search engines answer with a single number. Type{' '}
            <span className={styles.mono}>{SAMPLE_QUERY}</span> and you learn it
            first appears at decimal place{' '}
            <span className={styles.mono}>{SAMPLE_PLACE}</span> — accurate, and
            instantly forgettable. A nine-digit index tells you nothing about
            what it’s like to be there.
          </p>

          <div className={styles.compare}>
            <figure className={styles.panel}>
              <figcaption>Elsewhere</figcaption>
              <p className={styles.index}>{SAMPLE_PLACE}</p>
              <p className={styles.panelNote}>a position</p>
            </figure>
            <figure className={`${styles.panel} ${styles.panel__here}`}>
              <figcaption>Here</figcaption>
              <div className={styles.sample} aria-hidden="true">
                {SAMPLE_ROWS.map((row) => (
                  <span key={row}>{renderSampleRow(row)}</span>
                ))}
              </div>
              <p className={styles.panelNote}>a place</p>
            </figure>
          </div>

          <section className={styles.section}>
            <h3>So this page takes you there</h3>
            <p>
              Your number lights up inside the actual digits of π, with
              everything that comes before and after it laid out around it.
              Scroll up to see what led to it, scroll down to see what follows,
              step to the next time it shows up — or just keep going for as long
              as you like. The index stops being a statistic and becomes
              somewhere you can look around.
            </p>
            <dl className={styles.stats}>
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={styles.section}>
            <h3>How it works</h3>
            <p>
              Only the rows on your screen exist in the page, so it scrolls as
              smoothly at the hundred-trillionth digit as at the first. The
              first five million digits ship with the page for instant answers.
              Deeper searches go to PiSearch, and every digit past five million
              streams in from pi.delivery, a thousand at a time, as you scroll.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Made possible by</h3>
            <p>
              This page stands on two free, open APIs. Thank you, Josh and Emma
              — none of it would work without you.
            </p>
            <ul className={styles.credits}>
              {CREDITS.map((credit) => (
                <li key={credit.name}>
                  <a
                    className={styles.credit}
                    href={credit.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className={styles.creditHead}>
                      <span className={styles.creditMark} aria-hidden="true">
                        {credit.mark}
                      </span>
                      <span>
                        <span className={styles.creditName}>{credit.name}</span>
                        <span className={styles.creditAuthor}>
                          {credit.author}
                        </span>
                      </span>
                    </span>
                    <span className={styles.creditText}>{credit.text}</span>
                    <span className={styles.creditLink}>
                      {credit.label}
                      <Icon icon={ExternalLinkIcon} aria-hidden="true" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className={styles.foot}>
          <button
            className={styles.start}
            onClick={() => dialogRef.current?.close('start')}
          >
            Find my number
            <Icon icon={ArrowRightIcon} aria-hidden="true" />
          </button>
        </footer>
      </div>
    </dialog>
  );
}
