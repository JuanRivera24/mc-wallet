"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useHaptics } from "@/hooks/useHaptics";
import { useTheme } from "@/context/ThemeContext";
import { TRANSPORT_AUX_BY_YEAR } from "@/constants/rates";

const MESES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type CalcType = 'VACACIONES' | 'CESANTIAS' | 'LIQUIDACION';

export default function PrestacionesCalculator() {
  const { user } = useUser();
  const { themeColor } = useTheme();
  const { hapticLight, hapticSuccess, hapticError, hapticWarning } = useHaptics();

  const activeBg = themeColor === 'blue' ? 'bg-blue-500' : 'bg-red-500';
  const activeText = themeColor === 'blue' ? 'text-blue-500' : 'text-red-500';
  const activeBorder = themeColor === 'blue' ? 'border-blue-500' : 'border-red-500';

  const currentYear = new Date().getFullYear();
  const baseTransport = TRANSPORT_AUX_BY_YEAR[currentYear] || 162000;

  // ==========================================
  // ESTADOS GLOBALES
  // ==========================================
  const [calcType, setCalcType] = useState<CalcType>('VACACIONES');
  const [selectedYear, setSelectedYear] = useState(currentYear); 
  
  const [shifts, setShifts] = useState<any[]>([]);
  const [bigVentas, setBigVentas] = useState<any[]>([]);
  const [savedRecords, setSavedRecords] = useState<any[]>([]);

  // ESTADOS CONFIGURACIÓN
  const [salaryMode, setSalaryMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualSalary, setManualSalary] = useState<number | "">("");
  const [manualTransport, setManualTransport] = useState<number | "">(baseTransport); 

  const [daysMode, setDaysMode] = useState<'DATES' | 'MANUAL'>('DATES');
  const [manualDays, setManualDays] = useState<number | "">(360);
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);

  // ESTADO DESGLOSE Y EDICIÓN
  const [showBreakdown, setShowBreakdown] = useState(false); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ==========================================
  // FETCH DE DATOS
  // ==========================================
  useEffect(() => {
    if (!user) return;
    const qShifts = query(collection(db, "shifts"), where("userId", "==", user.id), where("year", "==", selectedYear));
    const unsubShifts = onSnapshot(qShifts, (snap) => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const qBV = query(collection(db, "bigVentas"), where("userId", "==", user.id), where("year", "==", selectedYear));
    const unsubBV = onSnapshot(qBV, (snap) => setBigVentas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qSaved = query(collection(db, "prestaciones"), where("userId", "==", user.id), where("year", "==", selectedYear));
    const unsubSaved = onSnapshot(qSaved, (snap) => setSavedRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { unsubShifts(); unsubBV(); unsubSaved(); };
  }, [user, selectedYear]);

  // ==========================================
  // MOTOR PROMEDIOS
  // ==========================================
  const { avgGrossSalary, avgTransport, monthDetails } = useMemo(() => {
    let totalGross = 0;
    let totalTransport = 0;
    const details: any[] = []; 

    MESES_FULL.forEach(month => {
      const monthShifts = shifts.filter(s => s.month === month && !s.isOff);
      const monthBV = bigVentas.filter(b => b.month === month);

      let mGross = 0;
      let mTransport = 0;

      monthShifts.forEach(s => {
        mGross += (Number(s.netPay) || 0) + (Number(s.deductions) || 0);
        mTransport += (Number(s.transportAux) || 0);
      });
      monthBV.forEach(b => {
        mGross += (Number(b.value) || 0);
      });

      if (monthShifts.length >= 5 || mGross > 250000) {
        totalGross += mGross;
        totalTransport += mTransport;
        details.push({ month, gross: mGross, transport: mTransport, shiftsCount: monthShifts.length });
      }
    });

    if (details.length === 0) return { avgGrossSalary: 0, avgTransport: 0, monthDetails: [] };
    
    return {
      avgGrossSalary: Math.floor(totalGross / details.length),
      avgTransport: Math.floor(totalTransport / details.length),
      monthDetails: details
    };
  }, [shifts, bigVentas]);

  // ==========================================
  // CÁLCULO DÍAS 
  // ==========================================
  const calculatedDays = useMemo(() => {
    if (daysMode === 'MANUAL') return Number(manualDays) || 0;
    if (daysMode === 'DATES') {
      if (!startDate || !endDate) return 0;
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      
      if (d2 < d1) return 0; 
      
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays; 
    }
    return 0;
  }, [daysMode, manualDays, startDate, endDate]);

  // ==========================================
  // VARIABLES FINALES
  // ==========================================
  const finalSalary = salaryMode === 'AUTO' ? avgGrossSalary : (Number(manualSalary) || 0);
  const finalTransport = salaryMode === 'AUTO' ? avgTransport : (Number(manualTransport) || 0);
  const salarySinTransporte = Math.max(0, finalSalary - finalTransport);

  // FÓRMULAS DE LEY
  const valCesantias = Math.floor((finalSalary * calculatedDays) / 360);
  const valIntereses = Math.floor((valCesantias * calculatedDays * 0.12) / 360);
  const valPrima = Math.floor((finalSalary * calculatedDays) / 360);
  const valVacaciones = Math.floor((salarySinTransporte * calculatedDays) / 720);

  const totalLiquidacion = valCesantias + valIntereses + valPrima + valVacaciones;

  const resultAmount = calcType === 'VACACIONES' ? valVacaciones : calcType === 'CESANTIAS' ? valCesantias : totalLiquidacion;

  // ==========================================
  // ACCIONES CRUD (GUARDAR, EDITAR, ELIMINAR)
  // ==========================================
  const handleSaveCalculation = async () => {
    if (!user || resultAmount <= 0) return hapticError();
    setIsSaving(true);
    hapticLight();

    try {
      const payload = {
        userId: user.id,
        year: selectedYear,
        type: calcType,
        salaryMode,
        manualSalary: manualSalary === "" ? 0 : manualSalary,
        manualTransport: manualTransport === "" ? 0 : manualTransport,
        daysMode,
        manualDays: manualDays === "" ? 0 : manualDays,
        startDate,
        endDate,
        calculatedDays,
        resultAmount,
        timestamp: serverTimestamp()
      };

      if (editingId) {
        await setDoc(doc(db, "prestaciones", editingId), payload, { merge: true });
        setEditingId(null);
        hapticSuccess();
      } else {
        const newRef = doc(collection(db, "prestaciones"));
        await setDoc(newRef, payload);
        hapticSuccess();
      }
    } catch (e) {
      hapticError();
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRecord = (record: any) => {
    hapticLight();
    setCalcType(record.type);
    setSelectedYear(record.year);
    setSalaryMode(record.salaryMode);
    setManualSalary(record.manualSalary || "");
    setManualTransport(record.manualTransport || "");
    setDaysMode(record.daysMode);
    setManualDays(record.manualDays || "");
    setStartDate(record.startDate || "");
    setEndDate(record.endDate || "");
    setEditingId(record.id);
    
    // ✅ Scroll corregido: sube suavemente hasta el id de ESTE componente
    const formTop = document.getElementById("prestaciones-top");
    if (formTop) {
      formTop.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    hapticWarning();
    if (confirm("¿Eliminar este cálculo guardado?")) {
      try {
        await deleteDoc(doc(db, "prestaciones", id));
        if (editingId === id) setEditingId(null);
        hapticSuccess();
      } catch (e) {
        hapticError();
      }
    }
  };

  const handleCancelEdit = () => {
    hapticLight();
    setEditingId(null);
  };

  return (
    // ✅ ID agregado aquí para el target del scroll
    <div id="prestaciones-top" className="w-full space-y-6 pb-6">
      
      {/* 1. HEADER INTEGRADO & SELECTOR DE PRESTACIÓN */}
      <div className="space-y-2">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            {editingId ? <span className="text-blue-500">✏️ Editando Cálculo Guardado</span> : "Tipo de Cálculo"}
          </h3>
          <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1 py-0.5 shadow-sm">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest ml-1 mr-0.5">Año</span>
            <button onClick={() => { hapticLight(); setSelectedYear(selectedYear - 1); }} className="px-1.5 text-gray-400 hover:text-black dark:hover:text-white font-black text-xs transition-colors">‹</button>
            <span className="text-[10px] font-black text-black dark:text-white w-7 text-center">{selectedYear}</span>
            <button onClick={() => { hapticLight(); setSelectedYear(selectedYear + 1); }} className="px-1.5 text-gray-400 hover:text-black dark:hover:text-white font-black text-xs transition-colors">›</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 flex gap-1 shadow-sm">
          <button onClick={() => { hapticLight(); setCalcType('VACACIONES'); }} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all ${calcType === 'VACACIONES' ? `${activeBg} text-white shadow-md` : 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'}`}>Vacaciones</button>
          <button onClick={() => { hapticLight(); setCalcType('CESANTIAS'); }} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all ${calcType === 'CESANTIAS' ? `${activeBg} text-white shadow-md` : 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'}`}>Cesantías</button>
          <button onClick={() => { hapticLight(); setCalcType('LIQUIDACION'); }} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all ${calcType === 'LIQUIDACION' ? `bg-gray-900 dark:bg-gray-100 text-white dark:text-black shadow-md` : 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'}`}>Liquidación</button>
        </div>
      </div>

      {/* 2. MÓDULO SALARIO */}
      <div className={`p-5 rounded-3xl border transition-colors shadow-sm ${editingId ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50' : 'bg-gray-50 dark:bg-[#111] border-gray-100 dark:border-gray-800'}`}>
        <div className="flex justify-between items-center mb-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">Salario Promedio</label>
          <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden p-0.5">
            <button onClick={() => { hapticLight(); setSalaryMode('AUTO'); }} className={`px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${salaryMode === 'AUTO' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>De la App</button>
            <button onClick={() => { hapticLight(); setSalaryMode('MANUAL'); }} className={`px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${salaryMode === 'MANUAL' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>Manual</button>
          </div>
        </div>

        {salaryMode === 'AUTO' ? (
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-black text-black dark:text-white">${avgGrossSalary.toLocaleString('es-CO')}</p>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">Promedio con Transporte</p>
              </div>
              <span className="text-xl opacity-20">📈</span>
            </div>
            {calcType !== 'CESANTIAS' && (
               <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                 <p className="text-[10px] text-gray-500 font-bold">Aux. Transp. Deductible:</p>
                 <p className="text-[11px] text-red-500 dark:text-red-400 font-black">-${avgTransport.toLocaleString()}</p>
               </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">$</span>
              <input 
                type="number" value={manualSalary} onChange={(e) => setManualSalary(e.target.value === "" ? "" : Number(e.target.value))} 
                placeholder="Salario Bruto (Ej. 1300000)" 
                className={`w-full p-4 pl-8 rounded-2xl bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-lg font-black outline-none text-black dark:text-white focus:ring-2 ring-blue-500 transition-all`} 
              />
            </div>
            {calcType !== 'CESANTIAS' && (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">🚌</span>
                <input 
                  type="number" value={manualTransport} onChange={(e) => setManualTransport(e.target.value === "" ? "" : Number(e.target.value))} 
                  placeholder="Promedio Transp. (Ej. 162000)" 
                  className={`w-full p-3 pl-10 rounded-xl bg-gray-100 dark:bg-gray-900 border border-transparent text-sm font-bold outline-none text-gray-600 dark:text-gray-300 focus:border-gray-300 transition-all`} 
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. MÓDULO DÍAS */}
      <div className={`p-5 rounded-3xl border transition-colors shadow-sm ${editingId ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50' : 'bg-gray-50 dark:bg-[#111] border-gray-100 dark:border-gray-800'}`}>
        <div className="flex justify-between items-center mb-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">Periodo a Liquidar</label>
          <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden p-0.5">
            <button onClick={() => { hapticLight(); setDaysMode('DATES'); }} className={`px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${daysMode === 'DATES' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>Fechas</button>
            <button onClick={() => { hapticLight(); setDaysMode('MANUAL'); }} className={`px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${daysMode === 'MANUAL' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>Manual</button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {daysMode === 'DATES' ? (
            <motion.div key="dates" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase ml-2">Desde</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-gray-700 font-bold outline-none dark:text-white text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase ml-2">Hasta</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-gray-700 font-bold outline-none dark:text-white text-sm" />
                </div>
              </div>
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500">Total: <span className={activeText}>{calculatedDays} Días</span></p>
            </motion.div>
          ) : (
            <motion.div key="manual" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
              <input 
                type="number" value={manualDays} onChange={(e) => setManualDays(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Ingresa los días (Ej. 360)" 
                className={`w-full p-4 rounded-2xl bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-xl font-black outline-none text-center text-black dark:text-white focus:ring-2 ring-blue-500 transition-all`} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. RESULTADO ESTELAR */}
      <div className={`p-6 sm:p-8 rounded-[2rem] text-center shadow-lg relative overflow-hidden transition-colors ${calcType === 'LIQUIDACION' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-black' : 'bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-800 text-white'}`}>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1 relative z-10">
          {calcType === 'LIQUIDACION' ? 'Total Liquidación Estimada' : `Total ${calcType}`}
        </p>
        <p className="text-4xl sm:text-5xl font-black tracking-tighter relative z-10 drop-shadow-sm">
          ${resultAmount.toLocaleString('es-CO')}
        </p>

        {calcType === 'LIQUIDACION' && (
          <div className="mt-6 space-y-2 text-left relative z-10 bg-black/10 dark:bg-white/10 p-4 rounded-2xl">
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span className="opacity-80 uppercase tracking-wider">Cesantías</span>
              <span>${valCesantias.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span className="opacity-80 uppercase tracking-wider">Intereses (12%)</span>
              <span>${valIntereses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span className="opacity-80 uppercase tracking-wider">Prima Prop.</span>
              <span>${valPrima.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span className="opacity-80 uppercase tracking-wider">Vacaciones Prop.</span>
              <span>${valVacaciones.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* ✅ BOTÓN DE GUARDAR / ACTUALIZAR CON EL COLOR SOLICITADO */}
      <div className="pt-2 flex flex-col gap-2">
        <button 
          onClick={handleSaveCalculation} 
          disabled={isSaving || resultAmount <= 0}
          className={`w-full py-5 rounded-[1.5rem] text-white font-black uppercase text-sm tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 bg-emerald-500 hover:bg-emerald-600`}
        >
          {isSaving ? 'Guardando...' : editingId ? 'Actualizar Cálculo' : `Guardar ${calcType}`}
        </button>
        {editingId && (
          <button 
            onClick={handleCancelEdit}
            className="w-full py-4 rounded-[1.5rem] bg-gray-100 dark:bg-gray-800 text-gray-500 font-black uppercase text-xs tracking-widest transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancelar Edición
          </button>
        )}
      </div>

      {/* 5. AUDITORÍA DEL CÁLCULO */}
      <div className="w-full pt-4">
        <button 
          onClick={() => { hapticLight(); setShowBreakdown(!showBreakdown); }}
          className="w-full text-center py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {showBreakdown ? '▲ Ocultar desglose' : '📊 Ver cómo se calculó'}
        </button>

        <AnimatePresence>
          {showBreakdown && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-2"
            >
              <div className="bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-3xl p-5 space-y-6">
                
                {salaryMode === 'AUTO' && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3 text-center border-b border-gray-200 dark:border-gray-800 pb-2">
                      Historial Promediado ({selectedYear})
                    </p>
                    <div className="space-y-2">
                      {monthDetails.length > 0 ? (
                        monthDetails.map((det, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white dark:bg-black p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-500 capitalize">{det.month}</span>
                              <span className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full font-black">{det.shiftsCount} turnos</span>
                            </div>
                            <span className="text-xs font-black text-black dark:text-white">${det.gross.toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-center text-gray-400 font-bold py-2">No hay meses con datos suficientes.</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3 text-center border-b border-gray-200 dark:border-gray-800 pb-2">
                    Fórmulas de Ley Aplicadas
                  </p>
                  <div className="space-y-3">
                    {(calcType === 'VACACIONES' || calcType === 'LIQUIDACION') && (
                      <div className="bg-white dark:bg-black p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 dark:text-blue-400">Vacaciones</p>
                        <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                          (Salario Sin Transporte × Días) / 720
                        </p>
                        <p className="text-xs font-black text-black dark:text-white">
                          (${salarySinTransporte.toLocaleString()} × {calculatedDays}) ÷ 720 = <span className="text-blue-500 dark:text-blue-400">${valVacaciones.toLocaleString()}</span>
                        </p>
                      </div>
                    )}
                    {(calcType === 'CESANTIAS' || calcType === 'LIQUIDACION') && (
                      <div className="bg-white dark:bg-black p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 dark:text-orange-400">Cesantías</p>
                        <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                          (Salario Bruto × Días) / 360
                        </p>
                        <p className="text-xs font-black text-black dark:text-white">
                          (${finalSalary.toLocaleString()} × {calculatedDays}) ÷ 360 = <span className="text-orange-500 dark:text-orange-400">${valCesantias.toLocaleString()}</span>
                        </p>
                      </div>
                    )}
                    {calcType === 'LIQUIDACION' && (
                      <>
                        <div className="bg-white dark:bg-black p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 dark:text-purple-400">Intereses Cesantías</p>
                          <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                            (Cesantías × Días × 0.12) / 360
                          </p>
                          <p className="text-xs font-black text-black dark:text-white">
                            (${valCesantias.toLocaleString()} × {calculatedDays} × 0.12) ÷ 360 = <span className="text-purple-500 dark:text-purple-400">${valIntereses.toLocaleString()}</span>
                          </p>
                        </div>
                        <div className="bg-white dark:bg-black p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 dark:text-emerald-400">Prima Proporcional</p>
                          <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                            (Salario Bruto × Días) / 360
                          </p>
                          <p className="text-xs font-black text-black dark:text-white">
                            (${finalSalary.toLocaleString()} × {calculatedDays}) ÷ 360 = <span className="text-emerald-500 dark:text-emerald-400">${valPrima.toLocaleString()}</span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ✅ SECCIÓN DE CÁLCULOS GUARDADOS */}
      {savedRecords.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800/50">
          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 px-2">Cálculos Guardados ({selectedYear})</h4>
          <div className="space-y-3">
            {savedRecords.map(record => (
              <div 
                key={record.id} 
                className={`bg-white dark:bg-gray-900 border p-4 rounded-[1.5rem] flex items-center justify-between transition-colors shadow-sm ${editingId === record.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100 dark:border-gray-800'}`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-800 dark:text-gray-200">
                      {record.type}
                    </span>
                    <span className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      {record.calculatedDays} Días
                    </span>
                  </div>
                  <p className="font-black text-xl text-black dark:text-white">
                    ${record.resultAmount.toLocaleString('es-CO')}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEditRecord(record)} 
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${editingId === record.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400'}`}
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDeleteRecord(record.id)} 
                    className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}