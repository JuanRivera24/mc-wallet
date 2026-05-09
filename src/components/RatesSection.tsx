"use client";
import { useTheme } from "@/context/ThemeContext";
import { RATES_BY_YEAR, TRANSPORT_AUX_BY_YEAR } from "@/constants/rates";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";

export default function RatesSection() {
  const { role, colors, themeColor } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const r = RATES_BY_YEAR[currentYear]?.[role] || RATES_BY_YEAR[2026][role];
  const transportAux = TRANSPORT_AUX_BY_YEAR[currentYear] || TRANSPORT_AUX_BY_YEAR[2026];

  // --- LÓGICA DE DOBLE CLIC Y LUZ TEMPORAL ---
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeLight, setActiveLight] = useState<string | null>(null);
  const lastClickTimes = useRef<{ [key: string]: number }>({});
  const lightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardClick = (cardId: string) => {
    const now = Date.now();
    const lastClick = lastClickTimes.current[cardId] || 0;
    
    if (now - lastClick < 800) {
      // Abre o cierra el texto
      setExpandedCard(prev => prev === cardId ? null : cardId);
      
      // Enciende la luz
      setActiveLight(cardId);
      
      // Reinicia el contador de clics
      lastClickTimes.current[cardId] = 0; 

      // Apaga la luz después de 2 segundos (2000 ms)
      if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
      lightTimeoutRef.current = setTimeout(() => {
        setActiveLight(null);
      }, 2000);

    } else {
      lastClickTimes.current[cardId] = now;
    }
  };

  useEffect(() => {
    setMounted(true);
    // Limpieza del temporizador al desmontar el componente
    return () => {
      if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
    };
  }, []);

  const containerVariant = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const cardVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  if (!mounted) return null;

  return (
    <section id="tarifas" className="py-24 bg-white dark:bg-[#0a0a0a] transition-colors duration-500 overflow-hidden relative select-none">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        
        {/* HEADER ANIMADO */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }} 
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className={`text-4xl lg:text-5xl font-black tracking-tighter mb-4 ${themeColor === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            Tarifas {currentYear}: {role}
          </h2>
          <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-[10px]">
            Toca dos veces una tarjeta para ver detalles
          </p>
        </motion.div>

        {/* GRID DE TARJETAS */}
        <motion.div 
          variants={containerVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {/* Bloque 1: Horas Ordinarias */}
          <motion.div 
            variants={cardVariant} 
            onClick={() => handleCardClick('ordinarias')}
            // 🔥 Nueva contraluz (Backlight) temporal conectada al estado 'activeLight'
            className={`group relative p-8 rounded-[2rem] border-2 cursor-pointer transition-all duration-700 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 ${colors.accent} ${themeColor === 'blue' ? 'bg-blue-50 dark:bg-blue-900/10 shadow-blue-500/10' : 'bg-red-50 dark:bg-red-900/10 shadow-red-500/10'} ${themeColor === 'blue' ? (activeLight === 'ordinarias' ? 'drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]' : '') : (activeLight === 'ordinarias' ? 'drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]' : '')}`}
          >
            <h3 className="text-sm font-black uppercase text-gray-400 dark:text-gray-500 mb-6">Ordinarias</h3>
            <div className="space-y-4">
              <RateRow label="Diurna" value={r.ORDINARY} />
              <RateRow label="Nocturna" value={r.ORDINARY_NIGHT} highlight={themeColor} />
            </div>

            <AnimatePresence>
              {expandedCard === 'ordinarias' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 italic bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800/50 leading-relaxed shadow-inner">
                    <strong className="text-gray-700 dark:text-gray-300">Diurna:</strong> 6:00 a.m. a 7:00 p.m.<br/>
                    <strong className="text-gray-700 dark:text-gray-300">Nocturna:</strong> 7:00 p.m. a 6:00 a.m. (Incluye recargo).<br/>
                    <em>Son las horas base que componen tu turno regular.</em>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bloque 2: Horas Extras */}
          <motion.div 
            variants={cardVariant} 
            onClick={() => handleCardClick('extras')}
            // 🔥 Nueva contraluz temporal gris
            className={`group relative p-8 rounded-[2rem] bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 cursor-pointer transition-all duration-700 hover:-translate-y-1 hover:shadow-xl ${activeLight === 'extras' ? 'drop-shadow-[0_0_15px_rgba(107,114,128,0.6)]' : ''}`}
          >
            <h3 className="text-sm font-black uppercase text-gray-400 dark:text-gray-500 mb-6">Extras</h3>
            <div className="space-y-4">
              <RateRow label="Extra Diurna" value={r.EXTRA_DAY} />
              <RateRow label="Extra Nocturna" value={r.EXTRA_NIGHT} />
            </div>

            <AnimatePresence>
              {expandedCard === 'extras' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 italic bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-gray-800/50 leading-relaxed shadow-inner">
                    Aplica cuando trabajas <strong>más de 8 horas</strong> en tu jornada. Se rigen por los mismos horarios (diurno hasta 7:00 p.m., nocturno hasta 6:00 a.m.) pero con mayor valor.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bloque 3: Dominicales */}
          <motion.div 
            variants={cardVariant} 
            onClick={() => handleCardClick('dominicales')}
            // 🔥 Nueva contraluz temporal verde
            className={`group relative p-8 rounded-[2rem] bg-green-50 dark:bg-green-900/10 border-2 border-green-100 dark:border-green-900/30 text-green-800 dark:text-green-400 cursor-pointer transition-all duration-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/10 ${activeLight === 'dominicales' ? 'drop-shadow-[0_0_15px_rgba(74,222,128,0.6)]' : ''}`}
          >
            <h3 className="text-sm font-black uppercase text-green-400 dark:text-green-500 mb-6">Dominicales</h3>
            <div className="space-y-4">
              <RateRow label="Dominical" value={r.SUNDAY} isGreen />
              <RateRow label="Dom. Nocturno" value={r.SUNDAY_NIGHT} isGreen />
            </div>

            <AnimatePresence>
              {expandedCard === 'dominicales' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-[10px] text-green-700/80 dark:text-green-400/80 italic bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-green-200/50 dark:border-green-800/50 leading-relaxed shadow-inner">
                    Pago por trabajar en <strong>domingos o días festivos</strong> dentro de tus horas base. El nocturno combina el recargo del festivo + el recargo de la noche.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bloque 4: Extras Festivas */}
          <motion.div 
            variants={cardVariant} 
            onClick={() => handleCardClick('festivas')}
            // 🔥 Nueva contraluz temporal naranja
            className={`group relative p-8 rounded-[2rem] bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-100 dark:border-orange-900/30 text-orange-800 dark:text-orange-400 cursor-pointer md:col-span-2 transition-all duration-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10 ${activeLight === 'festivas' ? 'drop-shadow-[0_0_15px_rgba(251,146,60,0.6)]' : ''}`}
          >
            <h3 className="text-sm font-black uppercase text-orange-400 dark:text-orange-500 mb-6">Extras Festivas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 relative z-10">
              <RateRow label="Extra Fest. Diurna" value={r.EXTRA_FESTIVE_DAY} isOrange />
              <RateRow label="Extra Fest. Noct." value={r.EXTRA_FESTIVE_NIGHT} isOrange />
            </div>

            <AnimatePresence>
              {expandedCard === 'festivas' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden relative z-10"
                >
                  <p className="text-[10px] text-orange-700/80 dark:text-orange-400/80 italic bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-orange-200/50 dark:border-orange-800/50 leading-relaxed shadow-inner max-w-lg">
                    ¡La combinación más alta! Ocurre cuando te quedas trabajando <strong>horas extra</strong> un día domingo o festivo. Suma el recargo de extra + el recargo dominical.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bloque 5: Auxilio de Transporte */}
          <motion.div 
            variants={cardVariant} 
            onClick={() => handleCardClick('transporte')}
            // 🔥 Contraluz azul suave sobre fondo negro (sutil)
            className={`group relative p-8 rounded-[2rem] bg-gray-900 dark:bg-[#111] border border-transparent dark:border-gray-800 text-white flex flex-col justify-center items-center cursor-pointer transition-all duration-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20 overflow-hidden ${activeLight === 'transporte' ? 'drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]' : ''}`}
          >
            <span className="text-blue-400 dark:text-blue-500 font-black uppercase text-[9px] mb-2 relative z-10">Transporte</span>
            <h3 suppressHydrationWarning className="text-4xl font-black relative z-10">
              ${transportAux.toLocaleString('es-CO')}
            </h3>
            <p className="text-gray-500 text-[10px] uppercase font-bold mt-1 relative z-10">Valor Diario</p>

            <AnimatePresence>
              {expandedCard === 'transporte' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden w-full relative z-10"
                >
                  <p className="text-[10px] text-gray-300 bg-black/40 p-3 rounded-xl border border-gray-700/50 leading-relaxed shadow-inner text-center">
                    <span className="italic">Valor base nacional por día efectivamente laborado. <strong>No se paga</strong> en descanso, incapacidades o vacaciones.</span>
                    <span className="text-blue-300 mt-2 pt-2 border-t border-gray-700/50 block font-medium uppercase tracking-tight">
                      ✨ Bono Auxilio Extra Legal de Transporte: $5.000 para turnos que finalicen entre las 00:01 y las 04:59 a.m.
                    </span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}

function RateRow({ label, value, highlight, isGreen, isOrange }: { label: string; value: number; highlight?: string; isGreen?: boolean; isOrange?: boolean }) {
  let textColor = "text-gray-900 dark:text-white";
  if (highlight === 'blue') textColor = "text-blue-600 dark:text-blue-400";
  if (highlight === 'red') textColor = "text-red-600 dark:text-red-400";
  if (isGreen) textColor = "text-green-800 dark:text-green-400";
  if (isOrange) textColor = "text-orange-800 dark:text-orange-400";

  return (
    <div className="flex justify-between items-center group transition-transform hover:translate-x-1 duration-300">
      <span className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-300">
        {label}
      </span>
      <span suppressHydrationWarning className={`text-xl font-black transition-colors duration-300 ${textColor}`}>
        ${value.toLocaleString('es-CO')}
      </span>
    </div>
  );
}