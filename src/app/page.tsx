"use client";
import Navbar from "@/components/Navbar";
import ShiftCalculator from "@/components/ShiftCalculator";
import RatesSection from "@/components/RatesSection";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  const { colors, isDarkMode } = useTheme();

  return (
    <main className="min-h-screen bg-white dark:bg-[#0a0a0a] transition-colors duration-500">
      <Navbar />

      <section id="nosotros" className={`flex flex-col items-center justify-center px-5 py-16 min-h-[calc(100vh-80px)] text-center transition-colors duration-700 ${colors.bg}`}>
  <div className="max-w-5xl mx-auto space-y-8 md:space-y-10">
    
    <div className={`inline-block px-4 py-1.5 rounded-full bg-white dark:bg-gray-900 shadow-sm border ${colors.accent} dark:border-gray-800 text-[10px] font-black uppercase tracking-widest ${colors.primary}`}>
      Sistema 2026
    </div>
    
    <h1 className="text-4xl md:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white tracking-tighter leading-[1.1] md:leading-none">
      Tu esfuerzo, <br className="hidden md:block"/>
      <span className={`${colors.primary} italic underline decoration-gray-200 dark:decoration-gray-800 underline-offset-4 md:underline-offset-8`}>al centavo.</span>
    </h1>
    
    <p className="text-base md:text-xl text-gray-600 dark:text-gray-400 max-w-sm md:max-w-2xl mx-auto leading-relaxed">
      <span className="font-semibold">Hecho por Crews para Crews con tablas oficiales 2026.</span>{" "}
      Simulador <b>independiente</b> de referencia: los valores son <b>estimados</b> y tu desprendible oficial siempre tendrá la última palabra.
      <br />
      <span className="font-bold text-gray-800 dark:text-gray-300 mt-2 block">Inicia sesión para guardar tus turnos y estimar tus nóminas.</span>
    </p>

    <div className="flex flex-col w-full md:w-auto md:flex-row gap-3 md:gap-5 justify-center pt-4 md:pt-8 px-2 md:px-0">
      <a href="#calculadora" className={`${colors.secondary} text-white w-full md:w-auto px-7 py-3.5 rounded-2xl font-black text-sm md:text-base shadow-xl active:scale-95 transition-all flex items-center justify-center`}>
        CALCULAR TURNO
      </a>
      
      <SignedOut>
        <SignInButton mode="modal">
          <button className="bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white w-full md:w-auto border-2 border-gray-900 dark:border-white px-7 py-3.5 rounded-2xl font-black text-sm md:text-base hover:bg-gray-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all">
            INGRESAR Y VER TUS NÓMINAS
          </button>
        </SignInButton>
      </SignedOut>
      
      <SignedIn>
        <Link href="/nominas" className="bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white w-full md:w-auto border-2 border-gray-900 dark:border-white px-7 py-3.5 rounded-2xl font-black text-sm md:text-base hover:shadow-xl transition-all flex items-center justify-center">
          📂 MIS NÓMINAS
        </Link>
      </SignedIn>
    </div>
  </div>
</section>

      <RatesSection />

      <section id="calculadora" className="py-16 md:py-24 bg-gray-50 dark:bg-black flex flex-col items-center px-4 transition-colors duration-500">
        <div className="mb-8 md:mb-12 text-center max-w-lg mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2 dark:text-white">Simulador Rápido</h2>
          <p className="text-gray-400 font-bold text-xs md:text-sm">
            Calcula sin necesidad de guardar. - <b className="text-gray-600 dark:text-gray-300">Inicia sesión para guardar tus turnos y estimar tus nóminas</b>
          </p>
        </div>
        
        <ShiftCalculator />

        <div className="mt-6 w-full max-w-lg flex flex-col gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 w-full px-8 py-4 rounded-2xl font-black text-sm md:text-lg hover:bg-black dark:hover:bg-gray-200 hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
                🔐 INGRESAR Y GUARDAR TURNOS
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/nominas" className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 w-full px-8 py-4 rounded-2xl font-black text-sm md:text-lg hover:bg-black dark:hover:bg-gray-200 hover:scale-[1.02] active:scale-95 transition-all shadow-xl text-center block">
              📂 IR A MIS NÓMINAS
            </Link>
          </SignedIn>
        </div>
      </section>

      <Footer />
    </main>
  );
}
