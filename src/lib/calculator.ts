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

  // Si termina al día siguiente
  if (end <= start) end.setDate(end.getDate() + 1);

  let totalMinutesWorked = 0;
  let dayMinutes = 0;
  let nightMinutes = 0;
  let totalMoney = 0;

  const rateTable = RATES[role];

  const current = new Date(start);

  while (current < end) {
    const currentDateStr = current.toISOString().split("T")[0];
    const hour = current.getHours();

    const isNight = hour >= 19 || hour < 6;
    const isFestivo =
      HOLIDAYS_2026.includes(currentDateStr) ||
      isSunday(current);

    let ratePerHour;

    if (isNight) {
      ratePerHour = isFestivo
        ? rateTable.SUNDAY_NIGHT
        : rateTable.ORDINARY_NIGHT;
      nightMinutes++;
    } else {
      ratePerHour = isFestivo
        ? rateTable.SUNDAY
        : rateTable.ORDINARY;
      dayMinutes++;
    }

    totalMoney += ratePerHour / 60;
    totalMinutesWorked++;

    current.setMinutes(current.getMinutes() + 1);
  }

  // =========================
  // BREAK MANUAL
  // =========================
  if (manualBreak) {
    const breakStart = new Date(`${dateStr}T${manualBreak.start}`);
    let breakEnd = new Date(`${dateStr}T${manualBreak.end}`);

    if (breakEnd <= breakStart) breakEnd.setDate(breakEnd.getDate() + 1);

    const breakMinutes =
      (breakEnd.getTime() - breakStart.getTime()) / 60000;

    totalMinutesWorked -= breakMinutes;

    // Restamos del dinero minuto a minuto
    const breakCurrent = new Date(breakStart);

    while (breakCurrent < breakEnd) {
      const currentDateStr = breakCurrent.toISOString().split("T")[0];
      const hour = breakCurrent.getHours();
      const isNight = hour >= 19 || hour < 6;
      const isFestivo =
        HOLIDAYS_2026.includes(currentDateStr) ||
        isSunday(breakCurrent);

      let ratePerHour;

      if (isNight) {
        ratePerHour = isFestivo
          ? rateTable.SUNDAY_NIGHT
          : rateTable.ORDINARY_NIGHT;
        nightMinutes--;
      } else {
        ratePerHour = isFestivo
          ? rateTable.SUNDAY
          : rateTable.ORDINARY;
        dayMinutes--;
      }

      totalMoney -= ratePerHour / 60;

      breakCurrent.setMinutes(breakCurrent.getMinutes() + 1);
    }
  }
  // =========================
  // BREAK AUTOMÁTICO (solo si ≥ 5.5h Y no hay manual)
  // =========================
  else if (totalMinutesWorked >= 330) {
    const deduction = 30;
    totalMinutesWorked -= deduction;

    const deductionPerMinute =
      (rateTable.ORDINARY / 60); // aproximación conservadora

    totalMoney -= deductionPerMinute * deduction;

    if (dayMinutes >= deduction) {
      dayMinutes -= deduction;
    } else {
      nightMinutes -= (deduction - dayMinutes);
      dayMinutes = 0;
    }
  }

  // =========================
  // SUMAMOS AUXILIO
  // =========================
  totalMoney += TRANSPORT_AUX_DAILY;

  return {
    hoursDay: dayMinutes / 60,
    hoursNight: nightMinutes / 60,
    totalHours: totalMinutesWorked / 60,
    totalMoney,
  };
}
