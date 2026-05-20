import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/toaster";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "WhatsFlow AI — Stop Losing Leads. Let AI Handle Your WhatsApp 24/7.",
  description:
    "AI-powered WhatsApp lead conversion system that automatically replies, qualifies leads, and books appointments for small businesses.",
  keywords: [
    "WhatsApp automation",
    "AI lead generation",
    "appointment booking",
    "small business",
    "WhatsApp AI",
  ],
  openGraph: {
    title: "WhatsFlow AI",
    description: "Stop Losing Leads. Let AI Handle Your WhatsApp — 24/7.",
    type: "website",
  },
  icons: {
    icon: "/logo-robot.png",
  },
};

import { ThemeReset } from "@/components/ThemeReset";
import { EndorselyTracker } from "@/components/EndorselyTracker";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakartaSans.className} antialiased`} suppressHydrationWarning>
        <ThemeReset />
        <EndorselyTracker />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
