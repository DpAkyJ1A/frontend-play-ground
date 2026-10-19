import { useEffect, useId, useRef, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import { XIcon } from 'lucide-react';
import styles from './index.module.css';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export default function Dialog({
  open,
  onClose,
  title,
  description,
  className = '',
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerOnBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current!;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${className}`}
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
        <header className={styles.head}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={() => dialogRef.current!.close()}
          >
            <Icon icon={XIcon} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
