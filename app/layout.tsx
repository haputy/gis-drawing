import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GIS Drawing Tool',
  description: 'Draw and save polygon features over satellite imagery',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
