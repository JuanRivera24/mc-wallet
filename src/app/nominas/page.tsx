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
import { RATES_BY_YEAR, TRANSPORT_AUX_BY_YEAR } from "@/constants/rates";
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

  // NUEVOS ESTADOS PARA EVENTOS ESPECIALES
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [specialTab, setSpecialTab] = useState<'REUNION' | 'COMPENSATORIO' | 'INCAPACIDAD'>('REUNION');
  const [specialHours, setSpecialHours] = useState<string>("");
  const [specialRateType, setSpecialRateType] = useState<string>("ORDINARY");
  const [specialTransport, setSpecialTransport] = useState(false);
  const [incapacidadType, setIncapacidadType] = useState<'HORAS' | 'TURNO'>('HORAS');

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

  // CÁLCULO ASIMÉTRICO REDONDEADO
  const autoCalculateBreak = (start: string, end: string) => {
    const [hStart, mStart] = start.split(":").map(Number);
    const [hEnd, mEnd] = end.split(":").map(Number);
    let startMins = hStart * 60 + mStart;
    let endMins = hEnd * 60 + mEnd;
    if (endMins <= startMins) endMins += 24 * 60;

    const midMins = Math.floor((startMins + endMins) / 2);

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

  // VIGILANTE DE ERRORES
  useEffect(() => {
    if (!hasBreak || !isManualBreak || !(showModal || (showSpecialModal && incapacidadType === 'TURNO'))) {
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
  }, [startTime, endTime, breakStart, breakEnd, hasBreak, isManualBreak, showModal, showSpecialModal, incapacidadType]);

  const shiftsDelAno = useMemo(() => shifts.filter(s => s.year === selectedYear), [shifts, selectedYear]);
  const todayShift = useMemo(() => shiftsDelAno.find(s => s.date === todayStr && (!s.type || s.type === 'SHIFT' || s.isOff)), [shiftsDelAno, todayStr]);

  const statsAnuales = useMemo(() => {
    const dataMeses = mesesFull.map(m => {
      const turnosNeto = shiftsDelAno.filter(s => {
        let shiftM = s.month;
        if (s.type === 'INCAPACIDAD' && parseInt(s.date.split('-')[2]) > 15) {
          shiftM = mesesFull[(mesesFull.indexOf(shiftM) + 1) % 12];
        }
        return shiftM === m;
      }).reduce((acc, curr) => acc + (curr.netPay || 0), 0);
      const bvNeto = bigVentas.filter(b => b.month === m).reduce((acc, curr) => acc + (curr.value * 0.92), 0);
      return turnosNeto + bvNeto;
    });

    return {
      labels: mesesFull.map(m => m.substring(0, 3).toUpperCase()),
      datasets: [{ label: 'Neto', data: dataMeses, backgroundColor: colors.secondary, borderRadius: 6 }]
    };
  }, [shiftsDelAno, bigVentas, colors.secondary]);

  const statsQuincenas = useMemo(() => {
    const calcQ = (isQ1: boolean) => {
      const currentQ = isQ1 ? 1 : 2;
      const filteredShifts = shiftsDelAno.filter(s => {
        let day = parseInt(s.date.split('-')[2]);
        let q = day <= 15 ? 1 : 2;
        let m = s.month;
        if (s.type === 'INCAPACIDAD') {
          if (q === 1) q = 2;
          else { q = 1; m = mesesFull[(mesesFull.indexOf(m) + 1) % 12]; }
        }
        return m === selectedMonth && q === currentQ;
      });
      const filteredBV = bigVentas.find(b => b.month === selectedMonth && b.quincena === currentQ);
      const bvNeto = filteredBV ? filteredBV.value * 0.92 : 0;

      return {
        dinero: filteredShifts.reduce((a, b) => a + (b.netPay || 0), 0) + bvNeto,
        horas: filteredShifts.reduce((a, b) => a + (b.totalHours || 0), 0),
        diasTrabajados: filteredShifts.filter(s => !s.isOff && (!s.type || s.type === 'SHIFT')).length,
        diasOff: filteredShifts.filter(s => s.isOff).length
      };
    };
    const q1 = calcQ(true);
    const q2 = calcQ(false);

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

  // Lista Visual
  const turnosLista = useMemo(() => {
    return shiftsDelAno.filter(s => {
      let day = parseInt(s.date.split('-')[2]);
      let shiftQ = day <= 15 ? 1 : 2;
      return s.month === selectedMonth && shiftQ === selectedQuincena;
    }).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      if (a.type && !b.type) return 1;
      if (!a.type && b.type) return -1;
      return 0;
    });
  }, [shiftsDelAno, selectedMonth, selectedQuincena]);

  // Cálculo Matemático (Incapacidad desplazada)
  const turnosCalculo = useMemo(() => {
    return shiftsDelAno.filter(s => {
      let day = parseInt(s.date.split('-')[2]);
      let shiftQ = day <= 15 ? 1 : 2;
      let shiftMonth = s.month;

      if (s.type === 'INCAPACIDAD') {
        if (shiftQ === 1) {
          shiftQ = 2;
        } else {
          shiftQ = 1;
          shiftMonth = mesesFull[(mesesFull.indexOf(shiftMonth) + 1) % 12];
        }
      }
      return shiftMonth === selectedMonth && shiftQ === selectedQuincena;
    });
  }, [shiftsDelAno, selectedMonth, selectedQuincena]);

  const currentBigVenta = bigVentas.find(b => b.month === selectedMonth && b.quincena === selectedQuincena);
  const bigVentaNeto = currentBigVenta ? currentBigVenta.value * 0.92 : 0;
  const bigVentaDeduccion = currentBigVenta ? currentBigVenta.value * 0.08 : 0;

  const baseDineroTurnos = turnosCalculo.reduce((acc, curr) => acc + (curr.netPay || 0), 0);
  const totalListaDinero = baseDineroTurnos + bigVentaNeto;
  const totalListaHoras = turnosCalculo.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);

  const countTrabajados = turnosLista.filter(s => !s.isOff && (!s.type || s.type === 'SHIFT')).length;
  const countOff = turnosLista.filter(s => s.isOff).length;

  const tOrdD_h = turnosCalculo.reduce((a, c) => a + (c.hOrdD || 0), 0);
  const tOrdD_p = turnosCalculo.reduce((a, c) => a + (c.pOrdD || 0), 0);
  const tOrdN_h = turnosCalculo.reduce((a, c) => a + (c.hOrdN || 0), 0);
  const tOrdN_p = turnosCalculo.reduce((a, c) => a + (c.pOrdN || 0), 0);
  const tDomD_h = turnosCalculo.reduce((a, c) => a + (c.hDomD || 0), 0);
  const tDomD_p = turnosCalculo.reduce((a, c) => a + (c.pDomD || 0), 0);
  const tDomN_h = turnosCalculo.reduce((a, c) => a + (c.hDomN || 0), 0);
  const tDomN_p = turnosCalculo.reduce((a, c) => a + (c.pDomN || 0), 0);
  const tExtD_h = turnosCalculo.reduce((a, c) => a + (c.hExtD || 0), 0);
  const tExtD_p = turnosCalculo.reduce((a, c) => a + (c.pExtD || 0), 0);
  const tExtN_h = turnosCalculo.reduce((a, c) => a + (c.hExtN || 0), 0);
  const tExtN_p = turnosCalculo.reduce((a, c) => a + (c.pExtN || 0), 0);
  const tExtDomD_h = turnosCalculo.reduce((a, c) => a + (c.hExtDomD || 0), 0);
  const tExtDomD_p = turnosCalculo.reduce((a, c) => a + (c.pExtDomD || 0), 0);
  const tExtDomN_h = turnosCalculo.reduce((a, c) => a + (c.hExtDomN || 0), 0);
  const tExtDomN_p = turnosCalculo.reduce((a, c) => a + (c.pExtDomN || 0), 0);

  const tTransportAux = turnosCalculo.reduce((a, c) => a + (c.transportAux || 0), 0);
  const tDeductionsBase = turnosCalculo.reduce((a, c) => a + (c.deductions || 0), 0);
  const tDeductionsFinal = tDeductionsBase + bigVentaDeduccion;

  const tReunion_h = turnosCalculo.filter(s => s.type === 'REUNION').reduce((a, c) => a + (c.totalHours || 0), 0);
  const tReunion_p = turnosCalculo.filter(s => s.type === 'REUNION').reduce((a, c) => a + (c.salaryBase || 0), 0);
  const tCompensatorio_h = turnosCalculo.filter(s => s.type === 'COMPENSATORIO').reduce((a, c) => a + (c.totalHours || 0), 0);
  const tCompensatorio_p = turnosCalculo.filter(s => s.type === 'COMPENSATORIO').reduce((a, c) => a + (c.salaryBase || 0), 0);
  const tIncapacidad_h = turnosCalculo.filter(s => s.type === 'INCAPACIDAD').reduce((a, c) => a + (c.totalHours || 0), 0);
  const tIncapacidad_p = turnosCalculo.filter(s => s.type === 'INCAPACIDAD').reduce((a, c) => a + (c.salaryBase || 0), 0);

  let tTransportBase = 0;
  let tTransportExtra = 0;
  turnosCalculo.forEach(c => {
    if (c.transportAux) {
      if (c.endTime && c.endTime >= "00:01" && c.endTime <= "04:59") {
        tTransportExtra += 5000;
        tTransportBase += (c.transportAux - 5000);
      } else {
        tTransportBase += c.transportAux;
      }
    }
  });

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

  const handleOpenSpecial = () => {
    setEditingShiftId(null);
    setSpecialHours("");
    setSpecialRateType("ORDINARY");
    setSpecialTransport(false);
    setIncapacidadType('HORAS');
    setSpecialTab('REUNION'); // Siempre abrimos por defecto en Reunión
    setShowSpecialModal(true);
  };

  const handleQuickAddToday = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(mesesFull[today.getMonth()]);
    setSelectedDate(today);
    handleOpenNew();
  };

  const handleOpenEdit = (e: React.MouseEvent, shift: any) => {
    e.stopPropagation();
    setEditingShiftId(shift.id);

    const [year, month, day] = shift.date.split('-');
    setSelectedDate(new Date(Number(year), Number(month) - 1, Number(day)));

    if (shift.type === 'REUNION' || shift.type === 'COMPENSATORIO' || shift.type === 'INCAPACIDAD') {
      setSpecialTab(shift.type);

      if (shift.type === 'INCAPACIDAD' && shift.startTime) {
        setIncapacidadType('TURNO');
        setStartTime(shift.startTime);
        setEndTime(shift.endTime);
        const shiftHasBreak = shift.hasBreak !== undefined ? shift.hasBreak : true;
        setHasBreak(shiftHasBreak);
        if (shiftHasBreak && shift.breakStart && shift.breakEnd) {
          setBreakStart(shift.breakStart);
          setBreakEnd(shift.breakEnd);
          setIsManualBreak(shift.isManualBreak !== undefined ? shift.isManualBreak : true);
        } else {
          setIsManualBreak(false);
        }
      } else {
        if (shift.type === 'INCAPACIDAD') setIncapacidadType('HORAS');
        setSpecialHours(shift.totalHours ? shift.totalHours.toString() : "");
        setSpecialRateType(shift.specialRateKey || "ORDINARY");
      }

      setSpecialTransport(shift.transportAux > 0);
      setShowSpecialModal(true);
      return;
    }

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
        const [hS, mS] = sTime.split(":").map(Number);
        const [hE, mE] = eTime.split(":").map(Number);
        let sMins = hS * 60 + mS;
        let eMins = hE * 60 + mE;
        if (eMins <= sMins) eMins += 24 * 60;
        const midMins = Math.floor((sMins + eMins) / 2);

        let bStartMins = midMins - 15;
        bStartMins = Math.round(bStartMins / 30) * 30;

        const formatTime = (totalMins: number) => {
          const h = Math.floor((totalMins % (24 * 60)) / 60).toString().padStart(2, "0");
          const m = (totalMins % 60).toString().padStart(2, "0");
          return `${h}:${m}`;
        };
        setBreakStart(formatTime(bStartMins));
        setBreakEnd(formatTime(bStartMins + 30));
      }
      setIsManualBreak(shift.isManualBreak !== undefined ? shift.isManualBreak : false);
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

  const handleRecalculate = async (e: React.MouseEvent, shift: any) => {
    e.stopPropagation();
    if (!user || shift.isOff || shift.type === 'REUNION' || shift.type === 'COMPENSATORIO') return;

    const shiftHasBreak = shift.hasBreak !== undefined ? shift.hasBreak : true;

    let exactSavedBreak = undefined;
    if (shiftHasBreak && shift.isManualBreak && shift.breakStart && shift.breakEnd) {
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

    const existingSpecials = shifts.filter(s => s.date === targetDateStr && s.type && s.type !== 'SHIFT');
    for (const sp of existingSpecials) {
      if (isOff) {
        await deleteDoc(doc(db, "shifts", sp.id));
      } else {
        if (sp.type === 'INCAPACIDAD' || sp.type === 'COMPENSATORIO') {
          await deleteDoc(doc(db, "shifts", sp.id));
        }
      }
    }

    const docId = editingShiftId || `${user.id}_${targetDateStr}`;

    const finalBreak = (!isOff && hasBreak && isManualBreak) ? { start: breakStart, end: breakEnd } : undefined;

    const calc = calculateShift(targetDateStr, startTime, endTime, finalBreak, role, hasBreak);

    const payload: any = {
      userId: user.id,
      date: targetDateStr,
      type: 'SHIFT',
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

  const handleSaveSpecial = async () => {
    if (!user || !selectedDate) return;

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const targetDateStr = `${year}-${month}-${day}`;

    const docId = editingShiftId || `${user.id}_${targetDateStr}_${specialTab}`;

    const existingNormal = shifts.find(s => s.date === targetDateStr && (!s.type || s.type === 'SHIFT'));

    if (specialTab === 'INCAPACIDAD' || specialTab === 'COMPENSATORIO') {
      if (existingNormal) await deleteDoc(doc(db, "shifts", existingNormal.id));
      const otherSpecials = shifts.filter(s => s.date === targetDateStr && s.type && s.type !== 'SHIFT' && s.id !== docId);
      for (const osp of otherSpecials) {
        await deleteDoc(doc(db, "shifts", osp.id));
      }
    } else if (specialTab === 'REUNION') {
      if (existingNormal && existingNormal.isOff) {
        await deleteDoc(doc(db, "shifts", existingNormal.id));
      }
      const incompatSpecials = shifts.filter(s => s.date === targetDateStr && (s.type === 'INCAPACIDAD' || s.type === 'COMPENSATORIO') && s.id !== docId);
      for (const isp of incompatSpecials) {
        await deleteDoc(doc(db, "shifts", isp.id));
      }
    }

    const rateTable = RATES_BY_YEAR[year]?.[role] || RATES_BY_YEAR[2026][role];
    const baseTransport = TRANSPORT_AUX_BY_YEAR[year] || TRANSPORT_AUX_BY_YEAR[2026];

    let payload: any = {
      userId: user.id, date: targetDateStr, type: specialTab, isOff: false,
      month: selectedMonth || mesesFull[selectedDate.getMonth()], year: year, timestamp: serverTimestamp()
    };

    if (specialTab === 'INCAPACIDAD' && incapacidadType === 'TURNO') {
      if (breakError) return alert("Corrige el break primero");

      const finalBreak = (hasBreak && isManualBreak) ? { start: breakStart, end: breakEnd } : undefined;
      const calc = calculateShift(targetDateStr, startTime, endTime, finalBreak, role, hasBreak);

      const transportToApply = specialTransport ? calc.transportAux : 0;
      const netToApply = calc.salaryBase + transportToApply - calc.deductions;

      payload = { ...payload, ...calc, transportAux: transportToApply, netPay: netToApply };
    } else {
      if (!specialHours || Number(specialHours) <= 0) return alert("Ingresa horas válidas");

      const rate = rateTable[specialRateType as keyof typeof rateTable] || rateTable.ORDINARY;
      const hrs = Number(specialHours);
      const moneyBase = hrs * rate;
      const healthPension = Math.round(moneyBase * 0.08);
      const transport = specialTransport ? baseTransport : 0;

      payload = {
        ...payload, startTime: "", endTime: "", hasBreak: false,
        totalHours: hrs, salaryBase: Math.round(moneyBase),
        deductions: healthPension, transportAux: transport,
        netPay: Math.round(moneyBase - healthPension + transport),
        specialRateKey: specialRateType,
        breakStart: "", breakEnd: "", hoursDay: 0, hoursNight: 0,
        hOrdD: 0, pOrdD: 0, hOrdN: 0, pOrdN: 0,
        hDomD: 0, pDomD: 0, hDomN: 0, pDomN: 0,
        hExtD: 0, pExtD: 0, hExtN: 0, pExtN: 0,
        hExtDomD: 0, pExtDomD: 0, hExtDomN: 0, pExtDomN: 0
      }
    }

    await setDoc(doc(db, "shifts", docId), payload, { merge: true });
    setShowSpecialModal(false); setEditingShiftId(null);
  }

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

  // 🔥 AQUÍ SE ARREGLÓ EL PROBLEMA: Las variables ahora son globales para toda la vista
  const dStrForModal = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` : "";
  const existingMainShift = shiftsDelAno.find(s => s.date === dStrForModal && (!s.type || s.type === 'SHIFT'));
  const hasNormalShiftForModal = shifts.some(s => s.date === dStrForModal && (!s.type || s.type === 'SHIFT') && !s.isOff);

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
                      const dayEvents = shiftsDelAno.filter(shift => shift.date === dStr);
                      const isDisabled = isDateDisabled({ date });

                      const hasOff = dayEvents.some(e => e.isOff);
                      const hasIncapacidad = dayEvents.some(e => e.type === 'INCAPACIDAD');
                      const hasShift = dayEvents.some(e => e.type === 'SHIFT' || !e.type);
                      const hasReunion = dayEvents.some(e => e.type === 'REUNION');
                      const hasCompensatorio = dayEvents.some(e => e.type === 'COMPENSATORIO');

                      let classes = 'font-bold rounded-2xl transition-all relative overflow-hidden ';

                      if (isDisabled) classes += 'opacity-20 saturate-50 cursor-not-allowed ';
                      else classes += 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ';

                      if (hasIncapacidad) classes += '!bg-white !text-red-600 !ring-2 !ring-inset !ring-red-500 shadow-md is-incapacidad ';
                      else if (hasShift && hasReunion) classes += '!bg-green-500 !text-white !ring-[4px] !ring-inset !ring-orange-400 shadow-sm ';
                      else if (hasOff && hasReunion) classes += '!bg-red-500 !text-white !ring-[4px] !ring-inset !ring-orange-400 shadow-sm ';
                      else if (hasReunion) classes += '!bg-orange-500 !text-white !ring-2 !ring-inset !ring-orange-400 shadow-sm ';
                      else if (hasCompensatorio) classes += '!bg-yellow-400 !text-black shadow-sm ';
                      else if (hasOff) classes += '!bg-red-500 !text-white shadow-sm ';
                      else if (hasShift) classes += '!bg-green-500 !text-white shadow-sm ';

                      if (selectedDate && date.getTime() === selectedDate.getTime()) {
                        classes += '!ring-4 !ring-blue-400 ';
                      } else if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) {
                        if (!hasShift && !hasOff && !hasIncapacidad && !hasReunion && !hasCompensatorio) {
                          classes += '!bg-yellow-100 dark:!bg-yellow-900/40 text-yellow-800 dark:!text-yellow-500 font-black !ring-2 !ring-inset !ring-yellow-400 ';
                        } else {
                          classes += '!ring-4 !ring-yellow-400 ';
                        }
                      }

                      if (date.getDay() === 0 && !hasShift && !hasOff && !hasIncapacidad && !hasReunion && !hasCompensatorio) classes += 'text-red-500 dark:text-red-400 ';
                      if (!hasShift && !hasOff && !hasIncapacidad && !hasReunion && !hasCompensatorio && date.getDay() !== 0) classes += 'text-gray-700 dark:text-gray-300 ';

                      return classes;
                    }}
                    tileDisabled={isDateDisabled}
                  />

                  <div className="mt-8 flex gap-3 transition-all duration-300">
                    <button
                      disabled={!selectedDate}
                      onClick={(e) => {
                        if (existingMainShift) handleOpenEdit(e, existingMainShift);
                        else { setSelectedDate(selectedDate); handleOpenNew(); }
                      }}
                      className={`flex-[4] py-4 rounded-2xl font-black shadow-lg uppercase text-[10px] md:text-xs tracking-widest transition-all
                            ${selectedDate ? `${colors.secondary} text-white hover:brightness-110 active:scale-95 cursor-pointer` : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none'}`}
                    >
                      {existingMainShift ? "✏️ Editar Turno" : "+ Agregar Turno"}
                    </button>

                    <button
                      disabled={!selectedDate}
                      onClick={() => handleSaveShift(true)}
                      className={`flex-[4] py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all border border-transparent
                            ${selectedDate ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 cursor-pointer' : 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
                    >
                      Marcar OFF
                    </button>

                    <button
                      disabled={!selectedDate}
                      onClick={handleOpenSpecial}
                      title="Eventos Especiales"
                      className={`flex-[1] py-4 rounded-2xl font-black shadow-lg transition-all text-xl
                            ${selectedDate ? `bg-gray-900 dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95 cursor-pointer` : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'}`}
                    >
                      ...
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
                    {turnosLista.length === 0 ? (
                      <div className="p-10 text-center text-gray-300 dark:text-gray-600 font-bold italic">No hay turnos registrados en esta quincena.</div>
                    ) : (
                      turnosLista.map((s) => (
                        <div key={s.id} onClick={() => !s.isOff && handleToggleExpand(s.id)} className={`transition-colors cursor-pointer group ${s.isOff ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>

                          {/* LIST ITEM PRINCIPAL */}
                          <div className="p-4 md:p-8 flex justify-between items-center gap-2 md:gap-4">

                            {/* Información a la Izquierda */}
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center gap-2 md:gap-3 mb-1">
                                <span className={`flex-shrink-0 w-3 h-3 rounded-full border border-black dark:border-transparent ${s.isOff ? 'bg-red-500' : s.type === 'REUNION' ? 'bg-orange-400' : s.type === 'COMPENSATORIO' ? 'bg-yellow-400' : s.type === 'INCAPACIDAD' ? 'bg-white border-2 border-red-500' : 'bg-green-500'}`}></span>
                                <p className="font-black text-lg md:text-xl text-gray-800 dark:text-gray-200 capitalize truncate">
                                  {new Date(s.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}
                                </p>
                              </div>

                              <div className="flex flex-col md:flex-row md:items-center text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide pl-[1.25rem] md:pl-6 leading-tight gap-0.5 md:gap-0">
                                {s.isOff ? (
                                  <span>Día de Descanso</span>
                                ) : s.startTime ? (
                                  <>
                                    <span>{s.startTime} - {s.endTime}</span>
                                    <span className="hidden md:inline mx-1.5 text-gray-300 dark:text-gray-600">•</span>
                                    <span className="text-gray-500 dark:text-gray-400">{s.totalHours?.toFixed(1)}H</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-gray-500 dark:text-gray-400">{s.totalHours?.toFixed(1)}H</span>
                                    <span className="hidden md:inline mx-1.5 text-gray-300 dark:text-gray-600">•</span>
                                    <span className="text-[9px] md:text-xs text-gray-400">{s.type === 'INCAPACIDAD' && incapacidadType === 'HORAS' ? 'INCAPACIDAD' : s.type}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Información y Botones a la Derecha */}
                            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                              <div className="text-right flex-shrink-0 mr-[3%]">
                                {!s.isOff && s.type !== 'INCAPACIDAD' && (<p className="font-black text-base md:text-xl text-gray-900 dark:text-white">${Math.floor(s.netPay).toLocaleString()}</p>)}
                                {!s.isOff && s.type === 'INCAPACIDAD' && (<p className="font-bold text-[9px] md:text-xs text-red-500 uppercase">En Prox. Q.</p>)}
                              </div>

                              <div className="flex items-center gap-1 md:gap-2">
                                <button onClick={(e) => handleOpenEdit(e, s)} className="p-1 md:p-1 text-[10px] md:text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors z-10" title="Editar Turno">✏️</button>
                                <button onClick={(e) => handleRecalculate(e, s)} className="p-1 md:p-1 text-[10px] md:text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-blue-500 dark:hover:bg-blue-600 hover:text-white transition-colors z-10" title="Recalcular rápido">🔄</button>
                                <button onClick={(e) => handleDelete(e, s.id)} className="p-1 md:p-1 text-[10px] md:text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-red-500 dark:hover:bg-red-600 hover:text-white transition-colors z-10" title="Eliminar">🗑️</button>
                              </div>
                            </div>
                          </div>

                          {/* DESGLOSE AL EXPANDIR (PARA TODOS LOS TURNOS MENOS OFF) */}
                          {!s.isOff && expandedShiftId === s.id && (
                            <div className="px-6 pb-6 md:px-8 md:pb-8 animate-in slide-in-from-top-2 fade-in duration-300">
                              <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 transition-colors shadow-inner">

                                {/* Resumen General del Turno (Igual para todos) */}
                                <div className="grid grid-cols-3 gap-2 md:gap-4 text-center mb-4 pb-4 border-b border-gray-200/50 dark:border-gray-700">
                                  <div><p className="text-[9px] md:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Base (Horas)</p><p className="font-black text-gray-700 dark:text-gray-300">${Math.floor(s.salaryBase || 0).toLocaleString()}</p></div>
                                  <div><p className="text-[9px] md:text-[10px] font-bold text-green-600 dark:text-green-500 uppercase">Aux. Transp</p><p className="font-black text-green-700 dark:text-green-400">+${Math.floor(s.transportAux || 0).toLocaleString()}</p></div>
                                  <div><p className="text-[9px] md:text-[10px] font-bold text-red-400 uppercase">Deducciones</p><p className="font-black text-red-600 dark:text-red-400">-${Math.floor(s.deductions || 0).toLocaleString()}</p></div>
                                </div>

                                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest text-center mb-3">Desglose de Horas de este Evento</p>

                                {/* Desglose Detallado de Horas (Difiere si es turno normal vs especial) */}
                                {(!s.type || s.type === 'SHIFT' || (s.type === 'INCAPACIDAD' && s.startTime)) ? (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-2 text-center">
                                    {s.hOrdD > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Ord. Diurna</p><p className="font-black text-sm text-gray-800 dark:text-gray-200">{s.hOrdD.toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pOrdD).toLocaleString()}</p></div>}
                                    {s.hOrdN > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Ord. Nocturna</p><p className="font-black text-sm text-blue-500 dark:text-blue-300">{s.hOrdN.toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pOrdN).toLocaleString()}</p></div>}
                                    {s.hDomD > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Dom/Fest Diurno</p><p className="font-black text-sm text-orange-500 dark:text-orange-400">{s.hDomD.toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pDomD).toLocaleString()}</p></div>}
                                    {s.hDomN > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Dom/Fest Noct</p><p className="font-black text-sm text-orange-600 dark:text-orange-500">{s.hDomN.toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pDomN).toLocaleString()}</p></div>}

                                    {s.hExtD > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Extra Diurna</p><p className="font-black text-sm text-red-500 dark:text-red-400">{s.hExtD.toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pExtD).toLocaleString()}</p></div>}
                                    {s.hExtN > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Extra Nocturna</p><p className="font-black text-sm text-red-600 dark:text-red-500">{s.hExtN.toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pExtN).toLocaleString()}</p></div>}
                                    {s.hExtDomD > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Extra Dom D.</p><p className="font-black text-sm text-purple-500 dark:text-purple-400">{s.hExtDomD.toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pExtDomD).toLocaleString()}</p></div>}
                                    {s.hExtDomN > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Extra Dom N.</p><p className="font-black text-sm text-purple-600 dark:text-purple-500">{s.hExtDomN.toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pExtDomN).toLocaleString()}</p></div>}
                                  </div>
                                ) : (
                                  <div className="flex justify-center text-center">
                                    <div>
                                      <p className="text-[8px] font-bold text-gray-400 uppercase">{s.type === 'INCAPACIDAD' ? 'INCAPACIDAD (POR HORAS)' : s.type}</p>
                                      <p className="font-black text-lg text-gray-800 dark:text-gray-200">{s.totalHours?.toFixed(1)} h</p>
                                      <p className="text-[9px] font-bold text-gray-500">${Math.floor(s.salaryBase || 0).toLocaleString()} {s.specialRateKey ? `(${s.specialRateKey})` : ''}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {turnosLista.length > 0 && (
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
                            <div className={tOrdD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Ord. Diurna</p><p className={`font-black text-lg ${tOrdD_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tOrdD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tOrdD_p).toLocaleString()}</p></div>
                            <div className={tOrdN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Ord. Nocturna</p><p className={`font-black text-lg ${tOrdN_h > 0 ? 'text-blue-300' : 'text-gray-600'}`}>{tOrdN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tOrdN_p).toLocaleString()}</p></div>
                            <div className={tDomD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Dom/Fest Diurno</p><p className={`font-black text-lg ${tDomD_h > 0 ? 'text-orange-400' : 'text-gray-600'}`}>{tDomD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tDomD_p).toLocaleString()}</p></div>
                            <div className={tDomN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Dom/Fest Noct</p><p className={`font-black text-lg ${tDomN_h > 0 ? 'text-orange-600' : 'text-gray-600'}`}>{tDomN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tDomN_p).toLocaleString()}</p></div>

                            <div className={tExtD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Extra Diurna</p><p className={`font-black text-lg ${tExtD_h > 0 ? 'text-red-400' : 'text-gray-600'}`}>{tExtD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtD_p).toLocaleString()}</p></div>
                            <div className={tExtN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Extra Nocturna</p><p className={`font-black text-lg ${tExtN_h > 0 ? 'text-red-600' : 'text-gray-600'}`}>{tExtN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtN_p).toLocaleString()}</p></div>
                            <div className={tExtDomD_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Extra Dom. D.</p><p className={`font-black text-lg ${tExtDomD_h > 0 ? 'text-purple-400' : 'text-gray-600'}`}>{tExtDomD_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtDomD_p).toLocaleString()}</p></div>
                            <div className={tExtDomN_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-gray-400 uppercase">Extra Dom. N.</p><p className={`font-black text-lg ${tExtDomN_h > 0 ? 'text-purple-600' : 'text-gray-600'}`}>{tExtDomN_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tExtDomN_p).toLocaleString()}</p></div>

                            <div className="col-span-2 md:col-span-4 border-t border-gray-800/50 pt-4 mt-2"></div>

                            <div className={tReunion_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-orange-400 uppercase">Reunión</p><p className={`font-black text-lg ${tReunion_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tReunion_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tReunion_p).toLocaleString()}</p></div>
                            <div className={tCompensatorio_h > 0 ? "" : "opacity-30"}><p className="text-[9px] font-bold text-yellow-400 uppercase">Compensatorio</p><p className={`font-black text-lg ${tCompensatorio_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tCompensatorio_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tCompensatorio_p).toLocaleString()}</p></div>
                            <div className={`col-span-2 md:col-span-2 ${tIncapacidad_h > 0 ? "" : "opacity-30"}`}><p className="text-[9px] font-bold text-red-400 uppercase">Incapacidad Pagada (Esta Q.)</p><p className={`font-black text-lg ${tIncapacidad_h > 0 ? 'text-white' : 'text-gray-600'}`}>{tIncapacidad_h.toFixed(1)} h</p><p className="text-[10px] font-bold text-gray-500">${Math.floor(tIncapacidad_p).toLocaleString()}</p></div>

                            <div className="col-span-2 md:col-span-4 border-t border-gray-800/50 pt-4 mt-2"></div>

                            <div className={`col-span-1 md:col-span-2 ${tTransportBase > 0 ? "" : "opacity-30"}`}>
                              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Aux. Transporte</p>
                              <p className={`font-black text-2xl ${tTransportBase > 0 ? 'text-green-400' : 'text-gray-600'}`}>+${Math.floor(tTransportBase).toLocaleString()}</p>
                            </div>

                            <div className={`col-span-1 md:col-span-2 ${tTransportExtra > 0 ? "" : "opacity-30"}`}>
                              <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Bono Madrugada</p>
                              <p className={`font-black text-2xl ${tTransportExtra > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>+${Math.floor(tTransportExtra).toLocaleString()}</p>
                            </div>

                            <div className={`col-span-2 md:col-span-4 ${tDeductionsFinal > 0 ? "" : "opacity-30"} pt-4`}>
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
                                    if (isEditingBigVenta) {
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
                                    <input type="number" placeholder="Ingresar Valor (ej. 60000)" className="flex-1 bg-gray-800 border-none rounded-xl p-4 text-center text-white font-black text-lg w-full focus:ring-2 ring-yellow-500 outline-none transition-all" value={bigVentaValue} onChange={(e) => setBigVentaValue(e.target.value ? Number(e.target.value) : "")} />
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

          {showSpecialModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col">
                <div className="p-8 pb-4 bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="text-2xl font-black text-center uppercase italic dark:text-white mb-2">{editingShiftId ? 'Editar Evento' : 'Eventos Especiales'}</h3>
                  {selectedDate && <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">{selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                </div>

                <div className="grid grid-cols-3 bg-gray-100 dark:bg-gray-800 p-1 m-4 rounded-xl">
                  <button
                    onClick={() => setSpecialTab('REUNION')}
                    disabled={!!editingShiftId && specialTab !== 'REUNION'}
                    className={`py-3 text-[9px] font-black uppercase rounded-lg transition-all ${!!editingShiftId && specialTab !== 'REUNION' ? 'opacity-30 cursor-not-allowed text-gray-400'
                        : specialTab === 'REUNION' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    Reunión
                  </button>
                  <button
                    onClick={() => {
                      if (hasNormalShiftForModal) alert("Día con turno. Elimínalo e inténtalo de nuevo para agregar un Compensatorio.");
                      else setSpecialTab('COMPENSATORIO');
                    }}
                    disabled={!!editingShiftId && specialTab !== 'COMPENSATORIO'}
                    className={`py-3 text-[9px] font-black uppercase rounded-lg transition-all ${(!!editingShiftId && specialTab !== 'COMPENSATORIO') || hasNormalShiftForModal ? 'opacity-30 cursor-not-allowed text-gray-400'
                        : specialTab === 'COMPENSATORIO' ? 'bg-white dark:bg-gray-700 text-yellow-500 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    Compensa.
                  </button>
                  <button
                    onClick={() => {
                      if (hasNormalShiftForModal) alert("Día con turno. Elimínalo e inténtalo de nuevo para agregar una Incapacidad.");
                      else setSpecialTab('INCAPACIDAD');
                    }}
                    disabled={!!editingShiftId && specialTab !== 'INCAPACIDAD'}
                    className={`py-3 text-[9px] font-black uppercase rounded-lg transition-all ${(!!editingShiftId && specialTab !== 'INCAPACIDAD') || hasNormalShiftForModal ? 'opacity-30 cursor-not-allowed text-gray-400'
                        : specialTab === 'INCAPACIDAD' ? 'bg-white dark:bg-gray-700 text-red-500 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    Incapacidad
                  </button>
                </div>

                <div className="px-8 pb-8 space-y-6">
                  {specialTab === 'INCAPACIDAD' && (
                    <div className="flex gap-2">
                      <button onClick={() => setIncapacidadType('HORAS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg border-2 ${incapacidadType === 'HORAS' ? 'border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>Por Horas</button>
                      <button onClick={() => setIncapacidadType('TURNO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg border-2 ${incapacidadType === 'TURNO' ? 'border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>Turno Completo</button>
                    </div>
                  )}

                  {(specialTab !== 'INCAPACIDAD' || incapacidadType === 'HORAS') && (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Cantidad de Horas</label>
                        <input type="number" step="0.1" placeholder="Ej: 2.5" value={specialHours} onChange={(e) => setSpecialHours(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-2xl font-black border-2 border-gray-100 dark:border-gray-700 outline-none focus:border-black transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Tipo de Hora a Pagar</label>
                        <select value={specialRateType} onChange={(e) => setSpecialRateType(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-2xl font-black border-2 border-gray-100 dark:border-gray-700 outline-none focus:border-black transition-colors appearance-none">
                          <option value="ORDINARY">Ordinaria Diurna</option>
                          <option value="ORDINARY_NIGHT">Ordinaria Nocturna</option>
                          <option value="SUNDAY">Dom/Fest Diurno</option>
                          <option value="SUNDAY_NIGHT">Dom/Fest Nocturno</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {specialTab === 'INCAPACIDAD' && incapacidadType === 'TURNO' && (
                    <div className="space-y-4 animate-in fade-in">
                      <p className="text-[9px] font-bold text-red-500 uppercase text-center">Calcula tu día para inyectarlo en la prox. quincena</p>
                      <div className="grid grid-cols-2 gap-4">
                        <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); if (!isManualBreak) autoCalculateBreak(e.target.value, endTime); }} className="w-full p-3 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl font-black border outline-none" />
                        <input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); if (!isManualBreak) autoCalculateBreak(startTime, e.target.value); }} className="w-full p-3 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl font-black border outline-none" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <span className="text-[10px] font-black uppercase text-gray-500">¿Con Break?</span>
                        <button onClick={() => setHasBreak(!hasBreak)} className={`w-10 h-5 rounded-full relative transition-all ${hasBreak ? 'bg-red-500' : 'bg-gray-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${hasBreak ? 'left-6' : 'left-1'}`} /></button>
                      </div>
                    </div>
                  )}

                  <div className={`p-4 rounded-2xl border-2 transition-colors flex items-center justify-between ${specialTransport ? 'border-green-400 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-800'}`}>
                    <div>
                      <p className="text-[10px] md:text-xs font-black uppercase text-gray-700 dark:text-gray-300">Aux. Transporte</p>
                      <p className="text-[8px] font-bold uppercase text-gray-400">¿Aplica subsidio este día?</p>
                    </div>
                    <button onClick={() => setSpecialTransport(!specialTransport)} className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative ${specialTransport ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <div className={`absolute top-1 w-3 h-3 md:w-4 md:h-4 bg-white rounded-full transition-all ${specialTransport ? 'left-[1.35rem] md:left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button onClick={() => setShowSpecialModal(false)} className="flex-1 font-bold text-gray-400 hover:text-black dark:hover:text-white transition-colors">CANCELAR</button>
                    <button onClick={handleSaveSpecial} className={`flex-[2] py-4 rounded-2xl text-black font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl
                      ${specialTab === 'REUNION' ? 'bg-orange-500 text-white' : specialTab === 'COMPENSATORIO' ? 'bg-yellow-400 text-black' : 'bg-red-500 text-white'}`}>GUARDAR</button>
                  </div>
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

            .is-incapacidad::after {
              content: '✚';
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 2.2rem;
              line-height: 1;
              color: rgba(239, 68, 68, 0.15);
              pointer-events: none;
              z-index: 0;
            }
            .is-incapacidad abbr {
              position: relative;
              z-index: 1;
            }
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