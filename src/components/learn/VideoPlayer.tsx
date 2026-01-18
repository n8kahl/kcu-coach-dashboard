'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  SkipBack,
  SkipForward,
  Loader2,
} from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (from: number, to: number) => void;
  onSpeedChange?: (speed: number) => void;
  minWatchPercent?: number;
  allowSkip?: boolean;
  className?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function VideoPlayer({
  src,
  poster,
  title,
  initialTime = 0,
  onTimeUpdate,
  onComplete,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  minWatchPercent = 90,
  allowSkip = true,
  className = '',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [maxWatchedTime, setMaxWatchedTime] = useState(initialTime);

  const hideControlsTimeout = useRef<NodeJS.Timeout>();
  const lastReportedTime = useRef(0);

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (initialTime > 0) {
        video.currentTime = initialTime;
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      // Track max watched time for compliance
      if (time > maxWatchedTime) {
        setMaxWatchedTime(time);
      }

      // Report time update every 5 seconds
      if (Math.abs(time - lastReportedTime.current) >= 5) {
        lastReportedTime.current = time;
        onTimeUpdate?.(time, video.duration);
      }

      // Check for completion
      const watchPercent = (maxWatchedTime / video.duration) * 100;
      if (watchPercent >= minWatchPercent && !video.ended) {
        // User has watched enough to count as complete
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onComplete?.();
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100);
      }
    };

    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [initialTime, minWatchPercent, maxWatchedTime, onTimeUpdate, onComplete]);

  // Hide controls after inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
      if (isPlaying) {
        hideControlsTimeout.current = setTimeout(() => {
          setShowControls(false);
          setShowSettings(false);
        }, 3000);
      }
    };

    const container = containerRef.current;
    container?.addEventListener('mousemove', handleMouseMove);

    return () => {
      container?.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync volume with video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Sync playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
      onPlay?.();
    } else {
      video.pause();
      setIsPlaying(false);
      onPause?.();
    }
  }, [onPlay, onPause]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const from = video.currentTime;
    let to = from + seconds;

    // Compliance: prevent skipping ahead if not allowed
    if (!allowSkip && to > maxWatchedTime + 5) {
      to = maxWatchedTime + 5;
    }

    to = Math.max(0, Math.min(duration, to));
    video.currentTime = to;
    onSeek?.(from, to);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const from = video.currentTime;
    let to = clickPosition * duration;

    // Compliance: prevent seeking ahead if not allowed
    if (!allowSkip && to > maxWatchedTime + 5) {
      to = maxWatchedTime + 5;
    }

    video.currentTime = to;
    onSeek?.(from, to);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSettings(false);
    onSpeedChange?.(speed);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const maxWatchedPercent = duration > 0 ? (maxWatchedTime / duration) * 100 : 0;

  return (
    <Card className={`overflow-hidden bg-black ${className}`}>
      <div
        ref={containerRef}
        className="relative aspect-video cursor-pointer"
        onClick={togglePlay}
        tabIndex={0}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full"
          playsInline
        />

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        )}

        {/* Play button overlay when paused */}
        {!isPlaying && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-20 h-20 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
              <Play className="w-10 h-10 text-black ml-1" />
            </div>
          </motion.div>
        )}

        {/* Controls overlay */}
        <motion.div
          initial={false}
          animate={{ opacity: showControls ? 1 : 0 }}
          className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent"
          onClick={e => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div className="px-4 mb-2">
            <div
              ref={progressRef}
              className="relative h-1 bg-white/30 rounded-full cursor-pointer group"
              onClick={handleProgressClick}
            >
              {/* Buffered */}
              <div
                className="absolute h-full bg-white/30 rounded-full"
                style={{ width: `${buffered}%` }}
              />

              {/* Max watched (compliance) */}
              {!allowSkip && (
                <div
                  className="absolute h-full bg-white/20 rounded-full"
                  style={{ width: `${maxWatchedPercent}%` }}
                />
              )}

              {/* Current progress */}
              <div
                className="absolute h-full bg-[var(--accent-primary)] rounded-full"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Scrubber */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--accent-primary)] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progressPercent}% - 6px)` }}
              />
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2 px-4 pb-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2 text-white hover:text-[var(--accent-primary)] transition-colors"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>

            {/* Skip buttons */}
            <button
              onClick={() => skip(-10)}
              className="p-2 text-white hover:text-[var(--accent-primary)] transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={() => skip(10)}
              className="p-2 text-white hover:text-[var(--accent-primary)] transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="p-2 text-white hover:text-[var(--accent-primary)] transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {/* Time display */}
            <span className="text-white text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Title */}
            {title && (
              <span className="text-white text-sm truncate max-w-[200px]">
                {title}
              </span>
            )}

            {/* Settings (speed) */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-white hover:text-[var(--accent-primary)] transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg overflow-hidden">
                  <p className="px-3 py-2 text-xs text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                    Playback Speed
                  </p>
                  {PLAYBACK_SPEEDS.map(speed => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`
                        w-full px-4 py-2 text-left text-sm transition-colors
                        ${playbackSpeed === speed
                          ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                        }
                      `}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-white hover:text-[var(--accent-primary)] transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </Card>
  );
}
