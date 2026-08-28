"use client";

import { useEffect, useRef } from "react";

type Dot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
};

const GOLD = { r: 212, g: 175, b: 55 };

function createDot(width: number, height: number): Dot {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    radius: Math.random() * 1.8 + 0.8,
    opacity: Math.random() * 0.45 + 0.15,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: Math.random() * 0.02 + 0.008,
  };
}

export default function GoldDotsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let running = true;
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;

    const dotCount = () =>
      Math.min(90, Math.max(40, Math.floor((width * height) / 18000)));

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      const count = dotCount();
      dots = Array.from({ length: count }, () => createDot(width, height));
    };

    const draw = () => {
      if (!running) return;

      ctx.clearRect(0, 0, width, height);

      for (const dot of dots) {
        if (!prefersReducedMotion) {
          dot.x += dot.vx;
          dot.y += dot.vy;
          dot.pulse += dot.pulseSpeed;

          if (dot.x < -20) dot.x = width + 20;
          if (dot.x > width + 20) dot.x = -20;
          if (dot.y < -20) dot.y = height + 20;
          if (dot.y > height + 20) dot.y = -20;
        }

        const pulse = prefersReducedMotion
          ? 1
          : 0.75 + Math.sin(dot.pulse) * 0.25;
        const alpha = dot.opacity * pulse;

        const gradient = ctx.createRadialGradient(
          dot.x,
          dot.y,
          0,
          dot.x,
          dot.y,
          dot.radius * 4
        );
        gradient.addColorStop(0, `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, ${alpha})`);
        gradient.addColorStop(
          0.5,
          `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, ${alpha * 0.35})`
        );
        gradient.addColorStop(1, `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, 0)`);

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(dot.x, dot.y, dot.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, ${Math.min(alpha + 0.2, 0.9)})`;
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        for (let i = 0; i < dots.length; i++) {
          for (let j = i + 1; j < dots.length; j++) {
            const a = dots[i];
            const b = dots[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 120) {
              const lineAlpha = (1 - dist / 120) * 0.08;
              ctx.beginPath();
              ctx.strokeStyle = `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, ${lineAlpha})`;
              ctx.lineWidth = 0.6;
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      animationId = window.requestAnimationFrame(draw);
    };

    const onVisibilityChange = () => {
      running = !document.hidden;
      if (running) {
        draw();
        return;
      }
      window.cancelAnimationFrame(animationId);
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      running = false;
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
