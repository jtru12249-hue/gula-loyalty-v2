import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GULA EXPRESS Rewards",
  description: "GULA EXPRESS loyalty rewards",
  applicationName: "GULA EXPRESS Rewards",
};

export const viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

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
