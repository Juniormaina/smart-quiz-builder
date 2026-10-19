import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { gradeExplanationRequestSchema } from '@/lib/schemas';
import { buildGradeExplanationPrompt, gradeExplanationSystemPrompt } from '@/lib/prompts/gradeExplanation.v1';
import { gradeExplanationFallback, parseGradeResponse } from '@/lib/teachback';
import { LEARNING_CONFIG } from '@/lib/config';

const sessions = new Map<string, { count: number; windowStartedAt: number }>();

function withinRateLimit(sessionId: string, now: number) {
  const existing = sessions.get(sessionId);
  if (!existing || now - existing.windowStartedAt >= 60_000) {
    sessions.set(sessionId, { count: 1, windowStartedAt: now });
    return true;
  }
  if (existing.count >= LEARNING_CONFIG.gradeRequestsPerMinute) return false;
  existing.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const parsed = gradeExplanationRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid grading request.' }, { status: 400 });

  const sessionId = request.headers.get('x-learning-session');
  if (!sessionId || !/^[\w-]{8,100}$/.test(sessionId)) {
    return NextResponse.json({ error: 'A valid learning session is required.' }, { status: 400 });
  }
  if (!withinRateLimit(sessionId, Date.now())) {
    return NextResponse.json({ error: 'Too many grading requests. Try again in a minute.' }, { status: 429 });
  }

  const { question, text } = parsed.data;
  const fallback = gradeExplanationFallback(question, text);
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json(fallback);

  const userPrompt = buildGradeExplanationPrompt({
    stem: question.stem,
    options: question.options.map((option) => `${option.id}: ${option.text}`),
    correctAnswer: question.correct,
    authoredExplanation: `${question.explanation.summary} ${question.explanation.whyCorrect}`,
    keyConcepts: question.explanation.keyConcepts,
    learnerText: text,
  });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 250,
        system: gradeExplanationSystemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const output = response.content.find((item) => item.type === 'text');
      if (!output || output.type !== 'text') continue;
      let decoded: unknown;
      try {
        decoded = JSON.parse(output.text);
      } catch {
        if (attempt === 0) continue;
        break;
      }
      const valid = parseGradeResponse(decoded, question);
      if (valid) return NextResponse.json({ ...valid, source: 'ai' as const });
      if (attempt === 0) continue;
    } catch (error) {
      console.error('Teach-back grading request failed; using deterministic fallback.', error);
      break;
    }
  }
  return NextResponse.json(fallback);
}
