"use client";
import { useTheme } from "@/context/ThemeContext";
import { RATES_BY_YEAR, TRANSPORT_AUX_BY_YEAR } from "@/constants/rates";

export default function RatesSection() {
  const { role, colors, themeColor } = useTheme();
  
  // Obtenemos el año actual del sistema
  const currentYear = new Date().getFullYear();
  
  // Buscamos las tarifas del año actual (si no existen en nuestra lista, usamos 2026 por defecto)
  const r = RATES_BY_YEAR[currentYear]?.[role] || RATES_BY_YEAR[2026][role];
  const transportAux = TRANSPORT_AUX_BY_YEAR[currentYear] || TRANSPORT_AUX_BY_YEAR[2026];

  return (
    <section id="tarifas" className="py-24 bg-white dark:bg-[#0a0a0a] transition-colors duration-500">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className={`text-4xl font-black tracking-tighter mb-4 ${themeColor === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            Tarifas {currentYear}: {role}
          </h2>
          <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-[10px]">
            Tabla de valores legales para empleados de operaciones
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Bloque 1: Horas Ordinarias */}
          <div className={`p-8 rounded-[2rem] border-2 transition-colors duration-300 ${colors.accent} dark:border-gray-800 ${themeColor === 'blue' ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
            <h3 className="text-sm font-black uppercase text-gray-400 dark:text-gray-500 mb-6">Ordinarias</h3>
            <div className="space-y-4">
              <RateRow label="Diurna" value={r.ORDINARY} />
              <RateRow label="Nocturna" value={r.ORDINARY_NIGHT} highlight={themeColor} />
            </div>
          </div>

          {/* Bloque 2: Horas Extras */}
          <div className="p-8 rounded-[2rem] bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 transition-colors duration-300">
            <h3 className="text-sm font-black uppercase text-gray-400 dark:text-gray-500 mb-6">Extras</h3>
            <div className="space-y-4">
              <RateRow label="Extra Diurna" value={r.EXTRA_DAY} />
              <RateRow label="Extra Nocturna" value={r.EXTRA_NIGHT} />
            </div>
          </div>

          {/* Bloque 3: Dominicales */}
          <div className="p-8 rounded-[2rem] bg-green-50 dark:bg-green-900/10 border-2 border-green-100 dark:border-green-900/30 text-green-800 dark:text-green-400 transition-colors duration-300">
            <h3 className="text-sm font-black uppercase text-green-400 dark:text-green-500 mb-6">Dominicales</h3>
            <div className="space-y-4">
              <RateRow label="Dominical" value={r.SUNDAY} isGreen />
              <RateRow label="Dom. Nocturno" value={r.SUNDAY_NIGHT} isGreen />
            </div>
          </div>

          {/* Bloque 4: Extras Festivas */}
          <div className="p-8 rounded-[2rem] bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-100 dark:border-orange-900/30 text-orange-800 dark:text-orange-400 md:col-span-2 transition-colors duration-300">
            <h3 className="text-sm font-black uppercase text-orange-400 dark:text-orange-500 mb-6">Extras Festivas</h3>
            <div className="grid grid-cols-2 gap-8">
              <RateRow label="Extra Fest. Diurna" value={r.EXTRA_FESTIVE_DAY} isOrange />
              <RateRow label="Extra Fest. Noct." value={r.EXTRA_FESTIVE_NIGHT} isOrange />
            </div>
          </div>

          {/* Bloque 5: Auxilio */}
          <div className="p-8 rounded-[2rem] bg-gray-900 dark:bg-[#111] border border-transparent dark:border-gray-800 text-white flex flex-col justify-center items-center transition-colors duration-300">
            <span className="text-blue-400 dark:text-blue-500 font-black uppercase text-[9px] mb-2">Transporte</span>
            <h3 className="text-4xl font-black">${transportAux.toLocaleString()}</h3>
            <p className="text-gray-500 text-[10px] uppercase font-bold mt-1">Valor Diario</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RateRow({ label, value, highlight, isGreen, isOrange }: { label: string; value: number; highlight?: string; isGreen?: boolean; isOrange?: boolean }) {
  // Ajustamos el color del número dependiendo de dónde esté
  let textColor = "text-gray-900 dark:text-white";
  if (highlight === 'blue') textColor = "text-blue-600 dark:text-blue-400";
  if (highlight === 'red') textColor = "text-red-600 dark:text-red-400";
  if (isGreen) textColor = "text-green-800 dark:text-green-400";
  if (isOrange) textColor = "text-orange-800 dark:text-orange-400";

  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-tight">{label}</span>
      <span className={`text-xl font-black ${textColor}`}>
        ${value.toLocaleString()}
      </span>
    </div>
  );
}