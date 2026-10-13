import type { Metadata } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { MobileNavigation } from "@/components/MobileNavigation";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "NuestroMatri | Planificación de boda",
  description: "Planifiquen su boda, presupuesto, tareas e invitados en un solo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable}`}>
      <body>
        <PwaRegistration />
        <Suspense fallback={null}><MobileNavigation /></Suspense>
        {children}
      </body>
    </html>
  );
}
