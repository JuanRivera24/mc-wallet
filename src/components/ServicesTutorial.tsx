"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import Image from "next/image";

// ==========================================
// 📚 CONFIGURACIÓN DEL TOUR (TODAS LAS SECCIONES)
// ==========================================
const TUTORIAL_STEPS = [
  {
    target: "header-servicios",
    title: "Tu centro de control",
    text: "Bienvenido a tus Servicios. Aquí hemos unificado todas las herramientas que necesitas para gestionar tu día a día en el restaurante.",
  },
  {
    target: "item-calc-rapida",
    title: "Calculadora Rápida",
    text: "Simula tus turnos al instante. Si inicias sesión, podrás guardarlos directamente en tu libro contable para no perder ni un centavo.",
  },
  {
    target: "item-orquest",
    title: "Lector Orquest IA 💎",
    text: "¡Una chimba! Sube un pantallazo de tu horario. Nuestra IA extraerá tus turnos, recargos y descansos, sincronizándolos automáticamente en segundos.",
  },
  {
    target: "item-marcaciones",
    title: "Auditoría Marcaciones 💎",
    text: "La nueva joya, Cruza tus turnos guardados con el reporte oficial de gerencia. Detecta descuadres, tiempos faltantes y asegura que te paguen cada minuto trabajado.",
  },
  {
    target: "item-billetera",
    title: "Mi Billetera 👑",
    text: "Lo que nadie pidió. Toma el control absoluto de tus finanzas. Importa tu nómina con un clic, crea bolsillos de ahorro, paga deudas y domina el flujo real de tu dinero.",
  },
  {
    target: "item-prima-calc",
    title: "Proyección de Prima",
    text: "Analizamos tu historial de turnos trabajados para calcular con exactitud cuánto recibirás en tu próxima prima de servicios.",
  },
  {
    target: "item-4x1000",
    title: "Calculadora 4x1000",
    text: "El famoso impuesto. Úsala para saber exactamente cuánto te van a descontar antes de mover o retirar tu quincena.",
  },
  {
    target: "item-prestaciones-calc",
    title: "Liquidación & Prestaciones",
    text: "Calcula fácilmente tus vacaciones, cesantías e intereses de ley basados en los promedios reales de lo que has trabajado.",
  },
  {
    target: "item-notificaciones",
    title: "Centro de Alertas",
    text: "¡Próximamente! Podrás gestionar notificaciones de tus turnos, descansos, llegadas tarde y pagos. Todo será 100% configurable a tu gusto.",
  },
  {
    target: "item-contacto",
    title: "Buzón Crew",
    text: "Tu voz es lo más importante. Déjanos sugerencias, reportes de errores o ideas. Incluso puedes enviarlas de forma anónima.",
  },
  {
    target: null, // Cierre
    title: "¡Todo listo!",
    text: "El control ahora es tuyo. Explora las herramientas, optimiza tu tiempo y domina tus finanzas.",
  }
];

export default function ServicesTutorial() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { role, themeColor } = useTheme();
  const { hapticLight, hapticSuccess } = useHaptics();

  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const activeBg = themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';

  // 1. Inicialización segura
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const storageKey = `mcwallet_tutorial_servicios_${user.id}`;
    if (!localStorage.getItem(storageKey)) {
      const timer = setTimeout(() => setIsVisible(true), 1000); 
      return () => clearTimeout(timer);
    }
  }, [isLoaded, isSignedIn, user]);

  // 2. Motor de Seguimiento Dinámico (Spotlight)
  useEffect(() => {
    if (!isVisible) return;

    const updatePosition = () => {
      const currentTargetId = TUTORIAL_STEPS[step]?.target;
      if (!currentTargetId) {
        setTargetRect(null);
        return;
      }

      const el = document.getElementById(currentTargetId);
      if (el) {
        // En móvil, hacemos scroll para dejar el elemento en el tercio superior
        const yOffset = -80; 
        const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });

        // Calculamos las coordenadas después de un mini delay
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);
        }, 300);
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [step, isVisible]);

  // Bloqueador de scroll nativo
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
    if (user) localStorage.setItem(`mcwallet_tutorial_servicios_${user.id}`, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const currentData = TUTORIAL_STEPS[step];
  const mascotImg = role === 'ENTRENADOR' ? '/entr.png' : '/crew.png';
  const mascotLabel = role === 'ENTRENADOR' ? 'Entrenador' : 'Crew';

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto font-sans">
      
      {/* ============================================================== */}
      {/* 🟢 SPOTLIGHT DINÁMICO */}
      {/* ============================================================== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
          style={{
            position: "absolute",
            top: targetRect ? targetRect.top - 8 : "50%",
            left: targetRect ? targetRect.left - 8 : "50%",
            width: targetRect ? targetRect.width + 16 : 0,
            height: targetRect ? targetRect.height + 16 : 0,
            borderRadius: "1.75rem",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
            transform: targetRect ? "none" : "translate(-50%, -50%)",
          }}
          className="transition-opacity duration-300 ring-2 ring-white/20 dark:ring-white/10"
        />
      </div>

      {/* ============================================================== */}
      {/* 📱 TARJETA DE DIÁLOGO (Agrandada un 10%) */}
      {/* ============================================================== */}
      <div className="absolute inset-x-0 bottom-0 p-4 pb-8 sm:p-6 sm:pb-8 pointer-events-none flex flex-col items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            // max-w-[500px] para hacerla más ancha
            className="bg-white dark:bg-[#121212] w-full max-w-[500px] rounded-[2.2rem] p-7 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-800 pointer-events-auto"
          >
            {/* Cabecera: Personaje como Avatar Recortado */}
            <div className="flex items-center gap-4 mb-5">
              {/* Contenedor del Avatar más grande (w-14 h-14) */}
              <div className="relative w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800/50 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {/* El Truco del Avatar: 
                  scale-[1.3] y translate-y-2 hacen zoom a la cara/pecho de la imagen 
                */}
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
                {/* Título más grande (text-xl) */}
                <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mt-1">
                  {currentData.title}
                </h3>
              </div>
            </div>

            {/* Cuerpo del Mensaje (text-[15px]) */}
            <p className="text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed font-medium mb-7">
              {currentData.text}
            </p>

            {/* Controles de Navegación */}
            <div className="flex items-center justify-between pt-2">
              {/* Barra de progreso ajustada a la cantidad de pasos */}
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
                  {step === TUTORIAL_STEPS.length - 1 ? "Comenzar" : "Siguiente"}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}