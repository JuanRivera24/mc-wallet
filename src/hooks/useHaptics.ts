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

  // Patrones predefinidos
  const hapticLight = () => vibrate(10); // Tap muy suave (ideal para abrir tarjetas)
  const hapticSuccess = () => vibrate([10, 30, 20]); // Doble tap rápido (ideal al guardar nómina)
  const hapticError = () => vibrate([50, 50, 50]); // 3 pulsos (ideal si falta llenar un campo)

  return { vibrate, hapticLight, hapticSuccess, hapticError };
};