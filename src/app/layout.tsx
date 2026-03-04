import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PulseForge Management",
  description: "Project Workspace",
  icons: {
    icon: "/WhatsApp%20Image%202025-11-13%20at%2017.19.42_d06efc8c.jpg",
    shortcut: "/WhatsApp%20Image%202025-11-13%20at%2017.19.42_d06efc8c.jpg",
    apple: "/WhatsApp%20Image%202025-11-13%20at%2017.19.42_d06efc8c.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
