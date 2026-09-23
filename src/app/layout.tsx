import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Alimentación Inteligente",
  description: "Inventario de comida y plan de comidas para tu familia",
  applicationName: "Alimentación Inteligente",
  appleWebApp: { capable: true, title: "Alimentación", statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" />
          <ServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
