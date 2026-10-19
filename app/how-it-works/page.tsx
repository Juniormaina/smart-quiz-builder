'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';

const mechanisms = [
  {
    title: 'Answer',
    summary: 'Practice questions are selected around a predicted 70% chance of success. This aims for productive challenge rather than questions that are all too easy or too difficult.',
  },
  {
    title: 'Tracked',
    summary: 'Each answer updates a transparent Elo-style rating and subtopic accuracy. Correctness, question difficulty, and optional teach-back quality all contribute to the record.',
  },
  {
    title: 'Adapted',
    summary: 'The next practice question favors a predicted success chance near 70%, adds emphasis to weak subtopics, and avoids recently seen questions. Exam simulation keeps its fixed format.',
  },
  {
    title: 'Remediated',
    summary: 'Repeated confusion between related Azure concepts unlocks a short comparison and five-question drill. The drill result marks the pair as recovering or resolved.',
  },
];

export default function HowItWorksPage() {
  const reducedMotion = useReducedMotion();
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">The learning loop</p>
            <h1 className="mt-2 text-3xl font-bold">How practice adapts to you</h1>
          </div>
          <Link href="/" className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">Back to practice</Link>
        </header>

        <div className="mb-8 grid gap-3 sm:grid-cols-4" aria-label="Answer, track, adapt, remediate">
          {mechanisms.map((mechanism, index) => (
            <motion.div
              key={mechanism.title}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : index * 0.15 }}
              className="rounded-xl border border-sky-200 bg-white p-4 text-center shadow-sm dark:border-sky-900 dark:bg-slate-900"
            >
              <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">STEP {index + 1}</span>
              <h2 className="mt-1 font-bold">{mechanism.title}</h2>
              {index < mechanisms.length - 1 && <span className="sr-only">then</span>}
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
          {mechanisms.map((mechanism) => (
            <section key={mechanism.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-semibold">{mechanism.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{mechanism.summary}</p>
            </section>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pairs" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white">Explore confusion pairs</Link>
          <Link href="/?demo=1" className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">Load demo profile</Link>
        </div>
      </div>
    </main>
  );
}
