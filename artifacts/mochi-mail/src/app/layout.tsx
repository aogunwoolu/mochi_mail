import type { Metadata, Viewport } from "next";
import { Inter, Space_Mono } from "next/font/google";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { MochiProvider } from "@/context/MochiContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-geist-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MochiMail",
  description: "Digital stationery, stickers, and snail mail — reimagined",
  manifest: "/manifest.json",
  icons: {
    icon: "/brand-mark.svg",
    shortcut: "/brand-mark.svg",
    apple: "/brand-mark.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MochiMail",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fff8ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceMono.variable} h-full`}>
      <body className="relative min-h-svh font-sans antialiased">
        <ServiceWorkerRegistration />
        <MochiProvider>{children}</MochiProvider>
      </body>
    </html>
  );
}
