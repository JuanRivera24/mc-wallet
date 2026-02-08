"use client";
import Navbar from "@/components/Navbar";
import ShiftCalculator from "@/components/ShiftCalculator";
import RatesSection from "@/components/RatesSection";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  const { colors, themeColor } = useTheme();

  return (
    <main className="min-h-screen">
      <Navbar />

      {/* SECCIÓN NOSOTROS (FULL HERO) */}
      <section id="nosotros" className={`min-h-[85vh] flex flex-col items-center justify-center px-4 text-center transition-colors duration-700 ${colors.bg}`}>
        <div className="max-w-4xl mx-auto space-y-10">
          <div className={`inline-block px-6 py-2 rounded-full bg-white shadow-sm border ${colors.accent} text-xs font-black uppercase tracking-widest ${colors.primary}`}>
            Sistema de Liquidación 2026
          </div>
          
          <h1 className="text-6xl md:text-[100px] font-black text-gray-900 tracking-tighter leading-none">
            Tu esfuerzo, <br/>
            <span className={`${colors.primary} italic underline decoration-gray-200 underline-offset-8`}>al centavo.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 font-medium max-w-2xl mx-auto leading-relaxed">
            McWallet es la única app diseñada por y para empleados de <strong>Arcos Dorados Colombia</strong>. 
            Cálculos <strong>estimados</strong> y precisos según valores oficiales 2026.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center pt-8">
            <a href="#calculadora" className={`${colors.secondary} text-white px-12 py-5 rounded-2xl font-black text-lg shadow-2xl hover:scale-105 transition-all`}>
              CALCULAR TURNO
            </a>
            
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-white text-gray-900 border-2 border-gray-900 px-12 py-5 rounded-2xl font-black text-lg hover:bg-gray-900 hover:text-white transition-all">
                  INICIAR SESIÓN
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link href="/nominas" className="bg-white text-gray-900 border-2 border-gray-900 px-12 py-5 rounded-2xl font-black text-lg hover:shadow-xl transition-all">
                📂 VER MIS NÓMINAS
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      <RatesSection />

      <section id="calculadora" className="py-24 bg-gray-50 flex flex-col items-center">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black tracking-tighter mb-2">Simulador Rápido</h2>
          <p className="text-gray-400 font-bold uppercase text-[10px]">Calcula tu turno individual</p>
        </div>
        <ShiftCalculator />
      </section>

      <Footer />
    </main>
  );
}