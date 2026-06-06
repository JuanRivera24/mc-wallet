"use client";
import React, { useState } from "react";
import Link from "next/link";
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
  tInherited_h?: number;
  tInherited_p?: number;
  inheritedDetails?: { originalDate: string, currentDate: string, hours: number, pay: number }[];
}

interface QuincenaSummaryProps {
  totals: QuincenaTotals;
  getDineroColor: (dinero: number) => string;

  // Big Venta Props
  currentBigVenta: any;
  isEditingBigVenta: boolean;
  setIsEditingBigVenta: (v: boolean) => void;
  hasBigVenta: boolean;
  setHasBigVenta: (v: boolean) => void;
  bigVentaValue: number | "";
  setBigVentaValue: (v: number | "") => void;
  saveBigVenta: () => void;
  deleteBigVenta: (id: string) => void;

  // Prima Props
  isPrimaSeason: boolean;
  currentPrima: any;
  isEditingPrima: boolean;
  setIsEditingPrima: (v: boolean) => void;
  hasPrima: boolean;
  setHasPrima: (v: boolean) => void;
  primaValue: number | "";
  setPrimaValue: (v: number | "") => void;
  savePrima: () => void;
  deletePrima: (id: string) => void;
  suggestedPrima: number;

  // Extra Deductions Props
  currentExtraDeductions: any[];
  isEditingExtraDeduction: boolean;
  setIsEditingExtraDeduction: (v: boolean) => void;
  hasExtraDeduction: boolean;
  setHasExtraDeduction: (v: boolean) => void;
  extraDeductionValue: number | "";
  setExtraDeductionValue: (v: number | "") => void;
  extraDeductionDesc: string;
  setExtraDeductionDesc: (v: string) => void;
  saveExtraDeduction: () => void;
  deleteExtraDeduction: (id: string) => void;
  setEditingExtraDeductionId: (id: string | null) => void;

  // Extra Incomes Props
  currentExtraIncomes: any[];
  isEditingExtraIncome: boolean;
  setIsEditingExtraIncome: (v: boolean) => void;
  hasExtraIncome: boolean;
  setHasExtraIncome: (v: boolean) => void;
  extraIncomeValue: number | "";
  setExtraIncomeValue: (v: number | "") => void;
  extraIncomeDesc: string;
  setExtraIncomeDesc: (v: string) => void;
  saveExtraIncome: () => void;
  deleteExtraIncome: (id: string) => void;
  setEditingExtraIncomeId: (id: string | null) => void;
}

