"use client";
import { useTheme } from "@/context/ThemeContext";
import { RATES_BY_YEAR, TRANSPORT_AUX_BY_YEAR } from "@/constants/rates";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function RatesSection() {
  const { role, colors, themeColor } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const r = RATES_BY_YEAR[currentYear]?.[role] || RATES_BY_YEAR[2026][role];
  const transportAux = TRANSPORT_AUX_BY_YEAR[currentYear] || TRANSPORT_AUX_BY_YEAR[2026];

  // Solución Anti-Crash: Evita el error de hidratación en Vercel/Móviles
  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ Configuración correcta del padre para la animación en cascada
  const containerVariant = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 } // El tiempo entre cada tarjeta
    }
  };

  // ✅ Configuración de los hijos
  const cardVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  if (!mounted) return null; // Evita que el servidor y el cliente se peleen

  return (
    <section id="tarifas" className="py-24 bg-white dark:bg-[#0a0a0a] transition-colors duration-500 overflow-hidden relative">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        
        {/* HEADER ANIMADO */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }} // "amount" funciona mejor que "margin" en móviles
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className={`text-4xl lg:text-5xl font-black tracking-tighter mb-4 ${themeColor === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            Tarifas {currentYear}: {role}
          </h2>
          <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-[10px]">
            Tabla de valores legales para empleados de operaciones
          </p>
        </motion.div>

        {/* GRID DE TARJETAS (Ahora el padre sí tiene los variants) */}
        <motion.div 
          variants={containerVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {/* Bloque 1: Horas Ordinarias */}
          <motion.div variants={cardVariant} className={`group relative p-8 rounded-[2rem] border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 ${colors.accent} ${themeColor === 'blue' ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
            <div className="absolute -inset-1 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 bg-gradient-to-r from-blue-400 to-purple-400 rounded-[2rem] -z-10" />
            <h3 className="text-sm font-black uppercase text-gray-400 dark:text-gray-500 mb-6">Ordinarias</h3>
            <div className="space-y-4">
              <RateRow label="Diurna" value={r.ORDINARY} />
              <RateRow label="Nocturna" value={r.ORDINARY_NIGHT} highlight={themeColor} />
            </div>
          </motion.div>

          {/* Bloque 2: Horas Extras */}
          <motion.div variants={cardVariant} className="group relative p-8 rounded-[2rem] bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="absolute -inset-1 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 bg-gradient-to-r from-gray-400 to-gray-600 rounded-[2rem] -z-10" />
            <h3 className="text-sm font-black uppercase text-gray-400 dark:text-gray-500 mb-6">Extras</h3>
            <div className="space-y-4">
              <RateRow label="Extra Diurna" value={r.EXTRA_DAY} />
              <RateRow label="Extra Nocturna" value={r.EXTRA_NIGHT} />
            </div>
          </motion.div>

          {/* Bloque 3: Dominicales */}
          <motion.div variants={cardVariant} className="group relative p-8 rounded-[2rem] bg-green-50 dark:bg-green-900/10 border-2 border-green-100 dark:border-green-900/30 text-green-800 dark:text-green-400 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/10">
            <div className="absolute -inset-1 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 bg-gradient-to-r from-green-400 to-emerald-400 rounded-[2rem] -z-10" />
            <h3 className="text-sm font-black uppercase text-green-400 dark:text-green-500 mb-6">Dominicales</h3>
            <div className="space-y-4">
              <RateRow label="Dominical" value={r.SUNDAY} isGreen />
              <RateRow label="Dom. Nocturno" value={r.SUNDAY_NIGHT} isGreen />
            </div>
          </motion.div>

          {/* Bloque 4: Extras Festivas */}
          <motion.div variants={cardVariant} className="group relative p-8 rounded-[2rem] bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-100 dark:border-orange-900/30 text-orange-800 dark:text-orange-400 md:col-span-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10">
            <div className="absolute -inset-1 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 bg-gradient-to-r from-orange-400 to-yellow-400 rounded-[2rem] -z-10" />
            <h3 className="text-sm font-black uppercase text-orange-400 dark:text-orange-500 mb-6">Extras Festivas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 relative z-10">
              <RateRow label="Extra Fest. Diurna" value={r.EXTRA_FESTIVE_DAY} isOrange />
              <RateRow label="Extra Fest. Noct." value={r.EXTRA_FESTIVE_NIGHT} isOrange />
            </div>
          </motion.div>

          {/* Bloque 5: Auxilio de Transporte */}
          <motion.div variants={cardVariant} className="group relative p-8 rounded-[2rem] bg-gray-900 dark:bg-[#111] border border-transparent dark:border-gray-800 text-white flex flex-col justify-center items-center transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20 overflow-hidden">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-500 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-700" />
            <span className="text-blue-400 dark:text-blue-500 font-black uppercase text-[9px] mb-2 relative z-10">Transporte</span>
            {/* ✅ Solución Anti-Crash 2: Forzamos el idioma local a Colombia ('es-CO') */}
            <h3 className="text-4xl font-black relative z-10">${transportAux.toLocaleString('es-CO')}</h3>
            <p className="text-gray-500 text-[10px] uppercase font-bold mt-1 relative z-10">Valor Diario</p>
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
    <div className="flex justify-between items-center group cursor-default transition-transform hover:translate-x-1 duration-300">
      <span className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-300">
        {label}
      </span>
      {/* ✅ Solución Anti-Crash 3: Forzamos el idioma local a Colombia ('es-CO') */}
      <span className={`text-xl font-black transition-colors duration-300 ${textColor}`}>
        ${value.toLocaleString('es-CO')}
      </span>
    </div>
  );
}