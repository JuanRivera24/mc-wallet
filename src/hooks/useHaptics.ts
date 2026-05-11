// hooks/useHaptics.ts
"use client";
import { useCallback } from "react";

export const useHaptics = () => {
  const vibrate = useCallback((pattern: number | number[]) => {
    // Verificamos que estemos en el navegador y que el dispositivo soporte vibración
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  // Patrones predefinidos para mantener consistencia en toda la app
  const hapticLight = () => vibrate(10); // Tap muy suave (para clics rápidos o abrir tarjetas)
  const hapticSuccess = () => vibrate([10, 30, 20]); // Doble tap rápido (para guardado exitoso)
  const hapticError = () => vibrate([50, 50, 50]); // 3 pulsos pesados (para errores)
  const hapticWarning = () => vibrate([30, 40, 30]); // Pulsos medios (para advertencias como "ya existe un turno")

  // ASEGÚRATE DE QUE AQUÍ ESTÉ RETORNANDO hapticWarning
  return { vibrate, hapticLight, hapticSuccess, hapticError, hapticWarning };
};