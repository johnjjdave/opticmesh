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
    title: "LO2S - OpticMesh",
    description:
      "LED test patterns, Resolume pixel maps, and physically scaled 3D scene layout for technical production.",
    icons: {
      icon: "/brand/opticmesh-icon.png",
      shortcut: "/brand/opticmesh-icon.png",
      apple: "/brand/opticmesh-icon.png",
    },
    openGraph: {
      title: "LO2S - OpticMesh",
      description: "LED test patterns, Resolume pixel maps, and physically scaled 3D scene layout.",
      type: "website",
      images: [
        {
          url: `${origin}/brand/opticmesh-icon.png`,
          width: 1254,
          height: 1254,
          alt: "LO2S - OpticMesh",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "LO2S - OpticMesh",
      description: "LED test patterns, Resolume pixel maps, and physically scaled 3D scene layout.",
      images: [`${origin}/brand/opticmesh-icon.png`],
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
