"use client";
import { useState, useEffect } from "react";
import { calculateShift } from "@/lib/calculator";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function ShiftCalculator() {
  const { role, colors, isDarkMode } = useTheme();
  const { user } = useUser();

  const getLocalDate = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  };

  const [date, setDate] = useState(getLocalDate());
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("20:00");
  
  const [hasBreak, setHasBreak] = useState(true);
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:15");
  const [breakEnd, setBreakEnd] = useState("16:45");
  
  // NUEVO ESTADO: Para guardar el mensaje de error del break
  const [breakError, setBreakError] = useState<string | null>(null);

  const [result, setResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success'} | null>(null);

  const mesesFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // =========================================================================
  // VIGILANTE 1: Magia Automática (Centrar el Break al cambiar el turno)
  // =========================================================================
  useEffect(() => {
    const [hStart, mStart] = start.split(":").map(Number);
    const [hEnd, mEnd] = end.split(":").map(Number);

    let startMins = hStart * 60 + mStart;
    let endMins = hEnd * 60 + mEnd;

    // Si la salida es menor a la entrada, es porque pasó de la medianoche (turno amanecida)
    if (endMins <= startMins) endMins += 24 * 60; 

    // Calculamos la mitad del turno
    const midMins = Math.floor((startMins + endMins) / 2);
    
    // Asignamos 15 min antes y 15 min después del centro
    const bStartMins = midMins - 15;
    const bEndMins = midMins + 15;

    const formatTime = (totalMins: number) => {
      const h = Math.floor((totalMins % (24 * 60)) / 60).toString().padStart(2, "0");
      const m = (totalMins % 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    setBreakStart(formatTime(bStartMins));
    setBreakEnd(formatTime(bEndMins));
  }, [start, end]); // Se ejecuta cada vez que cambian "start" o "end"

  // =========================================================================
  // VIGILANTE 2: El Escudo (Validar que el break no se salga del turno)
  // =========================================================================
  useEffect(() => {
    if (!hasBreak || !isManualBreak) {
      setBreakError(null);
      return;
    }

    const [hS, mS] = start.split(":").map(Number);
    const [hE, mE] = end.split(":").map(Number);
    const [hBS, mBS] = breakStart.split(":").map(Number);
    const [hBE, mBE] = breakEnd.split(":").map(Number);

    let sMins = hS * 60 + mS;
    let eMins = hE * 60 + mE;
    if (eMins <= sMins) eMins += 24 * 60;

    let bsMins = hBS * 60 + mBS;
    let beMins = hBE * 60 + mBE;

    // Ajuste por si el break pasa la medianoche
    if (bsMins < sMins && eMins > 24 * 60) bsMins += 24 * 60;
    if (beMins < sMins && eMins > 24 * 60) beMins += 24 * 60;

    if (bsMins < sMins || beMins > eMins) {
      setBreakError("🚨 El break está por fuera de tu hora de turno.");
    } else if (beMins <= bsMins) {
      setBreakError("🚨 La hora de fin de break debe ser mayor a la de inicio.");
    } else {
      setBreakError(null); // Todo está bien
    }
  }, [start, end, breakStart, breakEnd, hasBreak, isManualBreak]);


  const handleCalculate = () => {
    if (breakError) return; // Si hay error, bloqueamos el cálculo por seguridad
    
    setNotification(null);
    const manualBreak = (isManualBreak && hasBreak) ? { start: breakStart, end: breakEnd } : undefined;
    const calc = calculateShift(date, start, end, manualBreak, role, hasBreak);
    setResult(calc);
  };

  const handleSaveOrUpdate = async () => {
    if (!user || !result) return;
    setIsSaving(true);
    setNotification(null);
    
    try {
      const docId = `${user.id}_${date}`;
      const [yearStr, monthStr] = date.split("-");
      const monthName = mesesFull[parseInt(monthStr, 10) - 1];
      const year = parseInt(yearStr, 10);

      const payload: any = {
        userId: user.id,
        date: date,
        startTime: start,
        endTime: end,
        isOff: false,
        month: monthName,
        year: year,
        ...result, 
        timestamp: serverTimestamp()
      };

      await setDoc(doc(db, "shifts", docId), payload, { merge: true });
      setNotification({ message: "¡Turno guardado en la nómina! ⚡", type: 'success' });

    } catch (error) {
      console.error("Error al guardar turno:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl overflow-hidden border ${colors.accent} dark:border-gray-800 mx-auto transition-all duration-500`}>

      {/* HEADER */}
      <div className={`${colors.secondary} p-5 sm:p-8 text-white text-center`}>
        <h2 className="text-xl sm:text-2xl font-black tracking-tighter uppercase italic">Calculadora Rápida</h2>
        <p className="text-xs sm:text-sm opacity-80 font-bold">Modo: {role}</p>
      </div>

      {/* BODY */}
      <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
        <div className="space-y-4">
          
          <div>
            <label className="text-[10px] sm:text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Fecha del Turno</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 p-3 sm:p-4 text-sm sm:text-base bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl border-none font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 outline-none transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-[10px] sm:text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Entrada</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full mt-1 p-3 sm:p-4 text-sm sm:text-base bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none transition-colors" />
            </div>
            <div>
              <label className="text-[10px] sm:text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Salida</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full mt-1 p-3 sm:p-4 text-sm sm:text-base bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none transition-colors" />
            </div>
          </div>

          {/* CONTENEDOR DE BREAKS */}
          <div className="space-y-3">
            
            {/* 1. INTERRUPTOR: TURNO CON BREAK */}
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-colors ${hasBreak ? colors.accent : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] sm:text-xs font-black uppercase transition-colors ${hasBreak ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>¿Turno con Break?</span>
                <button onClick={() => {
                  setHasBreak(!hasBreak);
                  if (hasBreak) setIsManualBreak(false);
                }} className={`w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-all relative ${hasBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div className={`absolute top-1 w-3 sm:w-4 h-3 sm:h-4 bg-white rounded-full transition-all ${hasBreak ? 'left-[1.35rem] sm:left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* 2. INTERRUPTOR MANUAL */}
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-dashed transition-all duration-300 ${!hasBreak ? 'opacity-40 pointer-events-none border-gray-100 dark:border-gray-800' : (isManualBreak ? colors.accent : 'border-gray-100 dark:border-gray-800')}`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[10px] sm:text-xs font-black text-gray-500 uppercase">¿Break Manual?</span>
                <button onClick={() => setIsManualBreak(!isManualBreak)} disabled={!hasBreak} className={`w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-all relative ${isManualBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div className={`absolute top-1 w-3 sm:w-4 h-3 sm:h-4 bg-white rounded-full transition-all ${isManualBreak ? 'left-[1.35rem] sm:left-7' : 'left-1'}`} />
                </button>
              </div>
              
              {isManualBreak && hasBreak && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-2">
                    <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className={`p-2 bg-white dark:bg-gray-800 dark:text-white rounded-lg text-xs sm:text-sm font-bold border outline-none focus:ring-2 focus:ring-gray-200 transition-colors ${breakError ? 'border-red-400 focus:ring-red-200' : 'border-gray-100 dark:border-gray-700'}`} />
                    <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className={`p-2 bg-white dark:bg-gray-800 dark:text-white rounded-lg text-xs sm:text-sm font-bold border outline-none focus:ring-2 focus:ring-gray-200 transition-colors ${breakError ? 'border-red-400 focus:ring-red-200' : 'border-gray-100 dark:border-gray-700'}`} />
                  </div>
                  
                  {/* MENSAJE DE ERROR DEL BREAK */}
                  {breakError && (
                    <p className="text-[10px] font-bold text-red-500 animate-pulse mt-1">
                      {breakError}
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* BOTÓN CALCULAR (Se desactiva si hay error en el break) */}
        <button 
          onClick={handleCalculate} 
          disabled={!!breakError}
          className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-lg transition-all text-white 
            ${breakError ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed scale-100' : `${colors.secondary} hover:brightness-110 active:scale-95`}`}
        >
          {breakError ? 'CORRIGE EL BREAK ⚠️' : 'CALCULAR 💰'}
        </button>

        {result && !breakError && (
          <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t-2 border-gray-50 dark:border-gray-800 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end mb-5 sm:mb-6">
              <div className="flex flex-col">
                <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[9px] sm:text-[10px]">Neto Estimado</span>
                <span className={`text-3xl sm:text-4xl font-black tracking-tighter ${colors.primary}`}>${result.netPay.toLocaleString('es-CO')}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center mb-5 sm:mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg"><p className="text-[8px] sm:text-[9px] font-bold uppercase text-blue-400">Base</p><p className="font-bold text-[10px] sm:text-xs dark:text-gray-300">${result.salaryBase.toLocaleString()}</p></div>
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg"><p className="text-[8px] sm:text-[9px] font-bold uppercase text-green-400">Auxilio</p><p className="font-bold text-[10px] sm:text-xs dark:text-gray-300">+${result.transportAux.toLocaleString()}</p></div>
              <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg"><p className="text-[8px] sm:text-[9px] font-bold uppercase text-red-400">Deduc</p><p className="font-bold text-[10px] sm:text-xs dark:text-gray-300">-${result.deductions.toLocaleString()}</p></div>
            </div>

            {user && (
              <div className="animate-in fade-in">
                <button 
                  onClick={handleSaveOrUpdate} 
                  disabled={isSaving}
                  className={`w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest text-white shadow-xl transition-all ${isSaving ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 active:scale-95'}`}
                >
                  {isSaving ? 'Procesando...' : '💾 Guardar en Nómina'}
                </button>
                
                {notification && (
                  <p className="text-center text-[9px] sm:text-[10px] font-bold mt-3 sm:mt-4 uppercase tracking-widest text-green-500 dark:text-green-400">
                    {notification.message}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}