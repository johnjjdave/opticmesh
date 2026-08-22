import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host =
    incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol =
    incoming.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "OpticMesh — LED Mapping & Simulation",
    description:
      "Metric LED test patterns, linked wall calculations and Resolume pixel maps for LO2S technical production teams.",
    icons: {
      icon: "/brand/opticmesh-icon.png",
      shortcut: "/brand/opticmesh-icon.png",
      apple: "/brand/opticmesh-icon.png",
    },
    openGraph: {
      title: "OpticMesh",
      description: "Metric LED test patterns and Resolume pixel-map exports for technical production.",
      type: "website",
      images: [
        {
          url: `${origin}/brand/github-social-preview.png`,
          width: 1280,
          height: 640,
          alt: "OpticMesh",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "OpticMesh",
      description: "Metric LED test patterns and Resolume pixel-map exports for technical production.",
      images: [`${origin}/brand/github-social-preview.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
