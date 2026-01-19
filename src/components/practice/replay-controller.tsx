'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  FastForward,
  Rewind,
  Target,
  Flag,
  Eye,
  Clock,
} from 'lucide-react';

interface ReplayControllerProps {
  totalCandles: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  decisionPointIndex?: number;
  outcomeIndex?: number;
  onShowOutcome?: () => void;
  markers?: ReplayMarker[];
  className?: string;
}

export interface ReplayMarker {
  index: number;
  type: 'decision' | 'entry' | 'exit' | 'level' | 'note';
  label: string;
  color?: string;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8];

export function ReplayController({
  totalCandles,
  currentIndex,
  onIndexChange,
  isPlaying,
  onPlayPause,
  playbackSpeed,
  onSpeedChange,
  decisionPointIndex,
  outcomeIndex,
  onShowOutcome,
  markers = [],
  className,
}: ReplayControllerProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate progress percentage
  const progress = totalCandles > 1 ? (currentIndex / (totalCandles - 1)) * 100 : 0;

  // Calculate marker positions
  const getMarkerPosition = (index: number) => {
    return totalCandles > 1 ? (index / (totalCandles - 1)) * 100 : 0;
  };

  // Handle slider click/drag
  const handleSliderInteraction = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const newIndex = Math.round((percentage / 100) * (totalCandles - 1));
      onIndexChange(newIndex);
    },
    [totalCandles, onIndexChange]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      handleSliderInteraction(e.clientX);
    },
    [handleSliderInteraction]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleSliderInteraction(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleSliderInteraction]);

  // Step controls
  const handleStepBack = useCallback(() => {
    onIndexChange(Math.max(0, currentIndex - 1));
  }, [currentIndex, onIndexChange]);

  const handleStepForward = useCallback(() => {
    onIndexChange(Math.min(totalCandles - 1, currentIndex + 1));
  }, [currentIndex, totalCandles, onIndexChange]);

  const handleJumpBack = useCallback(() => {
    onIndexChange(Math.max(0, currentIndex - 10));
  }, [currentIndex, onIndexChange]);

  const handleJumpForward = useCallback(() => {
    onIndexChange(Math.min(totalCandles - 1, currentIndex + 10));
  }, [currentIndex, totalCandles, onIndexChange]);

  const handleReset = useCallback(() => {
    onIndexChange(0);
  }, [onIndexChange]);

  const handleJumpToDecision = useCallback(() => {
    if (decisionPointIndex !== undefined) {
      onIndexChange(decisionPointIndex);
    }
  }, [decisionPointIndex, onIndexChange]);

  const handleJumpToOutcome = useCallback(() => {
    if (outcomeIndex !== undefined) {
      onIndexChange(outcomeIndex);
      onShowOutcome?.();
    }
  }, [outcomeIndex, onIndexChange, onShowOutcome]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            handleJumpBack();
          } else {
            handleStepBack();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            handleJumpForward();
          } else {
            handleStepForward();
          }
          break;
        case 'Home':
          e.preventDefault();
          handleReset();
          break;
        case 'End':
          e.preventDefault();
          onIndexChange(totalCandles - 1);
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          handleJumpToDecision();
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          handleJumpToOutcome();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onPlayPause,
    handleStepBack,
    handleStepForward,
    handleJumpBack,
    handleJumpForward,
    handleReset,
    handleJumpToDecision,
    handleJumpToOutcome,
    onIndexChange,
    totalCandles,
  ]);

  return (
    <div
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-3',
        className
      )}
    >
      {/* Timeline Slider */}
      <div className="mb-3">
        <div
          ref={sliderRef}
          className="relative h-8 bg-[var(--bg-tertiary)] rounded-lg cursor-pointer"
          onMouseDown={handleMouseDown}
        >
          {/* Progress Fill */}
          <div
            className="absolute inset-y-0 left-0 bg-[var(--accent-primary)]/30 rounded-l-lg transition-all"
            style={{ width: `${progress}%` }}
          />

          {/* Markers */}
          {markers.map((marker, idx) => (
            <div
              key={idx}
              className="absolute top-1 bottom-1 w-0.5 rounded"
              style={{
                left: `${getMarkerPosition(marker.index)}%`,
                backgroundColor: marker.color || 'var(--accent-primary)',
              }}
              title={marker.label}
            />
          ))}

          {/* Decision Point Marker */}
          {decisionPointIndex !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-500"
              style={{ left: `${getMarkerPosition(decisionPointIndex)}%` }}
              title="Decision Point"
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                <Target className="w-2 h-2 text-white" />
              </div>
            </div>
          )}

          {/* Outcome Marker */}
          {outcomeIndex !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-green-500"
              style={{ left: `${getMarkerPosition(outcomeIndex)}%` }}
              title="Outcome"
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                <Flag className="w-2 h-2 text-white" />
              </div>
            </div>
          )}

          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[var(--accent-primary)] rounded-full border-2 border-white shadow-lg transition-all"
            style={{ left: `calc(${progress}% - 8px)` }}
          />
        </div>

        {/* Time Labels */}
        <div className="flex justify-between mt-1 text-xs text-[var(--text-tertiary)]">
          <span>Candle {currentIndex + 1}</span>
          <span>{totalCandles} total</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Main Controls */}
        <div className="flex items-center gap-1">
          {/* Reset */}
          <button
            onClick={handleReset}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Reset (Home)"
          >
            <RotateCcw className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>

          {/* Jump Back */}
          <button
            onClick={handleJumpBack}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Back 10 (Shift+Left)"
          >
            <Rewind className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>

          {/* Step Back */}
          <button
            onClick={handleStepBack}
            disabled={currentIndex <= 0}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors disabled:opacity-50"
            title="Step Back (Left)"
          >
            <SkipBack className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="p-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 rounded-full transition-colors"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Step Forward */}
          <button
            onClick={handleStepForward}
            disabled={currentIndex >= totalCandles - 1}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors disabled:opacity-50"
            title="Step Forward (Right)"
          >
            <SkipForward className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>

          {/* Jump Forward */}
          <button
            onClick={handleJumpForward}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Forward 10 (Shift+Right)"
          >
            <FastForward className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  playbackSpeed === speed
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Jump Buttons */}
        <div className="flex items-center gap-2">
          {decisionPointIndex !== undefined && (
            <button
              onClick={handleJumpToDecision}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                currentIndex === decisionPointIndex
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-amber-500/10 hover:text-amber-400'
              )}
              title="Jump to Decision (D)"
            >
              <Target className="w-3.5 h-3.5" />
              Decision
            </button>
          )}

          {outcomeIndex !== undefined && (
            <button
              onClick={handleJumpToOutcome}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                currentIndex === outcomeIndex
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-green-500/10 hover:text-green-400'
              )}
              title="Show Outcome (O)"
            >
              <Eye className="w-3.5 h-3.5" />
              Outcome
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="mt-3 pt-3 border-t border-[var(--border-primary)] flex items-center justify-center gap-4 text-[10px] text-[var(--text-tertiary)]">
        <span><kbd className="px-1 bg-[var(--bg-tertiary)] rounded">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1 bg-[var(--bg-tertiary)] rounded">←/→</kbd> Step</span>
        <span><kbd className="px-1 bg-[var(--bg-tertiary)] rounded">Shift+←/→</kbd> Jump 10</span>
        <span><kbd className="px-1 bg-[var(--bg-tertiary)] rounded">D</kbd> Decision</span>
        <span><kbd className="px-1 bg-[var(--bg-tertiary)] rounded">O</kbd> Outcome</span>
      </div>
    </div>
  );
}

// Hook to manage replay state
export function useReplayState(totalCandles: number, initialIndex: number = 0) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-play effect
  useEffect(() => {
    if (isPlaying) {
      const interval = 1000 / playbackSpeed;
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= totalCandles - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, totalCandles, playbackSpeed]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleIndexChange = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  const reset = useCallback(() => {
    setCurrentIndex(initialIndex);
    setIsPlaying(false);
  }, [initialIndex]);

  return {
    currentIndex,
    isPlaying,
    playbackSpeed,
    setCurrentIndex: handleIndexChange,
    setIsPlaying,
    setPlaybackSpeed: handleSpeedChange,
    togglePlayPause: handlePlayPause,
    reset,
  };
}

export default ReplayController;
