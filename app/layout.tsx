import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/navbar";
import BottomNav from "./components/
import { Suspense } from "react";

<Suspense fallback={null}>
  <BottomNav />
</Suspense>   // ✅ مسیر اصلاح شد

export const metadata: Metadata = {
  title: "بازار شهر",
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

        <BottomNav />
      </body>
    </html>
  );
}