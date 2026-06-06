"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ShiftCalculator from "@/components/ShiftCalculator";
import Calculator4x1000 from "@/components/Calculator4x1000";
import PrimaCalculator from "@/components/PrimaCalculator"; 
import PrestacionesCalculator from "@/components/PrestacionesCalculator";
import OrquestReader from "@/components/OrquestReader";
import MarcacionesReader from "@/components/MarcacionesReader"; // ✅ IMPORTAMOS EL NUEVO COMPONENTE
import ContactForm from "@/components/ContactForm";
import ServicesTutorial from "@/components/ServicesTutorial";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { useHaptics } from "@/hooks/useHaptics";
import Footer from "@/components/Footer";

type ServiceItem = {
  id: string;
  title: string;
  icon: string;
  desc: string;
  action?: string;
  href?: string;
  comingSoon?: boolean;
  isBeta?: boolean;
  requiresAuth: boolean;
};

type ServiceCategory = {
  category: string;
  items: ServiceItem[];
};

const services: ServiceCategory[] = [
  {
    category: "Productividad",
    items: [
      { id: "calc-rapida", title: "Calculadora Rápida", icon: "⚡", desc: "Sin necesidad de guardar, se recomienda iniciar sesion para guardar los turnos", action: "open_calc", requiresAuth: false },
      { id: "orquest", title: "Lector Orquest", icon: "📸", desc: "Sube tu horario en foto y expórtalo a tu nómina", action: "open_orquest", isBeta: true, requiresAuth: true },
      // ✅ AÑADIMOS AUDITORÍA DE MARCACIONES AQUÍ
      { id: "marcaciones", title: "Auditoría Marcaciones", icon: "📑", desc: "Cruza y sincroniza tus turnos con las marcaciones del Excel ", action: "open_marcaciones", isBeta: true, requiresAuth: true },
    ]
  },
  {
    category: "Finanzas",
    items: [
      { id: "billetera", title: "Mi Billetera", icon: "👛", desc: "Control de gastos, deudas y metas de ahorro", href: "/billetera", isBeta: true, requiresAuth: true },
      { id: "prima-calc", title: "Calculadora de Prima", icon: "🌟", desc: "Proyecta tu prima semestral y expórtala a tu nómina oficial", action: "open_prima", requiresAuth: true },
      { id: "4x1000", title: "Calculadora 4x1000", icon: "🏦", desc: "Conoce el impuesto antes de mover tu quincena", action: "open_4x1000", requiresAuth: false },
      { id: "prestaciones-calc", title: "Liquidación & Prestaciones", icon: "⚖️", desc: "Calcula vacaciones, cesantías y liquidaciones", action: "open_prestaciones", isBeta: true, requiresAuth: true },
    ]
  },
  {
    category: "Ajustes & Soporte",
    items: [
      { id: "notificaciones", title: "Centro de Notificaciones", icon: "🔔", desc: "Ajusta las alertas antes de tu turno", href: "/servicios/notificaciones", comingSoon: true, requiresAuth: true },
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
    const targetCalc = params.get('calc');
    if (targetCalc === 'true') {
      setExpandedId('calc-rapida');
      window.history.replaceState({}, '', '/servicios');
    } else if (targetCalc === 'prima') {
      setExpandedId('prima-calc');
      window.history.replaceState({}, '', '/servicios');
    }
  }, []);

  // ✅ AGREGAMOS "open_marcaciones" A LAS ACCIONES DEL ACORDEÓN
  const accordionActions = ["open_calc", "open_4x1000", "open_orquest", "open_marcaciones", "open_contacto", "open_prima", "open_prestaciones"];

  const handleServiceClick = (e: React.MouseEvent, item: ServiceItem) => {
    if (item.requiresAuth && !isSignedIn) {
      e.preventDefault();
      hapticWarning();
      alert("🔒 Necesitas iniciar sesión para usar esta función.");
      return;
    }

    if (accordionActions.includes(item.action || "")) {
      e.preventDefault();
      hapticLight();
      setExpandedId(expandedId === item.id ? null : item.id);
    } else {
      hapticLight();
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0a0a0a] transition-colors">
      <Navbar />

      <div className="flex-1 pt-6 px-4 md:px-6 max-w-3xl w-full mx-auto selection:bg-yellow-500 selection:text-black pb-12">
        <header id="header-servicios" className="mb-8 pl-1 rounded-3xl p-2 -ml-2 transition-colors">
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
                  const isAccordion = accordionActions.includes(item.action || "");

                  const content = (
                    <div className="flex items-center p-4 sm:p-5 w-full text-left relative">
                      {isLocked ? (
                        <span className="absolute top-4 right-4 text-sm opacity-70">🔒</span>
                      ) : item.comingSoon ? (
                        <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full">Pronto</span>
                      ) : item.isBeta ? (
                        <span className="absolute top-3 sm:top-4 right-4 text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">BETA</span>
                      ) : null}

                      <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-colors ${item.comingSoon || isLocked ? 'bg-gray-100 dark:bg-gray-800 grayscale' : `${activeBg} text-white`}`}>
                        {item.icon}
                      </div>

                      <div className="ml-4 flex-1 pr-8">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className={`font-bold text-base sm:text-lg ${item.comingSoon || isLocked ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                            {item.title}
                          </h3>
                        </div>
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
                    <div
                      key={item.id}
                      id={`item-${item.id}`}
                      className={`relative flex flex-col rounded-3xl border transition-colors overflow-hidden ${isLocked ? 'bg-gray-100/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-60' : 'bg-white dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 shadow-sm'}`}
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

                      {isExpanded && isAccordion && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
                          className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0a0a0a]/50"
                        >
                          <div className="p-4 sm:p-6 pb-6">
                            {item.action === "open_calc" && (
                              <>
                                <ShiftCalculator />
                                {!isSignedIn && (
                                  <div className="mt-4 text-center">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Inicia sesión para guardar en tu nómina.</p>
                                  </div>
                                )}
                              </>
                            )}

                            {item.action === "open_4x1000" && <Calculator4x1000 />}
                            {item.action === "open_orquest" && <OrquestReader />}
                            {/* ✅ RENDERIZAMOS EL NUEVO COMPONENTE AQUÍ */}
                            {item.action === "open_marcaciones" && <MarcacionesReader />}
                            {item.action === "open_contacto" && <ContactForm />}
                            {item.action === "open_prima" && <PrimaCalculator />}
                            {item.action === "open_prestaciones" && <PrestacionesCalculator />}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
      </div>
      
      <ServicesTutorial />
      
      <div className="w-full border-t border-gray-200 dark:border-gray-800 pt-8 mt-auto"><Footer /></div>
    </main>
  );
}