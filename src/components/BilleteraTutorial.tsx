"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import Image from "next/image";

export default function BilleteraTutorial() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { role, themeColor } = useTheme();
  const { hapticLight, hapticSuccess } = useHaptics();

  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const activeBg = themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';

  // ==========================================
  // 📚 RUTA DE NAVEGACIÓN DEL TOUR
  // ==========================================
  const TUTORIAL_STEPS = [
    {
      target: null,
      title: "Tu Banco Personal 🏦",
      text: "Bienvenido a tu Billetera. Aquí tu dinero cobra vida. No es solo un registro, es un motor financiero real donde el dinero se mueve de un lado a otro. Vamos a ver cómo funciona.",
    },
    {
      target: "wallet-dashboard",
      title: "Tu Cash Disponible 💵",
      text: "El corazón de todo. Este número es el dinero líquido que tienes en el bolsillo HOY. Si registras un Gasto, baja. Si registras un Ingreso, sube. Con el ojo (👁️) puedes ocultar tus saldos como en Nequi.",
    },
    {
      target: "wallet-import-btn",
      title: "¡Magia Pura! 📥",
      text: "La función estrella: 'Traer Nómina'. Toca este botón para que la app sume tus turnos, BigVentas, Primas y reste deducciones, e inyecte ese total exacto a tu Cash Disponible en un solo clic.",
    },
    {
      target: "wallet-goals",
      title: "Bolsillos (Ahorros) 🎯",
      text: "Cuando abonas a una Meta, ese dinero SALE de tu Cash Disponible y se guarda aquí. Si cumples o cancelas la meta, ¡el dinero regresa automáticamente a tu saldo principal!",
    },
    {
      target: "wallet-debts",
      title: "Tus Obligaciones 💸",
      text: "Lleva el control de a quién le debes. Cada vez que pagas una cuota, el dinero se descuenta de tu Disponible para ir saldando esa deuda poco a poco.",
    },
    {
      target: "wallet-ledger",
      title: "Regla de 24 Horas ⏳",
      text: "El Libro Contable guarda todo. Si te equivocas, puedes deshacer el movimiento haciendo clic en él, pero ¡OJO! Solo tienes 24 horas. Después, el registro se sella por seguridad.",
    },
    {
      target: null,
      title: "¡Estás al mando! 🚀",
      text: "Ahora tienes el control total de cada centavo que ganas y gastas en el trabajo. ¡A meterle ficha y ver crecer esos saldos!",
    }
  ];

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const storageKey = `mcwallet_tutorial_billetera_${user.id}`;
    if (!localStorage.getItem(storageKey)) {
      const timer = setTimeout(() => setIsVisible(true), 1200); 
      return () => clearTimeout(timer);
    }
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isVisible) return;

    const currentStepData = TUTORIAL_STEPS[step];

    const timer = setTimeout(() => {
      const currentTargetId = currentStepData.target;
      if (!currentTargetId) {
        setTargetRect(null);
        if (step === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const el = document.getElementById(currentTargetId);
      if (el) {
        // Offset centrado en pantalla
        const y = el.getBoundingClientRect().top + window.scrollY - (window.innerHeight / 2) + (el.clientHeight / 2);
        
        window.scrollTo({ top: y, behavior: 'smooth' });

        setTimeout(() => {
          setTargetRect(el.getBoundingClientRect());
        }, 400);
      } else {
        setTargetRect(null);
      }
    }, 500);

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
    else finishTutorial();
  };

  const finishTutorial = () => {
    hapticSuccess();
    if (user) localStorage.setItem(`mcwallet_tutorial_billetera_${user.id}`, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const currentData = TUTORIAL_STEPS[step];
  const mascotImg = role === 'ENTRENADOR' ? '/entr.png' : '/crew.png';
  const mascotLabel = role === 'ENTRENADOR' ? 'Entrenador' : 'Crew';

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto font-sans">
      
      {/* 🟢 SPOTLIGHT DINÁMICO (Hueco nítido sin oscurecerse a sí mismo) */}
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
            borderRadius: "2rem",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)",
            transform: targetRect ? "none" : "translate(-50%, -50%)",
          }}
          className="transition-all duration-300 ring-4 ring-white/50 dark:ring-white/30"
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
            className="bg-white dark:bg-[#121212] w-full max-w-[500px] rounded-[2.2rem] p-7 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-gray-800 pointer-events-auto"
          >
            {/* Avatar */}
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
            <p className="text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed font-medium mb-7">
              {currentData.text}
            </p>

            {/* Navegación */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-1.5 flex-1 mr-4 overflow-hidden">
                {TUTORIAL_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? `w-6 ${activeBg}` : "flex-1 min-w-[4px] max-w-[12px] bg-gray-200 dark:bg-gray-800"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <button
                  onClick={finishTutorial}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-colors px-2 py-2"
                >
                  Saltar
                </button>
                <button
                  onClick={handleNext}
                  className={`px-7 py-3.5 rounded-2xl text-white font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg ${activeBg}`}
                >
                  {step === TUTORIAL_STEPS.length - 1 ? "¡Entendido!" : "Siguiente"}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}