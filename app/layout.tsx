import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HiddenHire | Stop searching. Start finding.',
  description: 'HiddenHire finds high-match remote and international jobs hiring from India and tells you exactly why you should apply.',
  openGraph: {
    title: 'HiddenHire | Stop searching. Start finding.',
    description: 'Discover remote international jobs in India-friendly roles with transparent match scoring.',
    url: 'http://localhost:3000',
    siteName: 'HiddenHire',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
