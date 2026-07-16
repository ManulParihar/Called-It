import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bungee, Rubik } from "next/font/google";
import "./globals.css";

// Bungee for the big shouty headings, Rubik for everything readable.
const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
});

const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "Called It",
  description: "Predict the match with your friends and see who called it.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Called It",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#180a26",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bungee.variable} ${rubik.variable}`}>
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
