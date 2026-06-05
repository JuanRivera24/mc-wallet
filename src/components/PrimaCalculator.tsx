"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useHaptics } from "@/hooks/useHaptics";
import { useTheme } from "@/context/ThemeContext";

const MESES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function PrimaCalculator() {
  const { user } = useUser();
  const { themeColor } = useTheme();
  const { hapticLight, hapticSuccess, hapticError, hapticWarning } = useHaptics();

  const activeBg = themeColor === 'blue' ? 'bg-blue-500' : 'bg-red-500';
  const activeText = themeColor === 'blue' ? 'text-blue-500' : 'text-red-500';
  const activeBorder = themeColor === 'blue' ? 'border-blue-500' : 'border-red-500';

  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth();
  
  // ==========================================
  // ESTADOS GLOBALES
  // ==========================================
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(currentMonthNum < 6 ? 1 : 2);
  
  const [shifts, setShifts] = useState<any[]>([]);
  const [bigVentas, setBigVentas] = useState<any[]>([]);
  const [primas, setPrimas] = useState<any[]>([]);

  // ==========================================
  // ESTADOS DE CONFIGURACIÓN
  // ==========================================
  const [salaryMode, setSalaryMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualSalary, setManualSalary] = useState<number | "">("");

  const [daysMode, setDaysMode] = useState<'FULL' | 'DATES' | 'MANUAL'>('FULL');
  const [manualDays, setManualDays] = useState<number | "">(180);
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-06-30`);

  const [isSaving, setIsSaving] = useState(false);

  // ==========================================
  // FETCH DATOS DE FIREBASE
  // ==========================================
  useEffect(() => {
    if (!user) return;
    const qShifts = query(collection(db, "shifts"), where("userId", "==", user.id), where("year", "==", selectedYear));
    const unsubShifts = onSnapshot(qShifts, (snap) => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const qBV = query(collection(db, "bigVentas"), where("userId", "==", user.id), where("year", "==", selectedYear));
    const unsubBV = onSnapshot(qBV, (snap) => setBigVentas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qPrimas = query(collection(db, "primas"), where("userId", "==", user.id), where("year", "==", selectedYear));
    const unsubPrimas = onSnapshot(qPrimas, (snap) => setPrimas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { unsubShifts(); unsubBV(); unsubPrimas(); };
  }, [user, selectedYear]);

  // Actualizar fechas default si cambian de semestre
  useEffect(() => {
    if (selectedSemester === 1) {
      setStartDate(`${selectedYear}-01-01`);
      setEndDate(`${selectedYear}-06-30`);
    } else {
      setStartDate(`${selectedYear}-07-01`);
      setEndDate(`${selectedYear}-12-31`);
    }
  }, [selectedSemester, selectedYear]);

  // ==========================================
  // CÁLCULOS INTELIGENTES
  // ==========================================
  const targetMonth = selectedSemester === 1 ? "junio" : "diciembre";
  const savedPrima = primas.find(p => p.month === targetMonth && p.quincena === 1);

  // Motor Salarial Automático
  const { autoCalculatedAverage, validMonthsCount } = useMemo(() => {
    const semesterMonths = selectedSemester === 1 ? MESES_FULL.slice(0, 6) : MESES_FULL.slice(6, 12);
    const semesterShifts = shifts.filter(s => semesterMonths.includes(s.month) && !s.isOff);
    const semesterBV = bigVentas.filter(b => semesterMonths.includes(b.month));

    const monthData = semesterMonths.map(month => {
      let gross = 0; let count = 0;
      semesterShifts.filter(s => s.month === month).forEach(s => {
        gross += (Number(s.netPay) || 0) + (Number(s.deductions) || 0);
        count++;
      });
      semesterBV.filter(b => b.month === month).forEach(b => {
        gross += (Number(b.value) || 0);
      });
      return { month, gross, count };
    });

    const validMonths = monthData.filter(m => m.count >= 5 || m.gross > 250000);
    
    if (validMonths.length === 0) return { autoCalculatedAverage: 0, validMonthsCount: 0 };
    return { 
      autoCalculatedAverage: Math.floor(validMonths.reduce((sum, m) => sum + m.gross, 0) / validMonths.length),
      validMonthsCount: validMonths.length
    };
  }, [shifts, bigVentas, selectedSemester]);

  // Cálculo de Días
  const calculatedDays = useMemo(() => {
    if (daysMode === 'FULL') return 180;
    if (daysMode === 'MANUAL') return Number(manualDays) || 0;
    if (daysMode === 'DATES') {
      if (!startDate || !endDate) return 0;
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir ambos días
      return Math.max(0, Math.min(diffDays, 180)); // En Colombia para prima el max es 180 por semestre
    }
    return 180;
  }, [daysMode, manualDays, startDate, endDate]);

  // ==========================================
  // RESULTADOS
  // ==========================================
  const finalSalary = salaryMode === 'AUTO' ? autoCalculatedAverage : (Number(manualSalary) || 0);
  const primaFinal = Math.floor((finalSalary * calculatedDays) / 360);

  // ==========================================
  // ACCIONES
  // ==========================================
  const handleExport = async () => {
    if (!user || primaFinal <= 0) return hapticError();
    setIsSaving(true);
    hapticLight();
    
    const docId = `${user.id}_PRIMA_${selectedYear}_${targetMonth}_1`;

    try {
      await setDoc(doc(db, "primas", docId), { 
        userId: user.id, 
        year: selectedYear, 
        month: targetMonth, 
        quincena: 1, 
        value: primaFinal, 
        timestamp: serverTimestamp() 
      }, { merge: true });
      hapticSuccess();
      alert(`¡Exportado exitosamente! La prima de $${primaFinal.toLocaleString('es-CO')} se guardó en tu quincena 1 de ${targetMonth}.`);
    } catch (error) {
      hapticError();
      alert("Error al exportar. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSaved = async () => {
    if (!savedPrima) return;
    hapticWarning();
    if(confirm(`¿Estás seguro de eliminar la prima guardada de $${savedPrima.value.toLocaleString()}?`)) {
      try {
        await deleteDoc(doc(db, "primas", savedPrima.id));
        hapticSuccess();
      } catch (e) {
        hapticError();
      }
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* 1. Selector de Semestre y Año */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-800 p-2 rounded-3xl border border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => { hapticLight(); setSelectedYear(selectedYear - 1); }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-2xl text-gray-500 font-black hover:text-black dark:hover:text-white transition-colors">←</button>
          <div className="flex-1 text-center py-2 font-black text-lg text-black dark:text-white">{selectedYear}</div>
          <button onClick={() => { hapticLight(); setSelectedYear(selectedYear + 1); }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-2xl text-gray-500 font-black hover:text-black dark:hover:text-white transition-colors">→</button>
        </div>
        <div className="flex flex-1 gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl">
          <button onClick={() => { hapticLight(); setSelectedSemester(1); }} className={`flex-1 py-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase transition-all ${selectedSemester === 1 ? `${activeBg} text-white shadow-md` : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'}`}>Mitad de Año</button>
          <button onClick={() => { hapticLight(); setSelectedSemester(2); }} className={`flex-1 py-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase transition-all ${selectedSemester === 2 ? `${activeBg} text-white shadow-md` : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'}`}>Fin de Año</button>
        </div>
      </div>

      {/* 2. Alerta de Prima Guardada */}
      <AnimatePresence>
        {savedPrima && (
          <motion.div 
            initial={{ opacity: 0, height: 0, scale: 0.9 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} exit={{ opacity: 0, height: 0, scale: 0.9 }}
            className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-3xl border border-emerald-200 dark:border-emerald-800 flex justify-between items-center"
          >
            <div>
              <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>🌟</span> Ya tienes una prima exportada
              </p>
              <p className="font-black text-emerald-800 dark:text-emerald-300 text-lg">
                ${savedPrima.value.toLocaleString('es-CO')}
              </p>
            </div>
            <button onClick={handleDeleteSaved} className="p-3 bg-white dark:bg-emerald-900/50 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/50 text-red-500 transition-colors" title="Eliminar prima exportada">
              🗑️
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Módulo Salario Base */}
      <div className="bg-gray-50 dark:bg-[#111] p-5 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">Salario Base Promedio</label>
          <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden p-0.5">
            <button onClick={() => { hapticLight(); setSalaryMode('AUTO'); }} className={`px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${salaryMode === 'AUTO' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>App</button>
            <button onClick={() => { hapticLight(); setSalaryMode('MANUAL'); }} className={`px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${salaryMode === 'MANUAL' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>Manual</button>
          </div>
        </div>

        {salaryMode === 'AUTO' ? (
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 p-4 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-3xl font-black text-black dark:text-white">${autoCalculatedAverage.toLocaleString('es-CO')}</p>
              <p className="text-[10px] text-gray-400 font-bold mt-1">Basado en {validMonthsCount} meses válidos del semestre.</p>
            </div>
            <span className="text-2xl opacity-20">📊</span>
          </div>
        ) : (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">$</span>
            <input 
              type="number" value={manualSalary} onChange={(e) => setManualSalary(e.target.value === "" ? "" : Number(e.target.value))} 
              placeholder="Ej. 1200000" 
              className={`w-full p-4 pl-8 rounded-2xl bg-white dark:bg-black border border-blue-200 dark:border-blue-900/50 text-xl font-black outline-none text-blue-600 dark:text-blue-400 focus:ring-2 ring-blue-500 transition-all shadow-sm`} 
            />
          </div>
        )}
      </div>

      {/* 4. Módulo Días a Liquidar */}
      <div className="bg-gray-50 dark:bg-[#111] p-5 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-3">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">Días a Liquidar</label>
          <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden p-0.5 w-full sm:w-auto">
            <button onClick={() => { hapticLight(); setDaysMode('FULL'); }} className={`flex-1 sm:flex-none px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${daysMode === 'FULL' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>180 Días</button>
            <button onClick={() => { hapticLight(); setDaysMode('DATES'); }} className={`flex-1 sm:flex-none px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${daysMode === 'DATES' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>Fechas</button>
            <button onClick={() => { hapticLight(); setDaysMode('MANUAL'); }} className={`flex-1 sm:flex-none px-3 py-1 text-[9px] font-black uppercase transition-colors rounded-md ${daysMode === 'MANUAL' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-500'}`}>Manual</button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {daysMode === 'FULL' && (
            <motion.div key="full" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-2xl font-black text-black dark:text-white">180 <span className="text-sm text-gray-400">días</span></p>
                <p className="text-[10px] text-gray-400 font-bold mt-1">Fórmula estándar (Semestre laborado completo).</p>
              </div>
              <span className="text-2xl opacity-20">✅</span>
            </motion.div>
          )}

          {daysMode === 'MANUAL' && (
            <motion.div key="manual" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
              <input 
                type="number" value={manualDays} onChange={(e) => setManualDays(e.target.value === "" ? "" : Number(e.target.value))} max={180} min={1}
                placeholder="Ingresa los días (Max 180)" 
                className="w-full p-4 rounded-2xl bg-white dark:bg-black border border-blue-200 dark:border-blue-900/50 text-xl font-black outline-none text-blue-600 dark:text-blue-400 focus:ring-2 ring-blue-500 transition-all shadow-sm text-center" 
              />
            </motion.div>
          )}

          {daysMode === 'DATES' && (
            <motion.div key="dates" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase ml-2">Ingreso / Inicio</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-gray-700 font-bold outline-none dark:text-white text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase ml-2">Corte / Fin</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-gray-700 font-bold outline-none dark:text-white text-sm" />
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl text-center">
                <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Equivale a: {calculatedDays} días</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Tarjeta Final */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 p-8 rounded-[2rem] text-center shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10 text-9xl">💰</div>
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-2 relative z-10">Prima Estimada Final</p>
        <p className="text-5xl font-black text-white tracking-tighter relative z-10 drop-shadow-md">
          ${primaFinal.toLocaleString('es-CO')}
        </p>
        
        <div className="mt-4 pt-4 border-t border-emerald-400/30 flex justify-center items-center gap-2 text-emerald-50 relative z-10">
          <p className="text-[10px] font-bold tracking-widest uppercase">
            ( ${finalSalary.toLocaleString()} × {calculatedDays} ) ÷ 360
          </p>
        </div>
      </div>

      {/* 6. Acción Exportar */}
      <button 
        onClick={handleExport} 
        disabled={isSaving || primaFinal <= 0}
        className={`w-full py-5 rounded-[1.5rem] text-white font-black uppercase text-sm tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 ${activeBg}`}
      >
        {isSaving ? 'Guardando...' : `${savedPrima ? 'Sobrescribir' : 'Exportar a'} Quincena 1 de ${selectedSemester === 1 ? 'Junio' : 'Diciembre'}`}
      </button>

    </div>
  );
}