import { describe, expect, it } from 'vitest';
  import {
    classifyLearningSignal,
    signalGuidance,
    signalLabel,
  } from '@/lib/confidence';
  import { Confidence, LearningSignal } from '@/lib/types';

  const confident: Confidence = 'confident';
  const unsure: Confidence = 'unsure';

  describe('confidence learning-signal classifier', () => {
    it('classifies all four observed signals', () => {
      expect(classifyLearningSignal(true, confident)).toBe('correct-confident');
      expect(classifyLearningSignal(true, unsure)).toBe('correct-unsure');
      expect(classifyLearningSignal(false, confident)).toBe('incorrect-confident');
      expect(classifyLearningSignal(false, unsure)).toBe('incorrect-unsure');
    });

    it('treats missing confidence as unknown rather than inventing a signal', () => {
      expect(classifyLearningSignal(true, undefined)).toBe('unknown');
      expect(classifyLearningSignal(false, undefined)).toBe('unknown');
    });

    it('is pure and deterministic for identical inputs', () => {
      const a = classifyLearningSignal(false, confident);
      const b = classifyLearningSignal(false, confident);
      expect(a).toBe(b);
      expect(a).toBe('incorrect-confident');
    });

    it('never asserts mastery from a single signal', () => {
      // The guidance must describe evidence, not claim understanding.
      expect(signalGuidance('correct-confident')).toMatch(/understanding/);
      expect(signalGuidance('correct-confident')).not.toMatch(/master|mastery|proof/);
      expect(signalGuidance('incorrect-confident')).not.toMatch(/master|mastery|proof/);
    });

    it('labels every signal with a human-readable name', () => {
      expect(signalLabel('correct-confident')).toBe('Correct and confident');
      expect(signalLabel('correct-unsure')).toBe('Correct but unsure');
      expect(signalLabel('incorrect-confident')).toBe('Incorrect but confident');
      expect(signalLabel('incorrect-unsure')).toBe('Incorrect and unsure');
      expect(signalLabel('unknown')).toBe('Confidence not captured');
    });

    it('only ever returns valid learning signals', () => {
      const validSignals: LearningSignal[] = [
        'correct-confident',
        'correct-unsure',
        'incorrect-confident',
        'incorrect-unsure',
      ];
      const combinations: [boolean, Confidence][] = [
        [true, 'confident'],
        [true, 'unsure'],
        [false, 'confident'],
        [false, 'unsure'],
      ];

      for (const [correct, confidence] of combinations) {
        expect(validSignals).toContain(classifyLearningSignal(correct, confidence));
      }
      expect(validSignals).not.toContain(classifyLearningSignal(true, undefined));
    });
  });