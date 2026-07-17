import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Anton, Archivo, Courier_Prime } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "@/lib/wallet/WalletProvider";
import { MotionRoot } from "@/components/MotionRoot";

// Anton for the back-page headlines, Courier Prime for everything printed on
// a slip, Archivo for the readable in-between.
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
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
      className={`${anton.variable} ${archivo.variable} ${courier.variable}`}
    >
      <body>
        <WalletProviders>
          <MotionRoot>
            <div className="shell">{children}</div>
          </MotionRoot>
        </WalletProviders>
      </body>
    </html>
  );
}
