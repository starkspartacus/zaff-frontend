import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const roboto = Roboto({
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "ZAFF", statusBarStyle: "black-translucent" },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  title: "Zaff | ERP & Caisse POS High-Tech",
  description: "Plateforme de gestion de stock, caisse tactile POS, facturation thermique, SAV et traçabilité pour boutiques et ateliers high-tech.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${roboto.variable} ${robotoMono.variable} dark h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-black text-white font-sans selection:bg-[#d4a017]/30 selection:text-[#f3d98b]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}