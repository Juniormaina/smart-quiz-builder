import { describe, expect, it } from 'vitest';
import { runTeachBackEvals } from './run';

describe('recorded teach-back evals', () => {
  it('passes all offline grading fixtures and writes the result table', () => {
    const results = runTeachBackEvals();
    expect(results).toHaveLength(12);
    expect(results.every((result) => result.passed)).toBe(true);
  });
});
