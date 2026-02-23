import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { ThemeProvider } from "@/context/ThemeContext";
import MobileDock from "@/components/MobileDock"; // 1. IMPORTAMOS EL DOCK
import "./globals.css";

export const metadata: Metadata = {
  title: "McWallet",
  description: "Nómina para Crew y Entrenadores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={esES}>
      <html lang="es">
        <body className="antialiased transition-colors duration-500 bg-white dark:bg-[#0a0a0a]">
          <ThemeProvider>
            {/* 2. EL DOCK Y CHILDREN DEBEN IR ADENTRO DEL THEMEPROVIDER */}
            {children}
            <MobileDock />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
