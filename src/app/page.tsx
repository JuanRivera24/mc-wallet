"use client";
import Navbar from "@/components/Navbar";
import ShiftCalculator from "@/components/ShiftCalculator";
import RatesSection from "@/components/RatesSection";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  const { colors } = useTheme();

  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* SECCIÓN HERO - Optimizada para Móvil */}
      <section id="nosotros" className={`flex flex-col items-center justify-center px-5 py-16 md:min-h-[85vh] md:py-0 text-center transition-colors duration-700 ${colors.bg}`}>
        <div className="max-w-5xl mx-auto space-y-8 md:space-y-12">
          
          {/* Badge pequeño */}
          <div className={`inline-block px-4 py-1.5 rounded-full bg-white shadow-sm border ${colors.accent} text-[10px] font-black uppercase tracking-widest ${colors.primary}`}>
            Sistema 2026
          </div>
          
          {/* TÍTULO: Agresivamente más pequeño en móvil (4xl) y gigante en PC (8xl) */}
          <h1 className="text-4xl md:text-8xl lg:text-9xl font-black text-gray-900 tracking-tighter leading-[1.1] md:leading-none">
            Tu esfuerzo, <br className="hidden md:block"/>
            <span className={`${colors.primary} italic underline decoration-gray-200 underline-offset-4 md:underline-offset-8`}>al centavo.</span>
          </h1>
          
          {/* TEXTO: Más pequeño y con menos ancho */}
          <p className="text-base md:text-2xl text-gray-600 font-medium max-w-sm md:max-w-2xl mx-auto leading-relaxed">
            Herramienta hecha por Crews, para Crews.
Cálculos basados rigurosamente en las tablas salariales oficiales de 2026, ten en cuenta que esta app es un simulador independiente.
Los valores mostrados son estimaciones de referencia y pueden variar ligeramente por redondeos del sistema o deducciones específicas. Tu desprendible de pago oficial de Arcos Dorados siempre tendrá la última palabra.
          </p>
          
          {/* BOTONES: Full ancho en móvil (w-full), normales en PC */}
          <div className="flex flex-col w-full md:w-auto md:flex-row gap-3 md:gap-6 justify-center pt-4 md:pt-8 px-2 md:px-0">
            <a href="#calculadora" className={`${colors.secondary} text-white w-full md:w-auto px-8 py-4 rounded-2xl font-black text-sm md:text-lg shadow-xl active:scale-95 transition-all`}>
              CALCULAR TURNO
            </a>
            
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-white text-gray-900 w-full md:w-auto border-2 border-gray-900 px-8 py-4 rounded-2xl font-black text-sm md:text-lg hover:bg-gray-900 hover:text-white transition-all">
                  ENTRAR
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link href="/nominas" className="bg-white text-gray-900 w-full md:w-auto border-2 border-gray-900 px-8 py-4 rounded-2xl font-black text-sm md:text-lg hover:shadow-xl transition-all">
                📂 MIS NÓMINAS
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      <RatesSection />

      {/* CALCULADORA: Menos padding en móvil */}
      <section id="calculadora" className="py-16 md:py-24 bg-gray-50 flex flex-col items-center px-4">
        <div className="mb-8 md:mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2">Simulador Rápido</h2>
          <p className="text-gray-400 font-bold text-xs md:text-sm">Calcula sin guardar</p>
        </div>
        <ShiftCalculator />
      </section>

      <Footer />
    </main>
  );
}