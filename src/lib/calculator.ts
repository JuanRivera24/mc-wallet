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

  let dayMinutes = 0;
  let nightMinutes = 0;
  let totalMinutesWorked = 0;

  const current = new Date(start);
  while (current < end) {
    totalMinutesWorked++;
    const hour = current.getHours();
    const isNight = hour >= 19 || hour < 6;
    if (isNight) nightMinutes++; else dayMinutes++;
    current.setMinutes(current.getMinutes() + 1);
  }

  // Deducción de break automática (30 min si es > 5.5h)
  if (totalMinutesWorked >= 330) {
    const deduction = 30;
    if (dayMinutes >= deduction) dayMinutes -= deduction;
    else { nightMinutes -= (deduction - dayMinutes); dayMinutes = 0; }
    totalMinutesWorked -= deduction;
  }

  const rateTable = RATES[role];
  const isFestivo = HOLIDAYS_2026.includes(dateStr) || isSunday(parseISO(dateStr));

  const dayRate = isFestivo ? rateTable.SUNDAY : rateTable.ORDINARY;
  // CORRECCIÓN AQUÍ: Usamos ORDINARY_NIGHT en lugar de NIGHT_SURCHARGE
  const nightRate = isFestivo ? rateTable.SUNDAY_NIGHT : rateTable.ORDINARY_NIGHT;

  const hoursDay = dayMinutes / 60;
  const hoursNight = nightMinutes / 60;
  const totalMoney = (hoursDay * dayRate) + (hoursNight * nightRate) + TRANSPORT_AUX_DAILY;

  return {
    hoursDay,
    hoursNight,
    totalHours: totalMinutesWorked / 60,
    totalMoney,
    isFestivo
  };
}