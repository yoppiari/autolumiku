/**
 * Audio Visualizer
 * Epic 3: Story 3.2 - Visual feedback for voice input
 */

'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
}

export function AudioVisualizer({ isActive }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple animated bars to simulate audio visualization
    // In production, you'd connect this to actual audio data
    const bars = 20;
    const barWidth = canvas.width / bars;

    let animationTime = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < bars; i++) {
        // Create wave effect
        const height = Math.abs(
          Math.sin(animationTime + i * 0.5) * 30 +
          Math.sin(animationTime * 2 + i * 0.3) * 15
        );

        const x = i * barWidth;
        const y = (canvas.height - height) / 2;

        // Gradient color
        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, 'rgb(59, 130, 246)'); // blue-500
        gradient.addColorStop(1, 'rgb(147, 51, 234)'); // purple-600

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 2, y, barWidth - 4, height);
      }

      animationTime += 0.1;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="w-full max-w-md">
      <canvas
        ref={canvasRef}
        width={400}
        height={60}
        className="w-full h-auto rounded-md"
      />
    </div>
  );
}
