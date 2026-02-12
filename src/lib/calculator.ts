// src/lib/calculator.ts
import { RATES, HOLIDAYS_2026, TRANSPORT_AUX_DAILY, Role } from "@/constants/rates";
import { isSunday } from "date-fns";

/**
 * Calcula el valor exacto del turno minuto a minuto.
 * - Descuenta el break automáticamente si es > 5.5h (priorizando horas diurnas baratas).
 * - Separa el Salario Base del Auxilio de Transporte para cálculos de seguridad social.
 */
export function calculateShift(
  dateStr: string,
  startTime: string,
  endTime: string,
  manualBreak?: { start: string; end: string },
  role: Role = "CREW"
) {
  // Configuración de Fechas
  const start = new Date(`${dateStr}T${startTime}`);
  let end = new Date(`${dateStr}T${endTime}`);

  // Si el turno termina al día siguiente (ej. 22:00 a 05:00)
  if (end <= start) end.setDate(end.getDate() + 1);

  let totalMinutesWorked = 0;
  let dayMinutes = 0;
  let nightMinutes = 0;
  let moneyBase = 0; // Dinero acumulado SIN auxilio de transporte

  const rateTable = RATES[role];

  // ==========================================
  // 1. PROCESAMIENTO MINUTO A MINUTO (SUMA)
  // ==========================================
  const current = new Date(start);
  while (current < end) {
    const currentDateStr = current.toISOString().split("T")[0];
    const hour = current.getHours();

    // Definición de Recargos
    const isNight = hour >= 19 || hour < 6; // 7PM a 6AM
    const isFestivo = HOLIDAYS_2026.includes(currentDateStr) || isSunday(current);

    let ratePerMinute;
    
    if (isNight) {
      ratePerMinute = isFestivo 
        ? rateTable.SUNDAY_NIGHT / 60 
        : rateTable.ORDINARY_NIGHT / 60;
      nightMinutes++;
    } else {
      ratePerMinute = isFestivo 
        ? rateTable.SUNDAY / 60 
        : rateTable.ORDINARY / 60;
      dayMinutes++;
    }

    moneyBase += ratePerMinute;
    totalMinutesWorked++;
    
    // Avanzar 1 minuto
    current.setMinutes(current.getMinutes() + 1);
  }

  // ==========================================
  // 2. LÓGICA DE BREAK (RESTA)
  // ==========================================
  
  // A. Break Manual (Si el usuario lo define)
  if (manualBreak) {
    const bStart = new Date(`${dateStr}T${manualBreak.start}`);
    let bEnd = new Date(`${dateStr}T${manualBreak.end}`);
    if (bEnd <= bStart) bEnd.setDate(bEnd.getDate() + 1);

    // Iteramos el break para restar el valor exacto de esos minutos
    const bCurrent = new Date(bStart);
    while (bCurrent < bEnd) {
      // Solo restamos si el break cae DENTRO del turno
      if (bCurrent >= start && bCurrent < end) {
        const bDateStr = bCurrent.toISOString().split("T")[0];
        const bHour = bCurrent.getHours();
        const bIsNight = bHour >= 19 || bHour < 6;
        const bIsFestivo = HOLIDAYS_2026.includes(bDateStr) || isSunday(bCurrent);

        let deductionPerMinute;
        if (bIsNight) {
          deductionPerMinute = bIsFestivo ? rateTable.SUNDAY_NIGHT / 60 : rateTable.ORDINARY_NIGHT / 60;
          nightMinutes--;
        } else {
          deductionPerMinute = bIsFestivo ? rateTable.SUNDAY / 60 : rateTable.ORDINARY / 60;
          dayMinutes--;
        }

        moneyBase -= deductionPerMinute;
        totalMinutesWorked--;
      }
      bCurrent.setMinutes(bCurrent.getMinutes() + 1);
    }
  } 
  // B. Break Automático (Si > 5.5 horas y no hay manual)
  else if (totalMinutesWorked >= 330) { // 5.5 horas = 330 min
    const deductionMinutes = 30;
    
    // Determinamos las tarifas "promedio" del día para descontar
    // (Usamos la fecha de inicio para saber si es festivo general)
    const isFestivoStart = HOLIDAYS_2026.includes(dateStr) || isSunday(start);
    
    const rateDayMinute = isFestivoStart ? rateTable.SUNDAY / 60 : rateTable.ORDINARY / 60;
    const rateNightMinute = isFestivoStart ? rateTable.SUNDAY_NIGHT / 60 : rateTable.ORDINARY_NIGHT / 60;

    // ALGORITMO DE DESCUENTO: Priorizar quitar horas Diurnas (son más baratas para el empleado perderlas)
    if (dayMinutes >= deductionMinutes) {
      moneyBase -= (rateDayMinute * deductionMinutes);
      dayMinutes -= deductionMinutes;
    } else {
      // Si no hay suficientes diurnas, quitamos las que haya y el resto nocturnas
      const remaining = deductionMinutes - dayMinutes;
      moneyBase -= (rateDayMinute * dayMinutes); // Quita todas las diurnas
      moneyBase -= (rateNightMinute * remaining); // Quita el resto de nocturnas
      
      dayMinutes = 0;
      nightMinutes -= remaining;
    }
    totalMinutesWorked -= deductionMinutes;
  }

  // ==========================================
  // 3. CONSOLIDACIÓN FINAL
  // ==========================================

  // Cálculos de seguridad social (aproximados 8% sobre base)
  const salaryBase = Math.round(moneyBase);
  const healthPension = Math.round(salaryBase * 0.08); // 4% Salud + 4% Pensión
  const transport = TRANSPORT_AUX_DAILY; // Siempre se suma completo por día asistido
  
  const netPay = (salaryBase - healthPension) + transport;

  return {
    date: dateStr,
    hoursDay: Number((dayMinutes / 60).toFixed(2)),
    hoursNight: Number((nightMinutes / 60).toFixed(2)),
    totalHours: Number((totalMinutesWorked / 60).toFixed(2)),
    
    salaryBase: salaryBase,       // Salario bruto SIN auxilio
    transportAux: transport,      // Auxilio de transporte
    deductions: healthPension,    // Total descuentos
    totalMoney: salaryBase + transport, // Devengado total
    netPay: netPay                // Lo que llega al banco
  };
}