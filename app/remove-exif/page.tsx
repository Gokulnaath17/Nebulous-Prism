import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Remove EXIF Data from Images',
  description: 'Free online EXIF remover. Strip GPS location, camera info, and personal metadata from JPEG, PNG, and WebP images. 100% client-side processing, no uploads.',
  openGraph: {
    title: 'Remove EXIF Data from Images — Prism',
    description: 'Strip GPS, camera, and personal metadata from your images. Private, browser-only processing.',
  },
  twitter: {
    title: 'Remove EXIF Data from Images — Prism',
    description: 'Strip GPS, camera, and personal metadata from your images. Private, browser-only processing.',
  },
};

export default function RemoveExifPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <Link href="/" className="text-white/40 hover:text-white/80 text-sm transition-colors mb-8 inline-block">&larr; Back to Prism</Link>

        <h1 className="text-4xl sm:text-5xl font-light tracking-tighter mb-6">Remove EXIF Data from Images</h1>

        <p className="text-lg text-white/70 leading-relaxed mb-8">
          EXIF (Exchangeable Image File Format) data includes camera settings, GPS coordinates, dates, and other hidden information embedded in your photos.
          Prism removes all EXIF data from your images completely client-side — nothing ever leaves your device.
        </p>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">What EXIF data gets removed?</h2>
          <ul className="list-disc list-inside text-white/70 space-y-2 leading-relaxed">
            <li>GPS coordinates and location data</li>
            <li>Camera make, model, and serial number</li>
            <li>Date and time the photo was taken</li>
            <li>Exposure settings (aperture, shutter speed, ISO)</li>
            <li>Focal length and flash information</li>
            <li>Software and editing history</li>
            <li>Thumbnail images embedded in the file</li>
            <li>Copyright and creator information</li>
          </ul>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">Does the website upload files?</h2>
          <p className="text-white/70 leading-relaxed">
            No. Prism processes every image entirely within your browser using the HTML5 Canvas API. Your files are never uploaded to any server,
            never stored, and never transmitted over the network. This is the core privacy guarantee of Prism.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-medium mb-4">How to remove EXIF data</h2>
          <ol className="list-decimal list-inside text-white/70 space-y-2 leading-relaxed">
            <li>Go to the <Link href="/" className="text-white hover:text-white/80 underline">Prism image tool</Link></li>
            <li>Drop your image onto the interface</li>
            <li>Ensure &quot;Sanitize Core Metadata&quot; is enabled</li>
            <li>Click process and download</li>
          </ol>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-medium mb-4">Related tools</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/remove-metadata" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Remove Image Metadata</Link>
            <Link href="/resize" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Resizer</Link>
            <Link href="/compress" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">Image Compressor</Link>
            <Link href="/png-to-jpg" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">PNG to JPG</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
