import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/nav/Navigation";
import AuthProvider from "@/components/AuthProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
});

export const metadata: Metadata = {
  title: "GamerMatch - Find Your Perfect Gaming Partner",
  description: "Tinder for Gamers but Anti-Toxic. Match with players based on personality and playstyle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${rajdhani.variable} font-sans antialiased`}>
        <AuthProvider />
        {children}
        <Navigation />
      </body>
    </html>
  );
}

