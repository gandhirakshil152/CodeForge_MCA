import React, { useEffect, useRef } from 'react';

// Snippets of code characters shown in the rain effect
const CODE_CHARS = '01{}[]<>/=;()_+-*&|#@$%!~^?:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const CodeRainBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = () => (canvas.width = window.innerWidth);
    const H = () => (canvas.height = window.innerHeight);
    W(); H();

    const fontSize = 13;
    let cols = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(cols).fill(1).map(() => Math.random() * -100);

    const resize = () => {
      W(); H();
      cols = Math.floor(canvas.width / fontSize);
      // Keep existing drops, add new ones if needed
      while (drops.length < cols) drops.push(Math.random() * -100);
    };
    window.addEventListener('resize', resize);

    const draw = () => {
      // Faint trail effect
      ctx.fillStyle = 'rgba(2, 2, 16, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < cols; i++) {
        // Skip every other column for sparser look
        if (i % 2 !== 0) continue;

        const char = CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        const y = drops[i] * fontSize;

        // Head character — bright cyan
        const progress = (y / canvas.height);
        const alpha = Math.max(0, 0.6 - progress * 0.4);

        if (drops[i] > 0) {
          // Brighter leading char
          ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.fillText(char, i * fontSize, y);
        }

        // Randomly restart drops
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.4; // slow fall speed
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    // Pause on hidden tab for performance
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameRef.current);
      } else {
        frameRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="code-rain-canvas"
      aria-hidden="true"
      style={{ opacity: 0.035 }}
    />
  );
};

export default CodeRainBackground;
