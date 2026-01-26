'use client';

import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Sound effect types for gamified feedback
 */
type SoundType =
  | 'select'
  | 'correct'
  | 'incorrect'
  | 'complete'
  | 'unlock'
  | 'countdown'
  | 'celebration';

interface UseSoundEffectsOptions {
  /** Enable sound effects */
  enabled?: boolean;
  /** Master volume (0-1) */
  volume?: number;
}

/**
 * Hook for playing sound effects in gamified interactions
 * Currently stubbed - can be connected to actual audio assets later
 */
export function useSoundEffects(options: UseSoundEffectsOptions = {}) {
  const { enabled = true, volume = 0.5 } = options;

  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext lazily (browser requirement)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Simple beep generator for stubbed sounds
  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!enabled || isMuted) return;

    const context = getAudioContext();
    if (!context) return;

    try {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(volume * 0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + duration);
    } catch (error) {
      // Silently fail if audio context is not available
      console.debug('[useSoundEffects] Could not play tone:', error);
    }
  }, [enabled, isMuted, volume, getAudioContext]);

  /**
   * Play a sound effect
   * @param type The type of sound to play
   */
  const play = useCallback((type: SoundType) => {
    if (!enabled || isMuted) return;

    // Stub implementation using synthesized tones
    // Replace with actual audio files when available
    switch (type) {
      case 'select':
        playTone(800, 0.1, 'sine');
        break;
      case 'correct':
        // Rising tone for success
        playTone(523.25, 0.15, 'sine');
        setTimeout(() => playTone(659.25, 0.15, 'sine'), 100);
        setTimeout(() => playTone(783.99, 0.2, 'sine'), 200);
        break;
      case 'incorrect':
        // Low buzz for incorrect
        playTone(200, 0.3, 'triangle');
        break;
      case 'complete':
        // Celebration melody
        playTone(523.25, 0.1);
        setTimeout(() => playTone(659.25, 0.1), 100);
        setTimeout(() => playTone(783.99, 0.1), 200);
        setTimeout(() => playTone(1046.50, 0.3), 300);
        break;
      case 'unlock':
        // Magical unlock sound
        playTone(400, 0.1);
        setTimeout(() => playTone(600, 0.1), 100);
        setTimeout(() => playTone(800, 0.1), 200);
        setTimeout(() => playTone(1200, 0.2), 300);
        break;
      case 'countdown':
        // Single tick for countdown
        playTone(440, 0.08, 'square');
        break;
      case 'celebration':
        // Full celebration
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            playTone(400 + i * 100, 0.1);
          }, i * 80);
        }
        break;
    }
  }, [enabled, isMuted, playTone]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    play,
    isMuted,
    setIsMuted,
    toggleMute: () => setIsMuted(prev => !prev),
  };
}

export type { SoundType };
