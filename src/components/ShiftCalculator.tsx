"use client";
import { useState } from "react";
import { calculateShift } from "@/lib/calculator";
import { useTheme } from "@/context/ThemeContext";
import { TRANSPORT_AUX_DAILY } from "@/constants/rates";
// Importaciones nuevas para Guardar
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ShiftCalculator() {
  const { role, colors } = useTheme();
  const { user, isLoaded } = useUser(); // Obtenemos el usuario actual
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("22:00");
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:00");
  const [breakEnd, setBreakEnd] = useState("16:30");
  const [result, setResult] = useState<any>(null);
  
  // Estados para el guardado
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleCalculate = () => {
    setSaveSuccess(false); // Reseteamos el mensaje de éxito
    const manualBreak = isManualBreak ? { start: breakStart, end: breakEnd } : undefined;
    const calc = calculateShift(date, start, end, manualBreak, role);
    const baseSalary = calc.totalMoney - TRANSPORT_AUX_DAILY;
    const deductions = baseSalary * 0.08;
    const netPay = calc.totalMoney - deductions;

    setResult({ ...calc, netPay, deductions, date }); // Incluimos la fecha en el resultado
  };

  const handleSaveToFirebase = async () => {
    if (!user) return alert("Debes iniciar sesión para guardar.");
    
    setIsSaving(true);
    try {
      // 1. Preparamos el paquete de datos
      const shiftData = {
        userId: user.id, // ID ÚNICO DE CLERK
        userEmail: user.primaryEmailAddress?.emailAddress,
        role: role,
        date: result.date,
        month: new Date(result.date).toLocaleString('es-CO', { month: 'long' }),
        year: new Date(result.date).getFullYear(),
        startTime: start,
        endTime: end,
        totalHours: result.totalHours,
        totalMoney: result.totalMoney,
        netPay: result.netPay,
        deductions: result.deductions,
        transportAux: TRANSPORT_AUX_DAILY,
        timestamp: serverTimestamp() // Hora exacta del guardado
      };

      // 2. Enviamos a la colección "shifts" (turnos)
      await addDoc(collection(db, "shifts"), shiftData);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Ocultar mensaje a los 3 seg
    } catch (error) {
      console.error("Error guardando:", error);
      alert("Hubo un error al guardar. Revisa tu conexión.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="calculadora" className={`w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden border ${colors.accent} mx-auto transition-all duration-500`}>
      <div className={`${colors.secondary} p-8 text-white text-center`}>
        <h2 className="text-2xl font-black tracking-tighter uppercase italic">Calcula tu turno individual</h2>
        <p className="text-sm opacity-80 font-bold">CARGO: {role}</p>
      </div>

      <div className="p-8 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-gray-400 uppercase">Día del Turno</label>
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

          {/* Sección de Break */}
          <div className={`p-4 rounded-2xl border-2 border-dashed ${isManualBreak ? colors.accent : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-gray-500 uppercase">¿Break Personalizado?</span>
              <button 
                onClick={() => setIsManualBreak(!isManualBreak)}
                className={`w-12 h-6 rounded-full transition-all relative ${isManualBreak ? colors.secondary : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isManualBreak ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {isManualBreak && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="p-2 bg-white rounded-lg text-sm font-bold border border-gray-100" />
                <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="p-2 bg-white rounded-lg text-sm font-bold border border-gray-100" />
              </div>
            )}
          </div>
        </div>

        <button onClick={handleCalculate}
          className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all text-white ${colors.secondary} hover:brightness-110`}>
          CALCULAR AHORA 💰
        </button>

        {result && (
          <div className="mt-8 pt-8 border-t-2 border-gray-50 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end mb-6">
              <span className="text-gray-400 font-bold uppercase text-xs">Pago Neto Estimado</span>
              <span className={`text-5xl font-black tracking-tighter ${colors.primary}`}>
                ${Math.floor(result.netPay).toLocaleString('es-CO')}
              </span>
            </div>
            
            {/* BOTÓN DE GUARDAR EN FIREBASE */}
            {user && (
              <button 
                onClick={handleSaveToFirebase}
                disabled={isSaving || saveSuccess}
                className={`w-full py-3 mb-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all 
                  ${saveSuccess 
                    ? "bg-green-500 text-white cursor-default" 
                    : "bg-gray-900 text-white hover:bg-gray-800 active:scale-95"
                  } disabled:opacity-70`}
              >
                {isSaving ? "Guardando..." : saveSuccess ? "¡Guardado con Éxito! ✅" : "💾 Guardar en mi Quincena"}
              </button>
            )}

            {!user && (
              <p className="text-center text-xs text-gray-400 mb-4">
                Inicia sesión para guardar este turno en tu historial.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded-xl">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Bruto</p>
                <p className="font-bold text-sm">${Math.floor(result.totalMoney).toLocaleString()}</p>
              </div>
              <div className="bg-red-50 p-3 rounded-xl text-red-600">
                <p className="text-[10px] font-bold uppercase">Deducciones</p>
                <p className="font-bold text-sm">-${Math.floor(result.deductions).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}