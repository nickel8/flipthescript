import type { Metadata } from "next";
import "./globals.css";
import PaddleProvider from "./components/PaddleProvider";

export const metadata: Metadata = {
  title: "FlipTheScript — Script breakdown software for art departments",
  description:
    "Import your PDF script, tag your elements, export your breakdown. When the next draft lands, your work carries over automatically.",
  openGraph: {
    title: "FlipTheScript",
    description: "Script breakdown software for art departments.",
    siteName: "FlipTheScript",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <PaddleProvider>
          {children}
        </PaddleProvider>
      </body>
    </html>
  );
}
