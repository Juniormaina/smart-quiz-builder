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
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-sky-400">Focused practice</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Confusion-pair drills</h1>
            <p className="mt-2 max-w-2xl text-slate-300">Compare related Azure concepts, then check your understanding with five short scenarios.</p>
          </div>
          <Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-900">Back to practice</Link>
        </header>

        <div className="space-y-5">
          {confusionPairs.map((pair) => {
            const status = getPairStatus(attempts, pair.id, pairResults[pair.id]);
            return (
              <article key={pair.id} id={pair.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold sm:text-xl">{pair.a.name} vs {pair.b.name}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'Triggered' ? 'bg-amber-950 text-amber-200' : status === 'Resolved' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-800 text-slate-200'}`}>
                    {status}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[pair.a, pair.b].map((concept) => (
                    <div key={concept.name} className="rounded-xl bg-slate-800 p-3">
                      <h3 className="font-semibold">{concept.name}</h3>
                      <p className="mt-1 text-sm text-slate-300">{concept.oneLiner}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead><tr className="border-b border-slate-700"><th className="p-2">Dimension</th><th className="p-2">{pair.a.name}</th><th className="p-2">{pair.b.name}</th></tr></thead>
                    <tbody>
                      {pair.comparison.map((row) => (
                        <tr key={row.dimension} className="border-b border-slate-800">
                          <th className="p-2 font-medium">{row.dimension}</th><td className="p-2">{row.a}</td><td className="p-2">{row.b}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 rounded-lg border-l-4 border-sky-500 bg-sky-950/40 p-3 text-sm"><strong>Rule of thumb:</strong> {pair.ruleOfThumb}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {pairResults[pair.id] && <p className="text-xs text-slate-400">Last drill: {pairResults[pair.id].correct}/{pairResults[pair.id].total}; accuracy {pairResults[pair.id].beforeAccuracy}% → {pairResults[pair.id].afterAccuracy}%</p>}
                  <Link href={`/?drill=${encodeURIComponent(pair.id)}`} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500">Start 5-question drill</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
