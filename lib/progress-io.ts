import { z } from 'zod';
import { attemptSchema } from '@/lib/schemas';
import { Attempt, BookmarkState, PendingAnswer } from '@/lib/types';

export type ProgressPayload = {
  attempts: Attempt[];
  bookmarks: BookmarkState;
  pendingAnswer: PendingAnswer | null;
};

/**
 * Attempts exported before confidence tracking existed have no confidence
 * field at all. Parsing them without the field keeps those exports valid.
 */
const attemptWithoutConfidenceSchema = attemptSchema.omit({ confidence: true });

const progressFileSchema = z.object({
  attempts: z.array(z.unknown()),
  bookmarks: z.record(z.string(), z.unknown()),
  pendingAnswer: z.unknown().optional(),
});

export function serializeProgress(payload: ProgressPayload): string {
  return JSON.stringify({
    attempts: payload.attempts,
    bookmarks: payload.bookmarks,
    pendingAnswer: payload.pendingAnswer,
  }, null, 2);
}

/**
 * Normalize a single imported attempt.
 *
 * A valid attempt is kept as-is, so confidence and teach-back survive an
 * export/import round trip. An attempt whose confidence value is not one of
 * the supported values is salvaged by dropping that field only: an otherwise
 * usable legacy export is never rejected because of one bad confidence value.
 *
 * Legacy attempts that predate the rating fields are restored with the same
 * defaults the store migration uses, so older exports are not rejected.
 */
export function normalizeImportedAttempt(value: unknown): Attempt | null {
  const parsed = attemptSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  const salvaged = attemptWithoutConfidenceSchema.safeParse(value);
  if (salvaged.success) return salvaged.data;

  // Legacy shape: attempt without ratingBefore/ratingAfter. Restore the
  // defaults the store migration would add rather than rejecting the file.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.qid === 'string'
      && Array.isArray(candidate.chosen)
      && typeof candidate.correct === 'boolean'
      && typeof candidate.ms === 'number'
      && typeof candidate.ts === 'number'
      && (candidate.mode === 'practice' || candidate.mode === 'exam' || candidate.mode === 'remediation')
    ) {
      return {
        qid: candidate.qid,
        chosen: candidate.chosen.filter((item): item is string => typeof item === 'string'),
        correct: candidate.correct,
        ms: candidate.ms,
        ts: candidate.ts,
        mode: candidate.mode,
        ratingBefore: typeof candidate.ratingBefore === 'number' ? candidate.ratingBefore : 1200,
        ratingAfter: typeof candidate.ratingAfter === 'number' ? candidate.ratingAfter : 1200,
        pairId: typeof candidate.pairId === 'string' ? candidate.pairId : undefined,
        teachBack: isTeachBackResult(candidate.teachBack) ? candidate.teachBack as Attempt['teachBack'] : undefined,
        confidence: candidate.confidence === 'confident' || candidate.confidence === 'unsure'
          ? candidate.confidence
          : undefined,
      };
    }
  }

  return null;
}

function isTeachBackResult(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.text === 'string'
    && (candidate.score === 0 || candidate.score === 1 || candidate.score === 2)
    && typeof candidate.feedback === 'string'
    && (candidate.source === 'ai' || candidate.source === 'fallback')
  );
}

/**
 * Normalize an imported pending answer.
 *
 * A pending answer must carry a qid, a non-empty chosen array, a boolean
 * correct flag, a valid phase, and optionally a teach-back result. Anything
 * else is unusable and is dropped so an existing pending answer is preserved.
 */
export function normalizeImportedPendingAnswer(value: unknown): PendingAnswer | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.qid !== 'string' || !candidate.qid) return null;
  if (!Array.isArray(candidate.chosen)) return null;
  if (typeof candidate.correct !== 'boolean') return null;
  if (candidate.phase !== 'awaiting-teach-back' && candidate.phase !== 'awaiting-confidence') return null;

  const normalized: PendingAnswer = {
    qid: candidate.qid,
    chosen: candidate.chosen.filter((item): item is string => typeof item === 'string'),
    correct: candidate.correct,
    phase: candidate.phase,
  };

  if (candidate.teachBack && typeof candidate.teachBack === 'object') {
    const teachBack = candidate.teachBack as Record<string, unknown>;
    if (
      typeof teachBack.text === 'string'
      && (teachBack.score === 0 || teachBack.score === 1 || teachBack.score === 2)
      && typeof teachBack.feedback === 'string'
      && (teachBack.source === 'ai' || teachBack.source === 'fallback')
    ) {
      normalized.teachBack = teachBack as unknown as PendingAnswer['teachBack'];
    }
  }

  return normalized;
}

/**
 * Parse an exported progress file.
 *
 * Returns null when the file is not usable at all, so a broken import leaves
 * the existing progress untouched instead of replacing it. A valid empty
 * export (no attempts, no bookmarks, no pending answer) is accepted and
 * returns an empty payload. A file whose attempts are all invalid is also
 * rejected, because it would wipe existing progress with nothing useful.
 */
export function parseProgress(raw: string): ProgressPayload | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = progressFileSchema.safeParse(decoded);
  if (!parsed.success) return null;

  const rawAttempts = parsed.data.attempts ?? [];
  const attempts = rawAttempts
    .map(normalizeImportedAttempt)
    .filter((attempt): attempt is Attempt => attempt !== null);

  // A file that contains an attempts array but zero valid attempts is not a
  // usable export: it would replace existing progress with nothing. Distinguish
  // this from a legitimately empty export (an empty array or no key at all).
  if (rawAttempts.length > 0 && attempts.length === 0) return null;

  const bookmarks: BookmarkState = {};
  for (const [qid, active] of Object.entries(parsed.data.bookmarks ?? {})) {
    if (typeof active === 'boolean') bookmarks[qid] = active;
  }

  const pendingAnswer = normalizeImportedPendingAnswer(parsed.data.pendingAnswer ?? null);

  return { attempts, bookmarks, pendingAnswer };
}
