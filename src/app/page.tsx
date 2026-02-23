"use client";
import Navbar from "@/components/Navbar";
import ShiftCalculator from "@/components/ShiftCalculator";
import RatesSection from "@/components/RatesSection";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  const { colors, role } = useTheme();

  return (
    <main className="min-h-screen bg-white dark:bg-[#0a0a0a] transition-colors duration-500">
      <Navbar />

      {/* AJUSTE DEFINITIVO:
        - pt-12: Pega el texto a la navbar en celular.
        - lg:justify-center: En PC lo centra todo normal.
        - min-h-[calc(100svh-72px)]: Garantiza que Tarifas NUNCA se vea al abrir en celular.
      */}
      <section id="nosotros" className={`flex flex-col items-center pt-12 lg:pt-0 lg:justify-center px-5 min-h-[calc(100svh-72px)] lg:min-h-[calc(100vh-80px)] text-center transition-colors duration-700 bg-gradient-to-b ${role === 'CREW' ? 'from-blue-50 from-[70%] to-white' : 'from-red-50 from-[70%] to-white'} dark:from-[#0a0a0a] dark:to-[#0a0a0a]`}>
        <div className="max-w-5xl mx-auto space-y-8 lg:space-y-10 z-10">

          <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black text-gray-900 dark:text-white tracking-tighter leading-[1.1] lg:leading-none">
            Tu esfuerzo, <br className="hidden lg:block"/>
            <span className={`${colors.primary} italic underline decoration-gray-200 dark:decoration-gray-800 underline-offset-4 lg:underline-offset-8`}>al centavo.</span>
          </h1>

          <p className="text-base lg:text-xl text-gray-600 dark:text-gray-400 max-w-sm sm:max-w-lg lg:max-w-2xl mx-auto leading-relaxed">
            <span className="font-semibold">Hecho por Crews para Crews con tablas oficiales 2026.</span>{" "}
            Simulador independiente de referencia: los valores son estimados y tu desprendible oficial siempre tendrá la última palabra.
            <br />
            <span className="font-bold text-gray-800 dark:text-gray-300 mt-2 block">Inicia sesión para guardar tus turnos y estimar tus nóminas.</span>
          </p>

          <div className="flex flex-col w-full sm:w-auto sm:flex-row gap-3 lg:gap-5 justify-center pt-4 lg:pt-8 px-2 lg:px-0">
            <a href="#calculadora" className={`${colors.secondary} text-white w-full sm:w-auto px-7 py-3.5 rounded-2xl font-black text-sm lg:text-base shadow-xl active:scale-95 transition-all flex items-center justify-center`}>
              CALCULAR TURNO
            </a>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white w-full sm:w-auto border-2 border-gray-900 dark:border-white px-7 py-3.5 rounded-2xl font-black text-sm lg:text-base hover:bg-gray-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all">
                  INGRESAR Y VER TUS NÓMINAS
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link href="/nominas" className="hidden lg:flex bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white w-full lg:w-auto border-2 border-gray-900 dark:border-white px-7 py-3.5 rounded-2xl font-black text-sm lg:text-base hover:shadow-xl transition-all items-center justify-center">
                📂 MIS NÓMINAS
              </Link>
            </SignedIn>
          </div>
        </div>

        {/* TRUCO VISUAL: Indicador de Scroll para rellenar el hueco inferior de forma profesional (Solo en móviles) */}
        <div className="mt-auto pb-8 lg:hidden flex flex-col items-center justify-center opacity-50 animate-bounce z-10">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Desliza</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-gray-400 dark:text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </section>

      <RatesSection />

      <section id="calculadora" className="py-16 lg:py-24 bg-gray-50 dark:bg-black flex flex-col items-center px-4 transition-colors duration-500">
        <div className="mb-8 lg:mb-12 text-center max-w-lg mx-auto">
          <h2 className="text-3xl lg:text-4xl font-black tracking-tighter mb-2 dark:text-white">Simulador Rápido</h2>
          <p className="text-gray-400 font-bold text-xs lg:text-sm">
            Calcula sin necesidad de guardar. - <b className="text-gray-600 dark:text-gray-300">Inicia sesión para guardar tus turnos y estimar tus nóminas</b>
          </p>
        </div>

        <ShiftCalculator />

        <div className="mt-6 w-full max-w-lg flex flex-col gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 w-full px-8 py-4 rounded-2xl font-black text-sm lg:text-lg hover:bg-black dark:hover:bg-gray-200 hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
                🔐 INGRESAR Y GUARDAR TURNOS
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/nominas" className="hidden lg:block bg-gray-900 dark:bg-white text-white dark:text-gray-900 w-full px-8 py-4 rounded-2xl font-black text-sm lg:text-lg hover:bg-black dark:hover:bg-gray-200 hover:scale-[1.02] active:scale-95 transition-all shadow-xl text-center">
              📂 IR A MIS NÓMINAS
            </Link>
          </SignedIn>
        </div>
      </section>

      <Footer />
    </main>
  );
}
