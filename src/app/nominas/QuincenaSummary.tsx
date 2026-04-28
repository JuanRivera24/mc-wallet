"use client";
import React, { useState } from "react";

// Agrupamos todos los totales en una interfaz para no pasar 30 variables sueltas
export interface QuincenaTotals {
  totalListaHoras: number;
  totalListaDinero: number;
  tOrdD_h: number; tOrdD_p: number;
  tOrdN_h: number; tOrdN_p: number;
  tDomD_h: number; tDomD_p: number;
  tDomN_h: number; tDomN_p: number;
  tExtD_h: number; tExtD_p: number;
  tExtN_h: number; tExtN_p: number;
  tExtDomD_h: number; tExtDomD_p: number;
  tExtDomN_h: number; tExtDomN_p: number;
  tReunion_h: number; tReunion_p: number;
  tCompensatorio_h: number; tCompensatorio_p: number;
  tIncapacidad_h: number; tIncapacidad_p: number;
  tTransportBase: number;
  tTransportExtra: number;
  tDeductionsFinal: number;
}

interface QuincenaSummaryProps {
  totals: QuincenaTotals;
  getDineroColor: (dinero: number) => string;
  // Props de la Big Venta
  currentBigVenta: any;
  isEditingBigVenta: boolean;
  setIsEditingBigVenta: (v: boolean) => void;
  hasBigVenta: boolean;
  setHasBigVenta: (v: boolean) => void;
  bigVentaValue: number | "";
  setBigVentaValue: (v: number | "") => void;
  saveBigVenta: () => void;
  deleteBigVenta: (id: string) => void;
}

