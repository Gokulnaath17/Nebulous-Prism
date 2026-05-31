import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Free PNG to JPG Converter Online',
  description: 'Convert PNG images to JPG format online for free. Reduce file size and ensure compatibility. 100% browser-based conversion with no uploads.',
  openGraph: {
    title: 'Free PNG to JPG Converter — Prism',
    description: 'Convert PNG to JPG instantly in your browser. Private, free, no uploads.',
  },
  twitter: {
    title: 'Free PNG to JPG Converter — Prism',
    description: 'Convert PNG to JPG instantly in your browser. Private, free, no uploads.',
  },
};

export default function PngToJpgPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <Link href="/" className="text-white/40 hover:text-white/80 text-sm transition-colors mb-8 inline-block">&larr; Back to Prism</Link>

        <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Free PNG to JPG Converter</h1>

        <p className="text-lg text-white/70 leading-relaxed mb-8">
          Need to convert a PNG image to JPG format? Prism lets you convert PNG to JPG instantly
          — entirely in your browser. No file uploads, no sign-ups, no privacy concerns.
        </p>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Why convert PNG to JPG?</h2>
          <ul className="list-disc list-inside text-white/70 space-y-2 leading-relaxed">
            <li><strong>Smaller file size</strong> — JPG compression typically produces much smaller files than PNG</li>
            <li><strong>Universal compatibility</strong> — JPG is supported by every device and platform</li>
            <li><strong>Faster loading</strong> — Smaller JPG files load faster on websites and in emails</li>
            <li><strong>Photographic images</strong> — JPG is ideal for photos with many colors and gradients</li>
          </ul>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">PNG vs JPG: which format should you use?</h2>
          <p className="text-white/70 leading-relaxed">
            PNG is best for images with text, logos, screenshots, or graphics requiring transparency. It uses lossless
            compression, meaning no quality is lost, but file sizes are larger. JPG is better for photographs and complex
            images with many colors. It uses lossy compression to achieve much smaller file sizes, though some quality
            is traded for size. Choose JPG when file size matters more than perfect quality.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">How to convert PNG to JPG</h2>
          <ol className="list-decimal list-inside text-white/70 space-y-2 leading-relaxed">
            <li>Open the <Link href="/" className="text-white hover:text-white/80 underline">Prism image tool</Link></li>
            <li>Drop your PNG files onto the dropzone</li>
            <li>Select &quot;JPEG (.jpg)&quot; as the target format</li>
            <li>Optionally set a target file size</li>
            <li>Click process and download your JPG files</li>
          </ol>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-medium mb-4">Related tools</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/jpg-to-png" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">JPG to PNG Converter</Link>
            <Link href="/webp-converter" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">WebP Converter</Link>
            <Link href="/compress" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Compressor</Link>
            <Link href="/resize" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Resizer</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
