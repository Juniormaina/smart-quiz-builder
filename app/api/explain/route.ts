import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { explainRequestSchema, explainResponseSchema } from '@/lib/schemas';
import { buildExplainPrompt } from '@/lib/prompts/explain';

const fallbackResponse = {
  mode: 'ELI5',
  headline: 'Start with the core concept, then test your reasoning.',
  explanation: 'The safest explanation is to match the scenario to the core Azure concept and eliminate the distractors that are either the wrong service model or the wrong responsibility boundary.',
  analogy: 'Think of Azure as a shared toolkit: the provider manages the platform and the physical building, while you remain responsible for the app and access settings.',
  commonMistake: 'Students often confuse service model boundaries and governance controls. Check the exact job of the service before selecting an answer.',
  checkYourself: {
    question: 'What part is handled by Azure, and what part remains your responsibility?',
    answer: 'Use the service model or governance boundary to decide what belongs to the provider and what belongs to your team.',
  },
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = explainRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { mode, question, chosenAnswer, followUp } = parsed.data;
  const prompt = buildExplainPrompt({
    mode,
    question: `${question.stem}\nSubtopic: ${question.subtopic}\nOptions: ${question.options.map((option) => `${option.id}: ${option.text}`).join('; ')}\nCorrect answer: ${question.correct.join(', ')}\nSource explanation: ${question.explanation.summary} ${question.explanation.whyCorrect} ${question.explanation.memoryHook}`,
    chosenAnswer,
    followUp,
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ...fallbackResponse, mode });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    });

    const output = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
    const parsedOutput = JSON.parse(output);
    const safeResult = explainResponseSchema.safeParse(parsedOutput);
    if (!safeResult.success) {
      return NextResponse.json({ ...fallbackResponse, mode });
    }
    return NextResponse.json({ ...safeResult.data, mode: safeResult.data.mode });
  } catch {
    return NextResponse.json({ ...fallbackResponse, mode });
  }
}
