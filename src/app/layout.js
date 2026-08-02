import { Inter } from "next/font/google";
import "@/styles/globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ReferralCapture from "@/components/ReferralCapture";
const inter = Inter({ subsets: ["latin"] });

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
export const metadata = {
  title: { default: "AptCasino · Inco × Megapot", template: "%s · AptCasino" },
  description:
    "Four confidential Inco Lightning games with Megapot ticket rewards on Base Sepolia.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    title: "AptCasino · Inco × Megapot",
    description:
      "Confidential games and real Megapot jackpot tickets on Base Sepolia.",
    images: [{ url: "/og.png", width: 1728, height: 960, alt: "AptCasino" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AptCasino · Inco × Megapot",
    description:
      "Confidential games and real Megapot jackpot tickets on Base Sepolia.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body 
        className={`${inter.className} overflow-x-hidden w-full`}
        suppressHydrationWarning={true}
      >
        <Providers>
          <ReferralCapture />
          <Navbar />
          <main id="site-main" className="site-main min-w-0 w-full">
            {children}
          </main>
          <Footer />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
