import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GULA EXPRESS Rewards",
    template: "%s | GULA EXPRESS",
  },
  description:
    "Join GULA EXPRESS Rewards, earn points, and keep your loyalty pass in Apple Wallet or Google Wallet.",
  applicationName: "GULA EXPRESS Rewards",
  icons: {
    icon: "/gula-wallet-logo.png",
    apple: "/gula-wallet-logo.png",
  },
};

export const viewport: Viewport = {
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
