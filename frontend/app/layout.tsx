import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();
  return {
    metadataBase: base,
    title: { default: "Aparaitech AI Interview", template: "%s · Aparaitech AI Interview" },
    description: "AI-powered interviews with adaptive questioning, evidence-rich evaluation and secure candidate reports.",
    icons: { icon: "/aparaitech-logo.png", shortcut: "/aparaitech-logo.png" },
    openGraph: { title: "Aparaitech AI Interview", description: "AI Interviews. Smarter Hiring. Better Future.", images: [{ url: image, width: 1672, height: 942, alt: "Aparaitech AI Interview" }] },
    twitter: { card: "summary_large_image", title: "Aparaitech AI Interview", description: "Intelligent interviews. Evidence you can trust.", images: [image] }
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
