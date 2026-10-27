import React, { useRef } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Maximum rotation in degrees. */
  max?: number;
  /** Disable below this viewport width (px). */
  minWidth?: number;
}

/**
 * Pointer-driven 3D tilt with a light glare. Transforms are written
 * directly to the node so pointer movement never re-renders React.
 */
export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  max = 7,
  minWidth = 1024,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  const canTilt = () =>
    typeof window !== 'undefined' &&
    window.innerWidth >= minWidth &&
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node || !canTilt()) return;
    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    const rotateX = -py * max;
    const rotateY = px * max;
    node.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(
      2
    )}deg) scale(1.01)`;
    node.style.setProperty('--glare-x', `${((px + 0.5) * 100).toFixed(2)}%`);
    node.style.setProperty('--glare-y', `${((py + 0.5) * 100).toFixed(2)}%`);
  };

  const handleLeave = () => {
    const node = ref.current;
    if (!node) return;
    node.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
  };

  return (
    <div className="tilt-scene">
      <div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className={`tilt-card relative ${className}`}
      >
        {children}
        <span aria-hidden="true" className="tilt-glare" />
      </div>
    </div>
  );
};
