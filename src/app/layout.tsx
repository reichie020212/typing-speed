import type { Metadata } from 'next';
import { Footer } from '@/components/chrome/Footer';
import { Header } from '@/components/chrome/Header';
import { ThemeProvider } from '@/components/chrome/ThemeProvider';
import { geistMono } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Typing Speed',
  description: 'Test your typing speed. Race later.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={geistMono.variable}>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
