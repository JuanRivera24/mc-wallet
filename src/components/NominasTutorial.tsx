"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import Image from "next/image";

interface NominasTutorialProps {
  goToStep: (step: number) => void;
  setSelectedMonth: (month: string) => void;
  setSelectedQuincena: (q: number) => void;
  currentMonthName: string;
  currentQuincena: number;
}

export default function NominasTutorial({ 
  goToStep, 
  setSelectedMonth, 
  setSelectedQuincena, 
  currentMonthName, 
  currentQuincena 
}: NominasTutorialProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { role, themeColor } = useTheme();
  const { hapticLight, hapticSuccess } = useHaptics();

  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const activeBg = themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';

  const TUTORIAL_STEPS = [
    {
      target: null, 
      title: "¡Qué más! Bienvenido 👋",
      text: "Este es el verdadero motor de la app. Prepárate para tener el control total de tu tiempo y tu plata. Vamos a dar un tour rápido para que le saques todo el jugo.",
      onEnter: () => goToStep(1)
    },
    {
      target: "step-1-months",
      title: "Vista Anual 📅",
      text: "Todo empieza seleccionando el mes. Aquí puedes navegar por todo tu año laboral. El mes actual siempre estará resaltado para que no te pierdas.",
      onEnter: () => goToStep(1)
    },
    {
      target: "annual-chart",
      title: "Tus Gráficas 📊",
      text: "Debajo de los meses verás tu resumen visual. ¡Ideal para ver cómo crecen tus ganancias mes a mes y comparar tus mejores rachas del año!",
      onEnter: () => goToStep(1)
    },
    {
      target: "step-2-quincenas",
      title: "Tus Cortes ✂️",
      text: "Al entrar a un mes, eliges la primera o segunda quincena. De entrada te mostramos un resumen rápido de la plata y las horas que llevas acumuladas en cada una.",
      onEnter: () => {
        setSelectedMonth(currentMonthName);
        goToStep(2);
      }
    },
    {
      target: "step-3-calendar",
      title: "El Calendario Mágico ✨",
      text: "Toca cualquier día para seleccionarlo. Los colores te indicarán si trabajaste, descansaste o te incapacitaste. ⚡ Atajo PRO: Toca dos veces rápido sobre un día para abrir el creador de turnos.",
      onEnter: () => {
        setSelectedQuincena(currentQuincena);
        goToStep(3);
      }
    },
    {
      target: "floating-bubble",
      title: "Botón Rápido (Hoy) 🚀",
      text: "Tu mejor amigo. Tócalo o muevelo en cualquier momento para registrar o editar tu turno de HOY al instante, sin tener que buscar el día exacto en el calendario, miralo en la derecha.",
      onEnter: () => {} 
    },
    {
      target: "step-3-actions",
      title: "Panel de Acciones 🛠️",
      text: "Con un día seleccionado, usa estos botones para: Agregar un Turno normal, Marcar un día libre (OFF), o tocar los '...' para eventos especiales como Reuniones o Compensatorios.",
      onEnter: () => {} 
    },
    {
      target: "step-3-actions", 
      title: "El Famoso 'Break' 🍔",
      text: "¡Magia pura! Al ingresar tu hora de entrada y salida, la app calcula tu break automáticamente (30 mins del turno) según la ley. ¿Te pasaste o no tuviste break? Activa o desactiva el check manual y pon la hora exacta.",
      onEnter: () => {} 
    },
    {
      target: "step-3-list",
      title: "Radiografía del Turno 📋",
      text: "Tus turnos guardados aparecerán aquí. Abre cualquiera para ver el desglose al detalle: horas extras, dominicales, recargos nocturnos... La app incluso calcula sola si tu turno cruza la medianoche.",
      onEnter: () => {}
    },
    {
      target: "step-3-summary",
      title: "El Comprobante Oficial 💰",
      text: "¡La joya de la corona! Tu nómina calculada al centavo con deducciones reales. Da click y podrás ver los tipos de horas, el dinero correspondiente, deducciones, sumar tus 'Big Ventas' y ver tu proyección de Prima en junio o diciembre.",
      onEnter: () => {}
    },
    {
      target: null,
      title: "¡Todo tuyo! 🎉",
      text: `Te he traído directo a tu quincena actual (${currentQuincena} de ${currentMonthName}). ¡Es hora de registrar tus turnos y no dejar escapar ni un peso!`,
      onEnter: () => {}
    }
  ];

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const storageKey = `mcwallet_tutorial_nominas_${user.id}`;
    if (!localStorage.getItem(storageKey)) {
      const timer = setTimeout(() => setIsVisible(true), 1200); 
      return () => clearTimeout(timer);
    }
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isVisible) return;

    const currentStepData = TUTORIAL_STEPS[step];

    if (currentStepData.onEnter) {
      currentStepData.onEnter();
    }

    const timer = setTimeout(() => {
      const currentTargetId = currentStepData.target;
      if (!currentTargetId) {
        setTargetRect(null);
        return;
      }

      const el = document.getElementById(currentTargetId);
      if (el) {
        const yOffset = -100; 
        const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
        
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
    if (user) localStorage.setItem(`mcwallet_tutorial_nominas_${user.id}`, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const currentData = TUTORIAL_STEPS[step];
  const mascotImg = role === 'ENTRENADOR' ? '/entr.png' : '/crew.png';
  const mascotLabel = role === 'ENTRENADOR' ? 'Entrenador' : 'Crew';

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto font-sans">
      
      {/* 🟢 SPOTLIGHT DINÁMICO (Sin bg-black) */}
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
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)", // Hace el trabajo del overlay sin oscurecer el centro
            transform: targetRect ? "none" : "translate(-50%, -50%)",
          }}
          className="transition-all duration-300 ring-4 ring-white/50"
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
                  {step === TUTORIAL_STEPS.length - 1 ? "¡A Darle!" : "Siguiente"}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}