import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Free Online Image Compressor',
  description: 'Compress JPEG, PNG, and WebP images online for free. Reduce file size without uploading. 100% browser-based image compression with privacy protection.',
  openGraph: {
    title: 'Free Online Image Compressor — Prism',
    description: 'Compress your images in-browser with no uploads. Reduce file size while protecting your privacy.',
  },
  twitter: {
    title: 'Free Online Image Compressor — Prism',
    description: 'Compress your images in-browser with no uploads. Reduce file size while protecting your privacy.',
  },
};

export default function CompressPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <Link href="/" className="text-white/40 hover:text-white/80 text-sm transition-colors mb-8 inline-block">&larr; Back to Prism</Link>

        <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Free Online Image Compressor</h1>

        <p className="text-lg text-white/70 leading-relaxed mb-8">
          Reduce your image file sizes without sacrificing quality. Prism compresses JPEG, PNG, and WebP images
          entirely in your browser using intelligent compression algorithms — no uploads, no servers, complete privacy.
        </p>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">How compression works</h2>
          <p className="text-white/70 leading-relaxed">
            Prism uses a binary search algorithm to find the optimal compression quality for your target file size.
            For JPEG and WebP images, it adjusts the quality parameter between 5% and 100% until the output matches
            your desired size. For PNG images, it uses dimension-based scaling since PNG is a lossless format.
            The algorithm typically converges within 12 iterations, giving you the best possible quality at your target size.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Supported formats</h2>
          <p className="text-white/70 leading-relaxed">
            Prism supports all common image formats: JPEG (.jpg), PNG (.png), and WebP (.webp). You can either
            keep the original format or convert to a different one during compression. Each format has different
            compression characteristics — JPEG offers the smallest file sizes, PNG is lossless but larger, and WebP
            provides excellent compression with modern browser support.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">When to compress images</h2>
          <ul className="list-disc list-inside text-white/70 space-y-2 leading-relaxed">
            <li>Uploading images to websites or blogs</li>
            <li>Sending images via email</li>
            <li>Sharing on social media platforms</li>
            <li>Reducing storage space on your device</li>
            <li>Preparing images for printing or archiving</li>
          </ul>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-medium mb-4">Related tools</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/resize" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Resizer</Link>
            <Link href="/remove-metadata" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Remove Metadata</Link>
            <Link href="/png-to-jpg" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">PNG to JPG</Link>
            <Link href="/jpg-to-png" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">JPG to PNG</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
