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

  // Si cruza medianoche
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

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
      isSunday(current);

    const rateTable = RATES[role];

    // Determinar tarifa por minuto
    const dayRate = isFestivo ? rateTable.SUNDAY : rateTable.ORDINARY;
    const nightRate = isFestivo
      ? rateTable.SUNDAY_NIGHT
      : rateTable.ORDINARY_NIGHT;

    if (isNight) {
      nightMinutes++;
    } else {
      dayMinutes++;
    }

    totalMinutesWorked++;
    current.setMinutes(current.getMinutes() + 1);
  }

  // 🔥 BREAK PERSONALIZADO (si existe)
  if (manualBreak) {
    const breakStart = new Date(`${dateStr}T${manualBreak.start}`);
    let breakEnd = new Date(`${dateStr}T${manualBreak.end}`);

    if (breakEnd <= breakStart) {
      breakEnd.setDate(breakEnd.getDate() + 1);
    }

    const breakMinutes =
      (breakEnd.getTime() - breakStart.getTime()) / 60000;

    totalMinutesWorked -= breakMinutes;

    // Se descuenta proporcionalmente primero de día
    if (dayMinutes >= breakMinutes) {
      dayMinutes -= breakMinutes;
    } else {
      const remaining = breakMinutes - dayMinutes;
      dayMinutes = 0;
      nightMinutes -= remaining;
    }
  }

  // 🔥 BREAK AUTOMÁTICO (solo si NO hay manual)
  else if (totalMinutesWorked >= 330) {
    const deduction = 30;
    totalMinutesWorked -= deduction;

    if (dayMinutes >= deduction) {
      dayMinutes -= deduction;
    } else {
      const remaining = deduction - dayMinutes;
      dayMinutes = 0;
      nightMinutes -= remaining;
    }
  }

  const hoursDay = dayMinutes / 60;
  const hoursNight = nightMinutes / 60;

  const rateTable = RATES[role];

  const totalMoney =
    (hoursDay * rateTable.ORDINARY) +
    (hoursNight * rateTable.ORDINARY_NIGHT) +
    TRANSPORT_AUX_DAILY;

  return {
    hoursDay,
    hoursNight,
    totalHours: totalMinutesWorked / 60,
    totalMoney,
  };
}
