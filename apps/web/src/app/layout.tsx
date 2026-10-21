import { BRANDING } from "@starter/config/branding";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";
import { getServices } from "@/server/services";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getServices().settings.getSafe();
  const title = settings?.metaTitle?.trim() || settings?.appName || BRANDING.appName;
  const description = settings?.metaDescription?.trim() || settings?.appDescription || BRANDING.description;
  const appUrl = settings?.appUrl?.trim() || getServices().appUrl;
  let image = settings?.ogImage?.trim() || undefined;
  if (image && !image.startsWith("http")) image = `${appUrl.replace(/\/$/, "")}/${image.replace(/^\//, "")}`;
  return {
    metadataBase: new URL(appUrl),
    title: { default: title, template: `%s · ${settings?.appName || BRANDING.appName}` },
    description,
    openGraph: { title, description, url: appUrl, images: image ? [{ url: image }] : undefined, type: "website" },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getServices().settings.getSafe();
  return (
    <html lang="en" data-app-theme={settings?.appTheme ?? BRANDING.defaultTheme} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
