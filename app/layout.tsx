import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import "@xyflow/react/dist/style.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Architecture Playground",
    template: "%s · Architecture Playground",
  },
  description:
    "Design enterprise Azure, AWS, and GCP architectures, control ordered request flows, and export high-quality PNG, SVG, PDF, JSON, or GIF artifacts.",
  applicationName: "Architecture Playground",
  authors: [{ name: "Saurav Raghuvanshi" }],
  openGraph: {
    type: "website",
    siteName: "Architecture Playground",
    title: "Architecture Playground",
    description:
      "Interactive multi-cloud architecture diagram editor with animated request flows.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Architecture Playground",
    description: "Drag-and-drop multi-cloud diagrams with animated request flows.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

const themeInitScript = `
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className={`${GeistSans.variable} font-sans antialiased bg-zinc-950 text-zinc-100`}>
        {children}
      </body>
    </html>
  );
}
