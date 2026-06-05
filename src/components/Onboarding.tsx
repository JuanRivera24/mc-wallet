"use client";
import React, { useState, Children, useRef, useLayoutEffect, HTMLAttributes, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";

// ==========================================
// 1. EL COMPONENTE PRINCIPAL (EL MODAL)
// ==========================================
export default function Onboarding() {
  const { user, isLoaded } = useUser();
  const [isVisible, setIsVisible] = useState(false);
  
  const { role, setRole, isDarkMode, toggleDarkMode } = useTheme(); 
  const [tempRole, setTempRole] = useState<'CREW' | 'ENTRENADOR'>(role);

  useEffect(() => {
    if (!isLoaded) return; 

    const storageKey = user ? `mcwallet_onboarding_${user.id}` : 'mcwallet_onboarding_guest';
    const hasSeenOnboarding = localStorage.getItem(storageKey);
    
    const hasSeenAsGuest = localStorage.getItem('mcwallet_onboarding_guest');

    if (!hasSeenOnboarding) {
      if (user && hasSeenAsGuest) {
        // Si ya lo vio como invitado y ahora inició sesión, guardamos el estado para su usuario sin mostrar el modal
        localStorage.setItem(storageKey, 'true');
      } else {
        // Si no lo ha visto de ninguna forma, lo mostramos
        setIsVisible(true);
      }
    }
  }, [isLoaded, user]);

  const handleComplete = () => {
    // Solo marcamos que ya vio el tutorial, porque el rol y tema se guardan "en vivo"
    const storageKey = user ? `mcwallet_onboarding_${user.id}` : 'mcwallet_onboarding_guest';
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-colors duration-500">
      <div className="w-full max-w-md bg-white dark:bg-[#0a0a0a] rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-colors duration-500">
        <Stepper 
          onFinalStepCompleted={handleComplete}
          nextButtonText="Siguiente"
          backButtonText="Atrás"
          stepContainerClassName="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 transition-colors duration-500"
        >
          {/* PASO 1: BIENVENIDA */}
          <Step>
            <div className="text-center space-y-4 py-6">
              <div className="text-6xl animate-bounce">🍔</div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter transition-colors">¡Bienvenido a <br/>McWallet!</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed transition-colors">
                Tu esfuerzo, calculado al centavo. <br/> Una herramienta independiente hecha por y para el equipo.
              </p>
            </div>
          </Step>

          {/* PASO 2: ROL */}
          <Step>
            <div className="text-center space-y-4 py-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white transition-colors">¿Cuál es tu rol?</h2>
              <div className="grid grid-cols-2 gap-3 max-w-[280px] mx-auto">
                <button 
                  onClick={() => setRole('CREW')}
                  className={`py-3 px-2 rounded-xl border-2 font-black text-sm transition-all flex flex-col items-center gap-1 ${role === 'CREW' ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'border-gray-200 dark:border-gray-800 text-gray-500'}`}
                >
                  <span className="text-lg">🍟</span>
                  CREW
                </button>
                <button 
                  onClick={() => setRole('ENTRENADOR')}
                  className={`py-3 px-2 rounded-xl border-2 font-black text-sm transition-all flex flex-col items-center gap-1 ${role === 'ENTRENADOR' ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'border-gray-200 dark:border-gray-800 text-gray-500'}`}
                >
                  <span className="text-lg">🎓</span>
                  ENTRENADOR
                </button>
              </div>
            </div>
          </Step>

          {/* PASO 3: TEMA (CLARO/OSCURO) AHORA CONECTADO A TU CONTEXTO */}
          <Step>
            <div className="text-center space-y-4 py-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white transition-colors">Elige tu estilo</h2>
              <div className="grid grid-cols-2 gap-3 max-w-[280px] mx-auto">
                <button 
                  // Si está oscuro, lo apagamos para que quede claro
                  onClick={() => { if (isDarkMode) toggleDarkMode(); }}
                  className={`py-3 px-2 rounded-xl border-2 font-black text-sm transition-all flex flex-col items-center gap-1 ${!isDarkMode ? 'border-gray-900 bg-gray-100 text-gray-900 dark:border-white dark:bg-gray-800 dark:text-white' : 'border-gray-200 dark:border-gray-800 text-gray-400'}`}
                >
                  <span className="text-lg">☀️</span>
                  CLARO
                </button>
                <button 
                  // Si NO está oscuro (está claro), lo prendemos para que quede oscuro
                  onClick={() => { if (!isDarkMode) toggleDarkMode(); }}
                  className={`py-3 px-2 rounded-xl border-2 font-black text-sm transition-all flex flex-col items-center gap-1 ${isDarkMode ? 'border-white bg-gray-900 text-white' : 'border-gray-200 text-gray-400'}`}
                >
                  <span className="text-lg">🌙</span>
                  OSCURO
                </button>
              </div>
            </div>
          </Step>

          {/* PASO 4: REGLAS Y MOTIVACIÓN */}
          <Step>
            <div className="text-center space-y-4 py-4">
              <h2 className="text-xl font-black text-gray-900 dark:text-white transition-colors">Reglas Claras</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                Esta app es un simulador de referencia. Los valores pueden variar por retenciones de ley, y tu desprendible oficial siempre tendrá la razón.
              </p>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl border border-yellow-200 dark:border-yellow-900/50 text-left flex gap-3 transition-colors">
                <span className="text-2xl">💡</span>
                <p className="text-xs text-yellow-800 dark:text-yellow-400 font-bold leading-relaxed">
                  ¡Tip del mes! Cuida los pedidos incompletos y la satisfacción (CSS) para no perder el bono de Big Venta.
                </p>
              </div>
            </div>
          </Step>
        </Stepper>
      </div>
    </div>
  );
}

// ==========================================
// 2. EL MOTOR DEL STEPPER
// ==========================================
interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  stepContainerClassName?: string;
  backButtonText?: string;
  nextButtonText?: string;
}

