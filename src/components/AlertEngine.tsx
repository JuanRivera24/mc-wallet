"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

// Cronograma de pagos 2026 (Crew Arcos Dorados)
const SCHEDULE_2026 = [
  [5, 20], [5, 20], [5, 20], [6, 20], [5, 20], [5, 19],
  [3, 21], [5, 20], [4, 18], [5, 20], [5, 20], [4, 18],
];

export default function AlertEngine() {
  const { user } = useUser();
  const checkInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !('Notification' in window)) return;

    const runEngine = async () => {
      if (Notification.permission !== "granted") return;

      // 1. Traer preferencias de alertas del usuario
      const docRef = doc(db, "user_settings", user.id);
      const snap = await getDoc(docRef);
      if (!snap.exists() || !snap.data().alerts) return;
      const alerts = snap.data().alerts;

      // 2. Traer los turnos de HOY
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;
      const monthName = MONTH_NAMES[today.getMonth()];

      const qShifts = query(
        collection(db, "shifts"),
        where("userId", "==", user.id),
        where("date", "==", todayStr)
      );
      const shiftDocs = await getDocs(qShifts);
      const todaysShifts = shiftDocs.docs.map(doc => doc.data());

      // ==========================================
      // FUNCIONES DE NOTIFICACIÓN
      // ==========================================
      const sendPush = (id: string, title: string, body: string) => {
        // Evitar mandar la misma notificación 2 veces el mismo día
        const cacheKey = `noti_sent_${id}_${todayStr}`;
        if (localStorage.getItem(cacheKey)) return;

        if (alerts.vibrateEnabled && navigator.vibrate) navigator.vibrate([200, 100, 200]);
        
        new Notification(title, {
          body,
          icon: "/icon-192x192.png",
          silent: !alerts.soundEnabled
        });

        localStorage.setItem(cacheKey, "true");
      };

      // ==========================================
      // REVISIÓN MINUTO A MINUTO
      // ==========================================
      const checkTime = () => {
        const now = new Date();
        const hour = now.getHours();
        const minutes = now.getMinutes();
        const dayOfWeek = now.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
        const currentDayOfMonth = now.getDate();
        const currentMonth = now.getMonth();

        // 1. DÍAS DE PAGO (8:00 AM)
        if (alerts.paydays && hour === 8 && minutes === 0) {
          const paydays = y === 2026 ? SCHEDULE_2026[currentMonth] : [5, 20];
          if (paydays.includes(currentDayOfMonth)) {
            sendPush("payday", "¡Día de Quincena! 💸", "Hoy depositan, resiva el portal sara o BBVA (despues de las 2 pm). Abre McWallet para comparar tu pago real vs el estimado.");
          }
        }

        // 2. ORQUEST: PETICIONES (Martes a las 9:00 AM)
        if (alerts.orquestRequests && dayOfWeek === 2 && hour === 9 && minutes === 0) {
          sendPush("orquest_req", "¡Último aviso de Orquest! ⚠️", "Tienes hasta hoy para pedir tus días libres o modificar tu disponibilidad.");
        }

        // 3. ORQUEST: NUEVOS HORARIOS (Jueves a las 17:00 / 5:00 PM)
        if (alerts.orquestSchedules && dayOfWeek === 4 && hour === 17 && minutes === 0) {
          sendPush("orquest_sch", "¡Malla casi lista! 👀", "Proximamente estarán publicando los horarios de la próxima semana. No olvides entrar a revisar.");
        }

        // 4. TURNOS Y DÍAS LIBRES
        if (todaysShifts.length > 0) {
          const mainShift = todaysShifts.find(s => !s.id?.includes("_split")) || todaysShifts[0];

          if (mainShift.isOff) {
            // Día Libre (8:00 AM)
            if (alerts.daysOff && hour === 8 && minutes === 0) {
              sendPush("day_off", "¡Hoy es tu día libre! 🌴", "Relájate y disfruta tu descanso, cero McDonald's por hoy.");
            }
          } else if (alerts.shifts && mainShift.startTime) {
            // Cálculo de anticipación de turno
            const [shiftH, shiftM] = mainShift.startTime.split(":").map(Number);
            const shiftTimeInMins = (shiftH * 60) + shiftM;
            const nowInMins = (hour * 60) + minutes;
            
            // Si falta exactamente el tiempo de anticipación configurado (ej. 120 mins)
            if (shiftTimeInMins - nowInMins === alerts.shiftAdvanceMin) {
              const textHoras = alerts.shiftAdvanceMin / 60;
              sendPush("shift_alert", "¡Hora de prepararse! 🏃‍♂️", `Tu turno empieza a las ${mainShift.startTime}. Tienes ${textHoras} horas para el traslado.`);
            }
          }
        }
      };

      // Ejecutar una vez al instante, y luego cada 1 minuto (60000ms)
      checkTime();
      checkInterval.current = setInterval(checkTime, 60000);
    };

    runEngine();

    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
    };
  }, [user]);

  return null; 
}