import { useRef, useState } from 'react';
import styles from './index.module.css';

export type ShareLink = { url: string; hasBoard: boolean };

export type ShareFile = { blob: Blob; name: string };

export type SharePanelProps = {
  getLink: () => Promise<ShareLink>;
  getFile: () => ShareFile;
  getRle: () => string;
  // Resolves to the status line to show.
  onOpenFile: (file: File) => Promise<string>;
};

const ACCEPT = '.json,.rle,.cells,.txt,application/json,text/plain';

const copyText = async (text: string | Promise<string>) => {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': Promise.resolve(text).then(
          (value) => new Blob([value], { type: 'text/plain' })
        ),
      }),
    ]);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(await text);
      return true;
    } catch {
      return false;
    }
  }
};

const formatSize = (text: string) => {
  const kb = new Blob([text]).size / 1024;
  return kb < 1 ? 'under 1 KB' : `${Math.round(kb)} KB`;
};

export default function SharePanel({
  getLink,
  getFile,
  getRle,
  onOpenFile,
}: SharePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<string | null>(null);
  const [rleStatus, setRleStatus] = useState<string | null>(null);

  const copyLink = async () => {
    setLinkStatus('Packing the board…');
    const result = getLink();
    const copied = await copyText(result.then(({ url }) => url));
    const { url, hasBoard } = await result;
    setLink(url);
    if (!copied) {
      setLinkStatus("Couldn't copy. Select the link above and copy it.");
    } else if (hasBoard) {
      setLinkStatus('Copied. The link holds the board and the settings.');
    } else {
      setLinkStatus(
        'Copied, but the board is too big for a link, so it holds only the settings. Download a file to share the board too.'
      );
    }
  };

  const downloadFile = () => {
    const { blob, name } = getFile();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
    setFileStatus(`Saved ${name}.`);
  };

  const openFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setFileStatus(await onOpenFile(file));
  };

  const copyRle = async () => {
    const rle = getRle();
    const copied = await copyText(rle);
    setRleStatus(
      copied
        ? `Copied ${formatSize(rle)} of RLE.`
        : "Couldn't copy. Your browser blocked the clipboard."
    );
  };

  return (
    <div className={styles.share}>
      <section className={styles.section} aria-labelledby="share-link-title">
        <h3 id="share-link-title" className={styles.title}>
          Link
        </h3>
        <p className={styles.note}>
          A link to this board with every setting. The board is packed into the
          link itself, nothing is uploaded.
        </p>
        <button
          className={`${styles.button} ${styles.primary}`}
          onClick={copyLink}
        >
          Copy link
        </button>
        {link && (
          <input
            className={styles.linkField}
            type="text"
            readOnly
            value={link}
            aria-label="Link to this board"
            onFocus={(e) => e.target.select()}
          />
        )}
        {linkStatus && (
          <p className={styles.status} role="status">
            {linkStatus}
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="share-file-title">
        <h3 id="share-file-title" className={styles.title}>
          File
        </h3>
        <p className={styles.note}>
          Saves the board and the settings to a file. Works for a field of any
          size.
        </p>
        <div className={styles.row}>
          <button className={styles.button} onClick={downloadFile}>
            Download file
          </button>
          <button
            className={styles.button}
            onClick={() => fileInputRef.current?.click()}
          >
            Open file
          </button>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept={ACCEPT}
            tabIndex={-1}
            aria-hidden="true"
            onChange={openFile}
          />
        </div>
        <p className={styles.note}>
          You can also drop a file onto the field. RLE and plaintext files open
          as patterns.
        </p>
        {fileStatus && (
          <p className={styles.status} role="status">
            {fileStatus}
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="share-rle-title">
        <h3 id="share-rle-title" className={styles.title}>
          RLE
        </h3>
        <p className={styles.note}>
          Copies the board as text in the format LifeWiki and Golly use, with
          the field size and edges in the header.
        </p>
        <button className={styles.button} onClick={copyRle}>
          Copy RLE
        </button>
        {rleStatus && (
          <p className={styles.status} role="status">
            {rleStatus}
          </p>
        )}
      </section>
    </div>
  );
}
