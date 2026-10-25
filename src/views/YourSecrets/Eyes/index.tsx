'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { AXIS, FIXED, IRIS, PINWHEEL, PUPIL, VIEW, shapes } from './geometry';
import {
  isSharingan,
  register,
  setSharingan,
  subscribe,
  type EyeNodes,
} from './store';
import styles from './index.module.css';

export { lookAt } from './store';

export const useSharingan = () => {
  const on = useSyncExternalStore(subscribe, isSharingan, () => false);
  return [on, setSharingan] as const;
};

export type EyesProps = {
  className?: string;
};

export default function Eyes({ className }: EyesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^\w-]/g, '');

  useEffect(() => {
    const svg = svgRef.current!;
    const eyes = [...svg.querySelectorAll<SVGGElement>('[data-eye]')].map(
      (group): EyeNodes => {
        const part = <T extends Element>(name: string) =>
          group.querySelector<T>(`[data-part="${name}"]`)!;
        return {
          mirror: group.dataset.eye === 'right',
          clipShape: part('clip'),
          white: part('white'),
          sclera: part('sclera'),
          shade: part('shade'),
          lid: part('lid'),
          iris: part('iris'),
          redIris: part('red'),
          pinwheel: part('pinwheel'),
          pupil: part('pupil'),
        };
      }
    );
    return register(svg, eyes);
  }, []);

  const { opening, lid, shade } = shapes(1);
  const ellipse = { rx: IRIS.rx, ry: IRIS.ry };

  return (
    <svg
      ref={svgRef}
      viewBox={VIEW}
      className={className ? `${styles.eyes} ${className}` : styles.eyes}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`dark-${uid}`} cx="50%" cy="45%" r="55%">
          <stop
            offset="45%"
            style={{ stopColor: 'var(--iris-light, #2c2f36)' }}
          />
          <stop
            offset="100%"
            style={{ stopColor: 'var(--iris-dark, #060708)' }}
          />
        </radialGradient>
        <radialGradient id={`red-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff0000" />
          <stop offset="50%" stopColor="#d90506" />
          <stop offset="70%" stopColor="#a50c0d" />
          <stop offset="85%" stopColor="#6d1415" />
          <stop offset="100%" stopColor="#231f20" />
        </radialGradient>
        <linearGradient id={`hood-${uid}`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" stopColor="#000" stopOpacity={0.6} />
          <stop offset="32%" stopColor="#000" stopOpacity={0} />
        </linearGradient>
        <clipPath id={`iris-${uid}`}>
          <ellipse {...ellipse} />
        </clipPath>
      </defs>
      {(['left', 'right'] as const).map((side) => {
        const mirror = side === 'right';
        const clipId = `open-${uid}-${side}`;
        return (
          <g
            key={side}
            data-eye={side}
            transform={
              mirror ? `translate(${AXIS * 2}, 0) scale(-1, 1)` : undefined
            }
          >
            <clipPath id={clipId}>
              <path data-part="clip" d={opening} />
            </clipPath>
            <g data-part="white" opacity="1.00">
              <path data-part="sclera" className={styles.sclera} d={opening} />
              <g clipPath={`url(#${clipId})`}>
                <path data-part="shade" className={styles.shade} d={shade} />
                <g
                  data-part="iris"
                  transform={`translate(${IRIS.x.toFixed(1)}, ${IRIS.y.toFixed(1)})`}
                >
                  <ellipse {...ellipse} fill={`url(#dark-${uid})`} />
                  <g data-part="red" opacity="0.000">
                    <ellipse {...ellipse} fill={`url(#red-${uid})`} />
                    <g clipPath={`url(#iris-${uid})`}>
                      <path
                        data-part="pinwheel"
                        d={PINWHEEL}
                        fill="#000"
                        transform="rotate(0.0)"
                      />
                    </g>
                    <circle
                      cy={-3.5}
                      r={35.5}
                      fill="#e00000"
                      stroke="#000"
                      strokeWidth={20}
                    />
                  </g>
                  <circle
                    data-part="pupil"
                    className={styles.pupil}
                    r={PUPIL.toFixed(1)}
                  />
                  <ellipse
                    rx={IRIS.rx - 10}
                    ry={IRIS.ry - 10}
                    fill="none"
                    stroke="#000"
                    strokeWidth={20}
                  />
                  <ellipse {...ellipse} fill={`url(#hood-${uid})`} />
                  <ellipse
                    className={styles.glint}
                    cx={-140.6}
                    cy={-118.2}
                    rx={65.5}
                    ry={13.3}
                  />
                </g>
              </g>
            </g>
            <path className={styles.lower} d={FIXED.lower} />
            <path
              data-part="lid"
              className={styles.lid}
              d={lid}
              strokeWidth="0.0"
            />
            <path className={styles.brow} d={FIXED.brow} />
          </g>
        );
      })}
    </svg>
  );
}
