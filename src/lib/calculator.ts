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

  if (hasBreak && manualBreak) {
    bStart = new Date(`${dateStr}T${manualBreak.start}`);
    bEnd = new Date(`${dateStr}T${manualBreak.end}`);
    
    // Si el break cruza la medianoche (ej: 23:45 a 00:15)
    if (bEnd <= bStart) bEnd.setDate(bEnd.getDate() + 1);

    // Si el break ocurre en la madrugada del día siguiente al inicio del turno
    if (bStart < start) {
       bStart.setDate(bStart.getDate() + 1);
       bEnd.setDate(bEnd.getDate() + 1);
    }
  } else if (hasBreak && !manualBreak) {
     // Fallback de seguridad (por si la UI falla): Break de 30 mins a la mitad
     const duration = (end.getTime() - start.getTime()) / 60000;
     if (duration >= 330) {
         const mid = new Date(start.getTime() + (duration * 60000) / 2);
         bStart = new Date(mid.getTime() - 15 * 60000);
         bEnd = new Date(mid.getTime() + 15 * 60000);
     }
  }

  let dayMinutes = 0;
  let nightMinutes = 0;
  let mOrdD = 0, mOrdN = 0, mDomD = 0, mDomN = 0;
  let mExtD = 0, mExtN = 0, mExtDomD = 0, mExtDomN = 0;
  let pOrdD = 0, pOrdN = 0, pDomD = 0, pDomN = 0;
  let pExtD = 0, pExtN = 0, pExtDomD = 0, pExtDomN = 0;

  let moneyBase = 0;
  let totalMinutesWorked = 0;

  // 1. PROCESAMIENTO MINUTO A MINUTO (UNIFICADO)
  const current = new Date(start);
  while (current < end) {
    
    // LÓGICA DE BREAK DEFENSIVA: Si estamos en horario de break, saltamos el minuto
    if (bStart && bEnd && current >= bStart && current < bEnd) {
        current.setMinutes(current.getMinutes() + 1);
        continue;
    }

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const currentDateStr = `${year}-${month}-${day}`;
    
    const hour = current.getHours();
    
    const isNight = hour >= 19 || hour < 6;
    const isFestivo = HOLIDAYS_COLOMBIA.includes(currentDateStr) || isSunday(current);
    const isExtra = totalMinutesWorked >= 480;

    let ratePerMinute = 0;

    if (!isExtra) { 
      if (!isFestivo && !isNight) { ratePerMinute = rateTable.ORDINARY / 60; mOrdD++; pOrdD += ratePerMinute; }
      if (!isFestivo && isNight)  { ratePerMinute = rateTable.ORDINARY_NIGHT / 60; mOrdN++; pOrdN += ratePerMinute; }
      if (isFestivo && !isNight)  { ratePerMinute = rateTable.SUNDAY / 60; mDomD++; pDomD += ratePerMinute; }
      if (isFestivo && isNight)   { ratePerMinute = rateTable.SUNDAY_NIGHT / 60; mDomN++; pDomN += ratePerMinute; }
    } else { 
      if (!isFestivo && !isNight) { ratePerMinute = rateTable.EXTRA_DAY / 60; mExtD++; pExtD += ratePerMinute; }
      if (!isFestivo && isNight)  { ratePerMinute = rateTable.EXTRA_NIGHT / 60; mExtN++; pExtN += ratePerMinute; }
      if (isFestivo && !isNight)  { ratePerMinute = rateTable.EXTRA_FESTIVE_DAY / 60; mExtDomD++; pExtDomD += ratePerMinute; }
      if (isFestivo && isNight)   { ratePerMinute = rateTable.EXTRA_FESTIVE_NIGHT / 60; mExtDomN++; pExtDomN += ratePerMinute; }
    }

    if (isNight) nightMinutes++; else dayMinutes++;
    moneyBase += ratePerMinute;
    totalMinutesWorked++;
    current.setMinutes(current.getMinutes() + 1);
  }

  // 2. CONSOLIDACIÓN FINAL
  const salaryBase = Math.round(moneyBase);
  const healthPension = Math.round(salaryBase * 0.08); 
  
  let transport = baseTransport;
  
  // FIX de string comparison para el auxilio nocturno
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const endMins = toMins(endTime);
  
  if (endMins >= 1 && endMins <= 299) { // 00:01 a 04:59
    transport += 5000;
  }

  const netPay = (salaryBase - healthPension) + transport;

  return {
    date: dateStr,
    
    hoursDay: Number((dayMinutes / 60).toFixed(2)),
    hoursNight: Number((nightMinutes / 60).toFixed(2)),
    totalHours: Number((totalMinutesWorked / 60).toFixed(2)),

    salaryBase: salaryBase,       
    transportAux: transport,      
    deductions: healthPension,    
    netPay: netPay,
    
    hOrdD: Number((mOrdD / 60).toFixed(2)), pOrdD: Math.round(pOrdD),
    hOrdN: Number((mOrdN / 60).toFixed(2)), pOrdN: Math.round(pOrdN),
    hDomD: Number((mDomD / 60).toFixed(2)), pDomD: Math.round(pDomD),
    hDomN: Number((mDomN / 60).toFixed(2)), pDomN: Math.round(pDomN),
    hExtD: Number((mExtD / 60).toFixed(2)), pExtD: Math.round(pExtD),
    hExtN: Number((mExtN / 60).toFixed(2)), pExtN: Math.round(pExtN),
    hExtDomD: Number((mExtDomD / 60).toFixed(2)), pExtDomD: Math.round(pExtDomD),
    hExtDomN: Number((mExtDomN / 60).toFixed(2)), pExtDomN: Math.round(pExtDomN),
  };
}