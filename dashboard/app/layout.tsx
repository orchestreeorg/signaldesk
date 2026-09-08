import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "signal-desk ops",
  description: "Live worker console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
