import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Free Online Image Resizer',
  description: 'Resize images online for free. Reduce image dimensions and file size without uploading. 100% browser-based image resizing tool with privacy protection.',
  openGraph: {
    title: 'Free Online Image Resizer — Prism',
    description: 'Resize your images in-browser with no uploads. Private, fast, and free.',
  },
  twitter: {
    title: 'Free Online Image Resizer — Prism',
    description: 'Resize your images in-browser with no uploads. Private, fast, and free.',
  },
};

export default function ResizePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <Link href="/" className="text-white/40 hover:text-white/80 text-sm transition-colors mb-8 inline-block">&larr; Back to Prism</Link>

        <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Free Online Image Resizer</h1>

        <p className="text-lg text-white/70 leading-relaxed mb-8">
          Need to resize an image for a website, email, or social media? Prism lets you resize JPEG, PNG, and WebP images
          to a target file size — all in your browser, with no uploads and no compromises on privacy.
        </p>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">How image resizing works</h2>
          <p className="text-white/70 leading-relaxed">
            Prism resizes images by adjusting compression quality and dimensions using a smart binary search algorithm.
            You set a target file size (from 50 KB to 5 MB), and the tool automatically finds the optimal quality setting
            to hit that target. For JPEG files, the algorithm can pad the file to exactly match your desired size.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Supported features</h2>
          <ul className="list-disc list-inside text-white/70 space-y-2 leading-relaxed">
            <li>Resize JPEG, PNG, and WebP images</li>
            <li>Set target file size from 50 KB to 5 MB</li>
            <li>Custom size input for precise control</li>
            <li>Batch mode for resizing multiple images at once</li>
            <li>Smart binary search for optimal quality</li>
            <li>All processing stays on your device</li>
          </ul>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Is image processing private?</h2>
          <p className="text-white/70 leading-relaxed">
            Absolutely. Every operation — resizing, compressing, format conversion, and metadata removal — happens entirely
            in your browser. Your images are processed using the Canvas API and never leave your computer. No data is stored,
            logged, or transmitted. Prism is designed for complete privacy from the ground up.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-medium mb-4">Related tools</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/compress" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Compressor</Link>
            <Link href="/remove-metadata" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Remove Metadata</Link>
            <Link href="/remove-exif" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Remove EXIF</Link>
            <Link href="/webp-converter" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">WebP Converter</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
