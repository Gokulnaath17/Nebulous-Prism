import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Remove Image Metadata',
  description: 'Free online tool to remove EXIF and other metadata from images. Strip location data, camera info, and personal details from your photos — all in your browser, no upload required.',
  openGraph: {
    title: 'Remove Image Metadata Online — Prism',
    description: 'Strip EXIF and image metadata instantly in your browser. 100% private, no uploads.',
  },
  twitter: {
    title: 'Remove Image Metadata Online — Prism',
    description: 'Strip EXIF and image metadata instantly in your browser. 100% private, no uploads.',
  },
};

export default function RemoveMetadataPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <Link href="/" className="text-white/40 hover:text-white/80 text-sm transition-colors mb-8 inline-block">&larr; Back to Prism</Link>

        <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Remove Image Metadata</h1>

        <p className="text-lg text-white/70 leading-relaxed mb-8">
          Every digital image carries hidden data — camera settings, GPS coordinates, timestamps, and software information.
          Prism lets you strip all of this metadata from your images in seconds, right in your browser.
        </p>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">How to remove image metadata</h2>
          <ol className="list-decimal list-inside text-white/70 space-y-2 leading-relaxed">
            <li>Open the <Link href="/" className="text-white hover:text-white/80 underline">Prism image tool</Link></li>
            <li>Drag and drop your image onto the dropzone</li>
            <li>Toggle the &quot;Sanitize Core Metadata&quot; option on</li>
            <li>Click &quot;Process Items&quot;</li>
            <li>Download your clean image</li>
          </ol>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">What is image metadata?</h2>
          <p className="text-white/70 leading-relaxed">
            Image metadata includes information stored within the image file by your camera or phone, such as the make and model of the device,
            the date and time the photo was taken, GPS coordinates, exposure settings (aperture, shutter speed, ISO), and software used to edit the image.
            This data is stored in the EXIF (Exchangeable Image File Format) section of JPEG, PNG, TIFF, and WebP files.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Why remove image metadata?</h2>
          <p className="text-white/70 leading-relaxed">
            When you share images online, embedded metadata can leak personal information. GPS coordinates reveal your location. Camera serial numbers
            can identify your device. Timestamps expose your routine. Removing metadata protects your privacy and ensures that only the visual content
            — not hidden data — is shared.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-medium mb-4">Related tools</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/remove-exif" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Remove EXIF Data</Link>
            <Link href="/resize" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Resizer</Link>
            <Link href="/compress" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Compressor</Link>
            <Link href="/webp-converter" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">WebP Converter</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
