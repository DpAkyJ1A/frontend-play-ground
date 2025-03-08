import { useEffect, useId, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { close } from 'ionicons/icons';
import styles from './index.module.css';

export default function Dialog({
  open,
  onClose,
  title,
  description,
  className = '',
  children,
}) {
  const dialogRef = useRef(null);
  const pointerOnBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
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
          dialogRef.current.close();
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
            onClick={() => dialogRef.current.close()}
          >
            <IonIcon icon={close} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
