"use client";
import { useState, useEffect, useMemo } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Navbar from "@/components/Navbar";
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useTheme } from "@/context/ThemeContext";
import { calculateShift } from "@/lib/calculator";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function NominasPage() {
  const { user } = useUser();
  const { colors, role } = useTheme();
  
  const [step, setStep] = useState(1); 
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuincena, setSelectedQuincena] = useState<number | null>(null);
  
  // Datos
  const [shifts, setShifts] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  
  // Formulario
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("22:00");
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:00");
  const [breakEnd, setBreakEnd] = useState("16:30");

  const mesesFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  
  // Fecha Actual (Para validaciones visuales)
  const today = new Date();
  const currentMonthName = mesesFull[today.getMonth()];
  const currentYear = today.getFullYear();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "shifts"), where("userId", "==", user.id));
    const unsub = onSnapshot(q, (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const shiftsDelAno = useMemo(() => shifts.filter(s => s.year === selectedYear), [shifts, selectedYear]);

  // --- ESTADÍSTICAS ---
  const statsAnuales = useMemo(() => {
    const dataMeses = mesesFull.map(m => 
      shiftsDelAno.filter(s => s.month === m).reduce((acc, curr) => acc + (curr.netPay || 0), 0)
    );
    return {
      labels: mesesFull.map(m => m.substring(0, 3).toUpperCase()),
      datasets: [{ label: 'Neto', data: dataMeses, backgroundColor: colors.secondary, borderRadius: 6 }]
    };
  }, [shiftsDelAno, colors.secondary]);

  const statsQuincenas = useMemo(() => {
    const shiftsMes = shiftsDelAno.filter(s => s.month === selectedMonth);
    const calcQ = (isQ1: boolean) => {
        const filtered = shiftsMes.filter(s => {
            const day = parseInt(s.date.split('-')[2]);
            return isQ1 ? day <= 15 : day > 15;
        });
        return {
            dinero: filtered.reduce((a, b) => a + (b.netPay || 0), 0),
            horas: filtered.reduce((a, b) => a + (b.totalHours || 0), 0),
            diasTrabajados: filtered.filter(s => !s.isOff).length,
            diasOff: filtered.filter(s => s.isOff).length
        };
    };
    const q1 = calcQ(true);
    const q2 = calcQ(false);
    return { q1, q2, chartData: {
      labels: ['Q1', 'Q2'],
      datasets: [{ label: 'Total', data: [q1.dinero, q2.dinero], backgroundColor: [colors.secondary, '#111'], borderRadius: 10 }]
    }};
  }, [shiftsDelAno, selectedMonth, colors.secondary]);

  const turnosFiltrados = useMemo(() => {
    return shiftsDelAno.filter(s => {
      const day = parseInt(s.date.split('-')[2]);
      const matchMonth = s.month === selectedMonth;
      const matchQuincena = selectedQuincena === 1 ? day <= 15 : day > 15;
      return matchMonth && matchQuincena;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [shiftsDelAno, selectedMonth, selectedQuincena]);

  const totalListaDinero = turnosFiltrados.reduce((acc, curr) => acc + (curr.netPay || 0), 0);
  const totalListaHoras = turnosFiltrados.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
  const countTrabajados = turnosFiltrados.filter(s => !s.isOff).length;
  const countOff = turnosFiltrados.filter(s => s.isOff).length;

  const getLastDayOfMonth = () => new Date(selectedYear, mesesFull.indexOf(selectedMonth) + 1, 0).getDate();

  // --- FUNCIONES ---

  const handleQuickAddToday = () => {
    // Configuramos todo para hoy automáticamente
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(mesesFull[now.getMonth()]);
    setSelectedDate(now);
    setEditingShiftId(null);
    setShowModal(true);
  };

  const handleOpenEdit = (shift: any) => {
    setEditingShiftId(shift.id);
    setStartTime(shift.startTime || "14:00");
    setEndTime(shift.endTime || "22:00");
    setShowModal(true);
  };

  const handleSaveShift = async (isOff: boolean = false) => {
    if (!user) return;
    let targetDateStr = "";
    if (editingShiftId) {
       const originalShift = shifts.find(s => s.id === editingShiftId);
       targetDateStr = originalShift.date;
    } else {
       if(!selectedDate) return alert("Error de fecha");
       const year = selectedDate.getFullYear();
       const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
       const day = String(selectedDate.getDate()).padStart(2, '0');
       targetDateStr = `${year}-${month}-${day}`;
    }

    const docId = editingShiftId || `${user.id}_${targetDateStr}`;
    const manualBreak = isManualBreak ? { start: breakStart, end: breakEnd } : undefined;
    const calc = calculateShift(targetDateStr, startTime, endTime, manualBreak, role);

    const payload = {
      userId: user.id,
      date: targetDateStr,
      startTime: isOff ? "" : startTime,
      endTime: isOff ? "" : endTime,
      netPay: isOff ? 0 : calc.totalMoney * 0.92,
      totalHours: isOff ? 0 : calc.totalHours,
      isOff,
      month: selectedMonth || mesesFull[new Date(targetDateStr).getMonth()], // Asegura mes si viene de Quick Add
      year: selectedYear,
      timestamp: serverTimestamp()
    };
    await setDoc(doc(db, "shifts", docId), payload, { merge: true });
    setShowModal(false);
    setEditingShiftId(null);
  };

  const isDateDisabled = ({ date }: { date: Date }) => {
    if (date.getFullYear() !== selectedYear || date.getMonth() !== mesesFull.indexOf(selectedMonth)) return true; 
    const day = date.getDate();
    return selectedQuincena === 1 ? day > 15 : day <= 15;
  };

  return (
    <>
      <SignedOut><RedirectToSignIn /></SignedOut>
      <SignedIn>
        <main className="min-h-screen bg-[#F4F6F8] pb-24 font-sans">
          <Navbar />
          <div className="max-w-5xl mx-auto p-6">
            
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
               <div>
                 {step > 1 && <button onClick={() => {setStep(step - 1); setSelectedDate(null);}} className="text-[10px] font-black text-gray-400 mb-1 hover:text-black">← ATRÁS</button>}
                 <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-gray-900 leading-none">
                   {step === 1 && "Selecciona Mes"}
                   {step === 2 && `Quincenas ${selectedMonth}`}
                   {step === 3 && `Quincena ${selectedQuincena}`}
                 </h1>
               </div>
               {step === 1 && (
                 <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-sm">
                    <button onClick={() => setSelectedYear(selectedYear - 1)} className="text-gray-400 hover:text-black transition-colors font-black text-xl">←</button>
                    <span className="text-2xl font-black italic tracking-tighter">{selectedYear}</span>
                    <button onClick={() => setSelectedYear(selectedYear + 1)} className="text-gray-400 hover:text-black transition-colors font-black text-xl">→</button>
                 </div>
               )}
            </div>

            {step === 1 && (
              <div className="animate-in fade-in duration-500 space-y-10">
                {/* LISTA DE MESES (CON HIGHLIGHT DEL MES ACTUAL) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {mesesFull.map((m) => {
                    const isCurrentMonth = m === currentMonthName && selectedYear === currentYear;
                    return (
                      <button key={m} onClick={() => { setSelectedMonth(m); setStep(2); }}
                        className={`p-6 rounded-[2rem] shadow-sm font-black text-lg capitalize transition-all border hover:scale-105 active:scale-95
                        ${isCurrentMonth 
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-800 ring-2 ring-yellow-100' // Estilo Mes Actual
                          : 'bg-white border-transparent hover:border-gray-200'
                        }`}>
                        {m}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
                   <p className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-[0.2em] text-center">Resumen Anual {selectedYear}</p>
                   <div className="h-64"><Bar data={statsAnuales} options={{ maintainAspectRatio: false }} /></div>
                </div>

                {/* BOTÓN DE ACCESO RÁPIDO: AGREGAR HOY */}
                <div className="flex justify-center">
                  <button 
                    onClick={handleQuickAddToday}
                    className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-black hover:scale-105 transition-all flex items-center gap-3 group"
                  >
                    <span className="text-2xl">⚡</span>
                    <div className="text-left">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Acceso Rápido</p>
                      <p className="text-lg">Agregar turno de HOY ({today.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })})</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in slide-in-from-right-8 duration-500 space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                    <div onClick={() => { setSelectedQuincena(1); setStep(3); }} className="bg-white p-8 rounded-[3rem] shadow-xl cursor-pointer hover:scale-[1.02] transition-transform border border-transparent hover:border-gray-200">
                        <div className="flex justify-between items-start mb-6">
                            <div><span className="text-5xl font-black text-gray-900 block">01</span><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Días 01 - 15</span></div>
                            <div className="text-right"><p className="text-3xl font-black tracking-tighter text-yellow-500">${Math.floor(statsQuincenas.q1.dinero).toLocaleString()}</p><p className="text-[10px] font-black text-gray-400 uppercase">Acumulado</p></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 bg-gray-50 p-4 rounded-2xl text-center">
                            <div><p className="text-xl font-black">{statsQuincenas.q1.horas.toFixed(1)}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Horas</p></div>
                            <div><p className="text-xl font-black text-green-600">{statsQuincenas.q1.diasTrabajados}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Días Job</p></div>
                            <div><p className="text-xl font-black text-red-500">{statsQuincenas.q1.diasOff}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Días Off</p></div>
                        </div>
                    </div>
                    <div onClick={() => { setSelectedQuincena(2); setStep(3); }} className="bg-white p-8 rounded-[3rem] shadow-xl cursor-pointer hover:scale-[1.02] transition-transform border border-transparent hover:border-gray-200">
                        <div className="flex justify-between items-start mb-6">
                            <div><span className="text-5xl font-black text-gray-900 block">02</span><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Días 16 - {getLastDayOfMonth()}</span></div>
                            <div className="text-right"><p className="text-3xl font-black tracking-tighter text-red-600">${Math.floor(statsQuincenas.q2.dinero).toLocaleString()}</p><p className="text-[10px] font-black text-gray-400 uppercase">Acumulado</p></div>
                        </div>
                         <div className="grid grid-cols-3 gap-2 bg-gray-50 p-4 rounded-2xl text-center">
                            <div><p className="text-xl font-black">{statsQuincenas.q2.horas.toFixed(1)}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Horas</p></div>
                            <div><p className="text-xl font-black text-green-600">{statsQuincenas.q2.diasTrabajados}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Días Job</p></div>
                            <div><p className="text-xl font-black text-red-500">{statsQuincenas.q2.diasOff}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Días Off</p></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm h-72 border border-gray-50">
                    <Bar data={statsQuincenas.chartData} options={{ maintainAspectRatio: false }} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-in zoom-in-95 duration-500 space-y-8">
                <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-xl border border-gray-100">
                  <Calendar 
                    onChange={(val) => setSelectedDate(val as Date)} 
                    value={selectedDate}
                    activeStartDate={new Date(selectedYear, mesesFull.indexOf(selectedMonth), 1)}
                    tileClassName={({ date, view }) => {
                        const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        const s = shiftsDelAno.find(shift => shift.date === dStr);
                        
                        // COLORES DE ESTADO (Prioridad Alta)
                        if (s?.isOff) return '!bg-red-500 !text-white rounded-2xl font-bold';
                        if (s) return '!bg-green-500 !text-white rounded-2xl font-bold';
                        
                        // DÍA SELECCIONADO (Azul)
                        if (selectedDate && date.getTime() === selectedDate.getTime()) {
                            return '!bg-blue-100 !text-blue-600 rounded-2xl font-black border-2 border-blue-200';
                        }

                        // HOY (Amarillo Claro) - Solo si no tiene turno y no está seleccionado
                        const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                        if (isToday) return '!bg-yellow-100 text-yellow-800 font-black border-2 border-yellow-200 rounded-2xl';

                        if (date.getDay() === 0) return 'text-red-500 font-bold';
                        return 'text-gray-700 font-bold hover:bg-gray-50 rounded-2xl';
                    }}
                    tileDisabled={isDateDisabled}
                  />
                  {selectedDate && (
                     <div className="mt-8 flex gap-4 animate-in fade-in slide-in-from-top-2">
                        <button onClick={() => {setEditingShiftId(null); setShowModal(true);}} className={`${colors.secondary} text-white flex-1 py-4 rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest hover:brightness-110 active:scale-95 transition-all`}>+ Agregar Turno</button>
                        <button onClick={() => handleSaveShift(true)} className="bg-gray-100 text-gray-400 flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-50 hover:text-red-500 transition-colors">Marcar OFF</button>
                     </div>
                  )}
                </div>

                <div className="bg-white rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden">
                   <div className="p-8 pb-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                      <h2 className="text-2xl font-black italic uppercase">Turnos Registrados</h2>
                      <div className="flex gap-4">
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-100">Trabajados: {countTrabajados}</span>
                          <span className="text-xs font-bold text-red-500 bg-red-50 px-4 py-2 rounded-full border border-red-100">OFF: {countOff}</span>
                      </div>
                   </div>
                   
                   <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                      {turnosFiltrados.length === 0 ? (
                         <div className="p-10 text-center text-gray-300 font-bold italic">No hay turnos registrados en esta quincena.</div>
                      ) : (
                         turnosFiltrados.map((s) => (
                           <div key={s.id} className="p-6 md:p-8 hover:bg-gray-50 transition-colors flex justify-between items-center group">
                              <div className="flex-1">
                                 <div className="flex items-center gap-3 mb-1">
                                    <span className={`w-3 h-3 rounded-full ${s.isOff ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                    <p className="font-black text-xl text-gray-800 capitalize">
                                       {new Date(s.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}
                                    </p>
                                 </div>
                                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pl-6">
                                    {s.isOff ? "Día de Descanso" : `${s.startTime} - ${s.endTime} • ${s.totalHours.toFixed(1)}h`}
                                 </p>
                              </div>
                              <div className="text-right flex items-center gap-4">
                                 {!s.isOff && ( <p className="font-black text-xl text-gray-900">${Math.floor(s.netPay).toLocaleString()}</p> )}
                                 <button onClick={() => handleOpenEdit(s)} className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-black hover:text-white transition-colors">✏️</button>
                                 <button onClick={() => deleteDoc(doc(db, "shifts", s.id))} className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-red-500 hover:text-white transition-colors">🗑️</button>
                              </div>
                           </div>
                         ))
                      )}
                   </div>

                   {turnosFiltrados.length > 0 && (
                      <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
                         <div><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Horas</p><p className="text-xl font-black text-white">{totalListaHoras.toFixed(1)} h</p></div>
                         <div className="text-right"><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Neto</p><p className="text-3xl font-black text-yellow-400 tracking-tighter">${Math.floor(totalListaDinero).toLocaleString()}</p></div>
                      </div>
                   )}
                </div>
              </div>
            )}
          </div>

          {showModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 animate-in zoom-in-95">
                <h3 className="text-2xl font-black mb-8 text-center uppercase italic">{editingShiftId ? 'Editar Turno' : 'Nuevo Turno'}</h3>
                {selectedDate && <p className="text-center text-gray-400 font-bold mb-6">{selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                
                <div className="space-y-6 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Entrada</label><input type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl font-black border-none outline-none focus:ring-2 ring-black" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Salida</label><input type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl font-black border-none outline-none focus:ring-2 ring-black" /></div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-center mb-2"><span className="text-xs font-black uppercase text-gray-500">Break Manual</span><input type="checkbox" className="w-5 h-5 accent-black" checked={isManualBreak} onChange={()=>setIsManualBreak(!isManualBreak)} /></div>
                    {isManualBreak && <div className="grid grid-cols-2 gap-2 mt-3"><input type="time" value={breakStart} onChange={(e)=>setBreakStart(e.target.value)} className="p-3 bg-white rounded-xl text-xs font-bold shadow-sm" /><input type="time" value={breakEnd} onChange={(e)=>setBreakEnd(e.target.value)} className="p-3 bg-white rounded-xl text-xs font-bold shadow-sm" /></div>}
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 font-bold text-gray-400 hover:text-black">CANCELAR</button>
                  <button onClick={() => handleSaveShift(false)} className={`${colors.secondary} flex-[2] py-4 rounded-2xl text-white font-black shadow-xl hover:scale-105 transition-transform`}>GUARDAR</button>
                </div>
              </div>
            </div>
          )}

          <style jsx global>{`
            .react-calendar { width: 100% !important; border: none !important; font-family: inherit; background: transparent !important; }
            .react-calendar__navigation { margin-bottom: 20px; }
            .react-calendar__navigation button { font-size: 1.2rem; font-weight: 900; text-transform: uppercase; }
            .react-calendar__tile { padding: 1.2em 0.5em !important; font-weight: 700; border-radius: 1.2rem; transition: all 0.2s; background: transparent; }
            .react-calendar__tile:disabled { opacity: 0.3 !important; cursor: not-allowed; background: #f3f4f6 !important; }
            .react-calendar__tile:enabled:hover { background-color: #f3f4f6; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
          `}</style>
        </main>
      </SignedIn>
    </>
  );
}