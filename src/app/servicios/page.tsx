"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ShiftCalculator from "@/components/ShiftCalculator";
import Calculator4x1000 from "@/components/Calculator4x1000";
import ContactForm from "@/components/ContactForm"; // ✅ Importamos el nuevo formulario
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { useHaptics } from "@/hooks/useHaptics";

// ✅ 1. LE ENSEÑAMOS A TYPESCRIPT LA ESTRUCTURA EXACTA (Hacemos action y href opcionales con "?")
type ServiceItem = {
  id: string;
  title: string;
  icon: string;
  desc: string;
  action?: string;
  href?: string;
  comingSoon?: boolean;
  requiresAuth: boolean;
};

type ServiceCategory = {
  category: string;
  items: ServiceItem[];
};

// ✅ 2. APLICAMOS EL TIPO AL ARREGLO
const services: ServiceCategory[] = [
  {
    category: "Productividad",
    items: [
      { id: "calc-rapida", title: "Calculadora Rápida", icon: "⚡", desc: "Calcula un turno rápido sin guardarlo en el historial", action: "open_calc", requiresAuth: false },
      { id: "orquest", title: "Lector Orquest", icon: "📸", desc: "Sube tu horario en foto y expórtalo a tu nómina", href: "/servicios/orquest", comingSoon: true, requiresAuth: true },
    ]
  },
  {
    category: "Finanzas",
    items: [
      { id: "4x1000", title: "Calculadora 4x1000", icon: "🏦", desc: "Conoce el impuesto antes de mover tu quincena", action: "open_4x1000", requiresAuth: false },
      { id: "metas", title: "Mis Metas", icon: "🏍️", desc: "Proyecta tus ahorros (ej. Moto) sumando la Prima", href: "/servicios/metas", comingSoon: true, requiresAuth: true },
    ]
  },
  {
    category: "Ajustes & Soporte",
    items: [
      { id: "notificaciones", title: "Centro de Notificaciones", icon: "🔔", desc: "Ajusta las alertas antes de tu turno", href: "/servicios/notificaciones", comingSoon: true, requiresAuth: true },
      // ✅ Cambiamos href por action para que sea acordeón
      { id: "contacto", title: "Buzón Crew", icon: "✉️", desc: "Déjanos una sugerencia, queja o recomendación", action: "open_contacto", requiresAuth: false },
    ]
  }
];

export default function ServiciosPage() {
  const { themeColor } = useTheme();
  const { isSignedIn, isLoaded } = useUser();
  const { hapticLight, hapticWarning } = useHaptics();
  
  const activeBg = themeColor === 'blue' ? 'bg-blue-500' : 'bg-red-500';
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calc') === 'true') {
      setExpandedId('calc-rapida');
      window.history.replaceState({}, '', '/servicios');
    }
  }, []);

  const handleServiceClick = (e: React.MouseEvent, item: ServiceItem) => {
    if (item.requiresAuth && !isSignedIn) {
      e.preventDefault();
      hapticWarning();
      alert("🔒 Necesitas iniciar sesión para usar esta función.");
      return;
    }
    
    // ✅ Agregamos open_contacto a la validación
    if (item.action === "open_calc" || item.action === "open_4x1000" || item.action === "open_contacto") {
      e.preventDefault();
      hapticLight();
      setExpandedId(expandedId === item.id ? null : item.id);
    } else {
      hapticLight();
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors pb-24">
      <Navbar />
      
      <div className="pt-6 px-4 md:px-6 max-w-3xl mx-auto selection:bg-yellow-500 selection:text-black">
        <header className="mb-8 pl-1">
          <motion.h1 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white"
          >
            Servicios
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1"
          >
            Tu centro de utilidades y herramientas.
          </motion.p>
        </header>

        <div className="space-y-10">
          {services.map((section, sectionIndex) => (
            <motion.section 
              key={section.category}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sectionIndex * 0.1 }}
            >
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 pl-2">
                {section.category}
              </h2>
              
              <div className="grid grid-cols-1 gap-3">
                {section.items.map((item) => {
                  const isLocked = isLoaded && item.requiresAuth && !isSignedIn;
                  const isExpanded = expandedId === item.id;
                  // ✅ Actualizamos isAccordion
                  const isAccordion = item.action === "open_calc" || item.action === "open_4x1000" || item.action === "open_contacto";
                  
                  const content = (
                    <div className="flex items-center p-4 sm:p-5 w-full text-left relative">
                      {isLocked ? (
                        <span className="absolute top-4 right-4 text-sm opacity-70">🔒</span>
                      ) : item.comingSoon ? (
                        <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full">
                          Pronto
                        </span>
                      ) : null}

                      <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-colors ${item.comingSoon || isLocked ? 'bg-gray-100 dark:bg-gray-800 grayscale' : `${activeBg} text-white`}`}>
                        {item.icon}
                      </div>
                      
                      <div className="ml-4 flex-1 pr-8">
                        <h3 className={`font-bold text-base sm:text-lg mb-0.5 ${item.comingSoon || isLocked ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {item.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-snug">
                          {item.desc}
                        </p>
                      </div>

                      {isAccordion && !isLocked && (
                        <div className="absolute right-4 text-gray-400 transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                        </div>
                      )}
                    </div>
                  );
                  
                  return (
                    <motion.div 
                      key={item.id}
                      className={`relative flex flex-col rounded-3xl border transition-all overflow-hidden
                        ${isLocked 
                          ? 'bg-gray-100/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-60' 
                          : 'bg-white dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 shadow-sm'
                        }`}
                    >
                      {isAccordion ? (
                        <button onClick={(e) => handleServiceClick(e, item)} className="w-full outline-none hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          {content}
                        </button>
                      ) : (
                        <Link href={item.href || "#"} onClick={(e) => handleServiceClick(e, item)} className="w-full block outline-none hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          {content}
                        </Link>
                      )}

                      <AnimatePresence initial={false}>
                        {isExpanded && isAccordion && (
                          <motion.div 
                            key="content"
                            initial="collapsed"
                            animate="open"
                            exit="collapsed"
                            variants={{
                              open: { opacity: 1, height: "auto" },
                              collapsed: { opacity: 0, height: 0 }
                            }}
                            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                            className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0a0a0a]/50 overflow-hidden"
                          >
                            <div className="p-4 sm:p-6 pb-6 origin-top">
                              {item.action === "open_calc" && (
                                <>
                                  <ShiftCalculator />
                                  {!isSignedIn && (
                                    <div className="mt-4 text-center">
                                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                        Inicia sesión para guardar en tu nómina.
                                      </p>
                                    </div>
                                  )}
                                </>
                              )}

                              {item.action === "open_4x1000" && (
                                <Calculator4x1000 />
                              )}

                              {/* ✅ AQUÍ SE RENDERIZA EL BUZÓN CREW */}
                              {item.action === "open_contacto" && (
                                <ContactForm />
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
      </div>
    </main>
  );
}