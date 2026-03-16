import { describe, it, expect } from "vitest";
import {
  parseIKCsv,
  computeMsPerFrame,
  getAvailableBones,
  BONE_DEFINITIONS,
  SkeletonFrame,
} from "@/lib/skeleton-data";

// ---------------------------------------------------------------------------
// Test CSV fixtures matching real Reboot Motion IK column naming
// ---------------------------------------------------------------------------

const MINIMAL_CSV = [
  "skullbasex,skullbasey,skullbasez,neckx,necky,neckz,midhipx,midhipy,midhipz,timeorg",
  "0.1,0.2,1.8,0.1,0.2,1.5,0.1,0.2,1.0,0.000",
  "0.11,0.21,1.81,0.11,0.21,1.51,0.11,0.21,1.01,0.033",
  "0.12,0.22,1.82,0.12,0.22,1.52,0.12,0.22,1.02,0.066",
].join("\n");

const FULL_BODY_CSV = [
  "skullbasex,skullbasey,skullbasez,neckx,necky,neckz,lsjcx,lsjcy,lsjcz,rsjcx,rsjcy,rsjcz,lwjcx,lwjcy,lwjcz,rwjcx,rwjcy,rwjcz,midhipx,midhipy,midhipz,lhjcx,lhjcy,lhjcz,rhjcx,rhjcy,rhjcz,lkjcx,lkjcy,lkjcz,rkjcx,rkjcy,rkjcz,lmmalx,lmmaly,lmmalz,rmmalx,rmmaly,rmmalz,timeorg",
  "0,0,1.8, 0,0,1.5, -0.2,0,1.4, 0.2,0,1.4, -0.4,0,1.2, 0.4,0,1.2, 0,0,1.0, -0.1,0,0.9, 0.1,0,0.9, -0.1,0,0.5, 0.1,0,0.5, -0.1,0,0.0, 0.1,0,0.0, 0.000",
  "0,0,1.81, 0,0,1.51, -0.2,0,1.41, 0.2,0,1.41, -0.4,0,1.21, 0.4,0,1.21, 0,0,1.01, -0.1,0,0.91, 0.1,0,0.91, -0.1,0,0.51, 0.1,0,0.51, -0.1,0,0.01, 0.1,0,0.01, 0.008",
].join("\n");

// ---------------------------------------------------------------------------
// parseIKCsv
// ---------------------------------------------------------------------------

