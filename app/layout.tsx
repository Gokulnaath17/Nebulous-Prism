import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const siteUrl = 'https://nebulousprism.dpdns.org';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Prism | Free Browser-Based Image Processor & Compressor',
    template: '%s | Prism',
  },
  description: 'Privacy-first, 100% client-side image tool. Remove EXIF metadata, resize, compress, and convert JPEG, PNG, and WebP images locally in your browser. Zero uploads, zero servers.',
  keywords: [
    'image processor',
    'remove exif',
    'remove metadata',
    'image resizer',
    'image compressor',
    'convert png to jpg',
    'convert jpg to png',
    'webp converter',
    'privacy image tool',
    'client-side image processing',
    'browser image tool',
    'bulk image compression online',
    'zero server image processing'
  ],
  authors: [{ name: 'Prism' }],
  creator: 'Prism',
  publisher: 'Prism',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Prism | Browser-Based Image Processor & Compressor',
    description: 'Sanitize, resize, compress, and convert images entirely in your browser. 100% client-side — zero uploads, zero servers.',
    url: siteUrl,
    siteName: 'Prism',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Prism — Zero-Server Image Processing',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prism | Browser-Based Image Processor & Compressor',
    description: 'Sanitize, resize, compress, and convert images entirely in your browser. 100% client-side — zero uploads, zero servers.',
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'googled1feb423c85e70f6',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' }
    ],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'Prism',
        description: 'Privacy-first, 100% client-side image tool for metadata removal, resizing, compression, and conversion.',
        publisher: {
          '@type': 'Organization',
          name: 'Prism',
          url: siteUrl,
        },
      },
      {
        '@type': 'WebApplication',
        '@id': `${siteUrl}/#webapp`,
        name: 'Prism',
        url: siteUrl,
        description: 'Privacy-first browser-based image processor for removing EXIF metadata, resizing, compressing, and converting images. All processing happens locally in your browser.',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'All',
        browserRequirements: 'Requires HTML5 Canvas and JavaScript',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        featureList: [
          'Client-side EXIF and metadata stripping',
          'Intelligent two-phase JPEG/WebP compression',
          'Lossless PNG dimension-based compression',
          'Pixel dimension constraints with aspect-ratio preservation',
          'Batch image processing and ZIP download',
          '100% private zero-server architecture',
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${siteUrl}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is EXIF metadata?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EXIF (Exchangeable Image File Format) metadata is hidden data embedded in images by cameras and phones. It includes GPS coordinates, device information, timestamps, and camera settings. This data can leak personal information when you share photos online.',
            },
          },
          {
            '@type': 'Question',
            name: 'Why remove metadata?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Removing image metadata protects your privacy. GPS coordinates reveal where you live or work. Camera serial numbers can identify your device. Timestamps expose your daily routine. Stripping this data ensures you share only the visual content you intend to.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is image processing private?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Every operation in Prism runs client-side. Your images are processed using canvas elements in your browser and are never transmitted to any server. No data is stored, logged, or accessible to anyone but you.',
            },
          },
          {
            '@type': 'Question',
            name: 'Supported image formats',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Prism supports JPEG (.jpg), PNG (.png), and WebP (.webp) formats. You can convert between formats, resize to specific file sizes, remove metadata, and process multiple images in batch mode — all with complete privacy.',
            },
          },
        ],
      },
    ],
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
