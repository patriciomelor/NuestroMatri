import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "NuestroMatri | Planificación de boda",
  description: "Planifiquen su boda, presupuesto, tareas e invitados en un solo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
