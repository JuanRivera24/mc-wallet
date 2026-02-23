import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { ThemeProvider } from "@/context/ThemeContext";
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
        {/* Quitamos bg-white de aquí para que funcione el Dark Mode */}
        <body className="antialiased transition-colors duration-500 bg-white dark:bg-[#0a0a0a]">
          <ThemeProvider>
            {children}
          </ThemeProvider>
          {children}
        <MobileDock />
        </body>
      </html>
    </ClerkProvider>
  );
}
