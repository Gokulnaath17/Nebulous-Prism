import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 - Page Not Found | Prism',
  description: 'The requested resource could not be found.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F5F5F7] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-2xl">
        <span className="text-xs uppercase tracking-[0.4em] text-white/40 mb-3 block font-mono">404 Exception</span>
        <h1 className="text-3xl font-light tracking-tight mb-3">Payload Vector Not Found</h1>
        <p className="text-sm text-white/60 mb-8 leading-relaxed">
          The requested page does not exist or has been relocated. All image processing operations remain available on the home terminal.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-white/90 transition-all"
        >
          Return to Terminal
        </Link>
      </div>
    </main>
  );
}

