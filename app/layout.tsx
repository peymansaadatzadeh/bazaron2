
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "./components/navbar";
import BottomNav from "./components/bottomNav";

export const metadata: Metadata = {
  title: "بازاران",
  description: "مارکت‌پلیس چند فروشندگی",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans antialiased bg-gray-50">
        <Navbar />

        <div className="pb-16 md:pb-0">
          {children}
        </div>

        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
