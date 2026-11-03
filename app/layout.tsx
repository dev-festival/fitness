import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Steady — A little better, every day", description: "Your personal space for drinking less, getting stronger, and feeling better.", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
