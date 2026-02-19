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
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  
  // ESTADO PARA EL DESPLEGABLE INFERIOR
  const [isTotalExpanded, setIsTotalExpanded] = useState(false);

  // Formulario
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("20:00");
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:00");
  const [breakEnd, setBreakEnd] = useState("16:30");

  const mesesFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

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
    return {
      q1, q2, chartData: {
        labels: ['Q1', 'Q2'],
        datasets: [{ label: 'Total', data: [q1.dinero, q2.dinero], backgroundColor: [colors.secondary, '#111'], borderRadius: 10 }]
      }
    };
  }, [shiftsDelAno, selectedMonth, colors.secondary]);

  const turnosFiltrados = useMemo(() => {
    return shiftsDelAno.filter(s => {
      const day = parseInt(s.date.split('-')[2]);
      const matchMonth = s.month === selectedMonth;
      const matchQuincena = selectedQuincena === 1 ? day <= 15 : day > 15;
      return matchMonth && matchQuincena;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [shiftsDelAno, selectedMonth, selectedQuincena]);

  // CÁLCULOS GENERALES
  const totalListaDinero = turnosFiltrados.reduce((acc, curr) => acc + (curr.netPay || 0), 0);
  const totalListaHoras = turnosFiltrados.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
  const countTrabajados = turnosFiltrados.filter(s => !s.isOff).length;
  const countOff = turnosFiltrados.filter(s => s.isOff).length;

  // CÁLCULOS DESGLOSE SEGURO (Maneja fallbacks para turnos viejos de otros usuarios)
  const tOrdD_h = turnosFiltrados.reduce((a, c) => a + (c.hOrdD || 0), 0);
  const tOrdD_p = turnosFiltrados.reduce((a, c) => a + (c.pOrdD || 0), 0);
  const tOrdN_h = turnosFiltrados.reduce((a, c) => a + (c.hOrdN || 0), 0);
  const tOrdN_p = turnosFiltrados.reduce((a, c) => a + (c.pOrdN || 0), 0);
  
  const tDomD_h = turnosFiltrados.reduce((a, c) => a + (c.hDomD || 0), 0);
  const tDomD_p = turnosFiltrados.reduce((a, c) => a + (c.pDomD || 0), 0);
  const tDomN_h = turnosFiltrados.reduce((a, c) => a + (c.hDomN || 0), 0);
  const tDomN_p = turnosFiltrados.reduce((a, c) => a + (c.pDomN || 0), 0);

  const tExtD_h = turnosFiltrados.reduce((a, c) => a + (c.hExtD || 0), 0);
  const tExtD_p = turnosFiltrados.reduce((a, c) => a + (c.pExtD || 0), 0);
  const tExtN_h = turnosFiltrados.reduce((a, c) => a + (c.hExtN || 0), 0);
  const tExtN_p = turnosFiltrados.reduce((a, c) => a + (c.pExtN || 0), 0);

  const tExtDomD_h = turnosFiltrados.reduce((a, c) => a + (c.hExtDomD || 0), 0);
  const tExtDomD_p = turnosFiltrados.reduce((a, c) => a + (c.pExtDomD || 0), 0);
  const tExtDomN_h = turnosFiltrados.reduce((a, c) => a + (c.hExtDomN || 0), 0);
  const tExtDomN_p = turnosFiltrados.reduce((a, c) => a + (c.pExtDomN || 0), 0);

  const getLastDayOfMonth = () => new Date(selectedYear, mesesFull.indexOf(selectedMonth) + 1, 0).getDate();

  const handlePrevMonth = () => {
    const currentIndex = mesesFull.indexOf(selectedMonth);
    if (currentIndex === 0) { setSelectedMonth("diciembre"); setSelectedYear(prev => prev - 1); } 
    else { setSelectedMonth(mesesFull[currentIndex - 1]); }
  };

  const handleNextMonth = () => {
    const currentIndex = mesesFull.indexOf(selectedMonth);
    if (currentIndex === 11) { setSelectedMonth("enero"); setSelectedYear(prev => prev + 1); } 
    else { setSelectedMonth(mesesFull[currentIndex + 1]); }
  };

  const handlePrevQuincena = () => selectedQuincena === 2 ? setSelectedQuincena(1) : (handlePrevMonth(), setSelectedQuincena(2));
  const handleNextQuincena = () => selectedQuincena === 1 ? setSelectedQuincena(2) : (handleNextMonth(), setSelectedQuincena(1));

  const handleQuickAddToday = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(mesesFull[now.getMonth()]);
    setSelectedDate(now);
    setEditingShiftId(null);
    setShowModal(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, shift: any) => {
    e.stopPropagation();
    setEditingShiftId(shift.id);

    const [year, month, day] = shift.date.split('-');
    setSelectedDate(new Date(Number(year), Number(month) - 1, Number(day)));

    setStartTime(shift.startTime || "14:00");
    setEndTime(shift.endTime || "22:00");
    setShowModal(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("¿Eliminar turno?")) deleteDoc(doc(db, "shifts", id));
  }

  // --- NUEVA FUNCIÓN: RECALCULAR TURNO RÁPIDO ---
  const handleRecalculate = async (e: React.MouseEvent, shift: any) => {
    e.stopPropagation();
    if (!user || shift.isOff) return; // Si es día OFF, no hacemos nada extra.

    // Calculamos de nuevo usando la misma entrada y salida. 
    // (Ojo: Si el usuario tenía un break manual muy específico, esto aplicará el break automático estándar si aplica)
    const calc = calculateShift(shift.date, shift.startTime, shift.endTime, undefined, role);

    const payload: any = {
      ...shift, // Conservamos todos los datos originales
      ...calc, // Sobrescribimos con los cálculos frescos
      
      hOrdD: calc.hOrdD, pOrdD: calc.pOrdD,
      hOrdN: calc.hOrdN, pOrdN: calc.pOrdN,
      hDomD: calc.hDomD, pDomD: calc.pDomD,
      hDomN: calc.hDomN, pDomN: calc.pDomN,
      hExtD: calc.hExtD, pExtD: calc.pExtD,
      hExtN: calc.hExtN, pExtN: calc.pExtN,
      hExtDomD: calc.hExtDomD, pExtDomD: calc.pExtDomD,
      hExtDomN: calc.hExtDomN, pExtDomN: calc.pExtDomN,
      
      timestamp: serverTimestamp() // Actualizamos la fecha de modificación
    };

    await setDoc(doc(db, "shifts", shift.id), payload, { merge: true });
    // OPCIONAL: Podrías agregar un pequeño alert("¡Turno actualizado!") si quieres que el usuario sepa que funcionó.
  };

  const handleToggleExpand = (id: string) => setExpandedShiftId(expandedShiftId === id ? null : id);

  const handleSaveShift = async (isOff: boolean = false) => {
    if (!user) return;
    let targetDateStr = "";
    if (editingShiftId) {
      const originalShift = shifts.find(s => s.id === editingShiftId);
      targetDateStr = originalShift.date;
    } else {
      if (!selectedDate) return alert("Error de fecha");
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      targetDateStr = `${year}-${month}-${day}`;
    }

    const docId = editingShiftId || `${user.id}_${targetDateStr}`;
    const manualBreak = isManualBreak ? { start: breakStart, end: breakEnd } : undefined;

    const calc = calculateShift(targetDateStr, startTime, endTime, manualBreak, role);

    // Evitamos problemas de TS asignando manualmente al payload
    const payload: any = {
      userId: user.id,
      date: targetDateStr,
      startTime: isOff ? "" : startTime,
      endTime: isOff ? "" : endTime,

      netPay: isOff ? 0 : calc.netPay,
      salaryBase: isOff ? 0 : calc.salaryBase,
      transportAux: isOff ? 0 : calc.transportAux,
      deductions: isOff ? 0 : calc.deductions,

      totalHours: isOff ? 0 : calc.totalHours,
      hoursDay: isOff ? 0 : calc.hoursDay,
      hoursNight: isOff ? 0 : calc.hoursNight,

      // Se guardan los nuevos desgloses
      hOrdD: isOff ? 0 : calc.hOrdD, pOrdD: isOff ? 0 : calc.pOrdD,
      hOrdN: isOff ? 0 : calc.hOrdN, pOrdN: isOff ? 0 : calc.pOrdN,
      hDomD: isOff ? 0 : calc.hDomD, pDomD: isOff ? 0 : calc.pDomD,
      hDomN: isOff ? 0 : calc.hDomN, pDomN: isOff ? 0 : calc.pDomN,
      hExtD: isOff ? 0 : calc.hExtD, pExtD: isOff ? 0 : calc.pExtD,
      hExtN: isOff ? 0 : calc.hExtN, pExtN: isOff ? 0 : calc.pExtN,
      hExtDomD: isOff ? 0 : calc.hExtDomD, pExtDomD: isOff ? 0 : calc.pExtDomD,
      hExtDomN: isOff ? 0 : calc.hExtDomN, pExtDomN: isOff ? 0 : calc.pExtDomN,

      isOff,
      month: selectedMonth || mesesFull[new Date(targetDateStr + 'T00:00:00').getMonth()],
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
        <main className={`min-h-screen pb-24 font-sans transition-colors duration-500 ${role === 'CREW' ? 'bg-blue-50/60' : 'bg-red-50/60'}`}>
          <Navbar />
          <div className="max-w-5xl mx-auto p-6">

            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                {step > 1 && <button onClick={() => { setStep(step - 1); setSelectedDate(null); }} className="text-[10px] font-black text-gray-400 mb-1 hover:text-black">← ATRÁS</button>}
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-gray-900 leading-none">
                  {step === 1 && "Selecciona Mes"}
                  {step === 2 && `Quincenas ${selectedMonth}`}
                  {step === 3 && `Quincena ${selectedQuincena}`}
                </h1>
              </div>
              {step === 1 && (
                <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
                  <button onClick={() => setSelectedYear(selectedYear - 1)} className="text-gray-400 hover:text-black transition-colors font-black text-xl">←</button>
                  <span className="text-2xl font-black italic tracking-tighter">{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)} className="text-gray-400 hover:text-black transition-colors font-black text-xl">→</button>
                </div>
              )}
            </div>

            {step === 1 && (
              <div className="animate-in fade-in duration-500 space-y-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {mesesFull.map((m) => {
                    const isCurrentMonth = m === currentMonthName && selectedYear === currentYear;
                    return (
                      <button key={m} onClick={() => { setSelectedMonth(m); setStep(2); }}
                        className={`p-6 rounded-[2rem] shadow-sm font-black text-lg capitalize transition-all border hover:scale-105 active:scale-95
                        ${isCurrentMonth
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-800 ring-2 ring-yellow-100'
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
                <div className="flex justify-center">
                  <button onClick={handleQuickAddToday} className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-black hover:scale-105 transition-all flex items-center gap-3 group border border-gray-800">
                    <span className="text-2xl">⚡</span>
                    <div className="text-left"><p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Acceso Rápido</p><p className="text-lg">Agregar turno de HOY ({today.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })})</p></div>
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
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 p-4 rounded-2xl text-center border border-gray-100">
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
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 p-4 rounded-2xl text-center border border-gray-100">
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

                  <div className="flex items-center justify-between mb-8 px-2 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                    <div className="flex gap-1 md:gap-3">
                      <button onClick={handlePrevMonth} className="p-2 px-3 md:px-4 bg-white rounded-xl text-gray-400 hover:text-black hover:shadow-md font-black text-lg transition-all border border-gray-100" title="Mes Anterior">«</button>
                      <button onClick={handlePrevQuincena} className="p-2 px-3 md:px-4 bg-white rounded-xl text-gray-400 hover:text-black hover:shadow-md font-black text-lg transition-all border border-gray-100" title="Quincena Anterior">‹</button>
                    </div>

                    <div className="text-center">
                      <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-gray-900 leading-tight">
                        {selectedMonth} {selectedYear}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Quincena {selectedQuincena}</p>
                    </div>

                    <div className="flex gap-1 md:gap-3">
                      <button onClick={handleNextQuincena} className="p-2 px-3 md:px-4 bg-white rounded-xl text-gray-400 hover:text-black hover:shadow-md font-black text-lg transition-all border border-gray-100" title="Siguiente Quincena">›</button>
                      <button onClick={handleNextMonth} className="p-2 px-3 md:px-4 bg-white rounded-xl text-gray-400 hover:text-black hover:shadow-md font-black text-lg transition-all border border-gray-100" title="Mes Siguiente">»</button>
                    </div>
                  </div>

                  <Calendar
                    showNavigation={false}
                    onChange={(val) => setSelectedDate(val as Date)}
                    value={selectedDate}
                    activeStartDate={new Date(selectedYear, mesesFull.indexOf(selectedMonth), 1)}
                    tileClassName={({ date, view }) => {
                      const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      const s = shiftsDelAno.find(shift => shift.date === dStr);

                      if (s?.isOff) return '!bg-red-500 !text-white rounded-2xl font-bold !ring-1 !ring-black/20 shadow-sm';
                      if (s) return '!bg-green-500 !text-white rounded-2xl font-bold !ring-1 !ring-black/20 shadow-sm';

                      if (selectedDate && date.getTime() === selectedDate.getTime()) {
                        return '!bg-blue-100 !text-blue-600 rounded-2xl font-black !ring-1 !ring-blue-400';
                      }

                      const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                      if (isToday) return '!bg-yellow-100 text-yellow-800 font-black !ring-1 !ring-yellow-400 rounded-2xl';

                      if (date.getDay() === 0) return 'text-red-500 font-bold';

                      return 'text-gray-700 font-bold hover:bg-gray-100 rounded-2xl';
                    }}
                    tileDisabled={isDateDisabled}
                  />

                  <div className="mt-8 flex gap-4 transition-all duration-300">
                    <button
                      disabled={!selectedDate}
                      onClick={() => { setEditingShiftId(null); setShowModal(true); }}
                      className={`flex-1 py-4 rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest transition-all
                            ${selectedDate ? `${colors.secondary} text-white hover:brightness-110 active:scale-95 cursor-pointer` : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}
                    >
                      + Agregar Turno
                    </button>

                    <button
                      disabled={!selectedDate}
                      onClick={() => handleSaveShift(true)}
                      className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-transparent
                            ${selectedDate ? 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 cursor-pointer' : 'bg-gray-100/50 text-gray-300 cursor-not-allowed'}`}
                    >
                      Marcar OFF
                    </button>
                  </div>
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
                        <div key={s.id} onClick={() => !s.isOff && handleToggleExpand(s.id)} className={`transition-colors cursor-pointer group ${s.isOff ? '' : 'hover:bg-gray-50'}`}>
                          <div className="p-6 md:p-8 flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`w-3 h-3 rounded-full border border-black ${s.isOff ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                <p className="font-black text-xl text-gray-800 capitalize">
                                  {new Date(s.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}
                                </p>
                              </div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pl-6">
                                {s.isOff ? "Día de Descanso" : `${s.startTime} - ${s.endTime} • ${s.totalHours.toFixed(1)}h`}
                              </p>
                            </div>
                            <div className="text-right flex items-center gap-2 md:gap-4">
                              {!s.isOff && (<p className="font-black text-xl text-gray-900">${Math.floor(s.netPay).toLocaleString()}</p>)}
                              
                              {/* AQUÍ ESTÁ EL BOTÓN DE RECALCULAR NUEVO Y A LA DERECHA ESTÁ LA BASURA */}
                              <button onClick={(e) => handleOpenEdit(e, s)} className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-black hover:text-white transition-colors z-10" title="Editar Turno">✏️</button>
                              <button onClick={(e) => handleRecalculate(e, s)} className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-blue-500 hover:text-white transition-colors z-10" title="Recalcular rápido">🔄</button>
                              <button onClick={(e) => handleDelete(e, s.id)} className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-red-500 hover:text-white transition-colors z-10" title="Eliminar">🗑️</button>
                            </div>
                          </div>

                          {!s.isOff && expandedShiftId === s.id && (
                            <div className="px-8 pb-8 animate-in slide-in-from-top-2 fade-in duration-300">
                              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <div className="grid grid-cols-3 gap-4 text-center mb-4 pb-4 border-b border-gray-200/50">
                                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Base (Horas)</p><p className="font-bold text-gray-700">${Math.floor(s.salaryBase || 0).toLocaleString()}</p></div>
                                  <div><p className="text-[10px] font-bold text-green-500 uppercase">Aux. Transp</p><p className="font-bold text-green-700">+${Math.floor(s.transportAux || 0).toLocaleString()}</p></div>
                                  <div><p className="text-[10px] font-bold text-red-400 uppercase">Deducciones</p><p className="font-bold text-red-600">-${Math.floor(s.deductions || 0).toLocaleString()}</p></div>
                                </div>
                                <div className="flex justify-center gap-6 text-xs font-bold text-gray-500">
                                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-full border border-black"></span> Diurnas: {s.hoursDay?.toFixed(1) || 0}</span>
                                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-900 rounded-full border border-black"></span> Nocturnas: {s.hoursNight?.toFixed(1) || 0}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {turnosFiltrados.length > 0 && (
                    <div className="bg-gray-900 text-white flex flex-col mt-auto transition-all duration-300 rounded-b-[3rem]">
                      
                      {/* BOTÓN DESPLEGABLE EN LA BARRA NEGRA */}
                      <div 
                        onClick={() => setIsTotalExpanded(!isTotalExpanded)} 
                        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-black transition-colors rounded-b-[3rem]"
                      >
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2 tracking-widest">
                            Horas {isTotalExpanded ? '▲' : '▼'}
                          </p>
                          <p className="text-xl md:text-2xl font-black">{totalListaHoras.toFixed(1)} h</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Neto</p>
                          <p className="text-3xl md:text-4xl font-black text-yellow-400 tracking-tighter">${Math.floor(totalListaDinero).toLocaleString()}</p>
                        </div>
                      </div>

                      {/* EL PANEL DESGLOSADO DE 8 HORAS CON VALOR EN PESOS */}
                      {isTotalExpanded && (
                        <div className="bg-[#111] px-6 md:px-8 pb-10 pt-6 animate-in slide-in-from-top-2 border-t border-gray-800 rounded-b-[3rem]">
                           <p className="text-[10px] font-black uppercase text-gray-600 tracking-widest mb-6 text-center">Desglose Exacto Quincenal</p>
                           
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 text-center">
                              {/* Ordinarias */}
                              <div className={tOrdD_h > 0 ? "" : "opacity-30"}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Ord. Diurna</p>
                                <p className={`font-black text-lg ${tOrdD_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tOrdD_h.toFixed(1)} h</p>
                                <p className="text-[10px] font-bold text-gray-500">${Math.floor(tOrdD_p).toLocaleString()}</p>
                              </div>
                              <div className={tOrdN_h > 0 ? "" : "opacity-30"}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Ord. Nocturna</p>
                                <p className={`font-black text-lg ${tOrdN_h > 0 ? 'text-blue-300' : 'text-gray-600'}`}>{tOrdN_h.toFixed(1)} h</p>
                                <p className="text-[10px] font-bold text-gray-500">${Math.floor(tOrdN_p).toLocaleString()}</p>
                              </div>
                              
                              {/* Dominicales */}
                              <div className={tDomD_h > 0 ? "" : "opacity-30"}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Dom/Fest Diurno</p>
                                <p className={`font-black text-lg ${tDomD_h > 0 ? 'text-orange-400' : 'text-gray-600'}`}>{tDomD_h.toFixed(1)} h</p>
                                <p className="text-[10px] font-bold text-gray-500">${Math.floor(tDomD_p).toLocaleString()}</p>
                              </div>
                              <div className={tDomN_h > 0 ? "" : "opacity-30"}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Dom/Fest Noct</p>
                                <p className={`font-black text-lg ${tDomN_h > 0 ? 'text-orange-600' : 'text-gray-600'}`}>{tDomN_h.toFixed(1)} h</p>
                                <p className="text-[10px] font-bold text-gray-500">${Math.floor(tDomN_p).toLocaleString()}</p>
                              </div>
                              
                              {/* Extras */}
                              <div className={tExtD_h > 0 ? "" : "opacity-30"}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Extra Diurna</p>
                                <p className={`font-black text-lg ${tExtD_h > 0 ? 'text-red-400' : 'text-gray-600'}`}>{tExtD_h.toFixed(1)} h</p>
                                <p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtD_p).toLocaleString()}</p>
                              </div>
                              <div className={tExtN_h > 0 ? "" : "opacity-30"}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Extra Nocturna</p>
                                <p className={`font-black text-lg ${tExtN_h > 0 ? 'text-red-600' : 'text-gray-600'}`}>{tExtN_h.toFixed(1)} h</p>
                                <p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtN_p).toLocaleString()}</p>
                              </div>
                              
                              {/* Extras Dominicales */}
                              <div className={tExtDomD_h > 0 ? "" : "opacity-30"}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Extra Dom. D.</p>
                                <p className={`font-black text-lg ${tExtDomD_h > 0 ? 'text-purple-400' : 'text-gray-600'}`}>{tExtDomD_h.toFixed(1)} h</p>
                                <p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtDomD_p).toLocaleString()}</p>
                              </div>
                              <div className={tExtDomN_h > 0 ? "" : "opacity-30"}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Extra Dom. N.</p>
                                <p className={`font-black text-lg ${tExtDomN_h > 0 ? 'text-purple-600' : 'text-gray-600'}`}>{tExtDomN_h.toFixed(1)} h</p>
                                <p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtDomN_p).toLocaleString()}</p>
                              </div>
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {showModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 animate-in zoom-in-95 border border-gray-100 shadow-2xl">
                <h3 className="text-2xl font-black mb-8 text-center uppercase italic">{editingShiftId ? 'Editar Turno' : 'Nuevo Turno'}</h3>
                {selectedDate && <p className="text-center text-gray-400 font-bold mb-6">{selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}

                <div className="space-y-6 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Entrada</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl font-black border-none outline-none focus:ring-2 ring-black" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Salida</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-4 bg-gray-100 rounded-2xl font-black border-none outline-none focus:ring-2 ring-black" /></div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-center mb-2"><span className="text-xs font-black uppercase text-gray-500">Break Manual</span><input type="checkbox" className="w-5 h-5 accent-black" checked={isManualBreak} onChange={() => setIsManualBreak(!isManualBreak)} /></div>
                    {isManualBreak && <div className="grid grid-cols-2 gap-2 mt-3"><input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="p-3 bg-white rounded-xl text-xs font-bold shadow-sm border border-gray-100" /><input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="p-3 bg-white rounded-xl text-xs font-bold shadow-sm border border-gray-100" /></div>}
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 font-bold text-gray-400 hover:text-black">CANCELAR</button>
                  <button onClick={() => handleSaveShift(false)} className={`${colors.secondary} flex-[2] py-4 rounded-2xl text-white font-black shadow-xl hover:scale-105 transition-transform border border-black`}>GUARDAR</button>
                </div>
              </div>
            </div>
          )}

          <style jsx global>{`
            .react-calendar { width: 100% !important; border: none !important; font-family: inherit; background: transparent !important; }
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