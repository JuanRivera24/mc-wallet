"use client";
import { useState, useEffect, useMemo } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useTheme } from "@/context/ThemeContext";
import { calculateShift } from "@/lib/calculator";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import PayrollFeedback from "@/components/PayrollFeedback";
import { motion } from "framer-motion"; 

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function NominasPage() {
  const { user } = useUser();
  const { colors, role, isDarkMode } = useTheme();

  const [isMounted, setIsMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuincena, setSelectedQuincena] = useState<number | null>(null);

  useEffect(() => {
    const storedYear = localStorage.getItem('mc_year');
    const storedMonth = localStorage.getItem('mc_month');
    const storedQuincena = localStorage.getItem('mc_quincena');

    if (storedYear) setSelectedYear(parseInt(storedYear, 10));
    if (storedMonth) setSelectedMonth(storedMonth);
    if (storedQuincena) setSelectedQuincena(parseInt(storedQuincena, 10));

    const params = new URLSearchParams(window.location.search);
    let urlStep = parseInt(params.get('step') || '1', 10);

    if (urlStep > 1 && !storedMonth) {
      urlStep = 1;
      window.history.replaceState({ step: 1 }, '', '?step=1');
    }

    setStep(urlStep);
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('mc_year', selectedYear.toString());
    if (selectedMonth) localStorage.setItem('mc_month', selectedMonth);
    if (selectedQuincena !== null) localStorage.setItem('mc_quincena', selectedQuincena.toString());
  }, [selectedYear, selectedMonth, selectedQuincena, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    const syncStepWithUrl = () => {
      const params = new URLSearchParams(window.location.search);
      let urlStep = parseInt(params.get('step') || '1', 10);
      
      if (urlStep > 1 && !localStorage.getItem('mc_month')) {
        urlStep = 1;
        window.history.replaceState({ step: 1 }, '', '?step=1');
      }

      setStep(urlStep);
      if (urlStep < 3) setSelectedDate(null);
    };

    window.addEventListener('popstate', syncStepWithUrl);
    return () => window.removeEventListener('popstate', syncStepWithUrl);
  }, [isMounted]);

  const [shifts, setShifts] = useState<any[]>([]);
  const [bigVentas, setBigVentas] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  
  const [isTotalExpanded, setIsTotalExpanded] = useState(false);
  const [hasBigVenta, setHasBigVenta] = useState(false);
  const [isEditingBigVenta, setIsEditingBigVenta] = useState(false);
  const [bigVentaValue, setBigVentaValue] = useState<number | "">("");

  // ESTADOS DEL FORMULARIO Y BREAK
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("20:00");
  const [hasBreak, setHasBreak] = useState(true);
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:30");
  const [breakEnd, setBreakEnd] = useState("17:00");
  const [breakError, setBreakError] = useState<string | null>(null);

  const mesesFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const today = new Date();
  const currentMonthName = mesesFull[today.getMonth()];
  const currentYear = today.getFullYear();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const goToStep = (newStep: number) => {
    window.history.pushState({ step: newStep }, '', `?step=${newStep}`);
    setStep(newStep);
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "shifts"), where("userId", "==", user.id), where("year", "==", selectedYear));
    const unsub = onSnapshot(q, (snap) => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [user, selectedYear]);

  useEffect(() => {
    if (!user) return;
    const qBV = query(collection(db, "bigVentas"), where("userId", "==", user.id), where("year", "==", selectedYear));
    const unsubBV = onSnapshot(qBV, (snap) => setBigVentas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubBV();
  }, [user, selectedYear]);

  // CÁLCULO ASIMÉTRICO REDONDEADO (Usado en múltiples partes para evitar errores)
  const autoCalculateBreak = (start: string, end: string) => {
    const [hStart, mStart] = start.split(":").map(Number);
    const [hEnd, mEnd] = end.split(":").map(Number);
    let startMins = hStart * 60 + mStart;
    let endMins = hEnd * 60 + mEnd;
    if (endMins <= startMins) endMins += 24 * 60; 

    const midMins = Math.floor((startMins + endMins) / 2);
    
    // Calcula la mitad, resta 15 min, y lo fuerza al bloque de 30 min más cercano (:00 o :30)
    let bStartMins = midMins - 15;
    bStartMins = Math.round(bStartMins / 30) * 30;
    const bEndMins = bStartMins + 30; 

    const formatTime = (totalMins: number) => {
      const h = Math.floor((totalMins % (24 * 60)) / 60).toString().padStart(2, "0");
      const m = (totalMins % 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };
    
    setBreakStart(formatTime(bStartMins));
    setBreakEnd(formatTime(bEndMins));
  };

  // VIGILANTE DE ERRORES (Avisa si la hora del break queda fuera del turno)
  useEffect(() => {
    if (!hasBreak || !isManualBreak || !showModal) {
      setBreakError(null);
      return;
    }
    const [hS, mS] = startTime.split(":").map(Number);
    const [hE, mE] = endTime.split(":").map(Number);
    const [hBS, mBS] = breakStart.split(":").map(Number);
    const [hBE, mBE] = breakEnd.split(":").map(Number);

    let sMins = hS * 60 + mS;
    let eMins = hE * 60 + mE;
    if (eMins <= sMins) eMins += 24 * 60;

    let bsMins = hBS * 60 + mBS;
    let beMins = hBE * 60 + mBE;

    if (bsMins < sMins && eMins > 24 * 60) bsMins += 24 * 60;
    if (beMins < sMins && eMins > 24 * 60) beMins += 24 * 60;

    if (bsMins < sMins || beMins > eMins) setBreakError("🚨 Break por fuera del turno.");
    else if (beMins <= bsMins) setBreakError("🚨 Hora fin inválida.");
    else setBreakError(null);
  }, [startTime, endTime, breakStart, breakEnd, hasBreak, isManualBreak, showModal]);

  const shiftsDelAno = useMemo(() => shifts.filter(s => s.year === selectedYear), [shifts, selectedYear]);
  const todayShift = useMemo(() => shiftsDelAno.find(s => s.date === todayStr), [shiftsDelAno, todayStr]);

  const statsAnuales = useMemo(() => {
    const dataMeses = mesesFull.map(m => {
      const turnosNeto = shiftsDelAno.filter(s => s.month === m).reduce((acc, curr) => acc + (curr.netPay || 0), 0);
      const bvNeto = bigVentas.filter(b => b.month === m).reduce((acc, curr) => acc + (curr.value * 0.92), 0);
      return turnosNeto + bvNeto;
    });

    return {
      labels: mesesFull.map(m => m.substring(0, 3).toUpperCase()),
      // Regresamos al color primario estético para el año completo
      datasets: [{ label: 'Neto', data: dataMeses, backgroundColor: colors.secondary, borderRadius: 6 }]
    };
  }, [shiftsDelAno, bigVentas, colors.secondary]);

  const statsQuincenas = useMemo(() => {
    const shiftsMes = shiftsDelAno.filter(s => s.month === selectedMonth);
    const bvMes = bigVentas.filter(b => b.month === selectedMonth);

    const calcQ = (isQ1: boolean) => {
      const filteredShifts = shiftsMes.filter(s => {
        const day = parseInt(s.date.split('-')[2]);
        return isQ1 ? day <= 15 : day > 15;
      });
      const filteredBV = bvMes.find(b => b.quincena === (isQ1 ? 1 : 2));
      const bvNeto = filteredBV ? filteredBV.value * 0.92 : 0;

      return {
        dinero: filteredShifts.reduce((a, b) => a + (b.netPay || 0), 0) + bvNeto,
        horas: filteredShifts.reduce((a, b) => a + (b.totalHours || 0), 0),
        diasTrabajados: filteredShifts.filter(s => !s.isOff).length,
        diasOff: filteredShifts.filter(s => s.isOff).length
      };
    };
    const q1 = calcQ(true);
    const q2 = calcQ(false);

    // Color primario para Q1, y un gris balanceado para Q2 que se ve bien en ambos modos
    const chartColors = [colors.secondary, isDarkMode ? '#374151' : '#d1d5db'];

    return {
      q1, q2, 
      chartData: {
        labels: ['Q1', 'Q2'],
        datasets: [{ label: 'Dinero', data: [q1.dinero, q2.dinero], backgroundColor: chartColors, borderRadius: 10 }]
      },
      chartDataHours: {
        labels: ['Q1', 'Q2'],
        datasets: [{ label: 'Horas', data: [q1.horas, q2.horas], backgroundColor: chartColors, borderRadius: 10 }]
      }
    };
  }, [shiftsDelAno, bigVentas, selectedMonth, colors.secondary, isDarkMode]);

  const turnosFiltrados = useMemo(() => {
    return shiftsDelAno.filter(s => {
      const day = parseInt(s.date.split('-')[2]);
      const matchMonth = s.month === selectedMonth;
      const matchQuincena = selectedQuincena === 1 ? day <= 15 : day > 15;
      return matchMonth && matchQuincena;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [shiftsDelAno, selectedMonth, selectedQuincena]);

  const currentBigVenta = bigVentas.find(b => b.month === selectedMonth && b.quincena === selectedQuincena);
  const bigVentaNeto = currentBigVenta ? currentBigVenta.value * 0.92 : 0;
  const bigVentaDeduccion = currentBigVenta ? currentBigVenta.value * 0.08 : 0;

  const baseDineroTurnos = turnosFiltrados.reduce((acc, curr) => acc + (curr.netPay || 0), 0);
  const totalListaDinero = baseDineroTurnos + bigVentaNeto;
  const totalListaHoras = turnosFiltrados.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
  const countTrabajados = turnosFiltrados.filter(s => !s.isOff).length;
  const countOff = turnosFiltrados.filter(s => s.isOff).length;

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
  const tTransportAux = turnosFiltrados.reduce((a, c) => a + (c.transportAux || 0), 0);
  const tDeductionsBase = turnosFiltrados.reduce((a, c) => a + (c.deductions || 0), 0);
  const tDeductionsFinal = tDeductionsBase + bigVentaDeduccion;

  const getLastDayOfMonth = () => new Date(selectedYear, mesesFull.indexOf(selectedMonth) + 1, 0).getDate();
  const getDineroColor = (dinero: number) => {
    if (dinero < 800000) return "text-red-500 dark:text-red-400";
    if (dinero < 1000000) return "text-orange-500 dark:text-orange-400";
    if (dinero < 1250000) return "text-green-400 dark:text-green-300"; 
    return "text-green-600 dark:text-green-500"; 
  };

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

  // LIMPITO AL ABRIR NUEVO
  const handleOpenNew = () => {
    setEditingShiftId(null);
    setStartTime("13:00");
    setEndTime("20:00");
    setHasBreak(true);
    setIsManualBreak(false);
    setBreakStart("16:30"); 
    setBreakEnd("17:00");
    setShowModal(true);
  };

  const handleQuickAddToday = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(mesesFull[today.getMonth()]);
    setSelectedDate(today);
    handleOpenNew(); 
  };

  // RESPETA TUS HORAS AL EDITAR O LAS CALCULA PERFECTAS SI ES VIEJO
  const handleOpenEdit = (e: React.MouseEvent, shift: any) => {
    e.stopPropagation();
    setEditingShiftId(shift.id);

    const [year, month, day] = shift.date.split('-');
    setSelectedDate(new Date(Number(year), Number(month) - 1, Number(day)));

    const sTime = shift.startTime || "14:00";
    const eTime = shift.endTime || "22:00";
    setStartTime(sTime);
    setEndTime(eTime);
    
    const shiftHasBreak = shift.hasBreak !== undefined ? shift.hasBreak : true;
    setHasBreak(shiftHasBreak);
    
    if (shiftHasBreak) {
      if (shift.breakStart && shift.breakEnd) {
        setBreakStart(shift.breakStart);
        setBreakEnd(shift.breakEnd);
      } else {
        // CORRECCIÓN: Si es un turno viejo, le aplica la misma magia redonda (:00 o :30)
        const [hS, mS] = sTime.split(":").map(Number);
        const [hE, mE] = eTime.split(":").map(Number);
        let sMins = hS * 60 + mS;
        let eMins = hE * 60 + mE;
        if (eMins <= sMins) eMins += 24 * 60;
        const midMins = Math.floor((sMins + eMins) / 2);
        
        let bStartMins = midMins - 15;
        bStartMins = Math.round(bStartMins / 30) * 30; // REDONDEO PERFECTO
        
        const formatTime = (totalMins: number) => {
          const h = Math.floor((totalMins % (24 * 60)) / 60).toString().padStart(2, "0");
          const m = (totalMins % 60).toString().padStart(2, "0");
          return `${h}:${m}`;
        };
        setBreakStart(formatTime(bStartMins));
        setBreakEnd(formatTime(bStartMins + 30));
      }
      setIsManualBreak(true); 
    } else {
      setBreakStart("16:00");
      setBreakEnd("16:30");
      setIsManualBreak(false);
    }
    setShowModal(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("¿Eliminar turno?")) deleteDoc(doc(db, "shifts", id));
  }

  // RECALCULAR AHORA RESPETA EL BREAK GUARDADO
  const handleRecalculate = async (e: React.MouseEvent, shift: any) => {
    e.stopPropagation();
    if (!user || shift.isOff) return; 

    const shiftHasBreak = shift.hasBreak !== undefined ? shift.hasBreak : true;
    
    let exactSavedBreak = undefined;
    if (shiftHasBreak && shift.breakStart && shift.breakEnd) {
      exactSavedBreak = { start: shift.breakStart, end: shift.breakEnd };
    }

    const calc = calculateShift(shift.date, shift.startTime, shift.endTime, exactSavedBreak, role, shiftHasBreak);
    
    const payload: any = {
      ...shift, ...calc, 
      hOrdD: calc.hOrdD, pOrdD: calc.pOrdD,
      hOrdN: calc.hOrdN, pOrdN: calc.pOrdN,
      hDomD: calc.hDomD, pDomD: calc.pDomD,
      hDomN: calc.hDomN, pDomN: calc.pDomN,
      hExtD: calc.hExtD, pExtD: calc.pExtD,
      hExtN: calc.hExtN, pExtN: calc.pExtN,
      hExtDomD: calc.hExtDomD, pExtDomD: calc.pExtDomD,
      hExtDomN: calc.hExtDomN, pExtDomN: calc.pExtDomN,
      timestamp: serverTimestamp() 
    };
    await setDoc(doc(db, "shifts", shift.id), payload, { merge: true });
  };

  const handleToggleExpand = (id: string) => setExpandedShiftId(expandedShiftId === id ? null : id);

  const handleSaveShift = async (isOff: boolean = false) => {
    if (!user || breakError) return;
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
    const finalBreak = (!isOff && hasBreak) ? { start: breakStart, end: breakEnd } : undefined;

    const calc = calculateShift(targetDateStr, startTime, endTime, finalBreak, role, hasBreak);

    const payload: any = {
      userId: user.id,
      date: targetDateStr,
      startTime: isOff ? "" : startTime,
      endTime: isOff ? "" : endTime,
      
      hasBreak: isOff ? false : hasBreak,
      isManualBreak: isOff ? false : isManualBreak,
      breakStart: isOff ? "" : breakStart,
      breakEnd: isOff ? "" : breakEnd,

      netPay: isOff ? 0 : calc.netPay,
      salaryBase: isOff ? 0 : calc.salaryBase,
      transportAux: isOff ? 0 : calc.transportAux,
      deductions: isOff ? 0 : calc.deductions,
      totalHours: isOff ? 0 : calc.totalHours,
      hoursDay: isOff ? 0 : calc.hoursDay,
      hoursNight: isOff ? 0 : calc.hoursNight,
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

  const saveBigVenta = async () => {
    if (!user || !bigVentaValue) return;
    const val = Number(bigVentaValue);
    if (val <= 0) return;

    const docId = `${user.id}_BV_${selectedYear}_${selectedMonth}_${selectedQuincena}`;
    await setDoc(doc(db, "bigVentas", docId), {
      userId: user.id,
      year: selectedYear,
      month: selectedMonth,
      quincena: selectedQuincena,
      value: val,
      timestamp: serverTimestamp()
    });
    setHasBigVenta(false);
    setIsEditingBigVenta(false);
    setBigVentaValue("");
  };

  const deleteBigVenta = async (id: string) => {
    if (confirm("¿Eliminar Big Venta? Esto restará el dinero de tus ingresos netos.")) {
      await deleteDoc(doc(db, "bigVentas", id));
      setIsEditingBigVenta(false);
      setHasBigVenta(false);
    }
  };

  const isDateDisabled = ({ date }: { date: Date }) => {
    if (date.getFullYear() !== selectedYear || date.getMonth() !== mesesFull.indexOf(selectedMonth)) return true;
    const day = date.getDate();
    return selectedQuincena === 1 ? day > 15 : day <= 15;
  };

  if (!isMounted) {
    return (
      <main className={`min-h-screen flex items-center justify-center font-sans ${isDarkMode ? 'bg-[#0a0a0a]' : (role === 'CREW' ? 'bg-blue-50/60' : 'bg-red-50/60')}`}>
        <p className="text-gray-400 font-bold animate-pulse uppercase tracking-widest">Cargando datos...</p>
      </main>
    );
  }

  return (
    <>
      <SignedOut><RedirectToSignIn /></SignedOut>
      <SignedIn>
        <main className={`min-h-screen font-sans transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a]' : (role === 'CREW' ? 'bg-blue-50/60' : 'bg-red-50/60')}`}>
          <Navbar />
          
          <motion.button
            drag
            dragMomentum={false}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => todayShift ? handleOpenEdit(e, todayShift) : handleQuickAddToday()}
            className="fixed bottom-24 right-6 w-14 h-14 bg-gray-500/50 backdrop-blur-md rounded-full shadow-2xl border border-gray-300/30 flex items-center justify-center text-2xl z-[90] text-white hover:bg-gray-500/70 transition-colors"
          >
            {todayShift ? "✏️" : "➕"}
          </motion.button>

          <div className="max-w-5xl mx-auto p-6">

            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                {step > 1 && <button onClick={() => { window.history.back(); setSelectedDate(null); }} className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 hover:text-black dark:hover:text-white transition-colors">← ATRÁS</button>}
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-gray-900 dark:text-white leading-none transition-colors">
                  {step === 1 && "Selecciona Mes"}
                  {step === 2 && `Quincenas ${selectedMonth || "..."}`}
                  {step === 3 && `Quincena ${selectedQuincena || "..."}`}
                </h1>
              </div>
              {step === 1 && (
                <div className="flex items-center gap-4 bg-white dark:bg-gray-900 px-6 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
                  <button onClick={() => setSelectedYear(selectedYear - 1)} className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition-colors font-black text-xl">←</button>
                  <span className="text-2xl font-black italic tracking-tighter dark:text-white">{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)} className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition-colors font-black text-xl">→</button>
                </div>
              )}
            </div>

            {step === 1 && (
              <div className="animate-in fade-in duration-500 space-y-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {mesesFull.map((m) => {
                    const isCurrentMonth = m === currentMonthName && selectedYear === currentYear;
                    return (
                      <button key={m} onClick={() => { setSelectedMonth(m); goToStep(2); }}
                        className={`p-6 rounded-[2rem] shadow-sm font-black text-lg capitalize transition-all border hover:scale-105 active:scale-95
                        ${isCurrentMonth
                          ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700/50 text-yellow-800 dark:text-yellow-500 ring-2 ring-yellow-100 dark:ring-yellow-900/50'
                          : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-300 border-transparent dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                        }`}>
                        {m}
                      </button>
                    );
                  })}
                </div>
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-gray-800 transition-colors">
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-6 tracking-[0.2em] text-center">Resumen Anual {selectedYear}</p>
                  <div className="h-64"><Bar data={statsAnuales} options={{ maintainAspectRatio: false, color: isDarkMode ? '#9ca3af' : '#6b7280' }} /></div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in slide-in-from-right-8 duration-500 space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div onClick={() => { setSelectedQuincena(1); goToStep(3); }} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-xl cursor-pointer hover:scale-[1.02] transition-transform border border-transparent dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-5xl font-black text-gray-900 dark:text-white block">01</span>
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Días 01 - 15</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-black tracking-tighter transition-colors ${getDineroColor(statsQuincenas.q1.dinero)}`}>
                          ${Math.floor(statsQuincenas.q1.dinero).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Acumulado</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-center border border-gray-100 dark:border-gray-700">
                      <div><p className="text-xl font-black dark:text-white">{statsQuincenas.q1.horas.toFixed(1)}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Horas</p></div>
                      <div><p className="text-xl font-black text-green-600 dark:text-green-400">{statsQuincenas.q1.diasTrabajados}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Días Job</p></div>
                      <div><p className="text-xl font-black text-red-500 dark:text-red-400">{statsQuincenas.q1.diasOff}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Días Off</p></div>
                    </div>
                  </div>
                  
                  <div onClick={() => { setSelectedQuincena(2); goToStep(3); }} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-xl cursor-pointer hover:scale-[1.02] transition-transform border border-transparent dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-5xl font-black text-gray-900 dark:text-white block">02</span>
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Días 16 - {getLastDayOfMonth()}</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-black tracking-tighter transition-colors ${getDineroColor(statsQuincenas.q2.dinero)}`}>
                          ${Math.floor(statsQuincenas.q2.dinero).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Acumulado</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-center border border-gray-100 dark:border-gray-700">
                      <div><p className="text-xl font-black dark:text-white">{statsQuincenas.q2.horas.toFixed(1)}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Horas</p></div>
                      <div><p className="text-xl font-black text-green-600 dark:text-green-400">{statsQuincenas.q2.diasTrabajados}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Días Job</p></div>
                      <div><p className="text-xl font-black text-red-500 dark:text-red-400">{statsQuincenas.q2.diasOff}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Días Off</p></div>
                    </div>
                  </div>
                </div>

                {/* NUEVAS GRÁFICAS DOBLES PARA STEP 2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm h-72 border border-gray-50 dark:border-gray-800 transition-colors flex flex-col">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-4 tracking-[0.2em] text-center">Ingresos Q1 vs Q2</p>
                    <div className="flex-1">
                      <Bar data={statsQuincenas.chartData} options={{ maintainAspectRatio: false, color: isDarkMode ? '#9ca3af' : '#6b7280' }} />
                    </div> 
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm h-72 border border-gray-50 dark:border-gray-800 transition-colors flex flex-col">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-4 tracking-[0.2em] text-center">Horas Q1 vs Q2</p>
                    <div className="flex-1">
                      <Bar data={statsQuincenas.chartDataHours} options={{ maintainAspectRatio: false, color: isDarkMode ? '#9ca3af' : '#6b7280' }} />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {step === 3 && selectedMonth && selectedQuincena && (
              <div className="animate-in zoom-in-95 duration-500 space-y-8">
                <div className="bg-white dark:bg-gray-900 p-6 md:p-10 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 transition-colors">

                  <div className="flex items-center justify-between mb-8 px-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700">
                    <div className="flex gap-1 md:gap-3">
                      <button onClick={handlePrevMonth} className="p-2 px-3 md:px-4 bg-white dark:bg-gray-900 rounded-xl text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white hover:shadow-md font-black text-lg transition-all border border-gray-100 dark:border-gray-700" title="Mes Anterior">«</button>
                      <button onClick={handlePrevQuincena} className="p-2 px-3 md:px-4 bg-white dark:bg-gray-900 rounded-xl text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white hover:shadow-md font-black text-lg transition-all border border-gray-100 dark:border-gray-700" title="Quincena Anterior">‹</button>
                    </div>

                    <div className="text-center">
                      <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-gray-900 dark:text-white leading-tight">
                        {selectedMonth} {selectedYear}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Quincena {selectedQuincena}</p>
                    </div>

                    <div className="flex gap-1 md:gap-3">
                      <button onClick={handleNextQuincena} className="p-2 px-3 md:px-4 bg-white dark:bg-gray-900 rounded-xl text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white hover:shadow-md font-black text-lg transition-all border border-gray-100 dark:border-gray-700" title="Siguiente Quincena">›</button>
                      <button onClick={handleNextMonth} className="p-2 px-3 md:px-4 bg-white dark:bg-gray-900 rounded-xl text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white hover:shadow-md font-black text-lg transition-all border border-gray-100 dark:border-gray-700" title="Mes Siguiente">»</button>
                    </div>
                  </div>

                  <Calendar
                    showNavigation={false}
                    onChange={(val) => setSelectedDate(val as Date)}
                    value={selectedDate}
                    activeStartDate={new Date(selectedYear, mesesFull.indexOf(selectedMonth), 1)}
                    tileClassName={({ date }) => {
                      const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      const s = shiftsDelAno.find(shift => shift.date === dStr);
                      const isDisabled = isDateDisabled({ date });

                      let classes = 'font-bold rounded-2xl transition-all ';

                      if (isDisabled) {
                        classes += 'opacity-20 saturate-50 cursor-not-allowed ';
                      } else {
                        classes += 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ';
                      }

                      if (s?.isOff) return classes + '!bg-red-500 !text-white !ring-1 !ring-black/20 shadow-sm';
                      if (s) return classes + '!bg-green-500 !text-white !ring-1 !ring-black/20 shadow-sm';

                      if (selectedDate && date.getTime() === selectedDate.getTime()) {
                        return classes + '!bg-blue-100 dark:!bg-blue-900/50 !text-blue-600 dark:!text-blue-300 !ring-1 !ring-blue-400 font-black';
                      }

                      const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                      if (isToday) return classes + '!bg-yellow-100 dark:!bg-yellow-900/40 text-yellow-800 dark:!text-yellow-500 font-black !ring-1 !ring-yellow-400';

                      if (date.getDay() === 0) return classes + 'text-red-500 dark:text-red-400';

                      return classes + 'text-gray-700 dark:text-gray-300';
                    }}
                    tileDisabled={isDateDisabled}
                  />

                  <div className="mt-8 flex gap-4 transition-all duration-300">
                    <button
                      disabled={!selectedDate}
                      onClick={() => { setSelectedDate(selectedDate); handleOpenNew(); }}
                      className={`flex-1 py-4 rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest transition-all
                            ${selectedDate ? `${colors.secondary} text-white hover:brightness-110 active:scale-95 cursor-pointer` : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none'}`}
                    >
                      + Agregar Turno
                    </button>

                    <button
                      disabled={!selectedDate}
                      onClick={() => handleSaveShift(true)}
                      className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-transparent
                            ${selectedDate ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 cursor-pointer' : 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
                    >
                      Marcar OFF
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
                  <div className="p-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-black italic uppercase dark:text-white">Turnos Registrados</h2>
                    <div className="flex gap-4">
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-full border border-green-100 dark:border-green-800">Trabajados: {countTrabajados}</span>
                      <span className="text-xs font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-4 py-2 rounded-full border border-red-100 dark:border-red-800">OFF: {countOff}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[500px] overflow-y-auto">
                    {turnosFiltrados.length === 0 ? (
                      <div className="p-10 text-center text-gray-300 dark:text-gray-600 font-bold italic">No hay turnos registrados en esta quincena.</div>
                    ) : (
                      turnosFiltrados.map((s) => (
                        <div key={s.id} onClick={() => !s.isOff && handleToggleExpand(s.id)} className={`transition-colors cursor-pointer group ${s.isOff ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                          <div className="p-6 md:p-8 flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`w-3 h-3 rounded-full border border-black dark:border-transparent ${s.isOff ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                <p className="font-black text-xl text-gray-800 dark:text-gray-200 capitalize">
                                  {new Date(s.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}
                                </p>
                              </div>
                              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide pl-6">
                                {s.isOff ? "Día de Descanso" : `${s.startTime} - ${s.endTime} • ${s.totalHours.toFixed(1)}h`}
                              </p>
                            </div>
                            <div className="text-right flex items-center gap-2 md:gap-4">
                              {!s.isOff && (<p className="font-black text-xl text-gray-900 dark:text-white">${Math.floor(s.netPay).toLocaleString()}</p>)}
                              
                              <button onClick={(e) => handleOpenEdit(e, s)} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors z-10" title="Editar Turno">✏️</button>
                              <button onClick={(e) => handleRecalculate(e, s)} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-blue-500 dark:hover:bg-blue-600 hover:text-white transition-colors z-10" title="Recalcular rápido">🔄</button>
                              <button onClick={(e) => handleDelete(e, s.id)} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-red-500 dark:hover:bg-red-600 hover:text-white transition-colors z-10" title="Eliminar">🗑️</button>
                            </div>
                          </div>

                          {!s.isOff && expandedShiftId === s.id && (
                            <div className="px-8 pb-8 animate-in slide-in-from-top-2 fade-in duration-300">
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 transition-colors">
                                <div className="grid grid-cols-3 gap-4 text-center mb-4 pb-4 border-b border-gray-200/50 dark:border-gray-700">
                                  <div><p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Base (Horas)</p><p className="font-bold text-gray-700 dark:text-gray-300">${Math.floor(s.salaryBase || 0).toLocaleString()}</p></div>
                                  <div><p className="text-[10px] font-bold text-green-500 uppercase">Aux. Transp</p><p className="font-bold text-green-700 dark:text-green-400">+${Math.floor(s.transportAux || 0).toLocaleString()}</p></div>
                                  <div><p className="text-[10px] font-bold text-red-400 uppercase">Deducciones</p><p className="font-bold text-red-600 dark:text-red-400">-${Math.floor(s.deductions || 0).toLocaleString()}</p></div>
                                </div>
                                <div className="flex justify-center gap-6 text-xs font-bold text-gray-500 dark:text-gray-400">
                                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-full border border-black dark:border-transparent"></span> Diurnas: {s.hoursDay?.toFixed(1) || 0}</span>
                                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-900 dark:bg-blue-500 rounded-full border border-black dark:border-transparent"></span> Nocturnas: {s.hoursNight?.toFixed(1) || 0}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {turnosFiltrados.length > 0 && (
                    <div className="bg-gray-900 dark:bg-[#111] text-white flex flex-col mt-auto transition-all duration-300 rounded-b-[3rem]">
                      
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
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Neto a Recibir</p>
                          <p className={`text-3xl md:text-4xl font-black tracking-tighter ${getDineroColor(totalListaDinero)}`}>${Math.floor(totalListaDinero).toLocaleString()}</p>
                        </div>
                      </div>

                      {isTotalExpanded && (
                        <div className="bg-[#111] dark:bg-black px-6 md:px-8 pb-10 pt-6 animate-in slide-in-from-top-2 border-t border-gray-800 rounded-b-[3rem]">
                           <p className="text-[10px] font-black uppercase text-gray-600 tracking-widest mb-6 text-center">Desglose Exacto Quincenal</p>
                           
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 text-center">
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

                              <div className="col-span-2 md:col-span-4 border-t border-gray-800/50 pt-6 mt-2"></div>
                              
                              <div className={`col-span-1 md:col-span-2 ${tTransportAux > 0 ? "" : "opacity-30"}`}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Total Aux. Transporte</p>
                                <p className={`font-black text-2xl ${tTransportAux > 0 ? 'text-green-400' : 'text-gray-600'}`}>+${Math.floor(tTransportAux).toLocaleString()}</p>
                              </div>
                              
                              <div className={`col-span-1 md:col-span-2 ${tDeductionsFinal > 0 ? "" : "opacity-30"}`}>
                                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Total Deducciones</p>
                                <p className={`font-black text-2xl ${tDeductionsFinal > 0 ? 'text-red-400' : 'text-gray-600'}`}>-${Math.floor(tDeductionsFinal).toLocaleString()}</p>
                              </div>
                           </div>

                           <div className="mt-8 pt-8 border-t border-gray-800/50 flex flex-col w-full">
                             {currentBigVenta && !isEditingBigVenta ? (
                                <div className="flex justify-between items-center bg-gray-800/40 p-5 rounded-2xl border border-gray-700/50">
                                   <div>
                                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Big Venta Registrada 💸</p>
                                     <p className="font-black text-2xl text-yellow-400">${Math.floor(currentBigVenta.value).toLocaleString()}</p>
                                     <p className="text-[11.5px] font-bold text-gray-500 uppercase tracking-tighter mt-1">
                                       Neto: <span className="text-green-400">+${Math.floor(currentBigVenta.value * 0.92).toLocaleString()}</span> | Deduc: <span className="text-red-400">-${Math.floor(currentBigVenta.value * 0.08).toLocaleString()}</span>
                                     </p>
                                   </div>
                                   <div className="flex gap-2">
                                      <button onClick={() => { setIsEditingBigVenta(true); setHasBigVenta(true); setBigVentaValue(currentBigVenta.value); }} className="p-3 bg-gray-700/50 rounded-xl hover:bg-white hover:text-black transition-colors" title="Editar">✏️</button>
                                      <button onClick={() => deleteBigVenta(currentBigVenta.id)} className="p-3 bg-gray-700/50 rounded-xl hover:bg-red-500 hover:text-white transition-colors" title="Eliminar">🗑️</button>
                                   </div>
                                </div>
                             ) : (
                                <div className="flex flex-col items-center w-full">
                                   <div className="flex items-center justify-between mb-4 w-full max-w-md">
                                     <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">{isEditingBigVenta ? "Editando Big Venta 💸" : "¿Hubo Big Venta? 💸"}</span>
                                     <button onClick={() => {
                                       if(isEditingBigVenta) {
                                         setIsEditingBigVenta(false);
                                         setHasBigVenta(false);
                                       } else {
                                         setHasBigVenta(!hasBigVenta);
                                       }
                                     }} className={`w-12 h-6 rounded-full transition-all relative ${(hasBigVenta || isEditingBigVenta) ? 'bg-yellow-500' : 'bg-gray-700'}`}>
                                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${(hasBigVenta || isEditingBigVenta) ? 'left-7' : 'left-1'}`} />
                                     </button>
                                   </div>
                                   {(hasBigVenta || isEditingBigVenta) && (
                                     <div className="animate-in slide-in-from-top-2 duration-300 flex flex-col md:flex-row items-center gap-3 w-full max-w-md">
                                       <input type="number" placeholder="Ingresar Valor (ej. 196000)" className="flex-1 bg-gray-800 border-none rounded-xl p-4 text-center text-white font-black text-lg w-full focus:ring-2 ring-yellow-500 outline-none transition-all" value={bigVentaValue} onChange={(e) => setBigVentaValue(e.target.value ? Number(e.target.value) : "")} />
                                       <button onClick={saveBigVenta} className="bg-yellow-500 text-black font-black uppercase tracking-widest text-xs px-6 py-4 rounded-xl hover:bg-yellow-400 active:scale-95 transition-all w-full md:w-auto">Guardar</button>
                                     </div>
                                   )}
                                </div>
                             )}
                           </div>

                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* MODAL EDITAR / CREAR TURNO */}
          {showModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[2.5rem] p-8 md:p-10 animate-in zoom-in-95 border border-gray-100 dark:border-gray-800 shadow-2xl transition-colors">
                <h3 className="text-2xl font-black mb-8 text-center uppercase italic dark:text-white">{editingShiftId ? 'Editar Turno' : 'Nuevo Turno'}</h3>
                {selectedDate && <p className="text-center text-gray-400 dark:text-gray-500 font-bold mb-6">{selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}

                <div className="space-y-6 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">Entrada</label>
                      <input 
                        type="time" 
                        value={startTime} 
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          if (!isManualBreak) autoCalculateBreak(e.target.value, endTime);
                        }} 
                        className="w-full p-4 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl font-black border-none outline-none focus:ring-2 ring-black dark:focus:ring-gray-600 transition-colors" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">Salida</label>
                      <input 
                        type="time" 
                        value={endTime} 
                        onChange={(e) => {
                          setEndTime(e.target.value);
                          if (!isManualBreak) autoCalculateBreak(startTime, e.target.value);
                        }} 
                        className="w-full p-4 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl font-black border-none outline-none focus:ring-2 ring-black dark:focus:ring-gray-600 transition-colors" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className={`p-4 rounded-2xl border-2 transition-colors ${hasBreak ? colors.accent : 'border-gray-100 dark:border-gray-800'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] md:text-xs font-black uppercase transition-colors ${hasBreak ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>¿Turno con Break?</span>
                        <button onClick={() => { 
                          const nextBreak = !hasBreak;
                          setHasBreak(nextBreak); 
                          if (nextBreak) {
                            setIsManualBreak(false);
                            autoCalculateBreak(startTime, endTime);
                          } 
                        }} className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative ${hasBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                          <div className={`absolute top-1 w-3 h-3 md:w-4 md:h-4 bg-white rounded-full transition-all ${hasBreak ? 'left-[1.35rem] md:left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border-2 border-dashed transition-all duration-300 ${!hasBreak ? 'opacity-40 pointer-events-none border-gray-100 dark:border-gray-800' : (isManualBreak ? colors.accent : 'border-gray-100 dark:border-gray-800')}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase">¿Break Manual?</span>
                        <button onClick={() => {
                          const nextState = !isManualBreak;
                          setIsManualBreak(nextState);
                          // Si lo apagas, que se auto-acomode de nuevo redondito
                          if (!nextState && hasBreak) {
                            autoCalculateBreak(startTime, endTime);
                          }
                        }} disabled={!hasBreak} className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative ${isManualBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                          <div className={`absolute top-1 w-3 h-3 md:w-4 md:h-4 bg-white rounded-full transition-all ${isManualBreak ? 'left-[1.35rem] md:left-7' : 'left-1'}`} />
                        </button>
                      </div>
                      
                      {isManualBreak && hasBreak && (
                        <div className="animate-in fade-in slide-in-from-top-2 mt-3">
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className={`p-3 bg-white dark:bg-gray-800 dark:text-white rounded-xl text-xs font-bold border outline-none focus:ring-2 focus:ring-gray-200 transition-colors ${breakError ? 'border-red-400 focus:ring-red-200' : 'border-gray-100 dark:border-gray-700'}`} />
                            <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className={`p-3 bg-white dark:bg-gray-800 dark:text-white rounded-xl text-xs font-bold border outline-none focus:ring-2 focus:ring-gray-200 transition-colors ${breakError ? 'border-red-400 focus:ring-red-200' : 'border-gray-100 dark:border-gray-700'}`} />
                          </div>
                          {breakError && <p className="text-[10px] font-bold text-red-500 animate-pulse mt-1">{breakError}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 font-bold text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition-colors">CANCELAR</button>
                  <button 
                    onClick={() => handleSaveShift(false)} 
                    disabled={!!breakError}
                    className={`flex-[2] py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all
                      ${breakError ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed shadow-none scale-100' : `${colors.secondary} hover:scale-105 shadow-xl border border-black dark:border-transparent`}`}
                  >
                    GUARDAR
                  </button>
                </div>
              </div>
            </div>
          )}

          <style jsx global>{`
            .react-calendar { width: 100% !important; border: none !important; font-family: inherit; background: transparent !important; }
            .react-calendar__tile { padding: 1.2em 0.5em !important; font-weight: 700; border-radius: 1.2rem; transition: all 0.2s; background: transparent; }
            .react-calendar__tile:disabled { background: transparent !important; }
            .react-calendar__tile:enabled:hover { background-color: #f3f4f6; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
            
            .dark .react-calendar__tile { color: #d1d5db; }
            .dark .react-calendar__tile:enabled:hover { background-color: #1f2937; color: #fff; }
            .dark .react-calendar__navigation button { color: #fff; }
          `}</style>

          <div className="h-16 md:h-20"></div>

          <div className="w-full border-t border-gray-100 dark:border-gray-900/50 pt-8">
            <Footer />
          </div>
          <PayrollFeedback />

        </main>
      </SignedIn>
    </>
  );
}