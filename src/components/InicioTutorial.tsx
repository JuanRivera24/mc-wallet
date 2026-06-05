"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function InicioTutorial() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { role, setRole, isDarkMode, toggleDarkMode, themeColor } = useTheme();
  const { hapticLight, hapticSuccess } = useHaptics();
  const router = useRouter();

  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const activeBg = themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';

  const TUTORIAL_STEPS = [
    {
      target: null,
      title: "¡Bienvenido a McWallet! 🍔",
      text: "Tu esfuerzo, calculado al centavo. Una herramienta independiente hecha por y para el equipo. Vamos a dar un paseo rápido para configurarla a tu medida.",
    },
    {
      target: "nav-role-toggle",
      title: "¿Cuál es tu rol? 🍟🎓",
      text: "Las tarifas cambian dependiendo de si eres Crew o Entrenador. Arriba en el menú siempre verás tu rol actual, pero confírmalo aquí abajo para ajustar tus cálculos:",
      hasRoleSelector: true,
    },
    {
      target: "footer-theme-toggle",
      title: "Elige tu estilo ☀️🌙",
      text: "Abajo en la página encontrarás el botón para cambiar el tema cuando quieras. ¿Cómo prefieres usar la app ahora mismo?",
      hasThemeSelector: true,
    },
    {
      target: "tarifas",
      title: "Tus Tarifas Oficiales 💰",
      text: "Aquí abajo siempre tendrás a la mano las tablas actualizadas. 💡 Atajo PRO: Dale doble clic a cualquier tarjeta para leer una explicación detallada de cómo funciona ese recargo.",
    },
    {
      target: "hero-nominas-btn",
      title: "¡Hora de facturar! 🚀",
      text: "Ya estás listo. Tu siguiente paso es ir a 'Mis Nóminas' para empezar a registrar tus turnos y llevar el control exacto de tu dinero. ¡A darle!",
    }
  ];

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn || !user) {
      setIsVisible(false);
      return;
    }

    const storageKey = `mcwallet_onboarding_${user.id}`;
    if (!localStorage.getItem(storageKey)) {
      const timer = setTimeout(() => setIsVisible(true), 800); 
      return () => clearTimeout(timer);
    }
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isVisible) return;

    const currentStepData = TUTORIAL_STEPS[step];
    const currentTargetId = currentStepData.target;

    if (!currentTargetId) {
      setTargetRect(null);
      if (step === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const timer = setTimeout(() => {
      const el = document.getElementById(currentTargetId);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - (window.innerHeight / 2) + (el.clientHeight / 2);
        window.scrollTo({ top: y, behavior: 'smooth' });

        setTimeout(() => {
          setTargetRect(el.getBoundingClientRect());
        }, 400);
      } else {
        setTargetRect(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [step, isVisible]);

  useEffect(() => {
    if (isVisible) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [isVisible]);

  const handleNext = () => {
    hapticLight();
    if (step < TUTORIAL_STEPS.length - 1) setStep(step + 1);
    else finishTutorial(true); // El último botón redirige
  };

  const finishTutorial = (goToNominas: boolean = false) => {
    hapticSuccess();
    if (user) localStorage.setItem(`mcwallet_onboarding_${user.id}`, 'true');
    setIsVisible(false);
    if (goToNominas) router.push('/nominas');
  };

  if (!isVisible) return null;

  const currentData = TUTORIAL_STEPS[step];
  const mascotImg = role === 'ENTRENADOR' ? '/entr.png' : '/crew.png';
  const mascotLabel = role === 'ENTRENADOR' ? 'Entrenador' : 'Crew';

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto font-sans">
      
      {/* 🟢 SPOTLIGHT DINÁMICO (Hueco nítido) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        <motion.div
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
          style={{
            position: "absolute",
            top: targetRect ? targetRect.top - 16 : "50%",
            left: targetRect ? targetRect.left - 16 : "50%",
            width: targetRect ? targetRect.width + 32 : 0,
            height: targetRect ? targetRect.height + 32 : 0,
            borderRadius: "1.5rem",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)", // Solo la sombra oscurece, el centro es transparente
            transform: targetRect ? "none" : "translate(-50%, -50%)",
          }}
          className="transition-all duration-300 ring-4 ring-white/60 dark:ring-white/30"
        />
      </div>

      {/* 📱 TARJETA DE DIÁLOGO */}
      <div className="absolute inset-x-0 bottom-0 p-4 pb-8 sm:p-6 sm:pb-8 pointer-events-none flex flex-col items-center z-50">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white dark:bg-[#121212] w-full max-w-[500px] rounded-[2.2rem] p-7 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-gray-800 pointer-events-auto"
          >
            {/* Avatar Real */}
            <div className="flex items-center gap-4 mb-5">
              <div className="relative w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800/50 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                <Image 
                  src={mascotImg} 
                  alt={mascotLabel} 
                  fill 
                  className="object-cover object-top scale-[1.3] translate-y-2" 
                />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                  Guía {mascotLabel}
                </p>
                <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mt-1">
                  {currentData.title}
                </h3>
              </div>
            </div>

            {/* Mensaje */}
            <p className="text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed font-medium mb-6">
              {currentData.text}
            </p>

            {currentData.hasRoleSelector && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                  onClick={() => { hapticLight(); setRole('CREW'); }}
                  className={`py-3 px-2 rounded-2xl border-2 font-black text-sm transition-all flex flex-col items-center gap-1 ${role === 'CREW' ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 scale-105 shadow-md' : 'border-gray-200 dark:border-gray-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                >
                  <span className="text-2xl">🍟</span> CREW
                </button>
                <button 
                  onClick={() => { hapticLight(); setRole('ENTRENADOR'); }}
                  className={`py-3 px-2 rounded-2xl border-2 font-black text-sm transition-all flex flex-col items-center gap-1 ${role === 'ENTRENADOR' ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 scale-105 shadow-md' : 'border-gray-200 dark:border-gray-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                >
                  <span className="text-2xl">🎓</span> ENTR.
                </button>
              </div>
            )}

            {currentData.hasThemeSelector && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                  onClick={() => { hapticLight(); if(isDarkMode) toggleDarkMode(); }}
                  className={`py-3 px-2 rounded-2xl border-2 font-black text-sm transition-all flex flex-col items-center gap-1 ${!isDarkMode ? 'border-gray-900 bg-gray-100 text-gray-900 dark:border-white dark:bg-gray-800 dark:text-white scale-105 shadow-md' : 'border-gray-200 dark:border-gray-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                >
                  <span className="text-2xl">☀️</span> CLARO
                </button>
                <button 
                  onClick={() => { hapticLight(); if(!isDarkMode) toggleDarkMode(); }}
                  className={`py-3 px-2 rounded-2xl border-2 font-black text-sm transition-all flex flex-col items-center gap-1 ${isDarkMode ? 'border-white bg-gray-900 text-white scale-105 shadow-md' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                >
                  <span className="text-2xl">🌙</span> OSCURO
                </button>
              </div>
            )}

            {/* Navegación */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-800/50">
              <div className="flex gap-1.5 flex-1 mr-4 overflow-hidden pt-2">
                {TUTORIAL_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? `w-6 ${activeBg}` : "flex-1 min-w-[4px] max-w-[12px] bg-gray-200 dark:bg-gray-800"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-4 shrink-0 pt-2">
                <button
                  onClick={() => finishTutorial(false)} // Saltar te deja donde estás
                  className="text-[11px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-colors px-2 py-2"
                >
                  Saltar
                </button>
                <button
                  onClick={handleNext}
                  className={`px-6 py-3 rounded-2xl text-white font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg ${activeBg}`}
                >
                  {step === TUTORIAL_STEPS.length - 1 ? "Ir a Nóminas 🚀" : "Siguiente"}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}