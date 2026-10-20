import { describe, expect, it } from 'vitest';
import { buildExamSet, buildPracticeSet, shuffleOptions, shuffleSeeded } from '@/lib/selection';
import { questionBank } from '@/data/index';

describe('Selection logic', () => {
  it('creates stable seeded practice sets', () => {
    const first = buildPracticeSet(questionBank, ['cloud-concepts'], null, 5, 1234);
    const second = buildPracticeSet(questionBank, ['cloud-concepts'], null, 5, 1234);
    expect(first.map((question) => question.id)).toEqual(second.map((question) => question.id));
  });

  it('samples the full eligible bank instead of always taking the first questions', () => {
    const selected = buildPracticeSet(questionBank, ['cloud-concepts', 'architecture-services', 'management-governance'], null, 20, 99);
    expect(new Set(selected.map((question) => question.domain)).size).toBeGreaterThan(1);
    expect(selected.length).toBe(20);
  });

  it('provides the requested 30-question practice and 50-question exam sets', () => {
    const practice = buildPracticeSet(questionBank, ['cloud-concepts', 'architecture-services', 'management-governance'], null, 30, 1234);
    const exam = buildExamSet(questionBank, 1234);

    expect(practice).toHaveLength(30);
    expect(exam).toHaveLength(50);
    expect(new Set(exam.map((question) => question.id)).size).toBe(50);
  });

  it('shuffles preserving the same order across the same seed', () => {
    expect(shuffleSeeded(['a', 'b', 'c', 'd'], 42)).toEqual(shuffleSeeded(['a', 'b', 'c', 'd'], 42));
  });

  it('preserves the correct option identities when shuffling answer order', () => {
    for (const question of questionBank) {
      const originalCorrectOptions = question.options
        .filter((option) => question.correct.includes(option.id))
        .map((option) => option.text)
        .sort();

      for (let seed = 1; seed <= 12; seed += 1) {
        const shuffled = shuffleOptions(question, seed);
        const shuffledCorrectOptions = shuffled.options
          .filter((option) => shuffled.correct.includes(option.id))
          .map((option) => option.text)
          .sort();

        expect(shuffledCorrectOptions, `${question.id}, seed ${seed}`).toEqual(originalCorrectOptions);
      }
    }
  });
});
