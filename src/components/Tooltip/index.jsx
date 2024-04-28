import styles from './tooltip.module.css'; // Подключаем файл стилей

const index = ({ text, children }) => {
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
