import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './index.module.css';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
};

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const pointerOnBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current!;
    const handleClose = () => {
      openerRef.current?.focus();
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current!;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      dialog.scrollTop = 0;
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={titleId}
      onPointerDown={(e) => {
        pointerOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pointerOnBackdrop.current && e.target === e.currentTarget) {
          dialogRef.current!.close();
        }
      }}
    >
      <div className={styles.frame}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={() => dialogRef.current!.close()}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
