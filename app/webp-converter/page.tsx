import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Free WebP Image Converter Online',
  description: 'Convert images to and from WebP format online. Reduce file size with modern compression. 100% browser-based conversion, no uploads required.',
  openGraph: {
    title: 'Free WebP Image Converter — Prism',
    description: 'Convert images to and from WebP format. Private, fast, browser-only.',
  },
  twitter: {
    title: 'Free WebP Image Converter — Prism',
    description: 'Convert images to and from WebP format. Private, fast, browser-only.',
  },
};

export default function WebpConverterPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <Link href="/" className="text-white/40 hover:text-white/80 text-sm transition-colors mb-8 inline-block">&larr; Back to Prism</Link>

        <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Free WebP Image Converter</h1>

        <p className="text-lg text-white/70 leading-relaxed mb-8">
          Convert your images to and from WebP format — Google&apos;s modern image format that provides superior compression.
          Prism handles all conversions entirely in your browser with no uploads or servers involved.
        </p>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Why use WebP?</h2>
          <p className="text-white/70 leading-relaxed">
            WebP is a modern image format developed by Google that provides superior lossless and lossy compression.
            WebP images are typically 25-35% smaller than JPEG and PNG files at the same quality, making your website
            load faster and use less bandwidth. WebP supports transparency (like PNG) and animation (like GIF),
            all in a single format. It&apos;s supported by all major modern browsers.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">How to convert to WebP</h2>
          <ol className="list-decimal list-inside text-white/70 space-y-2 leading-relaxed">
            <li>Open the <Link href="/" className="text-white hover:text-white/80 underline">Prism image tool</Link></li>
            <li>Drop your JPEG or PNG files onto the dropzone</li>
            <li>Select &quot;WEBP (.webp)&quot; as the target format</li>
            <li>Optionally set a target file size</li>
            <li>Click process and download your WebP files</li>
          </ol>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-medium mb-4">Related tools</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/png-to-jpg" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">PNG to JPG Converter</Link>
            <Link href="/jpg-to-png" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">JPG to PNG Converter</Link>
            <Link href="/compress" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Compressor</Link>
            <Link href="/resize" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Resizer</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
