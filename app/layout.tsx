import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drape | Digital Wardrobe",
  description: "Digitize your wardrobe from Gmail receipts and unlock actionable style intelligence."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
