"use client";
import { useTheme } from "@/context/ThemeContext";
import { RATES, TRANSPORT_AUX_DAILY } from "@/constants/rates";

export default function RatesSection() {
  const { role, colors, themeColor } = useTheme();
  const r = RATES[role];

  return (
    <section id="tarifas" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className={`text-5xl font-black tracking-tighter mb-4 ${colors.primary}`}>
            Tarifas 2026: {role}
          </h2>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
            Tabla de valores legales para empleados de operaciones
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Bloque 1: Horas Ordinarias */}
          <div className={`p-8 rounded-[2rem] border-2 ${colors.accent} ${colors.bg}`}>
            <h3 className="text-sm font-black uppercase text-gray-400 mb-6">Ordinarias</h3>
            <div className="space-y-4">
              <RateRow label="Diurna" value={r.ORDINARY} />
              <RateRow label="Nocturna" value={r.ORDINARY_NIGHT} highlight={themeColor} />
            </div>
          </div>

          {/* Bloque 2: Horas Extras */}
          <div className="p-8 rounded-[2rem] bg-gray-50 border-2 border-gray-100">
            <h3 className="text-sm font-black uppercase text-gray-400 mb-6">Extras</h3>
            <div className="space-y-4">
              <RateRow label="Extra Diurna" value={r.EXTRA_DAY} />
              <RateRow label="Extra Nocturna" value={r.EXTRA_NIGHT} />
            </div>
          </div>

          {/* Bloque 3: Dominicales */}
          <div className="p-8 rounded-[2rem] bg-green-50 border-2 border-green-100 text-green-800">
            <h3 className="text-sm font-black uppercase text-green-400 mb-6">Dominicales</h3>
            <div className="space-y-4">
              <RateRow label="Dominical" value={r.SUNDAY} />
              <RateRow label="Dom. Nocturno" value={r.SUNDAY_NIGHT} />
            </div>
          </div>

          {/* Bloque 4: Extras Festivas */}
          <div className="p-8 rounded-[2rem] bg-orange-50 border-2 border-orange-100 text-orange-800 md:col-span-2">
            <h3 className="text-sm font-black uppercase text-orange-400 mb-6">Extras Festivas</h3>
            <div className="grid grid-cols-2 gap-8">
              <RateRow label="Extra Fest. Diurna" value={r.EXTRA_FESTIVE_DAY} />
              <RateRow label="Extra Fest. Noct." value={r.EXTRA_FESTIVE_NIGHT} />
            </div>
          </div>

          {/* Bloque 5: Auxilio */}
          <div className="p-8 rounded-[2rem] bg-gray-900 text-white flex flex-col justify-center items-center">
            <span className="text-blue-400 font-black uppercase text-[9px] mb-2">Transporte</span>
            <h3 className="text-4xl font-black">${TRANSPORT_AUX_DAILY.toLocaleString()}</h3>
            <p className="text-gray-500 text-[10px] uppercase font-bold mt-1">Valor Diario</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RateRow({ label, value, highlight }: { label: string; value: number; highlight?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-black uppercase text-gray-500 tracking-tight">{label}</span>
      <span className={`text-xl font-black ${highlight === 'blue' ? 'text-blue-600' : highlight === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
        ${value.toLocaleString()}
      </span>
    </div>
  );
}