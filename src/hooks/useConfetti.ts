'use client';

import { useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  scalar?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  shapes?: ('square' | 'circle')[];
  gravity?: number;
  drift?: number;
  ticks?: number;
}

export function useConfetti() {
  const animationFrame = useRef<number | null>(null);

  // Standard celebration burst
  const celebrate = useCallback((options?: ConfettiOptions) => {
    const defaults: ConfettiOptions = {
      particleCount: 100,
      spread: 70,
      startVelocity: 30,
      decay: 0.94,
      origin: { x: 0.5, y: 0.6 },
      colors: ['#F59E0B', '#FCD34D', '#FDE68A', '#FBBF24', '#D97706'],
      ticks: 200,
    };

    confetti({
      ...defaults,
      ...options,
    });
  }, []);

  // Massive celebration for big wins (module/course completion)
  const massiveCelebration = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ['#F59E0B', '#FCD34D', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const frame = () => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        if (animationFrame.current) {
          cancelAnimationFrame(animationFrame.current);
          animationFrame.current = null;
        }
        return;
      }

      // Create confetti from both sides
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors,
        startVelocity: randomInRange(40, 60),
        gravity: 1,
        ticks: 300,
      });

      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors,
        startVelocity: randomInRange(40, 60),
        gravity: 1,
        ticks: 300,
      });

      animationFrame.current = requestAnimationFrame(frame);
    };

    frame();
  }, []);

  // Quick success pop (for correct answers, small wins)
  const quickPop = useCallback((origin?: { x: number; y: number }) => {
    confetti({
      particleCount: 40,
      spread: 60,
      startVelocity: 25,
      decay: 0.95,
      scalar: 0.8,
      origin: origin || { x: 0.5, y: 0.5 },
      colors: ['#10B981', '#34D399', '#6EE7B7'],
      ticks: 100,
    });
  }, []);

  // Firework effect
  const firework = useCallback(() => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      ticks: 200,
    };

    function fire(particleRatio: number, opts: ConfettiOptions) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#F59E0B', '#FCD34D'],
    });

    fire(0.2, {
      spread: 60,
      colors: ['#10B981', '#34D399'],
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#3B82F6', '#60A5FA'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#8B5CF6', '#A78BFA'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ['#EC4899', '#F472B6'],
    });
  }, []);

  // Cleanup function
  const reset = useCallback(() => {
    confetti.reset();
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);

  return {
    celebrate,
    massiveCelebration,
    quickPop,
    firework,
    reset,
  };
}

export default useConfetti;
