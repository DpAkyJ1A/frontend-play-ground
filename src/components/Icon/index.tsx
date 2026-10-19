import type { LucideIcon, LucideProps } from 'lucide-react';
import styles from './index.module.css';

export type IconProps = LucideProps & {
  icon: LucideIcon;
  filled?: boolean;
};

// Lucide glyph sized by the surrounding font-size, like an icon font.
// `filled` paints the shape solid (media controls).
export default function Icon({
  icon: Glyph,
  filled = false,
  className,
  ...props
}: IconProps) {
  return (
    <Glyph
      size="1em"
      aria-hidden="true"
      focusable="false"
      fill={filled ? 'currentColor' : 'none'}
      className={className ? `${styles.icon} ${className}` : styles.icon}
      {...props}
    />
  );
}
