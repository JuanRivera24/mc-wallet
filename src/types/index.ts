// src/types/index.ts

// Definimos qué forma tiene un "Turno" para que no cometamos errores al guardar
export interface Shift {
  id?: string;             // El ID único (lo pone Firebase después)
  userId: string;          // De quién es el turno
  date: string;            // "2026-02-01"
  startTime: string;       // "14:00"
  endTime: string;         // "22:00"
  role: 'CREW' | 'ENTRENADOR';
  
  // Datos calculados (Dinero y horas)
  results: {
    totalMoney: number;    // Cuánto ganaste
    totalHours: number;    // Horas netas
    hoursDay: number;      // Horas diurnas
    hoursNight: number;    // Horas nocturnas
    transport: number;     // Auxilio
    isFestivo: boolean;    // ¿Fue festivo?
  };
}