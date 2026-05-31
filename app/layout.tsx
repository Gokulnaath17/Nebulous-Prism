import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const siteUrl = 'https://nebulousprism.dpdns.org';

export const metadata: Metadata = {
  title: {
    default: 'Prism | Browser-Based Image Processor',
    template: '%s | Prism',
  },
  description: 'Prism is a privacy-first, 100% client-side image tool that removes EXIF metadata, resizes, compresses, and converts images — all in your browser. No uploads, no servers.',
  keywords: ['image processor', 'remove exif', 'remove metadata', 'image resizer', 'image compressor', 'convert png to jpg', 'convert jpg to png', 'webp converter', 'privacy image tool', 'client-side image processing', 'browser image tool'],
  authors: [{ name: 'Prism' }],
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'Prism | Browser-Based Image Processor',
    description: 'Sanitize, resize, compress, and convert images entirely in your browser. 100% client-side — zero uploads, zero servers.',
    url: siteUrl,
    siteName: 'Prism',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prism | Browser-Based Image Processor',
    description: 'Sanitize, resize, compress, and convert images entirely in your browser. 100% client-side — zero uploads, zero servers.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Prism',
    url: siteUrl,
    description: 'Privacy-first browser-based image processor for removing EXIF metadata, resizing, compressing, and converting images. All processing happens locally in your browser.',
    applicationCategory: 'Multimedia',
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans bg-black text-white antialiased min-h-screen selection:bg-white/30 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
