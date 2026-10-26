"use client";
import { ImageStreamHero } from "@/components/ui/image-stream-hero";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <ImageStreamHero
        images={[
          { src: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80", alt: "Cloud" },
          { src: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80", alt: "Servers" },
          { src: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80", alt: "Security" },
        ]}
        className="h-[320px] w-full sm:h-[420px]"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/50 to-slate-950/90 z-0 pointer-events-none" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-4 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-6xl">Build the habit of understanding why.</h1>
          <p className="mt-4 text-slate-400 max-w-2xl text-sm sm:text-base">Master Microsoft Azure fundamentals with adaptive spaced repetition.</p>
          <Link
            href="/practice"
            className="mt-6 rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 sm:mt-8"
          >
            Launch Practice Dashboard
          </Link>
        </div>
      </ImageStreamHero>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 sm:py-8">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm sm:p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-400">Unofficial AZ-900 Practice Tool</p>
            <h2 className="mt-2 text-lg font-semibold sm:text-xl">Build the habit of understanding why the answer is right.</h2>
          </div>
        </header>
      </div>
    </main>
  );
}
