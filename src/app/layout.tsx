import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bungee, Inter, Courier_Prime } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "@/lib/wallet/WalletProvider";
import { MotionRoot } from "@/components/MotionRoot";
import { SoundToggle } from "@/components/SoundToggle";

// Bungee for the arcade-sign headlines, Courier Prime for everything printed on
// a slip, Inter for the readable in-between.
const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const courier = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-courier",
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
  viewportFit: "cover",
  themeColor: "#0e211a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bungee.variable} ${inter.variable} ${courier.variable}`}
    >
      <body>
        <WalletProviders>
          <MotionRoot>
            <div className="shell">{children}</div>
            <SoundToggle />
          </MotionRoot>
        </WalletProviders>
      </body>
    </html>
  );
}
