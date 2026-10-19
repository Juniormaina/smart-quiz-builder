'use client';

import Link from 'next/link';
import { confusionPairs } from '@/data/confusionPairs';
import { getPairStatus } from '@/lib/pairs';
import { useProgressStore } from '@/lib/store';
import { PairDrillResult } from '@/lib/types';

export default function ConfusionPairsPage() {
  const attempts = useProgressStore((state) => state.attempts);
  const sessions = useProgressStore((state) => state.sessions);
  const pairResults = (sessions.pairDrills ?? {}) as Record<string, PairDrillResult>;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-sky-600">Focused practice</p>
            <h1 className="mt-2 text-3xl font-bold">Confusion-pair drills</h1>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">Compare related Azure concepts, then check your understanding with five short scenarios.</p>
          </div>
          <Link href="/" className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">Back to practice</Link>
        </header>

        <div className="space-y-5">
          {confusionPairs.map((pair) => {
            const status = getPairStatus(attempts, pair.id, pairResults[pair.id]);
            return (
              <article key={pair.id} id={pair.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">{pair.a.name} vs {pair.b.name}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'Triggered' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : status === 'Resolved' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                    {status}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[pair.a, pair.b].map((concept) => (
                    <div key={concept.name} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                      <h3 className="font-semibold">{concept.name}</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{concept.oneLiner}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead><tr className="border-b border-slate-200 dark:border-slate-700"><th className="p-2">Dimension</th><th className="p-2">{pair.a.name}</th><th className="p-2">{pair.b.name}</th></tr></thead>
                    <tbody>
                      {pair.comparison.map((row) => (
                        <tr key={row.dimension} className="border-b border-slate-100 dark:border-slate-800">
                          <th className="p-2 font-medium">{row.dimension}</th><td className="p-2">{row.a}</td><td className="p-2">{row.b}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 rounded-lg border-l-4 border-sky-500 bg-sky-50 p-3 text-sm dark:bg-sky-950/40"><strong>Rule of thumb:</strong> {pair.ruleOfThumb}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {pairResults[pair.id] && <p className="text-xs text-slate-500">Last drill: {pairResults[pair.id].correct}/{pairResults[pair.id].total}; accuracy {pairResults[pair.id].beforeAccuracy}% → {pairResults[pair.id].afterAccuracy}%</p>}
                  <Link href={`/?drill=${encodeURIComponent(pair.id)}`} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white">Start 5-question drill</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
