import { RATES_BY_YEAR, HOLIDAYS_COLOMBIA, TRANSPORT_AUX_BY_YEAR, Role } from "@/constants/rates";
import { isSunday } from "date-fns";

export function calculateShift(
  dateStr: string,
  startTime: string,
  endTime: string,
  manualBreak?: { start: string; end: string },
  role: Role = "CREW",
  hasBreak: boolean = true 
) {
  const start = new Date(`${dateStr}T${startTime}`);
  let end = new Date(`${dateStr}T${endTime}`);
  if (end <= start) end.setDate(end.getDate() + 1);

  const shiftYear = parseInt(dateStr.split('-')[0], 10);
  const rateTable = RATES_BY_YEAR[shiftYear]?.[role] || RATES_BY_YEAR[2026][role];
  const baseTransport = TRANSPORT_AUX_BY_YEAR[shiftYear] || TRANSPORT_AUX_BY_YEAR[2026];

  // --- CONFIGURACIÓN EXACTA DEL BREAK ---
  let bStart: Date | null = null;
  let bEnd: Date | null = null;

  if (hasBreak && manualBreak && manualBreak.start && manualBreak.end) {
    bStart = new Date(`${dateStr}T${manualBreak.start}`);
    bEnd = new Date(`${dateStr}T${manualBreak.end}`);
    
    if (bEnd <= bStart) bEnd.setDate(bEnd.getDate() + 1);
    if (bStart < start) {
       bStart.setDate(bStart.getDate() + 1);
       bEnd.setDate(bEnd.getDate() + 1);
    }
  } else if (hasBreak && !manualBreak) {
     const duration = (end.getTime() - start.getTime()) / 60000;
     if (duration >= 330) {
         const mid = new Date(start.getTime() + (duration * 60000) / 2);
         bStart = new Date(mid.getTime() - 15 * 60000);
         bEnd = new Date(mid.getTime() + 15 * 60000);
     }
  }

  // Identificador único para saber en qué quincena estamos
  const getQuincenaKey = (d: Date) => {
      const y = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const q = d.getDate() <= 15 ? 1 : 2;
      return `${y}-${mStr}-${q}`;
  };

  const parts: Record<string, any> = {};
  let globalMinutesWorked = 0;

  // 1. PROCESAMIENTO MINUTO A MINUTO
  const current = new Date(start);
  while (current < end) {
    
    if (bStart && bEnd && current >= bStart && current < bEnd) {
        current.setMinutes(current.getMinutes() + 1);
        continue;
    }

    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    const currentDateStr = `${y}-${m}-${d}`;
    const qKey = getQuincenaKey(current);
    
    // Si la quincena cambia en la madrugada, creamos un nuevo bloque
    if (!parts[qKey]) {
        parts[qKey] = {
            date: currentDateStr,
            dayMinutes: 0, nightMinutes: 0, totalMinutesWorked: 0, moneyBase: 0,
            mOrdD: 0, mOrdN: 0, mDomD: 0, mDomN: 0,
            mExtD: 0, mExtN: 0, mExtDomD: 0, mExtDomN: 0,
            pOrdD: 0, pOrdN: 0, pDomD: 0, pDomN: 0,
            pExtD: 0, pExtN: 0, pExtDomD: 0, pExtDomN: 0,
        };
    }

    const p = parts[qKey];
    const hour = current.getHours();
    
    const isNight = hour >= 19 || hour < 6;
    const isFestivo = HOLIDAYS_COLOMBIA.includes(currentDateStr) || isSunday(current);
    const isExtra = globalMinutesWorked >= 480; // Extras calculadas sobre el turno continuo

    let ratePerMinute = 0;

    if (!isExtra) { 
      if (!isFestivo && !isNight) { ratePerMinute = rateTable.ORDINARY / 60; p.mOrdD++; p.pOrdD += ratePerMinute; }
      if (!isFestivo && isNight)  { ratePerMinute = rateTable.ORDINARY_NIGHT / 60; p.mOrdN++; p.pOrdN += ratePerMinute; }
      if (isFestivo && !isNight)  { ratePerMinute = rateTable.SUNDAY / 60; p.mDomD++; p.pDomD += ratePerMinute; }
      if (isFestivo && isNight)   { ratePerMinute = rateTable.SUNDAY_NIGHT / 60; p.mDomN++; p.pDomN += ratePerMinute; }
    } else { 
      if (!isFestivo && !isNight) { ratePerMinute = rateTable.EXTRA_DAY / 60; p.mExtD++; p.pExtD += ratePerMinute; }
      if (!isFestivo && isNight)  { ratePerMinute = rateTable.EXTRA_NIGHT / 60; p.mExtN++; p.pExtN += ratePerMinute; }
      if (isFestivo && !isNight)  { ratePerMinute = rateTable.EXTRA_FESTIVE_DAY / 60; p.mExtDomD++; p.pExtDomD += ratePerMinute; }
      if (isFestivo && isNight)   { ratePerMinute = rateTable.EXTRA_FESTIVE_NIGHT / 60; p.mExtDomN++; p.pExtDomN += ratePerMinute; }
    }

    if (isNight) p.nightMinutes++; else p.dayMinutes++;
    p.moneyBase += ratePerMinute;
    p.totalMinutesWorked++;
    globalMinutesWorked++;
    current.setMinutes(current.getMinutes() + 1);
  }

  // 2. CONSOLIDACIÓN (Retornamos un Array de 1 o 2 bloques)
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const endMins = toMins(endTime);
  let transportExtra = 0;
  if (endMins >= 1 && endMins <= 299) { transportExtra = 5000; }
  const totalTransport = baseTransport + transportExtra;

  const keys = Object.keys(parts);
  const isSplit = keys.length > 1;

  return keys.map((key, index) => {
      const p = parts[key];
      const salaryBase = Math.round(p.moneyBase);
      const healthPension = Math.round(salaryBase * 0.08); 
      
      // El auxilio de transporte completo se asigna a la parte 1 para no duplicarlo
      const transport = index === 0 ? totalTransport : 0;
      const netPay = (salaryBase - healthPension) + transport;

      return {
        date: p.date, // Fecha exacta donde cayeron estas horas (ej. 15 o 16)
        isSplitPart: isSplit,
        splitIndex: index,
        totalSplits: keys.length,
        originalDate: dateStr, // Día en que inició el turno completo
        originalStartTime: startTime,
        originalEndTime: endTime,
        
        hoursDay: Number((p.dayMinutes / 60).toFixed(2)),
        hoursNight: Number((p.nightMinutes / 60).toFixed(2)),
        totalHours: Number((p.totalMinutesWorked / 60).toFixed(2)),

        salaryBase: salaryBase,       
        transportAux: transport,      
        deductions: healthPension,    
        netPay: netPay,
        
        hOrdD: Number((p.mOrdD / 60).toFixed(2)), pOrdD: Math.round(p.pOrdD),
        hOrdN: Number((p.mOrdN / 60).toFixed(2)), pOrdN: Math.round(p.pOrdN),
        hDomD: Number((p.mDomD / 60).toFixed(2)), pDomD: Math.round(p.pDomD),
        hDomN: Number((p.mDomN / 60).toFixed(2)), pDomN: Math.round(p.pDomN),
        hExtD: Number((p.mExtD / 60).toFixed(2)), pExtD: Math.round(p.pExtD),
        hExtN: Number((p.mExtN / 60).toFixed(2)), pExtN: Math.round(p.pExtN),
        hExtDomD: Number((p.mExtDomD / 60).toFixed(2)), pExtDomD: Math.round(p.pExtDomD),
        hExtDomN: Number((p.mExtDomN / 60).toFixed(2)), pExtDomN: Math.round(p.pExtDomN),
      };
  });
}