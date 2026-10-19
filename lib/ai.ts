import { ExplainResponse, Question } from '@/lib/types';

export function buildExplainPrompt(question: Question, mode: ExplainResponse['mode'], chosenAnswer?: string[], followUp?: string) {
  return `
You are a patient Azure Fundamentals tutor. Keep explanations at AZ-900 level. Never invent pricing, SLAs, product names, or exact limits. If uncertain, say: "I'm not certain, check Microsoft Learn".

Scope: ${question.subtopic}
Mode: ${mode}
Question stem: ${question.stem}
Options: ${question.options.map((option) => `${option.id}: ${option.text}`).join('; ')}
Correct answer: ${question.correct.join(', ')}
User selected: ${chosenAnswer?.join(', ') ?? 'none'}
Source explanation: ${question.explanation.summary} ${question.explanation.whyCorrect} ${question.explanation.memoryHook}
User follow-up: ${followUp ?? 'none'}

Return strict JSON with keys: mode, headline, explanation, analogy?, commonMistake, checkYourself { question, answer }.
`;
}
