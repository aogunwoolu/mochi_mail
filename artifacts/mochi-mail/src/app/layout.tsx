import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mochi Mail",
  description: "A cozy digital letter-writing studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
