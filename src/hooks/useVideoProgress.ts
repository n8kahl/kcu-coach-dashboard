'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useDebounce } from './useDebounce';

interface UseVideoProgressOptions {
  lessonId: string;
  videoDuration: number;
  initialProgress?: number;
  minWatchPercent?: number;
  saveInterval?: number; // milliseconds
  onComplete?: () => void;
}

interface VideoProgressState {
  currentTime: number;
  progressPercent: number;
  totalWatchTime: number;
  isCompleted: boolean;
  sessionId: string | null;
}

export function useVideoProgress({
  lessonId,
  videoDuration,
  initialProgress = 0,
  minWatchPercent = 90,
  saveInterval = 10000,
  onComplete,
}: UseVideoProgressOptions) {
  const [state, setState] = useState<VideoProgressState>({
    currentTime: initialProgress,
    progressPercent: videoDuration > 0 ? (initialProgress / videoDuration) * 100 : 0,
    totalWatchTime: 0,
    isCompleted: false,
    sessionId: null,
  });

  const lastSaveTime = useRef(Date.now());
  const watchTimeAccumulator = useRef(0);
  const pauseCount = useRef(0);
  const seekCount = useRef(0);
  const currentSpeed = useRef(1);
  const isPlaying = useRef(false);

  // Debounced save function
  const debouncedSave = useDebounce(async (data: {
    progressSeconds: number;
    watchTimeIncrement: number;
    pauseCount: number;
    seekCount: number;
    playbackSpeed: number;
    completed: boolean;
  }) => {
    try {
      const response = await fetch('/api/learn/progress/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          ...data,
          deviceType: getDeviceType(),
          browser: getBrowser(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.completed && !state.isCompleted) {
          setState(prev => ({ ...prev, isCompleted: true }));
          onComplete?.();
        }
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, 1000);

  // Start a new watch session
  const startSession = useCallback(async (startPosition: number) => {
    try {
      const response = await fetch('/api/learn/progress/watch-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          action: 'start',
          startPositionSeconds: startPosition,
          playbackSpeed: currentSpeed.current,
          deviceType: getDeviceType(),
          browser: getBrowser(),
          userAgent: navigator.userAgent,
        }),
      });

      if (response.ok) {
        const { sessionId } = await response.json();
        setState(prev => ({ ...prev, sessionId }));
        return sessionId;
      }
    } catch (error) {
      console.error('Failed to start session:', error);
    }
    return null;
  }, [lessonId]);

  // End the current watch session
  const endSession = useCallback(async (endPosition: number, wasCompleted: boolean) => {
    if (!state.sessionId) return;

    try {
      await fetch('/api/learn/progress/watch-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          sessionId: state.sessionId,
          action: 'end',
          endPositionSeconds: endPosition,
          playbackSpeed: currentSpeed.current,
          wasCompleted,
        }),
      });

      setState(prev => ({ ...prev, sessionId: null }));
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [lessonId, state.sessionId]);

  // Update time (called frequently during playback)
  const updateTime = useCallback((currentTime: number) => {
    if (!isPlaying.current) return;

    const now = Date.now();
    const elapsed = (now - lastSaveTime.current) / 1000;
    watchTimeAccumulator.current += elapsed;
    lastSaveTime.current = now;

    const progressPercent = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

    setState(prev => ({
      ...prev,
      currentTime,
      progressPercent,
      totalWatchTime: prev.totalWatchTime + elapsed,
    }));

    // Save periodically
    if (watchTimeAccumulator.current >= saveInterval / 1000) {
      const shouldComplete = progressPercent >= minWatchPercent;

      debouncedSave({
        progressSeconds: Math.floor(currentTime),
        watchTimeIncrement: Math.floor(watchTimeAccumulator.current),
        pauseCount: pauseCount.current,
        seekCount: seekCount.current,
        playbackSpeed: currentSpeed.current,
        completed: shouldComplete,
      });

      watchTimeAccumulator.current = 0;
      pauseCount.current = 0;
      seekCount.current = 0;
    }
  }, [videoDuration, saveInterval, minWatchPercent, debouncedSave]);

  // Handle play
  const handlePlay = useCallback(async () => {
    isPlaying.current = true;
    lastSaveTime.current = Date.now();

    if (!state.sessionId) {
      await startSession(state.currentTime);
    }
  }, [state.sessionId, state.currentTime, startSession]);

  // Handle pause
  const handlePause = useCallback(async () => {
    isPlaying.current = false;
    pauseCount.current += 1;

    // Save current progress
    if (watchTimeAccumulator.current > 0) {
      debouncedSave({
        progressSeconds: Math.floor(state.currentTime),
        watchTimeIncrement: Math.floor(watchTimeAccumulator.current),
        pauseCount: pauseCount.current,
        seekCount: seekCount.current,
        playbackSpeed: currentSpeed.current,
        completed: state.progressPercent >= minWatchPercent,
      });
      watchTimeAccumulator.current = 0;
    }
  }, [state.currentTime, state.progressPercent, minWatchPercent, debouncedSave]);

  // Handle seek
  const handleSeek = useCallback((from: number, to: number) => {
    seekCount.current += 1;
    setState(prev => ({ ...prev, currentTime: to }));
  }, []);

  // Handle speed change
  const handleSpeedChange = useCallback((speed: number) => {
    currentSpeed.current = speed;
  }, []);

  // Handle video complete
  const handleComplete = useCallback(async () => {
    isPlaying.current = false;

    // Save final progress
    debouncedSave({
      progressSeconds: Math.floor(videoDuration),
      watchTimeIncrement: Math.floor(watchTimeAccumulator.current),
      pauseCount: pauseCount.current,
      seekCount: seekCount.current,
      playbackSpeed: currentSpeed.current,
      completed: true,
    });

    // End the session
    await endSession(videoDuration, true);

    setState(prev => ({ ...prev, isCompleted: true }));
    onComplete?.();
  }, [videoDuration, debouncedSave, endSession, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Save any remaining progress
      if (watchTimeAccumulator.current > 0 && state.currentTime > 0) {
        // Fire and forget - can't await in cleanup
        fetch('/api/learn/progress/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId,
            progressSeconds: Math.floor(state.currentTime),
            watchTimeIncrement: Math.floor(watchTimeAccumulator.current),
            pauseCount: pauseCount.current,
            seekCount: seekCount.current,
            playbackSpeed: currentSpeed.current,
            completed: false,
            deviceType: getDeviceType(),
            browser: getBrowser(),
          }),
        }).catch(console.error);
      }

      // End session
      if (state.sessionId) {
        fetch('/api/learn/progress/watch-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId,
            sessionId: state.sessionId,
            action: 'end',
            endPositionSeconds: state.currentTime,
            playbackSpeed: currentSpeed.current,
            wasCompleted: false,
          }),
        }).catch(console.error);
      }
    };
  }, [lessonId, state.currentTime, state.sessionId]);

  return {
    ...state,
    updateTime,
    handlePlay,
    handlePause,
    handleSeek,
    handleSpeedChange,
    handleComplete,
  };
}

// Helper functions
function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Unknown';
}