function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  stepContainerClassName = '',
  backButtonText = 'Atrás',
  nextButtonText = 'Continuar',
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<number>(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) {
      onFinalStepCompleted();
    } else {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div className="flex flex-col w-full">
      <div className={`${stepContainerClassName} flex w-full items-center justify-center p-6`}>
        {stepsArray.map((_, index) => {
          const stepNumber = index + 1;
          const isNotLastStep = index < totalSteps - 1;
          return (
            <React.Fragment key={stepNumber}>
              <StepIndicator step={stepNumber} currentStep={currentStep} />
              {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
            </React.Fragment>
          );
        })}
      </div>

      <StepContentWrapper isCompleted={isCompleted} currentStep={currentStep} direction={direction} className="px-6 min-h-[200px]">
        {stepsArray[currentStep - 1]}
      </StepContentWrapper>

      {!isCompleted && (
        <div className="px-6 pb-6 pt-2">
          <div className={`flex ${currentStep !== 1 ? 'justify-between' : 'justify-end'}`}>
            {currentStep !== 1 && (
              <button onClick={handleBack} className="text-xs font-bold text-gray-400 hover:text-gray-700 dark:hover:text-white transition uppercase tracking-widest px-4 py-2">
                {backButtonText}
              </button>
            )}
            <button
              onClick={isLastStep ? handleComplete : handleNext}
              className="flex items-center justify-center rounded-xl bg-gray-900 dark:bg-white px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white dark:text-black transition active:scale-95 shadow-lg"
            >
              {isLastStep ? '¡Empezar!' : nextButtonText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepContentWrapper({ isCompleted, currentStep, direction, children, className = '' }: any) {
  const [parentHeight, setParentHeight] = useState<number>(0);
  return (
    <motion.div style={{ position: 'relative', overflow: 'hidden' }} animate={{ height: isCompleted ? 0 : parentHeight }} transition={{ type: 'spring', duration: 0.4 }} className={className}>
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={(h: number) => setParentHeight(h)}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SlideTransition({ children, direction, onHeightReady }: any) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (containerRef.current) onHeightReady(containerRef.current.offsetHeight);
  }, [children, onHeightReady]);

  return (
    <motion.div ref={containerRef} custom={direction} variants={{ enter: (dir: number) => ({ x: dir >= 0 ? '-100%' : '100%', opacity: 0 }), center: { x: '0%', opacity: 1 }, exit: (dir: number) => ({ x: dir >= 0 ? '50%' : '-50%', opacity: 0 }) }} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }} style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
      {children}
    </motion.div>
  );
}

export function Step({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function StepIndicator({ step, currentStep }: any) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';
  return (
    <motion.div animate={status} initial={false} className="relative">
      <motion.div variants={{ inactive: { backgroundColor: '#e5e7eb', color: '#9ca3af' }, active: { backgroundColor: '#111827', color: '#111827' }, complete: { backgroundColor: '#111827', color: '#3b82f6' } }} transition={{ duration: 0.3 }} className="flex h-7 w-7 items-center justify-center rounded-full font-bold dark:border dark:border-gray-700 transition-colors">
        {status === 'complete' ? (
          <svg fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24" className="w-3.5 h-3.5"><motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        ) : status === 'active' ? (
          <div className="h-2.5 w-2.5 rounded-full bg-white" />
        ) : (
          <span className="text-[10px] text-gray-500">{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

function StepConnector({ isComplete }: any) {
  return (
    <div className="relative mx-2 h-0.5 w-8 overflow-hidden rounded bg-gray-200 dark:bg-gray-800 transition-colors">
      <motion.div className="absolute left-0 top-0 h-full bg-gray-900 dark:bg-white transition-colors" variants={{ incomplete: { width: 0 }, complete: { width: '100%' } }} initial={false} animate={isComplete ? 'complete' : 'incomplete'} transition={{ duration: 0.4 }} />
    </div>
  );
}