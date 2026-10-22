"use client";
import { ImageStreamHero } from "@/components/ui/image-stream-hero";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeInitialized, setThemeInitialized] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("az900-theme");
    const nextTheme =
      savedTheme === "dark" ||
      (savedTheme === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    setTheme(nextTheme);
    setThemeInitialized(true);
  }, []);

  useEffect(() => {
    if (!themeInitialized) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("az900-theme", theme);
  }, [theme, themeInitialized]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <ImageStreamHero
        images={[
          { src: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80", alt: "Cloud" },
          { src: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80", alt: "Servers" },
          { src: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80", alt: "Security" },
        ]}
        className="h-[420px] w-full"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/50 to-background/90 z-0 pointer-events-none" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-6">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">Build the habit of understanding why.</h1>
          <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-2xl">Master Microsoft Azure fundamentals with adaptive spaced repetition.</p>
          <Link
            href="/practice"
            className="mt-8 rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Launch Practice Dashboard
          </Link>
        </div>
      </ImageStreamHero>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-600">Unofficial AZ-900 Practice Tool</p>
            <h2 className="mt-2 text-xl font-semibold">Build the habit of understanding why the answer is right.</h2>
          </div>
        </header>
      </div>
    </main>
  );
}
