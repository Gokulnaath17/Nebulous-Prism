import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Free JPG to PNG Converter Online',
  description: 'Convert JPG images to PNG format online for free. Preserve quality and add transparency support. 100% browser-based conversion with no uploads.',
  openGraph: {
    title: 'Free JPG to PNG Converter — Prism',
    description: 'Convert JPG to PNG instantly in your browser. Free, private, no uploads.',
  },
  twitter: {
    title: 'Free JPG to PNG Converter — Prism',
    description: 'Convert JPG to PNG instantly in your browser. Free, private, no uploads.',
  },
};

export default function JpgToPngPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <Link href="/" className="text-white/40 hover:text-white/80 text-sm transition-colors mb-8 inline-block">&larr; Back to Prism</Link>

        <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Free JPG to PNG Converter</h1>

        <p className="text-lg text-white/70 leading-relaxed mb-8">
          Convert your JPG images to PNG format while preserving quality. Prism processes everything
          in your browser — no uploads, no servers, complete privacy.
        </p>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Why convert JPG to PNG?</h2>
          <ul className="list-disc list-inside text-white/70 space-y-2 leading-relaxed">
            <li><strong>Lossless quality</strong> — PNG uses lossless compression, preserving every pixel</li>
            <li><strong>Transparency support</strong> — PNG supports alpha channels for transparent backgrounds</li>
            <li><strong>No artifacts</strong> — Unlike JPG, PNG has no compression artifacts or banding</li>
            <li><strong>Better for text and graphics</strong> — PNG excels at sharp edges, text, and solid colors</li>
            <li><strong>Ideal for editing</strong> — PNG is a preferred format for images that need further editing</li>
          </ul>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Supported image formats</h2>
          <p className="text-white/70 leading-relaxed">
            Prism supports JPEG, PNG, and WebP formats. You can convert between any of these formats
            while optionally adjusting the file size and stripping metadata — all in one pass. The tool
            also handles batch processing, so you can convert multiple images at once.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-medium mb-4">Related tools</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/png-to-jpg" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">PNG to JPG Converter</Link>
            <Link href="/webp-converter" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">WebP Converter</Link>
            <Link href="/compress" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Compressor</Link>
            <Link href="/resize" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Resizer</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
