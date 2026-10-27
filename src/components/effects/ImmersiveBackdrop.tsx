import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  red: boolean;
};

/**
 * Fixed, non-interactive atmosphere: aurora fields, technical grid,
 * film grain, and a lightweight constellation canvas. Motion is parked
 * entirely for users who prefer reduced motion.
 */
export function ImmersiveBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let particles: Particle[] = [];
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const buildField = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(24, Math.min(78, Math.round((width * height) / 26000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        radius: Math.random() * 1.5 + 0.6,
        red: Math.random() < 0.14,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const offsetX = pointer.x * 22;
      const offsetY = pointer.y * 16;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 138) {
            const alpha = (1 - distance / 138) * 0.16;
            context.strokeStyle = p.red || q.red
              ? `rgba(255, 82, 111, ${alpha})`
              : `rgba(94, 161, 255, ${alpha})`;
            context.lineWidth = 0.7;
            context.beginPath();
            context.moveTo(p.x + offsetX, p.y + offsetY);
            context.lineTo(q.x + offsetX, q.y + offsetY);
            context.stroke();
          }
        }
      }

      particles.forEach((p) => {
        context.beginPath();
        context.arc(p.x + offsetX, p.y + offsetY, p.radius, 0, Math.PI * 2);
        context.fillStyle = p.red ? 'rgba(255, 82, 111, 0.55)' : 'rgba(140, 186, 255, 0.5)';
        context.fill();
      });
    };

    const tick = () => {
      pointer.x += (pointer.targetX - pointer.x) * 0.04;
      pointer.y += (pointer.targetY - pointer.y) * 0.04;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      });

      draw();
      frame = window.requestAnimationFrame(tick);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointer.targetX = event.clientX / window.innerWidth - 0.5;
      pointer.targetY = event.clientY / window.innerHeight - 0.5;
    };

    const handleResize = () => {
      buildField();
      if (reduceMotion) draw();
    };

    buildField();
    draw();

    if (!reduceMotion) {
      frame = window.requestAnimationFrame(tick);
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#080A0F]" />

      {/* Aurora fields */}
      <div className="animate-drift absolute -left-[12%] -top-[22%] h-[75vh] w-[70vw] rounded-full bg-[#397BFF]/20 blur-[150px]" />
      <div className="animate-drift-slow absolute -right-[16%] top-[26%] h-[60vh] w-[52vw] rounded-full bg-[#FF294F]/10 blur-[160px]" />
      <div className="absolute bottom-[-20%] left-[30%] h-[45vh] w-[45vw] rounded-full bg-[#39D98A]/[0.05] blur-[150px]" />

      {/* Technical grid */}
      <div className="grid-lines absolute inset-0 opacity-60" />

      {/* Constellation */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />

      {/* Depth + grain */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,10,15,0.5)_68%,#080A0F_100%)]" />
      <div className="grain absolute inset-0 opacity-[0.05]" />
    </div>
  );
}
