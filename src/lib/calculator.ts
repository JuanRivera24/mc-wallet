import { RATES, HOLIDAYS_2026, TRANSPORT_AUX_DAILY, Role } from "@/constants/rates";
import { isSunday } from "date-fns";

export function calculateShift(
  dateStr: string,
  startTime: string,
  endTime: string,
  manualBreak?: { start: string; end: string },
  role: Role = "CREW",
  hasBreak: boolean = true // NUEVO PARÁMETRO: Define si el turno descuenta break o no
) {
  const start = new Date(`${dateStr}T${startTime}`);
  let end = new Date(`${dateStr}T${endTime}`);
  if (end <= start) end.setDate(end.getDate() + 1);

  // Contadores generales originales
  let dayMinutes = 0;
  let nightMinutes = 0;

  // NUEVOS: Contadores detallados (Minutos)
  let mOrdD = 0, mOrdN = 0, mDomD = 0, mDomN = 0;
  let mExtD = 0, mExtN = 0, mExtDomD = 0, mExtDomN = 0;
  
  // NUEVOS: Contadores de dinero por cada tipo
  let pOrdD = 0, pOrdN = 0, pDomD = 0, pDomN = 0;
  let pExtD = 0, pExtN = 0, pExtDomD = 0, pExtDomN = 0;

  let moneyBase = 0;
  let totalMinutesWorked = 0;

  const rateTable = RATES[role];

  // 1. PROCESAMIENTO MINUTO A MINUTO
  const current = new Date(start);
  while (current < end) {
    const currentDateStr = current.toISOString().split("T")[0];
    const hour = current.getHours();
    
    const isNight = hour >= 19 || hour < 6;
    const isFestivo = HOLIDAYS_2026.includes(currentDateStr) || isSunday(current);
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

  // 2. LÓGICA DE BREAK EXACTA (SOLO SE EJECUTA SI hasBreak ES TRUE)
  if (hasBreak) {
    if (manualBreak) {
      const bStart = new Date(`${dateStr}T${manualBreak.start}`);
      let bEnd = new Date(`${dateStr}T${manualBreak.end}`);
      if (bEnd <= bStart) bEnd.setDate(bEnd.getDate() + 1);

      const bCurrent = new Date(bStart);
      while (bCurrent < bEnd) {
        if (bCurrent >= start && bCurrent < end) {
          const bDateStr = bCurrent.toISOString().split("T")[0];
          const bHour = bCurrent.getHours();
          const bIsNight = bHour >= 19 || bHour < 6;
          const bIsFestivo = HOLIDAYS_2026.includes(bDateStr) || isSunday(bCurrent);

          let deductionPerMinute;
          if (bIsNight) {
            deductionPerMinute = bIsFestivo ? rateTable.SUNDAY_NIGHT / 60 : rateTable.ORDINARY_NIGHT / 60;
            nightMinutes--;
            // Restamos del contador detallado
            if (bIsFestivo) { mDomN = Math.max(0, mDomN - 1); pDomN = Math.max(0, pDomN - deductionPerMinute); }
            else { mOrdN = Math.max(0, mOrdN - 1); pOrdN = Math.max(0, pOrdN - deductionPerMinute); }
          } else {
            deductionPerMinute = bIsFestivo ? rateTable.SUNDAY / 60 : rateTable.ORDINARY / 60;
            dayMinutes--;
            // Restamos del contador detallado
            if (bIsFestivo) { mDomD = Math.max(0, mDomD - 1); pDomD = Math.max(0, pDomD - deductionPerMinute); }
            else { mOrdD = Math.max(0, mOrdD - 1); pOrdD = Math.max(0, pOrdD - deductionPerMinute); }
          }
          moneyBase -= deductionPerMinute;
          totalMinutesWorked--;
        }
        bCurrent.setMinutes(bCurrent.getMinutes() + 1);
      }
    } 
    else if (totalMinutesWorked >= 330) { 
      const deductionMinutes = 30;
      const isFestivoStart = HOLIDAYS_2026.includes(dateStr) || isSunday(start);

      const rateDayMinute = isFestivoStart ? rateTable.SUNDAY / 60 : rateTable.ORDINARY / 60;
      const rateNightMinute = isFestivoStart ? rateTable.SUNDAY_NIGHT / 60 : rateTable.ORDINARY_NIGHT / 60;

      if (dayMinutes >= deductionMinutes) {
        moneyBase -= (rateDayMinute * deductionMinutes);
        dayMinutes -= deductionMinutes;
        if (isFestivoStart) { 
          mDomD = Math.max(0, mDomD - deductionMinutes); 
          pDomD = Math.max(0, pDomD - (rateDayMinute * deductionMinutes)); 
        } else { 
          mOrdD = Math.max(0, mOrdD - deductionMinutes); 
          pOrdD = Math.max(0, pOrdD - (rateDayMinute * deductionMinutes)); 
        }
      } else {
        const remaining = deductionMinutes - dayMinutes;
        moneyBase -= (rateDayMinute * dayMinutes); 
        moneyBase -= (rateNightMinute * remaining); 

        if (isFestivoStart) {
           pDomD = Math.max(0, pDomD - (rateDayMinute * dayMinutes));
           mDomD = Math.max(0, mDomD - dayMinutes);
           pDomN = Math.max(0, pDomN - (rateNightMinute * remaining));
           mDomN = Math.max(0, mDomN - remaining);
        } else {
           pOrdD = Math.max(0, pOrdD - (rateDayMinute * dayMinutes));
           mOrdD = Math.max(0, mOrdD - dayMinutes);
           pOrdN = Math.max(0, pOrdN - (rateNightMinute * remaining));
           mOrdN = Math.max(0, mOrdN - remaining);
        }

        dayMinutes = 0;
        nightMinutes -= remaining;
      }
      totalMinutesWorked -= deductionMinutes;
    }
  }

  // 3. CONSOLIDACIÓN FINAL
  const salaryBase = Math.round(moneyBase);
  const healthPension = Math.round(salaryBase * 0.08); 
  
  let transport = TRANSPORT_AUX_DAILY;
  if (endTime >= "00:01" && endTime <= "04:59") {
    transport += 5000;
  }

  const netPay = (salaryBase - healthPension) + transport;

  return {
    date: dateStr,
    
    // Contadores Originales (Protegen la App)
    hoursDay: Number((dayMinutes / 60).toFixed(2)),
    hoursNight: Number((nightMinutes / 60).toFixed(2)),
    totalHours: Number((totalMinutesWorked / 60).toFixed(2)),

    salaryBase: salaryBase,       
    transportAux: transport,      
    deductions: healthPension,    
    netPay: netPay,
    
    // NUEVOS Contadores Detallados (Horas y Dinero)
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
