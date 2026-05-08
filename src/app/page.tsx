"use client";
import Navbar from "@/components/Navbar";
import Onboarding from "@/components/Onboarding";
import ShiftCalculator from "@/components/ShiftCalculator";
import RatesSection from "@/components/RatesSection";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect } from "react";

export default function Home() {
  const { colors, role } = useTheme();

  // --- ANIMACIONES: Efecto Spotlight que sigue el mouse ---
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 60, damping: 20 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, [mouseX, mouseY]);

  return (
    <main className="min-h-screen bg-white dark:bg-[#0a0a0a] transition-colors duration-500">
      <Navbar />
      <Onboarding />

      {/* HERO SECTION CON ANIMACIONES */}
      <section id="nosotros" className={`relative flex flex-col items-center justify-center px-5 min-h-[calc(100svh-72px)] lg:min-h-[calc(100vh-80px)] text-center overflow-hidden transition-colors duration-700 bg-gradient-to-b ${role === 'CREW' ? 'from-blue-50 from-[70%] to-white' : 'from-red-50 from-[70%] to-white'} dark:from-[#0a0a0a] dark:to-[#0a0a0a]`}>

        {/* ✨ Sparkles de fondo */}
        <div className="absolute inset-0 -z-20 pointer-events-none">
          <div className="absolute w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(0,0,0,0.05),transparent)] dark:bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.06),transparent)]" />
          <div className="absolute w-full h-full bg-[radial-gradient(circle_at_80%_70%,rgba(0,0,0,0.04),transparent)] dark:bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.05),transparent)]" />
        </div>

        {/* 💡 Spotlight que sigue el mouse */}
        <motion.div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: `radial-gradient(350px at ${smoothX}px ${smoothY}px, rgba(0,0,0,0.05), transparent 80%)`,
          }}
        />

        {/* 🌈 Aurora de fondo */}
        <div className="absolute -z-10 blur-[120px] opacity-[13%] pointer-events-none">
          <div className={`w-[600px] h-[600px] rounded-full ${role === 'CREW' ? 'bg-blue-400' : 'bg-red-400'}`} />
        </div>

        {/* CONTENIDO PRINCIPAL ANIMADO */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto space-y-8 lg:space-y-10 z-10"
        >
          <motion.h1
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-6xl lg:text-8xl font-black text-gray-900 dark:text-white tracking-tighter leading-[1.1] lg:leading-none"
          >
            Tu esfuerzo, <br className="hidden lg:block" />
            <span className={`${colors.primary} italic underline decoration-gray-200 dark:decoration-gray-800 underline-offset-4 lg:underline-offset-8`}>al centavo.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-base lg:text-xl text-gray-600 dark:text-gray-400 max-w-sm sm:max-w-lg lg:max-w-2xl mx-auto leading-relaxed"
          >
            <span className="font-semibold">Hecho por Crews para Crews con tablas oficiales 2026.</span>{" "}
            Simulador independiente de referencia: los valores son estimados y tu desprendible oficial siempre tendrá la última palabra.
            <br />
            <span className="font-bold text-gray-800 dark:text-gray-300 mt-2 block">Inicia sesión para guardar tus turnos y estimar tus nóminas.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col w-full sm:w-auto sm:flex-row gap-3 lg:gap-5 justify-center pt-4 lg:pt-8 px-2 lg:px-0"
          >
            {/* 🔥 Glow wrapper para el botón principal */}
            <div className="relative w-full sm:w-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 blur-lg opacity-[26%] animate-pulse rounded-2xl" />
              <a href="#calculadora" className={`${colors.secondary} relative text-white w-full sm:w-auto px-7 py-3.5 rounded-2xl font-black text-sm lg:text-base shadow-xl active:scale-95 transition-all flex items-center justify-center`}>
                CALCULAR TURNO
              </a>
            </div>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white w-full sm:w-auto border-2 border-gray-900 dark:border-white px-7 py-3.5 rounded-2xl font-black text-sm lg:text-base hover:bg-gray-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all relative z-10">
                  INGRESAR Y VER TUS NÓMINAS
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link
                href="/nominas"
                className="relative hidden lg:flex items-center justify-center px-7 py-4 rounded-2xl font-black text-sm lg:text-base text-gray-900 dark:text-white bg-white dark:bg-[#0a0a0a] overflow-hidden"
              >
                <span className="absolute inset-0 rounded-2xl border border-gray-300 dark:border-gray-700" />
                <span className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <span className="absolute -inset-[200%] bg-[linear-gradient(120deg,transparent,rgba(255,215,0,0.58),transparent)] animate-[borderRun_3s_linear_infinite]" />
                </span>
                <span className="relative z-10 flex items-center gap-2">
                  📂 MIS NÓMINAS
                </span>
              </Link>
            </SignedIn>
          </motion.div>
        </motion.div>

        {/* FLECHA ANIMADA RESTAURADA */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 lg:hidden flex flex-col items-center justify-center opacity-50 animate-bounce z-10 w-full">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Desliza</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-gray-400 dark:text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </section>

      <RatesSection />

      {/* CALCULADORA CON REVEAL ANIMADO */}
      <section id="calculadora" className="py-16 lg:py-24 bg-gray-50 dark:bg-black flex flex-col items-center px-4 transition-colors duration-500">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 lg:mb-12 text-center max-w-lg mx-auto"
        >
          <h2 className="text-3xl lg:text-4xl font-black tracking-tighter mb-2 dark:text-white">Simulador Rápido</h2>
          <p className="text-gray-400 font-bold text-xs lg:text-sm">
            Calcula sin necesidad de guardar. - <b className="text-gray-600 dark:text-gray-300">Inicia sesión para guardar tus turnos y estimar tus nóminas</b>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="w-full max-w-lg"
        >
          <ShiftCalculator />
        </motion.div>

        {/* BOTONES INFERIORES RESTAURADOS */}
        <div className="mt-6 w-full max-w-lg flex flex-col gap-3 relative z-10">
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