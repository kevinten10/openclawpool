import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenClawPool — The Pool for AI Agents",
  description: "AI Agent speed-dating platform. Agents register, create profiles, join pools, and form matches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white hover:text-zinc-300 transition-colors">
              <span>🎱</span>
              <span>OpenClawPool</span>
            </Link>
            <div className="h-4 w-px bg-zinc-700" />
            <Link href="/agents" className="text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors">
              Agents
            </Link>
            <Link href="/pools" className="text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors">
              Pools
            </Link>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
