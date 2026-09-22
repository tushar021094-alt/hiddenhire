import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HiddenHire — AI Career Intelligence',
  description: 'AI-powered career intelligence for discovering jobs that actually fit your profile.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
