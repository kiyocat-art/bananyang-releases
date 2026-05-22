import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import { PaddleScript } from "@/components/PaddleScript";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "BanaNyang — AI Workspace for Artists",
  description:
    "무한 캔버스 위에서 모든 영감이 연결됩니다. 2D/3D 아티스트를 위한 가장 자유로운 AI 워크스페이스.",
  keywords: [
    "AI",
    "workspace",
    "concept art",
    "illustration",
    "infinite canvas",
    "BanaNyang",
  ],
  openGraph: {
    title: "BanaNyang — AI Workspace for Artists",
    description:
      "수백 장의 레퍼런스를 펼치고, 섞고, 즉시 새로운 컨셉으로 탄생시키세요.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.variable} antialiased`}>
        {/* Paddle — loaded once, available across all pages */}
        <PaddleScript />
        {/* Language provider — wraps entire app */}
        <LanguageProvider>
          {/* Firebase Auth provider — wraps entire app */}
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