describe("parseIKCsv", () => {
  it("returns empty array for empty input", () => {
    expect(parseIKCsv("")).toEqual([]);
    expect(parseIKCsv("header_only")).toEqual([]);
  });

  it("parses minimal CSV with 3 joints and timeorg", () => {
    const frames = parseIKCsv(MINIMAL_CSV);
    expect(frames).toHaveLength(3);

    // Frame 0
    expect(frames[0].time).toBe(0);
    expect(frames[0].joints.skullbase).toEqual({ x: 0.1, y: 0.2, z: 1.8 });
    expect(frames[0].joints.neck).toEqual({ x: 0.1, y: 0.2, z: 1.5 });
    expect(frames[0].joints.midhip).toEqual({ x: 0.1, y: 0.2, z: 1.0 });

    // Frame 2 time
    expect(frames[2].time).toBeCloseTo(0.066, 3);
  });

  it("parses full-body CSV with all standard joints", () => {
    const frames = parseIKCsv(FULL_BODY_CSV);
    expect(frames).toHaveLength(2);

    const joints0 = frames[0].joints;
    expect(Object.keys(joints0)).toEqual(
      expect.arrayContaining([
        "skullbase", "neck", "lsjc", "rsjc", "lwjc", "rwjc",
        "midhip", "lhjc", "rhjc", "lkjc", "rkjc", "lmmal", "rmmal",
      ])
    );
  });

  it("handles case-insensitive headers", () => {
    const csv = "NeckX,NeckY,NeckZ,TimeOrg\n1,2,3,0.0\n";
    const frames = parseIKCsv(csv);
    expect(frames).toHaveLength(1);
    expect(frames[0].joints.neck).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("falls back to row index when timeorg is missing", () => {
    const csv = "neckx,necky,neckz\n1,2,3\n4,5,6\n";
    const frames = parseIKCsv(csv);
    expect(frames[0].time).toBe(0); // row-1 = 0
    expect(frames[1].time).toBe(1);
  });

  it("handles CRLF line endings", () => {
    const csv = "neckx,necky,neckz,timeorg\r\n1,2,3,0.0\r\n4,5,6,0.033\r\n";
    const frames = parseIKCsv(csv);
    expect(frames).toHaveLength(2);
  });

  it("skips rows with NaN values", () => {
    const csv = "neckx,necky,neckz,timeorg\n1,2,3,0.0\nabc,def,ghi,0.033\n";
    const frames = parseIKCsv(csv);
    expect(frames).toHaveLength(2);
    // Second frame should still exist but without the neck joint
    expect(frames[1].joints.neck).toBeUndefined();
  });

  it("ignores unknown columns gracefully", () => {
    const csv = "neckx,necky,neckz,foobar,bazqux,timeorg\n1,2,3,99,88,0.0\n";
    const frames = parseIKCsv(csv);
    expect(frames).toHaveLength(1);
    expect(frames[0].joints.neck).toBeDefined();
    expect(frames[0].joints).not.toHaveProperty("foobar");
  });
});

// ---------------------------------------------------------------------------
// computeMsPerFrame
// ---------------------------------------------------------------------------

describe("computeMsPerFrame", () => {
  it("returns 33ms fallback for < 2 frames", () => {
    expect(computeMsPerFrame([])).toBe(33);
    expect(computeMsPerFrame([{ joints: {}, time: 0 }])).toBe(33);
  });

  it("computes ms from second-based timestamps", () => {
    // 3 frames at 0.000, 0.033, 0.066 → median delta = 0.033s = 33ms
    const frames = parseIKCsv(MINIMAL_CSV);
    const ms = computeMsPerFrame(frames);
    expect(ms).toBeCloseTo(33, 0);
  });

  it("handles millisecond-scale timestamps (>1)", () => {
    const frames: SkeletonFrame[] = [
      { joints: {}, time: 0 },
      { joints: {}, time: 16 },
      { joints: {}, time: 32 },
    ];
    // median delta = 16, which is > 1, so treated as ms directly
    expect(computeMsPerFrame(frames)).toBe(16);
  });

  it("never returns less than 1ms", () => {
    const frames: SkeletonFrame[] = [
      { joints: {}, time: 0 },
      { joints: {}, time: 0 },
    ];
    expect(computeMsPerFrame(frames)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getAvailableBones
// ---------------------------------------------------------------------------

describe("getAvailableBones", () => {
  it("returns only bones where both joints exist", () => {
    const frame: SkeletonFrame = {
      joints: {
        midhip: { x: 0, y: 0, z: 1 },
        neck: { x: 0, y: 0, z: 1.5 },
        skullbase: { x: 0, y: 0, z: 1.8 },
      },
      time: 0,
    };
    const bones = getAvailableBones(frame);
    // Should get spine bones only (midhip->neck, neck->skullbase)
    expect(bones).toHaveLength(2);
    expect(bones.every(b => b.side === "mid")).toBe(true);
  });

  it("returns all bones for a full-body frame", () => {
    const frames = parseIKCsv(FULL_BODY_CSV);
    const bones = getAvailableBones(frames[0]);
    // 13 total bones minus 1 bat bone (bhandle/bhead not in data) = 12
    expect(bones).toHaveLength(12);
  });

  it("returns empty for frame with no joints", () => {
    expect(getAvailableBones({ joints: {}, time: 0 })).toHaveLength(0);
  });

  it("includes bat bone when bhandle and bhead exist", () => {
    const frame: SkeletonFrame = {
      joints: {
        bhandle: { x: 0, y: 0, z: 0 },
        bhead: { x: 1, y: 0, z: 0 },
      },
      time: 0,
    };
    const bones = getAvailableBones(frame);
    expect(bones).toHaveLength(1);
    expect(bones[0].side).toBe("bat");
  });
});

// ---------------------------------------------------------------------------
// BONE_DEFINITIONS integrity
// ---------------------------------------------------------------------------

describe("BONE_DEFINITIONS", () => {
  it("has expected bone count", () => {
    expect(BONE_DEFINITIONS).toHaveLength(13);
  });

  it("covers all four sides", () => {
    const sides = new Set(BONE_DEFINITIONS.map(b => b.side));
    expect(sides).toEqual(new Set(["left", "right", "mid", "bat"]));
  });
});
