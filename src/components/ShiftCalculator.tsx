"use client";
import { useState } from "react";
import { calculateShift } from "@/lib/calculator";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
// 1. IMPORTAMOS getDoc PARA PODER REVISAR SI EL TURNO YA EXISTE
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

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
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:00");
  const [breakEnd, setBreakEnd] = useState("16:30");

  const [result, setResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'update'} | null>(null);

  const mesesFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const handleCalculate = () => {
    setNotification(null);
    const manualBreak = isManualBreak ? { start: breakStart, end: breakEnd } : undefined;
    const calc = calculateShift(date, start, end, manualBreak, role);
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

      // 2. REVISAMOS SI EL TURNO YA EXISTE EN FIREBASE
      const docRef = doc(db, "shifts", docId);
      const docSnap = await getDoc(docRef);
      const existeTurno = docSnap.exists();

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

      // Guardamos la información (merge: true actualiza o crea según corresponda)
      await setDoc(docRef, payload, { merge: true });
      
      // 3. MOSTRAMOS EL MENSAJE DINÁMICO
      if (existeTurno) {
        setNotification({ message: "¡Turno actualizado en la nómina! 🔄", type: 'update' });
      } else {
        setNotification({ message: "¡Turno guardado en la nómina! ✅", type: 'success' });
      }

    } catch (error) {
      console.error("Error al guardar turno:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl overflow-hidden border ${colors.accent} dark:border-gray-800 mx-auto transition-all duration-500`}>

      <div className={`${colors.secondary} p-8 text-white text-center`}>
        <h2 className="text-2xl font-black tracking-tighter uppercase italic">Calculadora Rápida</h2>
        <p className="text-sm opacity-80 font-bold">Modo: {role}</p>
      </div>

      <div className="p-8 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Fecha del Turno</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 outline-none transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Entrada</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full mt-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none transition-colors" />
            </div>
            <div>
              <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Salida</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full mt-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none font-bold text-gray-700 dark:text-white outline-none transition-colors" />
            </div>
          </div>

          <div className={`p-4 rounded-2xl border-2 border-dashed ${isManualBreak ? colors.accent : 'border-gray-100 dark:border-gray-800'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-gray-500 uppercase">¿Break Manual?</span>
              <button onClick={() => setIsManualBreak(!isManualBreak)} className={`w-12 h-6 rounded-full transition-all relative ${isManualBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isManualBreak ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            {isManualBreak && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="p-2 bg-white dark:bg-gray-800 dark:text-white rounded-lg text-sm font-bold border border-gray-100 dark:border-gray-700" />
                <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="p-2 bg-white dark:bg-gray-800 dark:text-white rounded-lg text-sm font-bold border border-gray-100 dark:border-gray-700" />
              </div>
            )}
          </div>
        </div>

        <button onClick={handleCalculate} className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all text-white ${colors.secondary} hover:brightness-110`}>CALCULAR 💰</button>

        {result && (
          <div className="mt-6 pt-6 border-t-2 border-gray-50 dark:border-gray-800 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end mb-6">
              <div className="flex flex-col">
                <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[10px]">Neto Estimado</span>
                <span className={`text-4xl font-black tracking-tighter ${colors.primary}`}>${result.netPay.toLocaleString('es-CO')}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg"><p className="text-[9px] font-bold uppercase text-blue-400">Base</p><p className="font-bold text-xs dark:text-gray-300">${result.salaryBase.toLocaleString()}</p></div>
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg"><p className="text-[9px] font-bold uppercase text-green-400">Auxilio</p><p className="font-bold text-xs dark:text-gray-300">+${result.transportAux.toLocaleString()}</p></div>
              <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg"><p className="text-[9px] font-bold uppercase text-red-400">Deduc</p><p className="font-bold text-xs dark:text-gray-300">-${result.deductions.toLocaleString()}</p></div>
            </div>

            {/* BOTÓN DE GUARDADO (SOLO VISIBLE SI HAY SESIÓN) */}
            {user && (
              <div className="animate-in fade-in">
                <button 
                  onClick={handleSaveOrUpdate} 
                  disabled={isSaving}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl transition-all ${isSaving ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 active:scale-95'}`}
                >
                  {isSaving ? 'Procesando...' : '💾 Guardar en Nómina'}
                </button>
                
                {/* 4. APLICAMOS EL COLOR SEGÚN EL TIPO DE MENSAJE */}
                {notification && (
                  <p className={`text-center text-[10px] font-bold mt-4 uppercase tracking-widest ${notification.type === 'update' ? 'text-blue-500 dark:text-blue-400' : 'text-green-500 dark:text-green-400'}`}>
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
