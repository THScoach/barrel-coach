/**
 * useSkeletonPlayer
 * ==================
 * Playback hook for skeleton frame animation.
 * Returns current frame index, play/pause, seek, and duration info.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { SkeletonFrame, computeMsPerFrame } from '@/lib/skeleton-data';

export interface SkeletonPlayerState {
  currentFrame: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (frame: number) => void;
  duration: number;       // total frames
  durationMs: number;     // approx total duration in ms
  msPerFrame: number;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
}

export function useSkeletonPlayer(
  frames: SkeletonFrame[],
  initialSpeed: number = 0.25,
): SkeletonPlayerState {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(initialSpeed);

  const msPerFrame = computeMsPerFrame(frames);
  const duration = frames.length;
  const durationMs = duration * msPerFrame;

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const frameRef = useRef(currentFrame);

  // Keep frameRef in sync
  useEffect(() => {
    frameRef.current = currentFrame;
  }, [currentFrame]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || duration <= 1) return;

    const step = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      accumulatorRef.current += delta * playbackSpeed;

      const framesToAdvance = Math.floor(accumulatorRef.current / msPerFrame);
      if (framesToAdvance > 0) {
        accumulatorRef.current -= framesToAdvance * msPerFrame;
        const nextFrame = frameRef.current + framesToAdvance;

        if (nextFrame >= duration) {
          // Loop back to start
          setCurrentFrame(0);
          frameRef.current = 0;
        } else {
          setCurrentFrame(nextFrame);
          frameRef.current = nextFrame;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    lastTimeRef.current = 0;
    accumulatorRef.current = 0;
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, playbackSpeed, msPerFrame, duration]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying(p => !p), []);

  const seek = useCallback((frame: number) => {
    const clamped = Math.max(0, Math.min(frame, duration - 1));
    setCurrentFrame(clamped);
    frameRef.current = clamped;
  }, [duration]);

  return {
    currentFrame,
    isPlaying,
    play,
    pause,
    toggle,
    seek,
    duration,
    durationMs,
    msPerFrame,
    playbackSpeed,
    setPlaybackSpeed,
  };
}
