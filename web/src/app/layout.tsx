import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { DemoCartProvider } from "@/features/cart/demo-cart";
import { SelectedLocationProvider } from "@/features/location/selected-location-provider";
import { gcj02ToWgs84 } from "@/features/maps/coordinate-systems";
import { publicEnv } from "@/lib/env";

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
  title: "小智租房决策助手",
  description: "结合历史房源、高德地图与可引用租赁知识的 AI 解决方案交付作品",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const configuration = publicEnv();
  const defaultPoint = {
    longitude: configuration.NEXT_PUBLIC_DEFAULT_LONGITUDE,
    latitude: configuration.NEXT_PUBLIC_DEFAULT_LATITUDE,
  };
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SelectedLocationProvider
          defaultLocation={{
            name: configuration.NEXT_PUBLIC_DEFAULT_LOCATION_NAME,
            city: configuration.NEXT_PUBLIC_DEFAULT_CITY,
            point: defaultPoint,
            wgs84Point: gcj02ToWgs84(defaultPoint),
            source: "default",
          }}
        >
          <DemoCartProvider>{children}</DemoCartProvider>
        </SelectedLocationProvider>
      </body>
    </html>
  );
}