export default function QuincenaSummary({
  totals,
  getDineroColor,
  currentBigVenta, isEditingBigVenta, setIsEditingBigVenta, hasBigVenta, setHasBigVenta, bigVentaValue, setBigVentaValue, saveBigVenta, deleteBigVenta,
  isPrimaSeason, currentPrima, isEditingPrima, setIsEditingPrima, hasPrima, setHasPrima, primaValue, setPrimaValue, savePrima, deletePrima, suggestedPrima,
  currentExtraDeductions, isEditingExtraDeduction, setIsEditingExtraDeduction, hasExtraDeduction, setHasExtraDeduction, extraDeductionValue, setExtraDeductionValue, extraDeductionDesc, setExtraDeductionDesc, saveExtraDeduction, deleteExtraDeduction, setEditingExtraDeductionId,
  currentExtraIncomes, isEditingExtraIncome, setIsEditingExtraIncome, hasExtraIncome, setHasExtraIncome, extraIncomeValue, setExtraIncomeValue, extraIncomeDesc, setExtraIncomeDesc, saveExtraIncome, deleteExtraIncome, setEditingExtraIncomeId
}: QuincenaSummaryProps) {

  const [isTotalExpanded, setIsTotalExpanded] = useState(false);
  const [showSplit, setShowSplit] = useState(false);

  const {
    totalListaHoras, totalListaDinero,
    tOrdD_h, tOrdD_p, tOrdN_h, tOrdN_p,
    tDomD_h, tDomD_p, tDomN_h, tDomN_p,
    tExtD_h, tExtD_p, tExtN_h, tExtN_p,
    tExtDomD_h, tExtDomD_p, tExtDomN_h, tExtDomN_p,
    tReunion_h, tReunion_p, tCompensatorio_h, tCompensatorio_p, tIncapacidad_h, tIncapacidad_p,
    tTransportBase, tTransportExtra, tDeductionsFinal,
    tInherited_h = 0, tInherited_p = 0, inheritedDetails = []
  } = totals;

  return (
    <div className="bg-gray-800 dark:bg-[#111] text-white flex flex-col mt-auto transition-all duration-300 rounded-b-[3rem]">

      <div
        onClick={() => setIsTotalExpanded(!isTotalExpanded)}
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-900 dark:hover:bg-black transition-colors rounded-b-[3rem]"
      >
        <div>
          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase flex items-center gap-2 tracking-widest">
            Horas {isTotalExpanded ? '▲' : '▼'}
          </p>
          <p className="text-xl md:text-2xl font-black">{totalListaHoras.toFixed(1)} h</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Neto a Recibir</p>
          <p className={`text-3xl md:text-4xl font-black tracking-tighter ${getDineroColor(totalListaDinero)}`}>
            ${Math.floor(totalListaDinero).toLocaleString()}
          </p>
        </div>
      </div>

      {isTotalExpanded && (
        <div className="bg-gray-100 dark:bg-black text-gray-900 dark:text-white px-5 md:px-8 pb-8 pt-6 animate-in slide-in-from-top-2 border-t border-gray-300 dark:border-gray-800 rounded-b-[3rem]">
          <p className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-600 tracking-widest mb-5 text-center">Desglose Exacto Quincenal</p>

          {tInherited_h > 0 && inheritedDetails.length > 0 && (
            <div className="mb-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span>⏳</span> Horas heredadas <span className="text-[8px] text-purple-600/60 dark:text-purple-300/60 ml-1">(Ya sumadas)</span>
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {inheritedDetails.map((det, idx) => {
                  const [y1, m1, d1] = det.originalDate.split('-');
                  const [y2, m2, d2] = det.currentDate.split('-');
                  const mesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                  const fD1 = parseInt(d1, 10); const fM1 = mesesCortos[parseInt(m1, 10) - 1];
                  const fD2 = parseInt(d2, 10); const fM2 = mesesCortos[parseInt(m2, 10) - 1];

                  return (
                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-black/30 shadow-sm dark:shadow-none rounded-xl p-2 md:p-3 border border-purple-500/10">
                      <p className="text-[10px] md:text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        Turno <span className="font-bold text-black dark:text-white">{fD1} {fM1}</span> → <span className="font-bold text-black dark:text-white">{fD2} {fM2}</span>
                      </p>
                      <div className="flex items-center gap-2 text-right">
                        <p className="text-xs md:text-sm font-black text-black dark:text-white">{det.hours.toFixed(1)} <span className="text-[9px] text-gray-500 font-bold">h</span></p>
                        <p className="text-xs md:text-sm font-black text-purple-600 dark:text-purple-400">+${Math.floor(det.pay).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-3 text-center">
            <div className={tOrdD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Ord. Diurna</p><p className={`font-black text-base md:text-lg ${tOrdD_h > 0 ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>{tOrdD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tOrdD_p).toLocaleString()}</p></div>
            <div className={tOrdN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Ord. Nocturna</p><p className={`font-black text-base md:text-lg ${tOrdN_h > 0 ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400 dark:text-gray-600'}`}>{tOrdN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tOrdN_p).toLocaleString()}</p></div>
            <div className={tDomD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Dom/Fest Diurno</p><p className={`font-black text-base md:text-lg ${tDomD_h > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400 dark:text-gray-600'}`}>{tDomD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tDomD_p).toLocaleString()}</p></div>
            <div className={tDomN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Dom/Fest Noct</p><p className={`font-black text-base md:text-lg ${tDomN_h > 0 ? 'text-orange-600 dark:text-orange-600' : 'text-gray-400 dark:text-gray-600'}`}>{tDomN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tDomN_p).toLocaleString()}</p></div>

            <div className={tExtD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Extra Diurna</p><p className={`font-black text-base md:text-lg ${tExtD_h > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-600'}`}>{tExtD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtD_p).toLocaleString()}</p></div>
            <div className={tExtN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Extra Nocturna</p><p className={`font-black text-base md:text-lg ${tExtN_h > 0 ? 'text-red-600' : 'text-gray-400 dark:text-gray-600'}`}>{tExtN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtN_p).toLocaleString()}</p></div>
            <div className={tExtDomD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Extra Dom. D.</p><p className={`font-black text-base md:text-lg ${tExtDomD_h > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-600'}`}>{tExtDomD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtDomD_p).toLocaleString()}</p></div>
            <div className={tExtDomN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">Extra Dom. N.</p><p className={`font-black text-base md:text-lg ${tExtDomN_h > 0 ? 'text-purple-600' : 'text-gray-400 dark:text-gray-600'}`}>{tExtDomN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtDomN_p).toLocaleString()}</p></div>

            <div className="col-span-2 md:col-span-4 border-t border-gray-300 dark:border-gray-800/50 pt-3 mt-1"></div>

            <div className={tReunion_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase">Reunión</p><p className={`font-black text-base md:text-lg ${tReunion_h > 0 ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>{tReunion_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tReunion_p).toLocaleString()}</p></div>
            <div className={tCompensatorio_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 uppercase">Compensatorio</p><p className={`font-black text-base md:text-lg ${tCompensatorio_h > 0 ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>{tCompensatorio_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tCompensatorio_p).toLocaleString()}</p></div>
            <div className={`col-span-2 md:col-span-2 ${tIncapacidad_h > 0 ? "" : "opacity-30"}`}><p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase">Incapacidad Pagada</p><p className={`font-black text-base md:text-lg ${tIncapacidad_h > 0 ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>{tIncapacidad_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tIncapacidad_p).toLocaleString()}</p></div>

            <div className="col-span-2 md:col-span-4 border-t border-gray-300 dark:border-gray-800/50 pt-3 mt-1"></div>

            <div className={`col-span-1 md:col-span-2 ${tTransportBase > 0 ? "" : "opacity-30"}`}>
              <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Aux. Transporte</p>
              <p className={`font-black text-xl md:text-2xl ${tTransportBase > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>+${Math.floor(tTransportBase).toLocaleString()}</p>
            </div>

            <div className={`col-span-1 md:col-span-2 ${tTransportExtra > 0 ? "" : "opacity-30"}`}>
              <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Bono Madrugada</p>
              <p className={`font-black text-xl md:text-2xl ${tTransportExtra > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-600'}`}>+${Math.floor(tTransportExtra).toLocaleString()}</p>
            </div>

            <div 
              className={`col-span-2 md:col-span-4 ${tDeductionsFinal > 0 ? "cursor-pointer active:scale-[0.98] transition-transform" : "opacity-30"} pt-3`}
              onClick={() => tDeductionsFinal > 0 && setShowSplit(!showSplit)}
            >
              <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 flex items-center justify-center gap-1">
                Total Deducciones {tDeductionsFinal > 0 && <span className="text-[8px] italic lowercase opacity-70 border border-gray-300 dark:border-gray-600 px-1.5 py-0.5 rounded-md">Toca para ver</span>}
              </p>
              <p className={`font-black text-xl md:text-2xl ${tDeductionsFinal > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-600'}`}>-${Math.floor(tDeductionsFinal).toLocaleString()}</p>
              {showSplit && tDeductionsFinal > 0 && (
                <div className="flex justify-center gap-4 mt-2 text-[9px] font-black uppercase text-gray-500 bg-black/5 dark:bg-white/5 py-1.5 rounded-lg border border-red-500/10">
                  <p>Salud: <span className="text-red-500 dark:text-red-400">-${Math.floor(tDeductionsFinal / 2).toLocaleString()}</span></p>
                  <p>Pensión: <span className="text-red-500 dark:text-red-400">-${Math.floor(tDeductionsFinal / 2).toLocaleString()}</span></p>
                </div>
              )}
            </div>
          </div>

          {/* DEDUCCIONES E INGRESOS EXTRAS - COMPACTOS EN MÓVIL */}
          <div className="grid md:grid-cols-2 gap-4 mt-5 w-full">
            
            {/* 1. DEDUCCIONES EXTRAS (Arriba/Izquierda) */}
            <div className="flex flex-col gap-2.5 w-full">
              {currentExtraDeductions.map(ed => (
                <div key={ed.id} className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-2.5 md:p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
                  <div>
                    <p className="text-[9px] md:text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest leading-tight mb-0.5">{ed.desc}</p>
                    <p className="font-black text-base md:text-xl text-black dark:text-white leading-none">-${Math.floor(ed.value).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1.5 md:gap-2">
                    <button onClick={() => { setIsEditingExtraDeduction(true); setHasExtraDeduction(true); setExtraDeductionValue(ed.value); setExtraDeductionDesc(ed.desc); setEditingExtraDeductionId(ed.id); }} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg hover:bg-red-500 hover:text-white transition-colors shadow-sm text-xs md:text-sm">✏️</button>
                    <button onClick={() => deleteExtraDeduction(ed.id)} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg hover:bg-red-500 hover:text-white transition-colors shadow-sm text-xs md:text-sm">🗑️</button>
                  </div>
                </div>
              ))}

              {(hasExtraDeduction || isEditingExtraDeduction) ? (
                <div className="bg-red-50/50 dark:bg-red-900/10 p-3 md:p-4 rounded-2xl border border-red-100 dark:border-red-900/30 flex flex-col gap-2.5 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] md:text-[10px] font-black uppercase text-red-600 dark:text-red-400 tracking-widest">{isEditingExtraDeduction ? "Editando Deducción" : "Nueva Deducción"}</span>
                    <button onClick={() => { setHasExtraDeduction(false); setIsEditingExtraDeduction(false); setEditingExtraDeductionId(null); setExtraDeductionDesc(""); setExtraDeductionValue(""); }} className="text-red-400 text-[10px] font-bold bg-white dark:bg-gray-800 px-2 py-1 rounded-md">✖</button>
                  </div>
                  <input type="text" placeholder="Ej. Portanombres" className="bg-white dark:bg-gray-800 border-none rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-bold w-full outline-none text-black dark:text-white shadow-sm" value={extraDeductionDesc} onChange={e => setExtraDeductionDesc(e.target.value)} />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Monto" className="flex-1 bg-white dark:bg-gray-800 border-none rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-bold w-full outline-none text-black dark:text-white shadow-sm" value={extraDeductionValue} onChange={e => setExtraDeductionValue(e.target.value ? Number(e.target.value) : "")} />
                    <button onClick={saveExtraDeduction} className="bg-red-500 text-white font-black px-3 md:px-4 rounded-xl uppercase text-[9px] tracking-widest hover:bg-red-600 shadow-sm active:scale-95 transition-all">Guardar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setHasExtraDeduction(true)} className="flex items-center justify-center gap-2 border border-dashed border-red-200 dark:border-red-900/50 rounded-2xl py-2.5 px-3 md:p-3 text-red-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 transition-colors text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 w-full mx-auto">
                  <span>➖</span> Agregar Deducción Extra
                </button>
              )}
            </div>

            {/* 2. INGRESOS EXTRAS (Abajo/Derecha) */}
            <div className="flex flex-col gap-2.5 w-full">
              {currentExtraIncomes.map(ei => (
                <div key={ei.id} className="flex justify-between items-center bg-green-50 dark:bg-green-900/10 p-2.5 md:p-4 rounded-2xl border border-green-200 dark:border-green-900/30">
                  <div>
                    <p className="text-[9px] md:text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest leading-tight mb-0.5">{ei.desc}</p>
                    <p className="font-black text-base md:text-xl text-black dark:text-white leading-none">+${Math.floor(ei.value).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1.5 md:gap-2">
                    <button onClick={() => { setIsEditingExtraIncome(true); setHasExtraIncome(true); setExtraIncomeValue(ei.value); setExtraIncomeDesc(ei.desc); setEditingExtraIncomeId(ei.id); }} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg hover:bg-green-500 hover:text-white transition-colors shadow-sm text-xs md:text-sm">✏️</button>
                    <button onClick={() => deleteExtraIncome(ei.id)} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg hover:bg-red-500 hover:text-white transition-colors shadow-sm text-xs md:text-sm">🗑️</button>
                  </div>
                </div>
              ))}

              {(hasExtraIncome || isEditingExtraIncome) ? (
                <div className="bg-green-50/50 dark:bg-green-900/10 p-3 md:p-4 rounded-2xl border border-green-200 dark:border-green-900/30 flex flex-col gap-2.5 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] md:text-[10px] font-black uppercase text-green-600 dark:text-green-400 tracking-widest">{isEditingExtraIncome ? "Editando Ingreso" : "Nuevo Ingreso Extra"}</span>
                    <button onClick={() => { setHasExtraIncome(false); setIsEditingExtraIncome(false); setEditingExtraIncomeId(null); setExtraIncomeDesc(""); setExtraIncomeValue(""); }} className="text-green-500 text-[10px] font-bold bg-white dark:bg-gray-800 px-2 py-1 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">✖</button>
                  </div>
                  <input type="text" placeholder="Ej. Bono Empleado" className="bg-white dark:bg-gray-800 border-none rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-bold w-full outline-none text-black dark:text-white shadow-sm" value={extraIncomeDesc} onChange={e => setExtraIncomeDesc(e.target.value)} />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Monto" className="flex-1 bg-white dark:bg-gray-800 border-none rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-bold w-full outline-none text-black dark:text-white shadow-sm" value={extraIncomeValue} onChange={e => setExtraIncomeValue(e.target.value ? Number(e.target.value) : "")} />
                    <button onClick={saveExtraIncome} className="bg-green-500 text-white font-black px-3 md:px-4 rounded-xl uppercase text-[9px] tracking-widest hover:bg-green-600 shadow-sm active:scale-95 transition-all">Guardar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setHasExtraIncome(true)} className="flex items-center justify-center gap-2 border border-dashed border-green-200 dark:border-green-900/50 rounded-2xl py-2.5 px-3 md:p-3 text-green-500 hover:text-green-600 hover:border-green-300 dark:hover:border-green-800 transition-colors text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-green-50 dark:hover:bg-green-900/10 w-full mx-auto">
                  <span>➕</span> Agregar Bono / Ingreso
                </button>
              )}
            </div>

          </div>

          {/* EVENTOS ESPECIALES QUINCENALES (PRIMA, BIG VENTA) */}
          <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-800/50 flex flex-col w-full gap-3">

            {isPrimaSeason && (
              <>
                {currentPrima && !isEditingPrima ? (
                  <div className="flex justify-between items-center bg-white dark:bg-gray-800/40 p-4 md:p-6 rounded-3xl border-2 border-emerald-500/30 shadow-md">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-lg">🌟</span>
                        <p className="text-[9px] md:text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Prima de Servicios</p>
                      </div>
                      <p className="font-black text-2xl md:text-3xl text-black dark:text-white">${Math.floor(currentPrima.value).toLocaleString()}</p>
                      <p className="text-[9px] md:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter mt-0.5">
                        100% Exenta
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setIsEditingPrima(true); setHasPrima(true); setPrimaValue(currentPrima.value); }} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-gray-100 dark:bg-gray-700/80 rounded-xl hover:bg-emerald-500 hover:text-white transition-colors shadow-sm text-sm" title="Editar">✏️</button>
                      <button onClick={() => deletePrima(currentPrima.id)} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-gray-100 dark:bg-gray-700/80 rounded-xl hover:bg-red-500 hover:text-white transition-colors shadow-sm text-sm" title="Eliminar">🗑️</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full bg-emerald-50/50 dark:bg-emerald-900/10 p-4 md:p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center justify-between mb-3 w-full max-w-md">
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest italic flex items-center gap-1">
                          {isEditingPrima ? "Editando Prima 🌟" : "¿Agregar Prima? 🌟"}
                        </span>
                      </div>
                      <button onClick={() => {
                        if (isEditingPrima) {
                          setIsEditingPrima(false);
                          setHasPrima(false);
                        } else {
                          setHasPrima(!hasPrima);
                        }
                      }} className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative ${(hasPrima || isEditingPrima) ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`absolute top-0.5 md:top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${(hasPrima || isEditingPrima) ? 'left-[22px] md:left-7' : 'left-0.5 md:left-1'}`} />
                      </button>
                    </div>

                    {(hasPrima || isEditingPrima) && (
                      <div className="animate-in slide-in-from-top-2 duration-300 flex flex-col gap-2.5 w-full max-w-md">
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                          <input type="number" placeholder="Ej. 750000" className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-xl p-3 md:p-4 text-center text-black dark:text-white font-black text-base md:text-lg w-full focus:ring-2 ring-emerald-500 outline-none transition-all shadow-sm" value={primaValue} onChange={(e) => setPrimaValue(e.target.value ? Number(e.target.value) : "")} />
                          <button onClick={savePrima} className="bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] md:text-xs px-5 py-3 md:py-4 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all w-full sm:w-auto shadow-sm">Guardar</button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                          <button onClick={() => setPrimaValue(suggestedPrima)} className="flex-1 text-[9px] md:text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 py-2.5 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors">
                            Base 180 días (${suggestedPrima.toLocaleString()})
                          </button>
                          <Link href="/servicios?calc=prima" className="flex-1 text-center flex items-center justify-center gap-1 text-[9px] md:text-[10px] font-black uppercase text-white bg-gray-900 dark:bg-white dark:text-black py-2.5 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-sm">
                            Calculadora Avanzada 🚀
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* BIG VENTA */}
            {currentBigVenta && !isEditingBigVenta ? (
              <div className="flex justify-between items-center bg-white dark:bg-gray-800/40 p-4 md:p-6 rounded-3xl border-2 border-yellow-500/30 shadow-md">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-lg">🍔</span>
                    <p className="text-[9px] md:text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest">Big Venta</p>
                  </div>
                  <p className="font-black text-2xl md:text-3xl text-black dark:text-white">${Math.floor(currentBigVenta.value).toLocaleString()}</p>
                  <p className="text-[9px] md:text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter mt-0.5">
                    Neto: <span className="text-green-600 dark:text-green-400">+${Math.floor(currentBigVenta.value * 0.92).toLocaleString()}</span> <span className="mx-0.5 md:mx-1">|</span> -8%: <span className="text-red-600 dark:text-red-400">-${Math.floor(currentBigVenta.value * 0.08).toLocaleString()}</span>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => { setIsEditingBigVenta(true); setHasBigVenta(true); setBigVentaValue(currentBigVenta.value); }} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-gray-100 dark:bg-gray-700/80 rounded-xl hover:bg-yellow-500 hover:text-black transition-colors shadow-sm text-sm" title="Editar">✏️</button>
                  <button onClick={() => deleteBigVenta(currentBigVenta.id)} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-gray-100 dark:bg-gray-700/80 rounded-xl hover:bg-red-500 hover:text-white transition-colors shadow-sm text-sm" title="Eliminar">🗑️</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full bg-white/50 dark:bg-gray-900/20 p-4 md:p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3 w-full max-w-md">
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">{isEditingBigVenta ? "Editando Big Venta 💸" : "¿Hubo Big Venta? 💸"}</span>
                  <button onClick={() => {
                    if (isEditingBigVenta) {
                      setIsEditingBigVenta(false);
                      setHasBigVenta(false);
                    } else {
                      setHasBigVenta(!hasBigVenta);
                    }
                  }} className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative ${(hasBigVenta || isEditingBigVenta) ? 'bg-yellow-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                    <div className={`absolute top-0.5 md:top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${(hasBigVenta || isEditingBigVenta) ? 'left-[22px] md:left-7' : 'left-0.5 md:left-1'}`} />
                  </button>
                </div>
                {(hasBigVenta || isEditingBigVenta) && (
                  <div className="animate-in slide-in-from-top-2 duration-300 flex flex-col sm:flex-row items-center gap-2 w-full max-w-md">
                    <input type="number" placeholder="Ingresar Valor (ej. 60000)" className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-xl p-3 md:p-4 text-center text-black dark:text-white font-black text-base md:text-lg w-full focus:ring-2 ring-yellow-500 outline-none transition-all shadow-sm dark:shadow-none" value={bigVentaValue} onChange={(e) => setBigVentaValue(e.target.value ? Number(e.target.value) : "")} />
                    <button onClick={saveBigVenta} className="bg-yellow-500 text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-5 py-3 md:py-4 rounded-xl hover:bg-yellow-400 active:scale-95 transition-all w-full sm:w-auto shadow-sm">Guardar</button>
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