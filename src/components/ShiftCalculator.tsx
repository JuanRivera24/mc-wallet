"use client";

import { useState, useEffect } from "react";
import { calculateShift } from "@/lib/calculator";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";

// ✅ Tipos estrictos para evitar bugs
type CalcFragment = {
  netPay: number;
  salaryBase: number;
  transportAux: number;
  deductions: number;
  date: string;
  [key: string]: any;
};

type ShiftResult = {
  netPay: number;
  salaryBase: number;
  transportAux: number;
  deductions: number;
  raw: CalcFragment[];
};

export default function ShiftCalculator() {
  // --- 1. CONTEXTO SEGURO ---
  const theme = useTheme?.(); 
  const role = theme?.role ?? "CREW";
  const colors = theme?.colors ?? { primary: "text-blue-600", secondary: "bg-blue-600" };

  const { user } = useUser();

  // --- 2. ESTADOS DE CONTROL ---
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("20:00");

  // --- 3. ESTADOS DE BREAK ---
  const [hasBreak, setHasBreak] = useState(true);
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:15");
  const [breakEnd, setBreakEnd] = useState("16:45");
  const [breakTouched, setBreakTouched] = useState(false);
  const [breakError, setBreakError] = useState<string | null>(null);

  // --- 4. RESULTADOS Y NOTIFICACIONES ---
  const [result, setResult] = useState<ShiftResult | null>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mesesFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  useEffect(() => {
    setMounted(true);
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setDate(d.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (!isManualBreak) {
      setBreakTouched(false);
    }
  }, [start, end, isManualBreak]);

  // ✅ Lógica de Break Automático
  useEffect(() => {
    if (isManualBreak || breakTouched) return;

    const [hS, mS] = start.split(":").map(Number);
    const [hE, mE] = end.split(":").map(Number);

    let s = hS * 60 + mS;
    let e = hE * 60 + mE;
    if (e <= s) e += 1440; 

    const mid = Math.floor((s + e) / 2);

    const format = (mins: number) => {
      const h = Math.floor((mins % 1440) / 60).toString().padStart(2, "0");
      const m = (mins % 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    setBreakStart(format(mid - 15));
    setBreakEnd(format(mid + 15));
  }, [start, end, isManualBreak, breakTouched]);

  // ✅ Validación de Break Pro
  useEffect(() => {
    if (!hasBreak || !isManualBreak) {
      setBreakError(null);
      return;
    }

    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    let s = toMin(start);
    let e = toMin(end);
    if (e <= s) e += 1440;

    let bs = toMin(breakStart);
    let be = toMin(breakEnd);

    if (bs < s && e > 1440) bs += 1440;
    if (be < s && e > 1440) be += 1440;

    if (bs < s || be > e) setBreakError("Break fuera del turno");
    else if (be <= bs) setBreakError("Fin de break inválido");
    else setBreakError(null);
  }, [start, end, breakStart, breakEnd, hasBreak, isManualBreak]);

  // --- 🧮 CALCULAR ---
  const handleCalculate = () => {
    if (!date || !start || !end || breakError) return;

    const manual = (isManualBreak && hasBreak) ? { start: breakStart, end: breakEnd } : undefined;
    const calcs = calculateShift(date, start, end, manual, role, hasBreak);

    if (!calcs) {
      setResult(null);
      setNotification({ msg: "Error en el cálculo", type: 'error' });
      return;
    }

    const fragments = Array.isArray(calcs) ? calcs : [calcs];

    setResult({
      netPay: fragments.reduce((a, b) => a + (b?.netPay || 0), 0),
      salaryBase: fragments.reduce((a, b) => a + (b?.salaryBase || 0), 0),
      transportAux: fragments.reduce((a, b) => a + (b?.transportAux || 0), 0),
      deductions: fragments.reduce((a, b) => a + (b?.deductions || 0), 0),
      raw: fragments, // Guarda el detalle separado para el momento de guardar en BD
    });

    setNotification(null);
  };

  // --- 💾 GUARDAR (Mapeo IDÉNTICO a NominasPage) ---
  const handleSave = async () => {
    if (!user || !result || !date || isSaving) return;
    setIsSaving(true);

    try {
      const baseDocId = `${user.id}_${date}`;
      
      // Borramos posibles rastros de un split anterior (si antes era turno de amanecida y ahora ya no)
      await deleteDoc(doc(db, "shifts", `${baseDocId}_split`));

      // Guardamos cada fragmento exacto como lo hace NominasPage
      await Promise.all(result.raw.map(async (calc, i) => {
        const idToSave = i === 0 ? baseDocId : `${baseDocId}_split`;
        const shiftMonthVal = mesesFull[new Date(Number(calc.date.split('-')[0]), Number(calc.date.split('-')[1]) - 1, Number(calc.date.split('-')[2])).getMonth()];

        const payload = {
          userId: user.id,
          type: 'SHIFT', // FUNDAMENTAL PARA QUE NOMINASPAGE LO LEA
          startTime: start,
          endTime: end,
          hasBreak,
          isManualBreak,
          breakStart: hasBreak ? breakStart : "",
          breakEnd: hasBreak ? breakEnd : "",
          ...calc, // Esparce totalHours, hOrdD, netPay, etc. directo a la raíz
          isOff: false,
          month: shiftMonthVal,
          year: Number(calc.date.split('-')[0]),
          timestamp: serverTimestamp()
        };

        await setDoc(doc(db, "shifts", idToSave), payload, { merge: true });
      }));

      setNotification({ msg: "Guardado en la Nómina ✅", type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ msg: "Error de conexión ❌", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Función extraída para los botones flecha de fecha
  const changeDateByDays = (days: number) => {
    if (!date) return;
    const currentD = new Date(`${date}T12:00:00`);
    currentD.setDate(currentD.getDate() + days);
    setDate(currentD.toISOString().split("T")[0]);
  };

  if (!mounted) return null;

  return (
    <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 mx-auto transition-all duration-500">
      
      {/* HEADER PREMIUM */}
      <div className={`${colors.secondary} p-6 text-white text-center`}>
        <h2 className="text-xl font-black uppercase italic tracking-tighter">Calculadora Rápida</h2>
        <p className="text-[10px] opacity-80 font-black tracking-widest uppercase">Rol: {role}</p>
      </div>

      <div className="p-6 sm:p-8 space-y-5">
        <div className="space-y-4">
          {/* FECHA CON FLECHAS */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Fecha del Turno</label>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => changeDateByDays(-1)} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400 hover:text-black dark:hover:text-white transition-colors font-black">‹</button>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="flex-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none focus:ring-2 ring-gray-100 dark:ring-gray-700 transition-all text-center" />
              <button onClick={() => changeDateByDays(1)} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400 hover:text-black dark:hover:text-white transition-colors font-black">›</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Entrada</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full mt-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none text-center" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Salida</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full mt-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none text-center" />
            </div>
          </div>

          {/* BREAKS CON UX REFINADA */}
          <div className="space-y-3">
            <div className={`p-4 rounded-2xl border-2 transition-colors ${hasBreak ? 'border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/5' : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-widest ${hasBreak ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>¿Turno con Break?</span>
                <button onClick={() => {
                   setHasBreak(!hasBreak);
                   if (hasBreak) {
                     setIsManualBreak(false);
                     setBreakTouched(false);
                   }
                }} className={`w-12 h-6 rounded-full relative transition-all ${hasBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${hasBreak ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {hasBreak && (
              <div className="p-4 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800 animate-in fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">¿Break Manual?</span>
                  <div className="flex items-center gap-2">
                    {breakTouched && (
                      <button onClick={() => setBreakTouched(false)} className="text-[8px] font-bold text-blue-500 hover:underline uppercase">Auto-reset</button>
                    )}
                    <button onClick={() => setIsManualBreak(!isManualBreak)} className={`w-12 h-6 rounded-full relative transition-all ${isManualBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isManualBreak ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                {isManualBreak && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <input type="time" value={breakStart} onChange={(e) => { setBreakTouched(true); setBreakStart(e.target.value); }} 
                      className={`p-2 bg-white dark:bg-gray-800 dark:text-white rounded-lg font-bold border text-center transition-all ${breakError ? 'border-red-400' : 'border-gray-100 dark:border-gray-700'}`} />
                    <input type="time" value={breakEnd} onChange={(e) => { setBreakTouched(true); setBreakEnd(e.target.value); }} 
                      className={`p-2 bg-white dark:bg-gray-800 dark:text-white rounded-lg font-bold border text-center transition-all ${breakError ? 'border-red-400' : 'border-gray-100 dark:border-gray-700'}`} />
                  </div>
                )}
                {breakError && <p className="text-[10px] font-bold text-red-500 mt-2 italic">{breakError}</p>}
              </div>
            )}
          </div>
        </div>

        <button onClick={handleCalculate} disabled={!!breakError}
          className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all text-white ${breakError ? 'bg-gray-400 cursor-not-allowed grayscale' : `${colors.secondary} hover:brightness-110 active:scale-95 shadow-blue-500/20`}`}>
          {breakError ? 'CORRIGE EL BREAK' : 'CALCULAR 💰'}
        </button>

        {result && !breakError && (
          <div className="mt-6 pt-6 border-t-2 border-gray-50 dark:border-gray-800 animate-in zoom-in-95">
            <div className="text-center mb-6">
              <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[10px] tracking-[0.2em]">Neto Estimado</span>
              <p className={`text-4xl font-black tracking-tighter ${colors.primary}`}>
                <span className="text-2xl mr-1 opacity-70">$</span>{(result.netPay ?? 0).toLocaleString('es-CO')}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl border border-blue-100/50 dark:border-blue-800/30">
                <p className="text-[9px] font-black text-blue-400 uppercase">Base</p>
                <p className="font-bold text-xs dark:text-gray-200">${(result.salaryBase ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-xl border border-green-100/50 dark:border-green-800/30">
                <p className="text-[9px] font-black text-green-400 uppercase">Auxilio</p>
                <p className="font-bold text-xs dark:text-gray-200">+${(result.transportAux ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-xl border border-red-100/50 dark:border-red-800/30">
                <p className="text-[9px] font-black text-red-400 uppercase">Deduc</p>
                <p className="font-bold text-xs dark:text-gray-200">-${(result.deductions ?? 0).toLocaleString()}</p>
              </div>
            </div>

            {user && (
              <div className="space-y-4">
                <button onClick={handleSave} disabled={isSaving}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-xl transition-all ${isSaving ? 'bg-gray-400 cursor-not-allowed animate-pulse' : 'bg-green-500 hover:bg-green-600 active:scale-95 shadow-green-500/20'}`}>
                  {isSaving ? 'Guardando...' : '💾 GUARDAR EN MI NÓMINA'}
                </button>
              </div>
            )}
          </div>
        )}
        
        {notification && (
          <p className={`text-center text-[10px] font-black uppercase tracking-widest animate-pulse ${notification.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
            {notification.msg}
          </p>
        )}
      </div>
    </div>
  );
}