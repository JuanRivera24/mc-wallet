"use client";
import { useState } from "react";
import { calculateShift } from "@/lib/calculator";
import { useTheme } from "@/context/ThemeContext";
// Firebase & Auth
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";

export default function ShiftCalculator() {
  const { role, colors } = useTheme();
  const { user } = useUser();
  
  // Estados del Formulario
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("22:00");
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:00");
  const [breakEnd, setBreakEnd] = useState("16:30");
  
  const [result, setResult] = useState<any>(null);
  
  // Estados de UI (Carga y Notificaciones)
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'update'} | null>(null);

  const handleCalculate = () => {
    setNotification(null);
    const manualBreak = isManualBreak ? { start: breakStart, end: breakEnd } : undefined;
    
    // Calculamos usando la lógica centralizada
    const calc = calculateShift(date, start, end, manualBreak, role);
    setResult(calc);
  };

  const handleSaveOrUpdate = async () => {
    if (!user || !result) return;
    
    setIsSaving(true);
    try {
      // 1. Datos a guardar
      const shiftData = {
        userId: user.id,
        userEmail: user.primaryEmailAddress?.emailAddress,
        role: role,
        date: result.date,
        // Forzamos la zona horaria para que el mes sea correcto en Colombia
        month: new Date(result.date + 'T00:00:00').toLocaleString('es-CO', { month: 'long' }),
        year: new Date(result.date).getFullYear(),
        startTime: start,
        endTime: end,
        totalHours: result.totalHours,
        salaryBase: result.salaryBase,
        transportAux: result.transportAux,
        deductions: result.deductions,
        netPay: result.netPay,
        timestamp: serverTimestamp()
      };

      // 2. VERIFICAR DUPLICADOS: ¿Ya existe un turno en esta fecha?
      const shiftsRef = collection(db, "shifts");
      const q = query(
        shiftsRef, 
        where("userId", "==", user.id), 
        where("date", "==", result.date)
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // A. ACTUALIZAR (Si ya existe)
        const docId = querySnapshot.docs[0].id; // Tomamos el ID del turno existente
        const docRef = doc(db, "shifts", docId);
        
        await updateDoc(docRef, shiftData);
        
        showNotification("Turno actualizado correctamente 🔄", 'update');
      } else {
        // B. CREAR NUEVO (Si no existe)
        await addDoc(shiftsRef, shiftData);
        
        showNotification("Turno agregado a la nómina ✅", 'success');
      }

    } catch (error) {
      console.error("Error guardando:", error);
      alert("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const showNotification = (msg: string, type: 'success' | 'update') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 4000); // Ocultar a los 4 seg
  };

  return (
    <div className={`relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden border ${colors.accent} mx-auto transition-all duration-500`}>
      
      {/* HEADER */}
      <div className={`${colors.secondary} p-8 text-white text-center`}>
        <h2 className="text-2xl font-black tracking-tighter uppercase italic">Calculadora Rápida</h2>
        <p className="text-sm opacity-80 font-bold">Modo: {role}</p>
      </div>

      <div className="p-8 space-y-6">
        {/* INPUTS DE FECHA Y HORA */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-gray-400 uppercase">Fecha del Turno</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 p-4 bg-gray-50 rounded-2xl border-none font-bold text-gray-700 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-gray-400 uppercase">Entrada</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full mt-1 p-4 bg-gray-50 rounded-2xl border-none font-bold text-gray-700 outline-none" />
            </div>
            <div>
              <label className="text-xs font-black text-gray-400 uppercase">Salida</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full mt-1 p-4 bg-gray-50 rounded-2xl border-none font-bold text-gray-700 outline-none" />
            </div>
          </div>

          {/* TOGGLE DE BREAK */}
          <div className={`p-4 rounded-2xl border-2 border-dashed ${isManualBreak ? colors.accent : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-gray-500 uppercase">¿Break Manual?</span>
              <button 
                onClick={() => setIsManualBreak(!isManualBreak)}
                className={`w-12 h-6 rounded-full transition-all relative ${isManualBreak ? colors.secondary : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isManualBreak ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            {isManualBreak && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="p-2 bg-white rounded-lg text-sm font-bold border border-gray-100" />
                <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="p-2 bg-white rounded-lg text-sm font-bold border border-gray-100" />
              </div>
            )}
          </div>
        </div>

        {/* BOTÓN CALCULAR */}
        <button onClick={handleCalculate}
          className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all text-white ${colors.secondary} hover:brightness-110`}>
          CALCULAR 💰
        </button>

        {/* RESULTADOS */}
        {result && (
          <div className="mt-6 pt-6 border-t-2 border-gray-50 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end mb-6">
              <div className="flex flex-col">
                <span className="text-gray-400 font-bold uppercase text-[10px]">Neto Estimado</span>
                <span className={`text-4xl font-black tracking-tighter ${colors.primary}`}>
                  ${result.netPay.toLocaleString('es-CO')}
                </span>
              </div>
              
              {/* BOTÓN GUARDAR INTELIGENTE */}
              {user ? (
                <button 
                  onClick={handleSaveOrUpdate}
                  disabled={isSaving}
                  className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md
                    ${isSaving ? "bg-gray-300 cursor-not-allowed" : "bg-gray-900 text-white hover:bg-black active:scale-95"}
                  `}
                >
                  {isSaving ? "..." : "💾 Guardar"}
                </button>
              ) : (
                <span className="text-[10px] text-gray-400">Login para guardar</span>
              )}
            </div>

            {/* Desglose Rápido */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-blue-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold uppercase text-blue-400">Base</p>
                <p className="font-bold text-xs">${result.salaryBase.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold uppercase text-green-400">Auxilio</p>
                <p className="font-bold text-xs">+${result.transportAux.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold uppercase text-red-400">Deduc</p>
                <p className="font-bold text-xs">-${result.deductions.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NOTIFICACIÓN FLOTANTE (Toast) */}
      {notification && (
        <div className={`absolute bottom-4 right-4 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 z-50
          ${notification.type === 'success' ? 'bg-green-500' : 'bg-blue-600'} text-white`}>
          <span className="text-lg">{notification.type === 'success' ? '✅' : '🔄'}</span>
          <div>
            <p className="text-xs font-bold uppercase opacity-80">{notification.type === 'success' ? 'Éxito' : 'Actualizado'}</p>
            <p className="text-sm font-bold">{notification.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}