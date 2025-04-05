import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { chevronDown } from 'ionicons/icons';
import Dialog from '@/components/Dialog';
import {
  DITHERS,
  isBrighter,
  loadImage,
  readTones,
  suggestSettings,
  toCells,
  toPixel,
} from './image';
import controls from '../index.module.css';
import styles from './index.module.css';

const FRAMINGS = [
  ['fit', 'Whole image'],
  ['fill', 'Fill the field'],
];

export default function ImageDialog({
  open,
  file,
  cols,
  rows,
  aliveColor,
  deadColor,
  onFile,
  onApply,
  onClose,
}) {
  const id = useId();
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [framing, setFraming] = useState('fit');
  const [dither, setDither] = useState('floyd-steinberg');
  const [threshold, setThreshold] = useState(0.5);
  const [invert, setInvert] = useState(false);
  const [isDropping, setIsDropping] = useState(false);

  const brightIsAlive = isBrighter(aliveColor, deadColor);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    loadImage(file)
      .then((element) => {
        if (cancelled) return;
        const suggested = suggestSettings(element, brightIsAlive);
        setImage({ element, name: file.name });
        setDither(suggested.dither);
        setInvert(suggested.invert);
        setThreshold(0.5);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setImage(null);
        setError(
          `${file.name} isn't an image this browser can open. Try a PNG, JPEG, WebP, GIF or SVG.`
        );
      });
    return () => {
      cancelled = true;
    };
  }, [file, brightIsAlive]);

  useEffect(() => {
    if (!open) {
      setImage(null);
      setError(null);
    }
  }, [open]);

  const tones = useMemo(
    () => image && readTones(image.element, cols, rows, framing),
    [image, cols, rows, framing]
  );

  const cells = useMemo(
    () =>
      tones &&
      toCells(tones, cols, rows, {
        threshold,
        dither,
        bright: brightIsAlive !== invert,
      }),
    [tones, cols, rows, threshold, dither, brightIsAlive, invert]
  );

  const alive = useMemo(() => {
    let count = 0;
    for (let i = 0; cells && i < cells.length; i++) count += cells[i];
    return count;
  }, [cells]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!cells || !canvas) return;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    const data = ctx.createImageData(cols, rows);
    const pixels = new Uint32Array(data.data.buffer);
    const on = toPixel(aliveColor);
    const off = toPixel(deadColor);
    for (let i = 0; i < cells.length; i++) pixels[i] = cells[i] ? on : off;
    ctx.putImageData(data, 0, 0);
    canvas.style.imageRendering =
      canvas.clientWidth < cols ? 'auto' : 'pixelated';
  }, [cells, cols, rows, aliveColor, deadColor]);

  const pickFile = (e) => {
    const picked = e.target.files[0];
    e.target.value = '';
    if (picked) onFile(picked);
  };

  const isFileDrag = (e) => [...e.dataTransfer.types].includes('Files');

  const handleDragOver = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDropping(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDropping(false);
  };

  const handleDrop = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDropping(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className={styles.dialog}
      title="Image to cells"
      description="Every pixel becomes a live or a dead cell on the field"
    >
      <div
        className={styles.body}
        data-dropping={isDropping ? '' : undefined}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.preview}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : (
            image && (
              <canvas
                ref={canvasRef}
                className={styles.canvas}
                role="img"
                aria-label={`${image.name} as cells, ${alive} alive`}
                style={{ '--ratio': cols / rows }}
              />
            )
          )}
        </div>

        <div className={styles.controls}>
          <div className={controls.fieldGroup}>
            <span id={`${id}-framing`}>Framing</span>
            <div
              className={controls.segmented}
              role="radiogroup"
              aria-labelledby={`${id}-framing`}
            >
              {FRAMINGS.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`${id}-framing`}
                    value={value}
                    checked={framing === value}
                    onChange={() => setFraming(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className={controls.fieldGroup}>
            <span>Dithering</span>
            <span className={controls.select}>
              <select
                value={dither}
                onChange={(e) => setDither(e.target.value)}
              >
                {DITHERS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <IonIcon icon={chevronDown} aria-hidden="true" />
            </span>
          </label>
          <p className={styles.hint}>
            Dithering keeps the shading of photos. Turn it off for logos and
            line art.
          </p>

          <label className={controls.rangeField}>
            <span className={controls.rangeHead}>
              <span>Threshold</span>
              <output>{Math.round(threshold * 100)}%</output>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              style={{ '--fill': `${threshold * 100}%` }}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>

          <label className={controls.switchField}>
            <span>Invert</span>
            <input
              type="checkbox"
              role="switch"
              checked={invert}
              onChange={(e) => setInvert(e.target.checked)}
            />
          </label>

          {cells && (
            <p className={styles.hint}>
              {alive.toLocaleString('en-US')} live cells on a {cols}×{rows}{' '}
              field. A bigger field shows more detail.
            </p>
          )}
        </div>

        {isDropping && (
          <div className={styles.dropZone}>Drop an image to use it</div>
        )}
      </div>

      <footer className={styles.foot}>
        <button
          className={styles.button}
          onClick={() => inputRef.current.click()}
        >
          Change image
        </button>
        <input
          ref={inputRef}
          className={styles.fileInput}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={pickFile}
        />
        <button
          className={`${styles.button} ${styles.cancel}`}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className={`${styles.button} ${styles.primary}`}
          disabled={!cells}
          onClick={() => onApply(cells, image.name)}
        >
          Replace board
        </button>
      </footer>
    </Dialog>
  );
}
