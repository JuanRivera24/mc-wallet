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
import PayrollFeedback from "@/components/PayrollFeedback";
import { motion } from "framer-motion";

import { AnnualChart, QuincenaCharts } from "@/components/DashboardCharts";
import ShiftList from "./ShiftList";
import QuincenaSummary, { QuincenaTotals } from "./QuincenaSummary";
import { NormalShiftModal, SpecialShiftModal } from "./ShiftModals";

const toMinutes = (t?: string) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h * 60) + m;
};

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

  const [hasBigVenta, setHasBigVenta] = useState(false);
  const [isEditingBigVenta, setIsEditingBigVenta] = useState(false);
  const [bigVentaValue, setBigVentaValue] = useState<number | "">("");

  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("20:00");
  const [hasBreak, setHasBreak] = useState(true);
  const [isManualBreak, setIsManualBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("16:30");
  const [breakEnd, setBreakEnd] = useState("17:00");
  const [breakError, setBreakError] = useState<string | null>(null);

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

  const autoCalculateBreak = (start: string, end: string) => {
    let startMins = toMinutes(start);
    let endMins = toMinutes(end);
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

  useEffect(() => {
    if (!hasBreak || !isManualBreak || !(showModal || (showSpecialModal && incapacidadType === 'TURNO'))) {
      setBreakError(null); return;
    }
    let sMins = toMinutes(startTime); let eMins = toMinutes(endTime);
    if (eMins <= sMins) eMins += 24 * 60;
    let bsMins = toMinutes(breakStart); let beMins = toMinutes(breakEnd);
    if (bsMins < sMins && eMins > 24 * 60) bsMins += 24 * 60;
    if (beMins < sMins && eMins > 24 * 60) beMins += 24 * 60;

    if (bsMins < sMins || beMins > eMins) setBreakError("🚨 Break por fuera del turno.");
    else if (beMins <= bsMins) setBreakError("🚨 Hora fin inválida.");
    else setBreakError(null);
  }, [startTime, endTime, breakStart, breakEnd, hasBreak, isManualBreak, showModal, showSpecialModal, incapacidadType]);

  const shiftsDelAno = useMemo(() => shifts.filter(s => s.year === selectedYear), [shifts, selectedYear]);
  const todayShift = useMemo(() => shiftsDelAno.find(s => s.date === todayStr && (!s.type || s.type === 'SHIFT' || s.isOff)), [shiftsDelAno, todayStr]);

  const statsAnuales = useMemo(() => {
    return mesesFull.map(m => {
      const turnosNeto = shiftsDelAno.filter(s => {
        let shiftM = s.month;
        if (s.type === 'INCAPACIDAD' && parseInt(s.date.split('-')[2]) > 15) {
          shiftM = mesesFull[(mesesFull.indexOf(shiftM) + 1) % 12];
        }
        return shiftM === m;
      }).reduce((acc, curr) => acc + (Number(curr.netPay) || 0), 0);
      const bvNeto = bigVentas.filter(b => b.month === m).reduce((acc, curr) => acc + ((Number(curr.value) || 0) * 0.92), 0);
      return { month: m.substring(0, 3).toUpperCase(), net: turnosNeto + bvNeto };
    });
  }, [shiftsDelAno, bigVentas, selectedYear]);

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
      const bvNeto = filteredBV ? (Number(filteredBV.value) || 0) * 0.92 : 0;

      return {
        dinero: filteredShifts.reduce((a, b) => a + (Number(b.netPay) || 0), 0) + bvNeto,
        horas: filteredShifts.reduce((a, b) => a + (Number(b.totalHours) || 0), 0),
        diasTrabajados: filteredShifts.filter(s => !s.isOff && (!s.type || s.type === 'SHIFT')).length,
        diasOff: filteredShifts.filter(s => s.isOff).length
      };
    };
    const q1 = calcQ(true); const q2 = calcQ(false);
    return {
      q1, q2,
      moneyData: [{ name: 'Quincena 1', value: q1.dinero }, { name: 'Quincena 2', value: q2.dinero }],
      hoursData: [{ name: 'Q1', value: q1.horas }, { name: 'Q2', value: q2.horas }]
    };
  }, [shiftsDelAno, bigVentas, selectedMonth]);

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

  const turnosCalculo = useMemo(() => {
    return shiftsDelAno.filter(s => {
      let day = parseInt(s.date.split('-')[2]);
      let shiftQ = day <= 15 ? 1 : 2;
      let shiftMonth = s.month;
      if (s.type === 'INCAPACIDAD') {
        if (shiftQ === 1) shiftQ = 2;
        else { shiftQ = 1; shiftMonth = mesesFull[(mesesFull.indexOf(shiftMonth) + 1) % 12]; }
      }
      return shiftMonth === selectedMonth && shiftQ === selectedQuincena;
    });
  }, [shiftsDelAno, selectedMonth, selectedQuincena]);

  const currentBigVenta = bigVentas.find(b => b.month === selectedMonth && b.quincena === selectedQuincena);
  const bigVentaNeto = currentBigVenta ? (Number(currentBigVenta.value) || 0) * 0.92 : 0;
  const bigVentaDeduccion = currentBigVenta ? (Number(currentBigVenta.value) || 0) * 0.08 : 0;

  const baseDineroTurnos = turnosCalculo.reduce((acc, curr) => acc + (Number(curr.netPay) || 0), 0);

  let tTransportBase = 0; let tTransportExtra = 0;
  turnosCalculo.forEach(c => {
    if (c.transportAux) {
      if (c.endTime) {
        const endMins = toMinutes(c.endTime);
        if (endMins >= 1 && endMins <= 299) {
          tTransportExtra += 5000; tTransportBase += (Number(c.transportAux) - 5000);
        } else tTransportBase += Number(c.transportAux);
      } else tTransportBase += Number(c.transportAux);
    }
  });

  const totalsData: QuincenaTotals = {
    totalListaHoras: turnosCalculo.reduce((acc, curr) => acc + (Number(curr.totalHours) || 0), 0),
    totalListaDinero: baseDineroTurnos + bigVentaNeto,
    tOrdD_h: turnosCalculo.reduce((a, c) => a + (Number(c.hOrdD) || 0), 0), tOrdD_p: turnosCalculo.reduce((a, c) => a + (Number(c.pOrdD) || 0), 0),
    tOrdN_h: turnosCalculo.reduce((a, c) => a + (Number(c.hOrdN) || 0), 0), tOrdN_p: turnosCalculo.reduce((a, c) => a + (Number(c.pOrdN) || 0), 0),
    tDomD_h: turnosCalculo.reduce((a, c) => a + (Number(c.hDomD) || 0), 0), tDomD_p: turnosCalculo.reduce((a, c) => a + (Number(c.pDomD) || 0), 0),
    tDomN_h: turnosCalculo.reduce((a, c) => a + (Number(c.hDomN) || 0), 0), tDomN_p: turnosCalculo.reduce((a, c) => a + (Number(c.pDomN) || 0), 0),
    tExtD_h: turnosCalculo.reduce((a, c) => a + (Number(c.hExtD) || 0), 0), tExtD_p: turnosCalculo.reduce((a, c) => a + (Number(c.pExtD) || 0), 0),
    tExtN_h: turnosCalculo.reduce((a, c) => a + (Number(c.hExtN) || 0), 0), tExtN_p: turnosCalculo.reduce((a, c) => a + (Number(c.pExtN) || 0), 0),
    tExtDomD_h: turnosCalculo.reduce((a, c) => a + (Number(c.hExtDomD) || 0), 0), tExtDomD_p: turnosCalculo.reduce((a, c) => a + (Number(c.pExtDomD) || 0), 0),
    tExtDomN_h: turnosCalculo.reduce((a, c) => a + (Number(c.hExtDomN) || 0), 0), tExtDomN_p: turnosCalculo.reduce((a, c) => a + (Number(c.pExtDomN) || 0), 0),
    tReunion_h: turnosCalculo.filter(s => s.type === 'REUNION').reduce((a, c) => a + (Number(c.totalHours) || 0), 0), tReunion_p: turnosCalculo.filter(s => s.type === 'REUNION').reduce((a, c) => a + (Number(c.salaryBase) || 0), 0),
    tCompensatorio_h: turnosCalculo.filter(s => s.type === 'COMPENSATORIO').reduce((a, c) => a + (Number(c.totalHours) || 0), 0), tCompensatorio_p: turnosCalculo.filter(s => s.type === 'COMPENSATORIO').reduce((a, c) => a + (Number(c.salaryBase) || 0), 0),
    tIncapacidad_h: turnosCalculo.filter(s => s.type === 'INCAPACIDAD').reduce((a, c) => a + (Number(c.totalHours) || 0), 0), tIncapacidad_p: turnosCalculo.filter(s => s.type === 'INCAPACIDAD').reduce((a, c) => a + (Number(c.salaryBase) || 0), 0),
    tTransportBase, tTransportExtra,
    tDeductionsFinal: turnosCalculo.reduce((a, c) => a + (Number(c.deductions) || 0), 0) + bigVentaDeduccion
  };

  const countTrabajados = turnosLista.filter(s => !s.isOff && (!s.type || s.type === 'SHIFT')).length;
  const countOff = turnosLista.filter(s => s.isOff).length;
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
    else setSelectedMonth(mesesFull[currentIndex - 1]);
  };
  const handleNextMonth = () => {
    const currentIndex = mesesFull.indexOf(selectedMonth);
    if (currentIndex === 11) { setSelectedMonth("enero"); setSelectedYear(prev => prev + 1); }
    else setSelectedMonth(mesesFull[currentIndex + 1]);
  };
  const handlePrevQuincena = () => selectedQuincena === 2 ? setSelectedQuincena(1) : (handlePrevMonth(), setSelectedQuincena(2));
  const handleNextQuincena = () => selectedQuincena === 1 ? setSelectedQuincena(2) : (handleNextMonth(), setSelectedQuincena(1));

  const handleOpenNew = () => {
    setEditingShiftId(null); setStartTime("13:00"); setEndTime("20:00");
    setHasBreak(true); setIsManualBreak(false); setBreakStart("16:30"); setBreakEnd("17:00");
    setShowModal(true);
  };

  const handleOpenSpecial = () => {
    setEditingShiftId(null); setSpecialHours(""); setSpecialRateType("ORDINARY");
    setSpecialTransport(false); setIncapacidadType('HORAS'); setSpecialTab('REUNION');
    setShowSpecialModal(true);
  };

  const handleQuickAddToday = () => {
    setSelectedYear(today.getFullYear()); setSelectedMonth(mesesFull[today.getMonth()]);
    setSelectedDate(today); handleOpenNew();
  };

  const handleOpenEdit = (e: React.MouseEvent, shift: any) => {
    e.stopPropagation(); setEditingShiftId(shift.id);
    const [year, month, day] = shift.date.split('-');
    setSelectedDate(new Date(Number(year), Number(month) - 1, Number(day)));

    if (shift.type === 'REUNION' || shift.type === 'COMPENSATORIO' || shift.type === 'INCAPACIDAD') {
      setSpecialTab(shift.type);
      if (shift.type === 'INCAPACIDAD' && shift.startTime) {
        setIncapacidadType('TURNO'); setStartTime(shift.startTime); setEndTime(shift.endTime);
        const shiftHasBreak = shift.hasBreak !== undefined ? shift.hasBreak : true;
        setHasBreak(shiftHasBreak);
        if (shiftHasBreak && shift.breakStart && shift.breakEnd) {
          setBreakStart(shift.breakStart); setBreakEnd(shift.breakEnd);
          setIsManualBreak(shift.isManualBreak !== undefined ? shift.isManualBreak : true);
        } else setIsManualBreak(false);
      } else {
        if (shift.type === 'INCAPACIDAD') setIncapacidadType('HORAS');
        setSpecialHours(shift.totalHours ? shift.totalHours.toString() : "");
        setSpecialRateType(shift.specialRateKey || "ORDINARY");
      }
      setSpecialTransport(shift.transportAux > 0); setShowSpecialModal(true); return;
    }

    const sTime = shift.startTime || "14:00"; const eTime = shift.endTime || "22:00";
    setStartTime(sTime); setEndTime(eTime);
    const shiftHasBreak = shift.hasBreak !== undefined ? shift.hasBreak : true;
    setHasBreak(shiftHasBreak);
    if (shiftHasBreak) {
      if (shift.breakStart && shift.breakEnd) {
        setBreakStart(shift.breakStart); setBreakEnd(shift.breakEnd);
        setIsManualBreak(shift.isManualBreak !== undefined ? shift.isManualBreak : true);
      } else { autoCalculateBreak(sTime, eTime); setIsManualBreak(false); }
    } else { setBreakStart("16:00"); setBreakEnd("16:30"); setIsManualBreak(false); }
    setShowModal(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); if (confirm("¿Eliminar turno?")) deleteDoc(doc(db, "shifts", id));
  }

  const handleRecalculate = async (e: React.MouseEvent, shift: any) => {
    e.stopPropagation();
    if (!user || shift.isOff || shift.type === 'REUNION' || shift.type === 'COMPENSATORIO') return;
    const shiftHasBreak = shift.hasBreak !== undefined ? shift.hasBreak : true;
    let exactSavedBreak = undefined;
    if (shiftHasBreak && shift.breakStart && shift.breakEnd) exactSavedBreak = { start: shift.breakStart, end: shift.breakEnd };
    const calc = calculateShift(shift.date, shift.startTime, shift.endTime, exactSavedBreak, role, shiftHasBreak);

    const payload: any = {
      ...shift, ...calc,
      hOrdD: calc.hOrdD, pOrdD: calc.pOrdD, hOrdN: calc.hOrdN, pOrdN: calc.pOrdN,
      hDomD: calc.hDomD, pDomD: calc.pDomD, hDomN: calc.hDomN, pDomN: calc.pDomN,
      hExtD: calc.hExtD, pExtD: calc.pExtD, hExtN: calc.hExtN, pExtN: calc.pExtN,
      hExtDomD: calc.hExtDomD, pExtDomD: calc.pExtDomD, hExtDomN: calc.hExtDomN, pExtDomN: calc.pExtDomN,
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
      if (originalShift) targetDateStr = originalShift.date;
    }
    if (!targetDateStr) {
      if (!selectedDate) return alert("Error de fecha");
      targetDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    }

    const existingSpecials = shifts.filter(s => s.date === targetDateStr && s.type && s.type !== 'SHIFT' && s.id !== editingShiftId);
    const toDelete = existingSpecials.filter(sp => isOff || sp.type === 'INCAPACIDAD' || sp.type === 'COMPENSATORIO');
    await Promise.all(toDelete.map(sp => deleteDoc(doc(db, "shifts", sp.id))));

    const docId = editingShiftId || `${user.id}_${targetDateStr}`;
    const finalBreak = (!isOff && hasBreak) ? { start: breakStart, end: breakEnd } : undefined;
    const calc = calculateShift(targetDateStr, startTime, endTime, finalBreak, role, hasBreak);
    const shiftMonthVal = selectedMonth || mesesFull[new Date(Number(targetDateStr.split('-')[0]), Number(targetDateStr.split('-')[1]) - 1, Number(targetDateStr.split('-')[2])).getMonth()];

    const payload: any = {
      userId: user.id, date: targetDateStr, type: 'SHIFT',
      startTime: isOff ? "" : startTime, endTime: isOff ? "" : endTime,
      hasBreak: isOff ? false : hasBreak, isManualBreak: isOff ? false : isManualBreak,
      breakStart: isOff ? "" : breakStart, breakEnd: isOff ? "" : breakEnd,
      netPay: isOff ? 0 : calc.netPay, salaryBase: isOff ? 0 : calc.salaryBase, transportAux: isOff ? 0 : calc.transportAux,
      deductions: isOff ? 0 : calc.deductions, totalHours: isOff ? 0 : calc.totalHours,
      hoursDay: isOff ? 0 : calc.hoursDay, hoursNight: isOff ? 0 : calc.hoursNight,
      hOrdD: isOff ? 0 : calc.hOrdD, pOrdD: isOff ? 0 : calc.pOrdD, hOrdN: isOff ? 0 : calc.hOrdN, pOrdN: isOff ? 0 : calc.pOrdN,
      hDomD: isOff ? 0 : calc.hDomD, pDomD: isOff ? 0 : calc.pDomD, hDomN: isOff ? 0 : calc.hDomN, pDomN: isOff ? 0 : calc.pDomN,
      hExtD: isOff ? 0 : calc.hExtD, pExtD: isOff ? 0 : calc.pExtD, hExtN: isOff ? 0 : calc.hExtN, pExtN: isOff ? 0 : calc.pExtN,
      hExtDomD: isOff ? 0 : calc.hExtDomD, pExtDomD: isOff ? 0 : calc.pExtDomD, hExtDomN: isOff ? 0 : calc.hExtDomN, pExtDomN: isOff ? 0 : calc.pExtDomN,
      isOff, month: shiftMonthVal, year: selectedYear, timestamp: serverTimestamp()
    };
    await setDoc(doc(db, "shifts", docId), payload, { merge: true });
    setShowModal(false); setEditingShiftId(null);
  };

  const handleSaveSpecial = async () => {
    if (!user || !selectedDate) return;
    const targetDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const docId = editingShiftId || `${user.id}_${targetDateStr}_${specialTab}`;
    const existingNormal = shifts.find(s => s.date === targetDateStr && (!s.type || s.type === 'SHIFT') && s.id !== docId);
    let toDeleteIds: string[] = [];

    if (specialTab === 'INCAPACIDAD' || specialTab === 'COMPENSATORIO') {
      if (existingNormal) toDeleteIds.push(existingNormal.id);
      const otherSpecials = shifts.filter(s => s.date === targetDateStr && s.type && s.type !== 'SHIFT' && s.id !== docId);
      toDeleteIds.push(...otherSpecials.map(s => s.id));
    } else if (specialTab === 'REUNION') {
      if (existingNormal && existingNormal.isOff) toDeleteIds.push(existingNormal.id);
      const incompatSpecials = shifts.filter(s => s.date === targetDateStr && (s.type === 'INCAPACIDAD' || s.type === 'COMPENSATORIO') && s.id !== docId);
      toDeleteIds.push(...incompatSpecials.map(s => s.id));
    }
    await Promise.all(toDeleteIds.map(id => deleteDoc(doc(db, "shifts", id))));

    const rateTable = RATES_BY_YEAR[selectedDate.getFullYear()]?.[role] || RATES_BY_YEAR[2026][role];
    const baseTransport = TRANSPORT_AUX_BY_YEAR[selectedDate.getFullYear()] || TRANSPORT_AUX_BY_YEAR[2026];
    const shiftMonthVal = selectedMonth || mesesFull[selectedDate.getMonth()];

    let payload: any = { userId: user.id, date: targetDateStr, type: specialTab, isOff: false, month: shiftMonthVal, year: selectedDate.getFullYear(), timestamp: serverTimestamp() };

    if (specialTab === 'INCAPACIDAD' && incapacidadType === 'TURNO') {
      if (breakError) return alert("Corrige el break primero");
      const finalBreak = hasBreak ? { start: breakStart, end: breakEnd } : undefined;
      const calc = calculateShift(targetDateStr, startTime, endTime, finalBreak, role, hasBreak);
      const transportToApply = specialTransport ? calc.transportAux : 0;
      payload = { ...payload, ...calc, transportAux: transportToApply, netPay: calc.salaryBase + transportToApply - calc.deductions };
    } else {
      if (!specialHours || Number(specialHours) <= 0) return alert("Ingresa horas válidas");
      const rate = rateTable[specialRateType as keyof typeof rateTable] || rateTable.ORDINARY;
      const hrs = Number(specialHours); const moneyBase = hrs * rate;
      const healthPension = Math.round(moneyBase * 0.08); const transport = specialTransport ? baseTransport : 0;
      payload = {
        ...payload, startTime: "", endTime: "", hasBreak: false, totalHours: hrs, salaryBase: Math.round(moneyBase),
        deductions: healthPension, transportAux: transport, netPay: Math.round(moneyBase - healthPension + transport),
        specialRateKey: specialRateType, breakStart: "", breakEnd: "", hoursDay: 0, hoursNight: 0,
        hOrdD: 0, pOrdD: 0, hOrdN: 0, pOrdN: 0, hDomD: 0, pDomD: 0, hDomN: 0, pDomN: 0,
        hExtD: 0, pExtD: 0, hExtN: 0, pExtN: 0, hExtDomD: 0, pExtDomD: 0, hExtDomN: 0, pExtDomN: 0
      }
    }
    await setDoc(doc(db, "shifts", docId), payload, { merge: true });
    setShowSpecialModal(false); setEditingShiftId(null);
  }

  const saveBigVenta = async () => {
    if (!user || !bigVentaValue || Number(bigVentaValue) <= 0) return;
    const docId = `${user.id}_BV_${selectedYear}_${selectedMonth}_${selectedQuincena}`;
    await setDoc(doc(db, "bigVentas", docId), { userId: user.id, year: selectedYear, month: selectedMonth, quincena: selectedQuincena, value: Number(bigVentaValue), timestamp: serverTimestamp() });
    setHasBigVenta(false); setIsEditingBigVenta(false); setBigVentaValue("");
  };
  const deleteBigVenta = async (id: string) => {
    if (confirm("¿Eliminar Big Venta?")) { await deleteDoc(doc(db, "bigVentas", id)); setIsEditingBigVenta(false); setHasBigVenta(false); }
  };

  const isDateDisabled = ({ date }: { date: Date }) => {
    if (date.getFullYear() !== selectedYear || date.getMonth() !== mesesFull.indexOf(selectedMonth)) return true;
    return selectedQuincena === 1 ? date.getDate() > 15 : date.getDate() <= 15;
  };

  const dStrForModal = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` : "";
  const existingMainShift = shiftsDelAno.find(s => s.date === dStrForModal && (!s.type || s.type === 'SHIFT'));
  const hasNormalShiftForModal = shifts.some(s => s.date === dStrForModal && (!s.type || s.type === 'SHIFT') && !s.isOff);
  const isEditingRealShift = existingMainShift && !existingMainShift.isOff;

  if (!isMounted) return <main className={`min-h-screen flex items-center justify-center font-sans ${isDarkMode ? 'bg-[#0a0a0a]' : (role === 'CREW' ? 'bg-blue-50/60' : 'bg-red-50/60')}`}><p className="text-gray-400 font-bold animate-pulse uppercase tracking-widest">Cargando datos...</p></main>;

  return (
    <>
      <SignedOut><RedirectToSignIn /></SignedOut>
      <SignedIn>
        <main className={`min-h-screen font-sans transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a]' : (role === 'CREW' ? 'bg-blue-50/60' : 'bg-red-50/60')}`}>
          <Navbar />

          <motion.button drag dragMomentum={false} whileTap={{ scale: 0.9 }} onClick={(e) => todayShift ? handleOpenEdit(e, todayShift) : handleQuickAddToday()} className="fixed bottom-24 right-6 w-14 h-14 bg-gray-500/50 backdrop-blur-md rounded-full shadow-2xl border border-gray-300/30 flex items-center justify-center text-2xl z-[90] text-white hover:bg-gray-500/70 transition-colors">
            {todayShift ? "✏️" : "➕"}
          </motion.button>

          <div className="max-w-5xl mx-auto p-6">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                {step > 1 && <button onClick={() => { window.history.back(); setSelectedDate(null); }} className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 hover:text-black dark:hover:text-white transition-colors">← ATRÁS</button>}
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-gray-900 dark:text-white leading-none transition-colors">{step === 1 && "Selecciona Mes"}{step === 2 && `Quincenas ${selectedMonth || "..."}`}{step === 3 && `Quincena ${selectedQuincena || "..."}`}</h1>
              </div>
              {step === 1 && (
                <div className="flex items-center gap-4 bg-white dark:bg-gray-900 px-6 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
                  <button onClick={() => setSelectedYear(selectedYear - 1)} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors font-black text-xl">←</button>
                  <span className="text-2xl font-black italic tracking-tighter dark:text-white">{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors font-black text-xl">→</button>
                </div>
              )}
            </div>

            {step === 1 && (
              <div className="animate-in fade-in duration-500 space-y-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {mesesFull.map((m, i) => {
                    const isCurrentMonth = m === currentMonthName && selectedYear === currentYear;

                    return (
                      <motion.button
                        key={m}
                        initial={{ opacity: 0, y: 25, scale: 0.96 }}
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true, margin: "-20px" }}
                        transition={{
                          duration: 0.45,
                          ease: "easeOut",
                          delay: i * 0.05,
                        }}
                        whileHover={{ y: -5, scale: 1.03 }}
                        whileTap={{ scale: 0.95, y: 0 }}
                        onClick={() => {
                          setSelectedMonth(m);
                          goToStep(2);
                        }}
                        className={`
              group relative w-full p-5 rounded-[1.8rem] font-black text-base md:text-lg capitalize
              transition-all duration-300 overflow-hidden

              border
              shadow-[0_2px_6px_rgba(0,0,0,0.05)]
              hover:shadow-[0_6px_14px_rgba(0,0,0,0.08)]

              ${isCurrentMonth
                            ? 'bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900/40 dark:to-yellow-800/20 text-yellow-900 dark:text-yellow-400 border-yellow-300/50'
                            : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-300 border-gray-200/60 dark:border-gray-800'
                          }
            `}
                      >
                        {/* borde interno sutil (efecto 3D) */}
                        <span className="absolute inset-0 rounded-[1.8rem] ring-1 ring-inset ring-white/40 dark:ring-white/5 pointer-events-none" />

                        {/* glow hover suave */}
                        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 pointer-events-none" />

                        {/* línea inferior animada */}
                        <span className="absolute bottom-0 left-0 h-[3px] w-0 group-hover:w-full transition-all duration-300 bg-gradient-to-r from-transparent via-black/40 to-transparent dark:via-white/40" />

                        {/* contenido */}
                        <span className="relative z-10 flex items-center justify-between">
                          <span>{m}</span>

                          {isCurrentMonth && (
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                          )}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-10">
                  <AnnualChart data={statsAnuales} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in slide-in-from-right-8 duration-500 space-y-8">

                <div className="grid md:grid-cols-2 gap-6 md:gap-8">

                  {/* QUINCENA 1 */}
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setSelectedQuincena(1); goToStep(3); }}
                    className="
          group relative bg-white dark:bg-gray-900 p-7 md:p-8 rounded-[3rem]
          cursor-pointer transition-all duration-300 overflow-hidden

          border border-gray-200/60 dark:border-gray-800
          shadow-[0_4px_12px_rgba(0,0,0,0.06)]
          hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)]
        "
                  >
                    {/* borde interno 3D */}
                    <span className="absolute inset-0 rounded-[3rem] ring-1 ring-inset ring-white/40 dark:ring-white/5 pointer-events-none" />

                    {/* glow hover */}
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 pointer-events-none" />

                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <span className="text-5xl font-black text-gray-900 dark:text-white block">01</span>
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                          Días 01 - 15
                        </span>
                      </div>

                      <div className="text-right">
                        <p className={`text-3xl font-black tracking-tighter ${getDineroColor(statsQuincenas.q1.dinero)}`}>
                          ${Math.floor(statsQuincenas.q1.dinero).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 uppercase">Acumulado</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-center border border-gray-100 dark:border-gray-700 relative z-10">
                      <div>
                        <p className="text-xl font-black dark:text-white">{statsQuincenas.q1.horas.toFixed(1)}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Horas</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-green-600 dark:text-green-400">{statsQuincenas.q1.diasTrabajados}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Días Job</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-red-500 dark:text-red-400">{statsQuincenas.q1.diasOff}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Días Off</p>
                      </div>
                    </div>
                  </motion.div>


                  {/* QUINCENA 2 */}
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setSelectedQuincena(2); goToStep(3); }}
                    className="
          group relative bg-white dark:bg-gray-900 p-7 md:p-8 rounded-[3rem]
          cursor-pointer transition-all duration-300 overflow-hidden

          border border-gray-200/60 dark:border-gray-800
          shadow-[0_4px_12px_rgba(0,0,0,0.06)]
          hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)]
        "
                  >
                    {/* borde interno */}
                    <span className="absolute inset-0 rounded-[3rem] ring-1 ring-inset ring-white/40 dark:ring-white/5 pointer-events-none" />

                    {/* glow */}
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 pointer-events-none" />

                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <span className="text-5xl font-black text-gray-900 dark:text-white block">02</span>
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                          Días 16 - {getLastDayOfMonth()}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className={`text-3xl font-black tracking-tighter ${getDineroColor(statsQuincenas.q2.dinero)}`}>
                          ${Math.floor(statsQuincenas.q2.dinero).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 uppercase">Acumulado</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-center border border-gray-100 dark:border-gray-700 relative z-10">
                      <div>
                        <p className="text-xl font-black dark:text-white">{statsQuincenas.q2.horas.toFixed(1)}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Horas</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-green-600 dark:text-green-400">{statsQuincenas.q2.diasTrabajados}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Días Job</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-red-500 dark:text-red-400">{statsQuincenas.q2.diasOff}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Días Off</p>
                      </div>
                    </div>
                  </motion.div>

                </div>

                <div className="mt-8">
                  <QuincenaCharts data={statsQuincenas} />
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
                    <div className="text-center"><h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-gray-900 dark:text-white leading-tight">{selectedMonth} {selectedYear}</h3><p className="text-[10px] font-bold text-gray-400 uppercase">Quincena {selectedQuincena}</p></div>
                    <div className="flex gap-1 md:gap-3">
                      <button onClick={handleNextQuincena} className="p-2 px-3 md:px-4 bg-white dark:bg-gray-900 rounded-xl text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white hover:shadow-md font-black text-lg transition-all border border-gray-100 dark:border-gray-700" title="Siguiente Quincena">›</button>
                      <button onClick={handleNextMonth} className="p-2 px-3 md:px-4 bg-white dark:bg-gray-900 rounded-xl text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white hover:shadow-md font-black text-lg transition-all border border-gray-100 dark:border-gray-700" title="Mes Siguiente">»</button>
                    </div>
                  </div>

                  <Calendar
                    showNavigation={false} onChange={(val) => setSelectedDate(val as Date)} value={selectedDate} activeStartDate={new Date(selectedYear, mesesFull.indexOf(selectedMonth), 1)} tileDisabled={isDateDisabled}
                    tileClassName={({ date }) => {
                      const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      const dayEvents = shiftsDelAno.filter(shift => shift.date === dStr);
                      const isDisabled = isDateDisabled({ date });
                      const hasOff = dayEvents.some(e => e.isOff); const hasIncapacidad = dayEvents.some(e => e.type === 'INCAPACIDAD');
                      const hasShift = dayEvents.some(e => e.type === 'SHIFT' || !e.type); const hasReunion = dayEvents.some(e => e.type === 'REUNION'); const hasCompensatorio = dayEvents.some(e => e.type === 'COMPENSATORIO');
                      let classes = 'font-bold rounded-2xl transition-all relative overflow-hidden ';
                      if (isDisabled) classes += 'opacity-20 saturate-50 cursor-not-allowed '; else classes += 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ';
                      if (hasIncapacidad) classes += '!bg-white !text-red-600 !ring-2 !ring-inset !ring-red-500 shadow-md is-incapacidad ';
                      else if (hasShift && hasReunion) classes += '!bg-green-500 !text-white !ring-[4px] !ring-inset !ring-orange-400 shadow-sm ';
                      else if (hasOff && hasReunion) classes += '!bg-red-500 !text-white !ring-[4px] !ring-inset !ring-orange-400 shadow-sm ';
                      else if (hasReunion) classes += '!bg-orange-500 !text-white !ring-2 !ring-inset !ring-orange-400 shadow-sm ';
                      else if (hasCompensatorio) classes += '!bg-yellow-400 !text-black shadow-sm ';
                      else if (hasOff) classes += '!bg-red-500 !text-white shadow-sm ';
                      else if (hasShift) classes += '!bg-green-500 !text-white shadow-sm ';
                      if (selectedDate && date.getTime() === selectedDate.getTime()) classes += '!ring-4 !ring-blue-400 ';
                      else if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) {
                        if (!hasShift && !hasOff && !hasIncapacidad && !hasReunion && !hasCompensatorio) classes += '!bg-yellow-100 dark:!bg-yellow-900/40 text-yellow-800 dark:!text-yellow-500 font-black !ring-2 !ring-inset !ring-yellow-400 ';
                        else classes += '!ring-4 !ring-yellow-400 ';
                      }
                      if (date.getDay() === 0 && !hasShift && !hasOff && !hasIncapacidad && !hasReunion && !hasCompensatorio) classes += 'text-red-500 dark:text-red-400 ';
                      if (!hasShift && !hasOff && !hasIncapacidad && !hasReunion && !hasCompensatorio && date.getDay() !== 0) classes += 'text-gray-700 dark:text-gray-300 ';
                      return classes;
                    }}
                  />

                  <div className="mt-8 flex gap-3 transition-all duration-300">
                    <button disabled={!selectedDate} onClick={(e) => { if (isEditingRealShift) handleOpenEdit(e, existingMainShift); else { setSelectedDate(selectedDate); handleOpenNew(); } }} className={`flex-[4] py-4 rounded-2xl font-black shadow-lg uppercase text-[10px] md:text-xs tracking-widest transition-all ${selectedDate ? `${colors.secondary} text-white hover:brightness-110 active:scale-95 cursor-pointer` : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'}`}>{isEditingRealShift ? "✏️ Editar Turno" : "+ Agregar Turno"}</button>
                    <button disabled={!selectedDate} onClick={() => handleSaveShift(true)} className={`flex-[4] py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all border border-transparent ${selectedDate ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 cursor-pointer' : 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}>Marcar OFF</button>
                    <button disabled={!selectedDate} onClick={handleOpenSpecial} title="Eventos Especiales" className={`flex-[1] py-4 rounded-2xl font-black shadow-lg transition-all text-xl ${selectedDate ? `bg-gray-900 dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95 cursor-pointer` : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'}`}>...</button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
                  <div className="p-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-black italic uppercase dark:text-white">Turnos Registrados</h2>
                    <div className="flex gap-4">
                      <span className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-full border border-green-200 dark:border-green-800/50 transition-colors">Trabajados: {countTrabajados}</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-4 py-2 rounded-full border border-red-200 dark:border-red-800/50 transition-colors">OFF: {countOff}</span>
                    </div>
                  </div>

                  <ShiftList turnosLista={turnosLista} expandedShiftId={expandedShiftId} incapacidadType={incapacidadType} handleToggleExpand={handleToggleExpand} handleOpenEdit={handleOpenEdit} handleRecalculate={handleRecalculate} handleDelete={handleDelete} />
                  {turnosLista.length > 0 && (
                    <QuincenaSummary totals={totalsData} getDineroColor={getDineroColor} currentBigVenta={currentBigVenta} isEditingBigVenta={isEditingBigVenta} setIsEditingBigVenta={setIsEditingBigVenta} hasBigVenta={hasBigVenta} setHasBigVenta={setHasBigVenta} bigVentaValue={bigVentaValue} setBigVentaValue={setBigVentaValue} saveBigVenta={saveBigVenta} deleteBigVenta={deleteBigVenta} />
                  )}
                </div>
              </div>
            )}
          </div>

          <NormalShiftModal showModal={showModal} setShowModal={setShowModal} editingShiftId={editingShiftId} selectedDate={selectedDate} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} hasBreak={hasBreak} setHasBreak={setHasBreak} isManualBreak={isManualBreak} setIsManualBreak={setIsManualBreak} breakStart={breakStart} setBreakStart={setBreakStart} breakEnd={breakEnd} setBreakEnd={setBreakEnd} breakError={breakError} autoCalculateBreak={autoCalculateBreak} handleSaveShift={handleSaveShift} />
          <SpecialShiftModal showSpecialModal={showSpecialModal} setShowSpecialModal={setShowSpecialModal} editingShiftId={editingShiftId} selectedDate={selectedDate} hasNormalShiftForModal={hasNormalShiftForModal} specialTab={specialTab} setSpecialTab={setSpecialTab} incapacidadType={incapacidadType} setIncapacidadType={setIncapacidadType} specialHours={specialHours} setSpecialHours={setSpecialHours} specialRateType={specialRateType} setSpecialRateType={setSpecialRateType} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} hasBreak={hasBreak} setHasBreak={setHasBreak} isManualBreak={isManualBreak} autoCalculateBreak={autoCalculateBreak} specialTransport={specialTransport} setSpecialTransport={setSpecialTransport} handleSaveSpecial={handleSaveSpecial} />

          <style jsx global>{`
            .react-calendar { width: 100% !important; border: none !important; font-family: inherit; background: transparent !important; }
            .react-calendar__tile { padding: 1.2em 0.5em !important; font-weight: 700; border-radius: 1.2rem; transition: all 0.2s; background: transparent; }
            .react-calendar__tile:disabled { background: transparent !important; }
            .react-calendar__tile:enabled:hover { background-color: #f3f4f6; }
            
            .react-calendar__tile--active { background: transparent !important; color: #111827 !important; }
            .dark .react-calendar__tile--active { color: #ffffff !important; }
            .react-calendar__tile--active:enabled:hover, .react-calendar__tile--active:enabled:focus { background: transparent !important; }
            
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .dark .react-calendar__tile { color: #d1d5db; }
            .dark .react-calendar__tile:enabled:hover { background-color: #1f2937; color: #fff; }
            .dark .react-calendar__navigation button { color: #fff; }
            .is-incapacidad::after { content: '✚'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 2.2rem; line-height: 1; color: rgba(239, 68, 68, 0.15); pointer-events: none; z-index: 0; }
            .is-incapacidad abbr { position: relative; z-index: 1; }
          `}</style>
          <div className="h-16 md:h-20"></div>
          <div className="w-full border-t border-gray-100 dark:border-gray-900/50 pt-8"><Footer /></div>
          <PayrollFeedback />
        </main>
      </SignedIn>
    </>
  );
}