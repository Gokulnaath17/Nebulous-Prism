import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Prism | Image Processor',
  description: 'Sanitize, compress, and convert images via drag-and-drop.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="font-sans bg-black text-white antialiased min-h-screen selection:bg-white/30 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
