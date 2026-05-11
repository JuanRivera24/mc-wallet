import type { Metadata, Viewport } from "next"; // ✅ AÑADIDO: Importamos Viewport
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { ThemeProvider } from "@/context/ThemeContext";
import MobileDock from "@/components/MobileDock"; // 1. IMPORTAMOS EL DOCK
import "./globals.css";

// ✅ AÑADIDO: Configuración visual para la PWA en el celular
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Impide que la pantalla haga zoom accidental al tapear botones rápido
};

// ✅ MODIFICADO: Agregamos las conexiones a tu PWA y soporte para iPhone
export const metadata: Metadata = {
  title: "McWallet",
  description: "Nómina para Crew y Entrenadores",
  manifest: "/manifest.json", // Conecta con tu archivo manifest.json
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "McWallet",
  },
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