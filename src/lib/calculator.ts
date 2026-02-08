// src/lib/calculator.ts
import { RATES, HOLIDAYS_2026, TRANSPORT_AUX_DAILY, Role } from "@/constants/rates";
import { isSunday, parseISO } from "date-fns";

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

  let breakStart: Date | null = null;
  let breakEnd: Date | null = null;

  if (manualBreak && manualBreak.start && manualBreak.end) {
    breakStart = new Date(`${dateStr}T${manualBreak.start}`);
    breakEnd = new Date(`${dateStr}T${manualBreak.end}`);
    if (breakEnd < breakStart) breakEnd.setDate(breakEnd.getDate() + 1);
  }

  const isFestivo = HOLIDAYS_2026.includes(dateStr);
  const isDom = isSunday(parseISO(dateStr));
  const useSurcharge = isFestivo || isDom;

  let dayMinutes = 0;
  let nightMinutes = 0;
  let totalMinutesWorked = 0;

  const current = new Date(start);

  while (current < end) {
    let isOnBreak = false;
    if (breakStart && breakEnd) {
      if (current >= breakStart && current < breakEnd) {
        isOnBreak = true;
      }
    }

    if (!isOnBreak) {
      totalMinutesWorked++;
      const hour = current.getHours();
      const isNight = hour >= 19 || hour < 6;

      if (isNight) {
        nightMinutes++;
      } else {
        dayMinutes++;
      }
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  if (!manualBreak && totalMinutesWorked >= 330) {
    const deduction = 30;
    if (dayMinutes >= deduction) {
      dayMinutes -= deduction;
    } else {
      const remaining = deduction - dayMinutes;
      dayMinutes = 0;
      nightMinutes -= remaining;
    }
    totalMinutesWorked -= deduction;
  }

  const rateTable = RATES[role];
  
  // CORRECCIÓN AQUÍ: Usamos los nombres exactos de la tabla
  const dayRate = useSurcharge ? rateTable.SUNDAY : rateTable.ORDINARY;
  const nightRate = useSurcharge ? rateTable.SUNDAY_NIGHT : rateTable.ORDINARY_NIGHT;

  const hoursDay = dayMinutes / 60;
  const hoursNight = nightMinutes / 60;
  const totalMoney = (hoursDay * dayRate) + (hoursNight * nightRate) + TRANSPORT_AUX_DAILY;

  return {
    hoursDay,
    hoursNight,
    totalHours: totalMinutesWorked / 60,
    totalMoney,
    isFestivo: useSurcharge
  };
}