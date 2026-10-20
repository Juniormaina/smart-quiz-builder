import { describe, expect, it } from 'vitest';
  import { normalizeImportedAttempt, parseProgress, serializeProgress } from '@/lib/progress-io';
  import { Attempt, TeachBackResult } from '@/lib/types';

  const teachBack: TeachBackResult = {
    text: 'Because the service manages identity.',
    score: 1,
    feedback: 'Partly there.',
    source: 'fallback',
    covered: ['identity'],
    missing: ['billing'],
  };

  const attempt: Attempt = {
    qid: 'cc-001',
    chosen: ['a'],
    correct: true,
    ms: 1200,
    ts: 1_700_000_000_000,
    mode: 'practice',
    ratingBefore: 1200,
    ratingAfter: 1210,
    confidence: 'confident',
  };

  describe('progress export and import', () => {
    it('keeps confidence and teach-back through an export/import round trip', () => {
      const payload = serializeProgress({
        attempts: [{ ...attempt, teachBack }],
        bookmarks: { 'cc-001': true },
        pendingAnswer: null,
      });

      const parsed = parseProgress(payload);

      expect(parsed).not.toBeNull();
      expect(parsed?.attempts).toHaveLength(1);
      expect(parsed?.attempts[0].confidence).toBe('confident');
      expect(parsed?.attempts[0].teachBack).toEqual(teachBack);
      expect(parsed?.bookmarks).toEqual({ 'cc-001': true });
      expect(parsed?.pendingAnswer).toBeNull();
    });

    it('keeps exports written before confidence tracking valid', () => {
      const legacy = {
        qid: 'cc-001',
        chosen: ['a'],
        correct: true,
        ms: 1200,
        ts: 10,
        mode: 'practice',
        ratingBefore: 1200,
        ratingAfter: 1200,
      };

      const parsed = parseProgress(JSON.stringify({ attempts: [legacy], bookmarks: {} }));

      expect(parsed).not.toBeNull();
      expect(parsed?.attempts).toHaveLength(1);
      expect(parsed?.attempts[0].confidence).toBeUndefined();
      expect(parsed?.attempts[0].qid).toBe('cc-001');
    });

    it('discards an invalid confidence value instead of rejecting the attempt', () => {
      const parsed = normalizeImportedAttempt({ ...attempt, confidence: 'maybe' });

      expect(parsed).not.toBeNull();
      expect(parsed?.confidence).toBeUndefined();
      expect(parsed?.qid).toBe(attempt.qid);
    });

    it('keeps the rest of an export when one confidence value is invalid', () => {
      const payload = JSON.stringify({
        attempts: [
          { ...attempt, confidence: 'very' },
          { ...attempt, qid: 'cc-002', confidence: 'unsure' },
        ],
        bookmarks: {},
      });

      const parsed = parseProgress(payload);

      expect(parsed?.attempts).toHaveLength(2);
      expect(parsed?.attempts[0].confidence).toBeUndefined();
      expect(parsed?.attempts[1].confidence).toBe('unsure');
    });

    it('leaves progress untouched for a file that cannot be read', () => {
      expect(parseProgress('not json at all')).toBeNull();
      expect(parseProgress(JSON.stringify({ attempts: 'nope' }))).toBeNull();
    });

    it('accepts a valid empty export', () => {
      const parsed = parseProgress(JSON.stringify({ attempts: [], bookmarks: {} }));

      expect(parsed).not.toBeNull();
      expect(parsed?.attempts).toHaveLength(0);
      expect(parsed?.bookmarks).toEqual({});
      expect(parsed?.pendingAnswer).toBeNull();
    });

    it('rejects a file whose attempts are all invalid', () => {
      const parsed = parseProgress(JSON.stringify({
        attempts: [{ bad: 'object' }, { also: 'bad' }],
        bookmarks: {},
      }));

      expect(parsed).toBeNull();
    });

    it('rejects a file with missing required progress fields', () => {
      // An empty object with no structure at all is unusable.
      expect(parseProgress(JSON.stringify({}))).toBeNull();
      // Missing attempts would wipe existing progress with nothing.
      expect(parseProgress(JSON.stringify({ bookmarks: {} }))).toBeNull();
      // Missing bookmarks would wipe existing bookmarks with nothing.
      expect(parseProgress(JSON.stringify({ attempts: [] }))).toBeNull();
    });

    it('preserves valid confidence, teach-back, and bookmarks on import', () => {
      const payload = JSON.stringify({
        attempts: [{ ...attempt, teachBack }],
        bookmarks: { 'cc-001': true },
      });

      const parsed = parseProgress(payload);

      expect(parsed).not.toBeNull();
      expect(parsed?.attempts[0].confidence).toBe('confident');
      expect(parsed?.attempts[0].teachBack).toEqual(teachBack);
      expect(parsed?.bookmarks).toEqual({ 'cc-001': true });
    });

    it('preserves legacy attempts that need migration to restore missing rating fields', () => {
      const payload = JSON.stringify({
        attempts: [{
          qid: 'cc-001',
          chosen: ['a'],
          correct: true,
          ms: 1200,
          ts: 10,
          mode: 'practice',
        }],
        bookmarks: {},
      });

      const parsed = parseProgress(payload);

      expect(parsed).not.toBeNull();
      expect(parsed?.attempts).toHaveLength(1);
      expect(parsed?.attempts[0].ratingBefore).toBe(1200);
      expect(parsed?.attempts[0].ratingAfter).toBe(1200);
    });
  });
