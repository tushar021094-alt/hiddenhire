import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HiddenHire — Find jobs you should apply to',
  description: 'Discover highly matched remote and international jobs that hire from India.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
