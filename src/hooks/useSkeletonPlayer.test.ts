import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSkeletonPlayer } from "@/hooks/useSkeletonPlayer";
import { SkeletonFrame } from "@/lib/skeleton-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFrames(count: number, deltaSec = 0.033): SkeletonFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    joints: { neck: { x: 0, y: 0, z: 1 + i * 0.01 } },
    time: i * deltaSec,
  }));
}

// ---------------------------------------------------------------------------
// useSkeletonPlayer
// ---------------------------------------------------------------------------

describe("useSkeletonPlayer", () => {
  it("returns correct initial state", () => {
    const frames = makeFrames(10);
    const { result } = renderHook(() => useSkeletonPlayer(frames, 0.5));

    expect(result.current.currentFrame).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.duration).toBe(10);
    expect(result.current.playbackSpeed).toBe(0.5);
    expect(result.current.msPerFrame).toBeCloseTo(33, 0);
  });

  it("returns duration 0 for empty frames", () => {
    const { result } = renderHook(() => useSkeletonPlayer([]));
    expect(result.current.duration).toBe(0);
  });

  it("seek clamps to valid range", () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useSkeletonPlayer(frames));

    act(() => result.current.seek(10));
    expect(result.current.currentFrame).toBe(4); // clamped to last

    act(() => result.current.seek(-5));
    expect(result.current.currentFrame).toBe(0); // clamped to 0
  });

  it("seek sets exact frame", () => {
    const frames = makeFrames(20);
    const { result } = renderHook(() => useSkeletonPlayer(frames));

    act(() => result.current.seek(15));
    expect(result.current.currentFrame).toBe(15);
  });

  it("play sets isPlaying true, pause sets false", () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useSkeletonPlayer(frames));

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    act(() => result.current.pause());
    expect(result.current.isPlaying).toBe(false);
  });

  it("toggle flips isPlaying", () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useSkeletonPlayer(frames));

    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
  });

  it("setPlaybackSpeed updates speed", () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useSkeletonPlayer(frames, 0.25));

    act(() => result.current.setPlaybackSpeed(1.0));
    expect(result.current.playbackSpeed).toBe(1.0);
  });

  it("durationMs is computed correctly", () => {
    const frames = makeFrames(10, 0.033);
    const { result } = renderHook(() => useSkeletonPlayer(frames));

    // 10 frames × ~33ms
    expect(result.current.durationMs).toBeCloseTo(330, -1);
  });
});
