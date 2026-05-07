"use client";
import { useState, useEffect } from "react";
import { calculateShift } from "@/lib/calculator";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";

export default function ShiftCalculator() {
  const { role, colors } = useTheme();
  const { user } = useUser();

  // Estado para la fecha inicial (evitamos errores de hidratación)
  const [date, setDate] = useState("");
  
  useEffect(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setDate(d.toISOString().split("T")[0]);
  }, []);

  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("20:00");
  const [hasBreak, setHasBreak] = useState(true);
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:15");
  const [breakEnd, setBreakEnd] = useState("16:45");
  const [breakError, setBreakError] = useState<string | null>(null);

  // El resultado ahora guardará el array procesado o un objeto sumado
  const [result, setResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success'} | null>(null);

  const mesesFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // Vigilante del Break Automático
  useEffect(() => {
    const [hS, mS] = start.split(":").map(Number);
    const [hE, mE] = end.split(":").map(Number);
    let sMins = hS * 60 + mS;
    let eMins = hE * 60 + mE;
    if (eMins <= sMins) eMins += 24 * 60; 
    const midMins = Math.floor((startMins + endMins) / 2);
    
    const formatTime = (totalMins: number) => {
      const h = Math.floor((totalMins % (24 * 60)) / 60).toString().padStart(2, "0");
      const m = (totalMins % 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    if (!isManualBreak) {
      setBreakStart(formatTime(midMins - 15));
      setBreakEnd(formatTime(midMins + 15));
    }
  }, [start, end, isManualBreak]);

  // Vigilante de validación
  useEffect(() => {
    if (!hasBreak || !isManualBreak) { setBreakError(null); return; }
    const [hS, mS] = start.split(":").map(Number);
    const [hE, mE] = end.split(":").map(Number);
    const [hBS, mBS] = breakStart.split(":").map(Number);
    const [hBE, mBE] = breakEnd.split(":").map(Number);

    let sMins = hS * 60 + mS;
    let eMins = hE * 60 + mE;
    if (eMins <= sMins) eMins += 24 * 60;
    let bsMins = hBS * 60 + mBS;
    let beMins = hBE * 60 + mBE;

    if (bsMins < sMins && eMins > 24 * 60) bsMins += 24 * 60;
    if (beMins < sMins && eMins > 24 * 60) beMins += 24 * 60;

    if (bsMins < sMins || beMins > eMins) setBreakError("🚨 Break fuera de turno.");
    else if (beMins <= bsMins) setBreakError("🚨 Hora fin inválida.");
    else setBreakError(null);
  }, [start, end, breakStart, breakEnd, hasBreak, isManualBreak]);

  const handleCalculate = () => {
    if (breakError) return;
    setNotification(null);
    const manualBreak = (isManualBreak && hasBreak) ? { start: breakStart, end: breakEnd } : undefined;
    
    // CORRECCIÓN: calculateShift devuelve un Array
    const calcs = calculateShift(date, start, end, manualBreak, role, hasBreak);
    
    if (calcs && Array.isArray(calcs)) {
      // Sumamos los fragmentos para mostrar un total coherente en la UI
      const totalNet = calcs.reduce((acc, curr) => acc + (curr.netPay || 0), 0);
      const totalBase = calcs.reduce((acc, curr) => acc + (curr.salaryBase || 0), 0);
      const totalTransport = calcs.reduce((acc, curr) => acc + (curr.transportAux || 0), 0);
      const totalDeductions = calcs.reduce((acc, curr) => acc + (curr.deductions || 0), 0);

      setResult({
        netPay: totalNet,
        salaryBase: totalBase,
        transportAux: totalTransport,
        deductions: totalDeductions,
        rawCalcs: calcs // Guardamos el array original para el guardado en Firebase
      });
    }
  };

  const handleSaveOrUpdate = async () => {
    if (!user || !result || !result.rawCalcs) return;
    setIsSaving(true);
    setNotification(null);

    try {
      const baseDocId = `${user.id}_${date}`;
      
      // Borramos posibles rastros de splits anteriores por si el turno cambió de horario
      await deleteDoc(doc(db, "shifts", `${baseDocId}_split`));

      // Guardamos cada fragmento (el turno real y el split si existe)
      await Promise.all(result.rawCalcs.map(async (calc: any, i: number) => {
        const idToSave = i === 0 ? baseDocId : `${baseDocId}_split`;
        const [yearStr, monthStr] = calc.date.split("-");
        const monthName = mesesFull[parseInt(monthStr, 10) - 1];

        const payload = {
          userId: user.id,
          startTime: start,
          endTime: end,
          isOff: false,
          month: monthName,
          year: parseInt(yearStr, 10),
          ...calc,
          timestamp: serverTimestamp()
        };

        await setDoc(doc(db, "shifts", idToSave), payload, { merge: true });
      }));

      setNotification({ message: "¡Turno guardado en la nómina! ⚡", type: 'success' });
    } catch (error) {
      console.error("Error al guardar:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!date) return null; // Evita parpadeos de hidratación

  return (
    <div className={`relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 mx-auto transition-all duration-500`}>
      <div className={`${colors.secondary} p-5 sm:p-8 text-white text-center`}>
        <h2 className="text-xl sm:text-2xl font-black tracking-tighter uppercase italic">Calculadora Rápida</h2>
        <p className="text-xs sm:text-sm opacity-80 font-bold">Modo: {role}</p>
      </div>

      <div className="p-5 sm:p-8 space-y-5">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Fecha del Turno</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase">Entrada</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full mt-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase">Salida</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full mt-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none" />
            </div>
          </div>

          <div className="space-y-3">
            <div className={`p-4 rounded-2xl border-2 transition-colors ${hasBreak ? 'border-blue-100 dark:border-blue-900/30' : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-gray-500">¿Turno con Break?</span>
                <button onClick={() => setHasBreak(!hasBreak)} className={`w-12 h-6 rounded-full relative transition-all ${hasBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hasBreak ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {hasBreak && (
              <div className="p-4 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-gray-500 uppercase">¿Ajustar Manual?</span>
                  <button onClick={() => setIsManualBreak(!isManualBreak)} className={`w-12 h-6 rounded-full relative transition-all ${isManualBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isManualBreak ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                {isManualBreak && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="p-2 bg-white dark:bg-gray-800 dark:text-white rounded-lg font-bold border border-gray-100 dark:border-gray-700" />
                    <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="p-2 bg-white dark:bg-gray-800 dark:text-white rounded-lg font-bold border border-gray-100 dark:border-gray-700" />
                  </div>
                )}
                {breakError && <p className="text-[10px] font-bold text-red-500 mt-2">{breakError}</p>}
              </div>
            )}
          </div>
        </div>

        <button onClick={handleCalculate} disabled={!!breakError}
          className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all text-white ${breakError ? 'bg-gray-400 cursor-not-allowed' : `${colors.secondary} hover:brightness-110 active:scale-95`}`}>
          {breakError ? 'REVISA EL BREAK' : 'CALCULAR 💰'}
        </button>

        {result && !breakError && (
          <div className="mt-6 pt-6 border-t-2 border-gray-50 dark:border-gray-800 animate-in slide-in-from-bottom-4">
            <div className="text-center mb-6">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Neto Estimado</span>
              <p className={`text-4xl font-black tracking-tighter ${colors.primary}`}>${result.netPay.toLocaleString('es-CO')}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg"><p className="text-[9px] font-bold text-blue-400 uppercase">Base</p><p className="font-bold text-xs dark:text-gray-300">${result.salaryBase.toLocaleString()}</p></div>
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg"><p className="text-[9px] font-bold text-green-400 uppercase">Auxilio</p><p className="font-bold text-xs dark:text-gray-300">+${result.transportAux.toLocaleString()}</p></div>
              <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg"><p className="text-[9px] font-bold text-red-400 uppercase">Deduc</p><p className="font-bold text-xs dark:text-gray-300">-${result.deductions.toLocaleString()}</p></div>
            </div>

            {user && (
              <div className="space-y-4">
                <button onClick={handleSaveOrUpdate} disabled={isSaving}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl transition-all ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}>
                  {isSaving ? 'Procesando...' : '💾 Guardar en Nómina'}
                </button>
                {notification && <p className="text-center text-[10px] font-bold text-green-500 uppercase tracking-widest">{notification.message}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
