import type { ReactNode } from 'react';
import styles from './tooltip.module.css'; // Подключаем файл стилей

export type TooltipProps = {
  text: ReactNode;
  children: ReactNode;
};

const index = ({ text, children }: TooltipProps) => {
  return (
    <div className={styles.tooltipContainer}>
      <div className={styles.tooltip}>
        {children}
        <span className={styles.tooltipText}>{text}</span>
      </div>
    </div>
  );
};

export default index;