export default function QuincenaSummary({
  totals,
  getDineroColor,
  currentBigVenta,
  isEditingBigVenta,
  setIsEditingBigVenta,
  hasBigVenta,
  setHasBigVenta,
  bigVentaValue,
  setBigVentaValue,
  saveBigVenta,
  deleteBigVenta
}: QuincenaSummaryProps) {
  
  // Estado local, ya no contamina la página principal
  const [isTotalExpanded, setIsTotalExpanded] = useState(false);

  // Destructuramos para no escribir totals.tOrdD_h en cada línea
  const {
    totalListaHoras, totalListaDinero,
    tOrdD_h, tOrdD_p, tOrdN_h, tOrdN_p,
    tDomD_h, tDomD_p, tDomN_h, tDomN_p,
    tExtD_h, tExtD_p, tExtN_h, tExtN_p,
    tExtDomD_h, tExtDomD_p, tExtDomN_h, tExtDomN_p,
    tReunion_h, tReunion_p, tCompensatorio_h, tCompensatorio_p, tIncapacidad_h, tIncapacidad_p,
    tTransportBase, tTransportExtra, tDeductionsFinal
  } = totals;

  return (
    <div className="bg-gray-900 dark:bg-[#111] text-white flex flex-col mt-auto transition-all duration-300 rounded-b-[3rem]">
      
      <div
        onClick={() => setIsTotalExpanded(!isTotalExpanded)}
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-black transition-colors rounded-b-[3rem]"
      >
        <div>
          <p className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2 tracking-widest">
            Horas {isTotalExpanded ? '▲' : '▼'}
          </p>
          <p className="text-xl md:text-2xl font-black">{totalListaHoras.toFixed(1)} h</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Neto a Recibir</p>
          <p className={`text-3xl md:text-4xl font-black tracking-tighter ${getDineroColor(totalListaDinero)}`}>
            ${Math.floor(totalListaDinero).toLocaleString()}
          </p>
        </div>
      </div>

      {isTotalExpanded && (
        <div className="bg-[#111] dark:bg-black px-6 md:px-8 pb-10 pt-6 animate-in slide-in-from-top-2 border-t border-gray-800 rounded-b-[3rem]">
          <p className="text-[10px] font-black uppercase text-gray-600 tracking-widest mb-6 text-center">Desglose Exacto Quincenal</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 text-center">
            <div className={tOrdD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Ord. Diurna</p><p className={`font-black text-lg ${tOrdD_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tOrdD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tOrdD_p).toLocaleString()}</p></div>
            <div className={tOrdN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Ord. Nocturna</p><p className={`font-black text-lg ${tOrdN_h > 0 ? 'text-blue-300' : 'text-gray-600'}`}>{tOrdN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tOrdN_p).toLocaleString()}</p></div>
            <div className={tDomD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Dom/Fest Diurno</p><p className={`font-black text-lg ${tDomD_h > 0 ? 'text-orange-400' : 'text-gray-600'}`}>{tDomD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tDomD_p).toLocaleString()}</p></div>
            <div className={tDomN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Dom/Fest Noct</p><p className={`font-black text-lg ${tDomN_h > 0 ? 'text-orange-600' : 'text-gray-600'}`}>{tDomN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tDomN_p).toLocaleString()}</p></div>

            <div className={tExtD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Extra Diurna</p><p className={`font-black text-lg ${tExtD_h > 0 ? 'text-red-400' : 'text-gray-600'}`}>{tExtD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtD_p).toLocaleString()}</p></div>
            <div className={tExtN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Extra Nocturna</p><p className={`font-black text-lg ${tExtN_h > 0 ? 'text-red-600' : 'text-gray-600'}`}>{tExtN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtN_p).toLocaleString()}</p></div>
            <div className={tExtDomD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Extra Dom. D.</p><p className={`font-black text-lg ${tExtDomD_h > 0 ? 'text-purple-400' : 'text-gray-600'}`}>{tExtDomD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtDomD_p).toLocaleString()}</p></div>
            <div className={tExtDomN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Extra Dom. N.</p><p className={`font-black text-lg ${tExtDomN_h > 0 ? 'text-purple-600' : 'text-gray-600'}`}>{tExtDomN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtDomN_p).toLocaleString()}</p></div>

            <div className="col-span-2 md:col-span-4 border-t border-gray-800/50 pt-4 mt-2"></div>

            <div className={tReunion_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-orange-400 uppercase">Reunión</p><p className={`font-black text-lg ${tReunion_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tReunion_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tReunion_p).toLocaleString()}</p></div>
            <div className={tCompensatorio_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-yellow-400 uppercase">Compensatorio</p><p className={`font-black text-lg ${tCompensatorio_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tCompensatorio_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tCompensatorio_p).toLocaleString()}</p></div>
            <div className={`col-span-2 md:col-span-2 ${tIncapacidad_h > 0 ? "" : "opacity-30"}`}><p className="text-[9px] font-bold text-red-400 uppercase">Incapacidad Pagada (Esta Q.)</p><p className={`font-black text-lg ${tIncapacidad_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tIncapacidad_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tIncapacidad_p).toLocaleString()}</p></div>

            <div className="col-span-2 md:col-span-4 border-t border-gray-800/50 pt-4 mt-2"></div>

            <div className={`col-span-1 md:col-span-2 ${tTransportBase > 0 ? "" : "opacity-30"}`}>
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Aux. Transporte</p>
              <p className={`font-black text-2xl ${tTransportBase > 0 ? 'text-green-400' : 'text-gray-600'}`}>+${Math.floor(tTransportBase).toLocaleString()}</p>
            </div>

            <div className={`col-span-1 md:col-span-2 ${tTransportExtra > 0 ? "" : "opacity-30"}`}>
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Bono Madrugada</p>
              <p className={`font-black text-2xl ${tTransportExtra > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>+${Math.floor(tTransportExtra).toLocaleString()}</p>
            </div>

            <div className={`col-span-2 md:col-span-4 ${tDeductionsFinal > 0 ? "" : "opacity-30"} pt-4`}>
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Total Deducciones</p>
              <p className={`font-black text-2xl ${tDeductionsFinal > 0 ? 'text-red-400' : 'text-gray-600'}`}>-${Math.floor(tDeductionsFinal).toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800/50 flex flex-col w-full">
            {currentBigVenta && !isEditingBigVenta ? (
              <div className="flex justify-between items-center bg-gray-800/40 p-5 rounded-2xl border border-gray-700/50">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Big Venta Registrada 💸</p>
                  <p className="font-black text-2xl text-yellow-400">${Math.floor(currentBigVenta.value).toLocaleString()}</p>
                  <p className="text-[11.5px] font-bold text-gray-500 uppercase tracking-tighter mt-1">
                    Neto: <span className="text-green-400">+${Math.floor(currentBigVenta.value * 0.92).toLocaleString()}</span> | Deduc: <span className="text-red-400">-${Math.floor(currentBigVenta.value * 0.08).toLocaleString()}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setIsEditingBigVenta(true); setHasBigVenta(true); setBigVentaValue(currentBigVenta.value); }} className="p-3 bg-gray-700/50 rounded-xl hover:bg-white hover:text-black transition-colors" title="Editar">✏️</button>
                  <button onClick={() => deleteBigVenta(currentBigVenta.id)} className="p-3 bg-gray-700/50 rounded-xl hover:bg-red-500 hover:text-white transition-colors" title="Eliminar">🗑️</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                <div className="flex items-center justify-between mb-4 w-full max-w-md">
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">{isEditingBigVenta ? "Editando Big Venta 💸" : "¿Hubo Big Venta? 💸"}</span>
                  <button onClick={() => {
                    if (isEditingBigVenta) {
                      setIsEditingBigVenta(false);
                      setHasBigVenta(false);
                    } else {
                      setHasBigVenta(!hasBigVenta);
                    }
                  }} className={`w-12 h-6 rounded-full transition-all relative ${(hasBigVenta || isEditingBigVenta) ? 'bg-yellow-500' : 'bg-gray-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${(hasBigVenta || isEditingBigVenta) ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                {(hasBigVenta || isEditingBigVenta) && (
                  <div className="animate-in slide-in-from-top-2 duration-300 flex flex-col md:flex-row items-center gap-3 w-full max-w-md">
                    <input type="number" placeholder="Ingresar Valor (ej. 60000)" className="flex-1 bg-gray-800 border-none rounded-xl p-4 text-center text-white font-black text-lg w-full focus:ring-2 ring-yellow-500 outline-none transition-all" value={bigVentaValue} onChange={(e) => setBigVentaValue(e.target.value ? Number(e.target.value) : "")} />
                    <button onClick={saveBigVenta} className="bg-yellow-500 text-black font-black uppercase tracking-widest text-xs px-6 py-4 rounded-xl hover:bg-yellow-400 active:scale-95 transition-all w-full md:w-auto">Guardar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}