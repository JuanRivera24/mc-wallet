// src/lib/calculator.ts

import { RATES, HOLIDAYS_2026, TRANSPORT_AUX_DAILY, Role } from "@/constants/rates";
import { isSunday } from "date-fns";

export function calculateShift(
  dateStr: string,
  startTime: string,
  endTime: string,
  manualBreak?: { start: string; end: string },
  role: Role = "CREW"
) {
  const start = new Date(`${dateStr}T${startTime}`);
  let end = new Date(`${dateStr}T${endTime}`);

  if (end < start) end.setDate(end.getDate() + 1);

  let dayMinutes = 0;
  let nightMinutes = 0;
  let totalMinutesWorked = 0;

  const current = new Date(start);

  while (current < end) {
    const currentDateStr = current.toISOString().split("T")[0];
    const hour = current.getHours();

    const isNight = hour >= 19 || hour < 6;
    const isFestivo =
      HOLIDAYS_2026.includes(currentDateStr) ||
      isSunday(new Date(currentDateStr));

    const rateTable = RATES[role];

    if (isNight) nightMinutes++;
    else dayMinutes++;

    totalMinutesWorked++;
    current.setMinutes(current.getMinutes() + 1);
  }

  // ==========================
  // BREAK MANUAL
  // ==========================
  if (manualBreak) {
    const breakStart = new Date(`${dateStr}T${manualBreak.start}`);
    let breakEnd = new Date(`${dateStr}T${manualBreak.end}`);
    if (breakEnd < breakStart) breakEnd.setDate(breakEnd.getDate() + 1);

    const breakMinutes =
      (breakEnd.getTime() - breakStart.getTime()) / 60000;

    let remaining = breakMinutes;

    if (dayMinutes >= remaining) {
      dayMinutes -= remaining;
    } else {
      remaining -= dayMinutes;
      dayMinutes = 0;
      nightMinutes -= remaining;
    }

    totalMinutesWorked -= breakMinutes;
  }

  // ==========================
  // BREAK AUTOMÁTICO (solo si >= 5.5h y NO hay manual)
  // ==========================
  if (!manualBreak && totalMinutesWorked >= 330) {
    let deduction = 30;

    if (dayMinutes >= deduction) {
      dayMinutes -= deduction;
    } else {
      deduction -= dayMinutes;
      dayMinutes = 0;
      nightMinutes -= deduction;
    }

    totalMinutesWorked -= 30;
  }

  // ==========================
  // CÁLCULO POR DÍA REAL (importante para turnos cruzando medianoche)
  // ==========================

  const isOriginalFestivo =
    HOLIDAYS_2026.includes(dateStr) ||
    isSunday(new Date(dateStr));

  const rateTable = RATES[role];

  const dayRate = isOriginalFestivo
    ? rateTable.SUNDAY
    : rateTable.ORDINARY;

  const nightRate = isOriginalFestivo
    ? rateTable.SUNDAY_NIGHT
    : rateTable.ORDINARY_NIGHT;

  const hoursDay = dayMinutes / 60;
  const hoursNight = nightMinutes / 60;

  const salaryMoney =
    hoursDay * dayRate + hoursNight * nightRate;

  return {
    hoursDay,
    hoursNight,
    totalHours: totalMinutesWorked / 60,
    salaryMoney, // SOLO salario
    transportAux: TRANSPORT_AUX_DAILY, // separado
    totalMoney: salaryMoney + TRANSPORT_AUX_DAILY,
  };
}
