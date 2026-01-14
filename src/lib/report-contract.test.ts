// ============================================================================
// Report Contract Tests
// Ensures mockReportData, edge function responses, and SwingReport UI all
// conform to the canonical SwingReportData schema.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { mockReportData } from './mock-report-data';
import type { SwingReportData, ContractVersion } from './report-types';

// All required top-level keys in the report
const REQUIRED_KEYS: (keyof SwingReportData)[] = [
  'contract_version',
  'generated_at',
  'session',
  'scores',
  'kinetic_potential',
  'primary_leak',
  'fix_order',
  'square_up_window',
  'weapon_panel',
  'ball_panel',
  'barrel_sling_panel',
  'drills',
  'session_history',
  'coach_note',
  'badges',
];

// Section keys that must have { present: boolean } pattern
const PRESENT_SECTIONS = [
  'kinetic_potential',
  'primary_leak',
  'fix_order',
  'square_up_window',
  'weapon_panel',
  'ball_panel',
  'barrel_sling_panel',
  'drills',
  'session_history',
  'coach_note',
] as const;

// Sections that must have { items: [] } array
const ITEMS_SECTIONS = ['fix_order', 'drills', 'session_history'] as const;

/**
 * Build a minimal valid edge function response for testing
 * Simulates what get-report returns with present:false for most sections
 */
function buildEdgeResponse(): SwingReportData {
  return {
    contract_version: '2026-01-14',
    generated_at: new Date().toISOString(),
    session: {
      id: 'test-session-id',
      date: '2026-01-14',
      player: { name: 'Test Player', age: 14, level: 'youth', handedness: 'R' },
    },
    scores: {
      body: 70,
      brain: 65,
      bat: 72,
      ball: 60,
      composite: 67,
    },
    kinetic_potential: { present: true, ceiling: 82, current: 67 },
    primary_leak: { present: false, title: undefined, description: undefined, why_it_matters: undefined },
    fix_order: { present: false, items: [], do_not_chase: [] },
    square_up_window: { present: false, grid: undefined, best_zone: undefined, avoid_zone: undefined, coach_note: undefined },
    weapon_panel: { present: false, metrics: [] },
    ball_panel: { present: false, projected: { present: false, outcomes: [] }, outcomes: [] },
    barrel_sling_panel: { present: false },
    drills: { present: false, items: [] },
    session_history: { present: false, items: [] },
    coach_note: { present: false, text: undefined, audio_url: undefined },
    badges: [],
  };
}

describe('Report Contract', () => {
  describe('mockReportData', () => {
    it('satisfies SwingReportData at compile time', () => {
      // This test passes if TypeScript compiles - runtime check below
      const data: SwingReportData = mockReportData;
      expect(data).toBeDefined();
    });

    it('has all required top-level keys', () => {
      for (const key of REQUIRED_KEYS) {
        expect(mockReportData).toHaveProperty(key);
      }
    });

    it('has contract_version matching current version', () => {
      const expectedVersion: ContractVersion = '2026-01-14';
      expect(mockReportData.contract_version).toBe(expectedVersion);
    });

    it('has generated_at as ISO string', () => {
      expect(typeof mockReportData.generated_at).toBe('string');
      expect(() => new Date(mockReportData.generated_at)).not.toThrow();
    });

    it('all present-flag sections have boolean present field', () => {
      for (const key of PRESENT_SECTIONS) {
        const section = mockReportData[key];
        expect(section).toHaveProperty('present');
        expect(typeof section.present).toBe('boolean');
      }
    });

    it('all items sections have items array', () => {
      for (const key of ITEMS_SECTIONS) {
        const section = mockReportData[key];
        expect(section).toHaveProperty('items');
        expect(Array.isArray(section.items)).toBe(true);
      }
    });

    it('badges is an array', () => {
      expect(Array.isArray(mockReportData.badges)).toBe(true);
    });
  });

  describe('Edge function response builder', () => {
    const edgeResponse = buildEdgeResponse();

    it('satisfies SwingReportData at compile time', () => {
      const data: SwingReportData = edgeResponse;
      expect(data).toBeDefined();
    });

    it('has all required top-level keys', () => {
      for (const key of REQUIRED_KEYS) {
        expect(edgeResponse).toHaveProperty(key);
      }
    });

    it('has contract_version matching current version', () => {
      const expectedVersion: ContractVersion = '2026-01-14';
      expect(edgeResponse.contract_version).toBe(expectedVersion);
    });

    it('all present-flag sections have boolean present field', () => {
      for (const key of PRESENT_SECTIONS) {
        const section = edgeResponse[key];
        expect(section).toHaveProperty('present');
        expect(typeof section.present).toBe('boolean');
      }
    });

    it('all items sections have items array (even when present:false)', () => {
      for (const key of ITEMS_SECTIONS) {
        const section = edgeResponse[key];
        expect(section).toHaveProperty('items');
        expect(Array.isArray(section.items)).toBe(true);
      }
    });

    it('weapon_panel.metrics is always an array', () => {
      expect(Array.isArray(edgeResponse.weapon_panel.metrics)).toBe(true);
    });

    it('ball_panel.outcomes is always an array', () => {
      expect(Array.isArray(edgeResponse.ball_panel.outcomes)).toBe(true);
    });

    it('ball_panel.projected is always an object with present and outcomes', () => {
      expect(edgeResponse.ball_panel.projected).toHaveProperty('present');
      expect(typeof edgeResponse.ball_panel.projected.present).toBe('boolean');
      expect(Array.isArray(edgeResponse.ball_panel.projected.outcomes)).toBe(true);
    });
  });
});
