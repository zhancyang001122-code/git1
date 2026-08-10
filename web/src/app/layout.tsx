import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { DemoCartProvider } from "@/features/cart/demo-cart";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "小智本地生活 AI 服务助手",
  description: "面向本地生活场景的 AI FDE 作品集项目",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DemoCartProvider>{children}</DemoCartProvider>
      </body>
    </html>
  );
}
