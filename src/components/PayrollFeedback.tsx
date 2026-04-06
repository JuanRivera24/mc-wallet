"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
// IMPORTANTE: Agregamos doc, getDoc, setDoc y serverTimestamp
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/* ================================
   CONSTANTES Y HELPERS
================================ */

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function getPreviousMonth(month: number, year: number) {
  if (month === 0) return { month: 11, year: year - 1 };
  return { month: month - 1, year };
}

function getTargetCycle() {
  const now = new Date();
  const day = now.getDate();
  const hour = now.getHours();
  const month = now.getMonth();
  const year = now.getFullYear();

  let targetMonth = month;
  let targetYear = year;
  let targetQ = 1;
  let shouldShow = false;

  // Por defecto (2027 en adelante)
  let d1 = 5;
  let d2 = 20;

  // Cronograma exacto de pagos Crew para 2026
  if (year === 2026) {
    const schedule2026 = [
      [5, 20], // Enero
      [5, 20], // Febrero
      [5, 20], // Marzo
      [6, 20], // Abril
      [5, 20], // Mayo
      [5, 19], // Junio
      [3, 21], // Julio
      [5, 20], // Agosto
      [4, 18], // Septiembre
      [5, 20], // Octubre
      [5, 20], // Noviembre
      [4, 18], // Diciembre
    ];
    d1 = schedule2026[month][0];
    d2 = schedule2026[month][1];
  }

  // 1. Periodo del 1er pago (Paga Q2 del mes anterior): 
  // Desde el día d1 a las 17:00, hasta el día d2 antes de las 17:00.
  if ((day === d1 && hour >= 17) || (day > d1 && day < d2) || (day === d2 && hour < 17)) {
    const prev = getPreviousMonth(month, year);
    targetMonth = prev.month;
    targetYear = prev.year;
    targetQ = 2;
    shouldShow = true;
  } 
  // 2. Periodo del 2do pago (Paga Q1 del mes actual): 
  // Desde el día d2 a las 17:00 hasta fin de mes.
  else if ((day === d2 && hour >= 17) || day > d2) {
    targetMonth = month;
    targetYear = year;
    targetQ = 1;
    shouldShow = true;
  } 
  // 3. Inicio de mes, antes del 1er pago: 
  // Sigue mostrando el pago anterior (Q1 del mes anterior).
  else if (day < d1 || (day === d1 && hour < 17)) {
    const prev = getPreviousMonth(month, year);
    targetMonth = prev.month;
    targetYear = prev.year;
    targetQ = 1;
    shouldShow = true;
  }

  return {
    shouldShow,
    targetMonth,
    targetYear,
    targetQ,
    cycleId: `${targetYear}-${targetMonth}-Q${targetQ}`,
    cycleName: `${targetQ === 1 ? "1ra" : "2da"} Quincena de ${MONTH_NAMES[targetMonth]}`,
  };
}

async function calculateEstimatedAmount(userId: string, targetYear: number, targetMonth: number, targetQ: number) {
  const monthName = MONTH_NAMES[targetMonth].toLowerCase();
  let total = 0;

  const qShifts = query(
    collection(db, "shifts"),
    where("userId", "==", userId),
    where("year", "==", targetYear),
    where("month", "==", monthName)
  );

  const snapShifts = await getDocs(qShifts);
  snapShifts.forEach((doc) => {
    const data = doc.data();
    const sDay = parseInt(data.date.split("-")[2]);
    const isInQ = targetQ === 1 ? sDay <= 15 : sDay > 15;
    if (isInQ && !data.isOff) total += data.netPay || 0;
  });

  const qBV = query(
    collection(db, "bigVentas"),
    where("userId", "==", userId),
    where("year", "==", targetYear),
    where("month", "==", monthName),
    where("quincena", "==", targetQ)
  );

  const snapBV = await getDocs(qBV);
  snapBV.forEach((doc) => {
    total += doc.data().value * 0.92;
  });

  return total;
}

/* ================================
   COMPONENTE PRINCIPAL
================================ */

export default function PayrollFeedback() {
  const { colors } = useTheme();
  const { user, isLoaded } = useUser();

  const [isVisible, setIsVisible] = useState(false);
  const [view, setView] = useState<"form" | "dismiss" | "result">("form");
  const [actualPay, setActualPay] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState(0);
  const [cycleName, setCycleName] = useState("");
  const [diff, setDiff] = useState(0);
  const [percent, setPercent] = useState(0);

  const storageKeyRef = useRef<string>("");

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function init() {
      const cycle = getTargetCycle();
      if (!cycle.shouldShow) return;

      const storageKey = `mcwallet_feedback_${user?.id}_${cycle.cycleId}`;
      storageKeyRef.current = storageKey;

      // 1. Revisión rápida local
      const localStatus = localStorage.getItem(storageKey);
      if (localStatus === "completed" || localStatus === "dismissed") return;

      try {
        // 2. Revisión global en Firebase (Crucial para múltiples dispositivos)
        const docRef = doc(db, "feedback_status", storageKey);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          // Si ya lo respondió en otro lado, actualizamos la memoria local y cancelamos
          localStorage.setItem(storageKey, docSnap.data().status);
          return;
        }

        // 3. Si no hay registros, calculamos y mostramos
        const total = await calculateEstimatedAmount(
          user?.id as string,
          cycle.targetYear,
          cycle.targetMonth,
          cycle.targetQ
        );

        if (total > 0) {
          setEstimatedAmount(total);
          setCycleName(cycle.cycleName);
          setTimeout(() => setIsVisible(true), 1200);
        }
      } catch (error) {
        console.error("PayrollFeedback error:", error);
      }
    }

    init();
  }, [isLoaded, user]);

  const handleCalculate = async () => {
    const actual = parseFloat(actualPay.replace(/[^0-9]/g, ""));
    if (isNaN(actual) || actual <= 0) return;

    const difference = actual - estimatedAmount;
    const percentage = estimatedAmount > 0 ? (difference / estimatedAmount) * 100 : 0;

    setDiff(difference);
    setPercent(percentage);

    // Guardar estado localmente (para velocidad) y en Firebase (para sincronización)
    localStorage.setItem(storageKeyRef.current, "completed");
    setView("result");
    
    try {
      await setDoc(doc(db, "feedback_status", storageKeyRef.current), { 
        status: "completed", 
        timestamp: serverTimestamp() 
      });
    } catch (e) {
      console.error("Error guardando en Firebase:", e);
    }
  };

  const handleDismissAction = async (action: "later" | "never") => {
    if (action === "never") {
      // Guardar que no quiere verlo más, tanto local como en la nube
      localStorage.setItem(storageKeyRef.current, "dismissed");
      try {
        await setDoc(doc(db, "feedback_status", storageKeyRef.current), { 
          status: "dismissed", 
          timestamp: serverTimestamp() 
        });
      } catch (e) {
        console.error("Error guardando dismiss en Firebase:", e);
      }
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="w-full max-w-sm bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 relative transition-colors duration-500"
        >
          {/* BOTÓN CERRAR (X) */}
          <button 
            onClick={() => view === 'result' ? setIsVisible(false) : setView('dismiss')}
            className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors z-10"
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {view === "form" && (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner">💰</div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">¡Analiza y Compara tu Pago!</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">{cycleName}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 transition-colors">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Estimado McWallet</p>
                <p className={`text-3xl font-black ${colors.primary}`}>
                  ${Math.floor(estimatedAmount).toLocaleString("es-CO")}
                </p>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Valor en tu cuenta</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder=" "
                    value={actualPay}
                    onChange={(e) => setActualPay(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl py-4 pl-8 pr-4 font-black text-gray-900 dark:text-white focus:outline-none focus:border-gray-900 dark:focus:border-white transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculate}
                disabled={!actualPay}
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-[0.2em] text-xs py-4 rounded-2xl active:scale-95 transition-all shadow-xl"
              >
                Comparar Cálculos
              </button>
            </div>
          )}

          {view === "result" && (
            <div className="p-8 text-center space-y-6">
              <div className="text-6xl animate-bounce">{percent > 1 ? "🥳" : percent < -3 ? "🧐" : "👌"}</div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">
                  {percent > 1 ? "¡Salió más!" : percent < -3 ? "Salió menos" : "¡Casi exacto!"}
                </h2>
                <p className="font-bold text-gray-500 mt-1">
                  Dif: <span className={diff >= 0 ? "text-green-500" : "text-red-500"}>
                    {diff > 0 ? "+" : ""}{diff.toLocaleString("es-CO")} ({percent.toFixed(1)}%)
                  </span>
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-left transition-colors">
                {percent > 1 ? "¡Excelente! Seguramente son recargos nocturnos extra o el bono de Big Venta." : 
                 percent < -3 ? "Ojo, revisa tus desprendibles/marcaciones. Podría ser que te equivocaste o faltó la Big Venta." : 
                 "¡Cálculo impecable! La diferencia es mínima, probablemente por los redondeos de ley."}
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-colors"
              >
                Cerrar Reporte
              </button>
            </div>
          )}

          {view === "dismiss" && (
            <div className="p-8 text-center space-y-6">
              <div className="text-5xl">👀</div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">¿Aún no te pagan?</h2>
                <p className="text-sm text-gray-500 mt-2">Puedo recordártelo la próxima vez que entres.</p>
              </div>
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleDismissAction("later")}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-xs py-4 rounded-2xl shadow-lg active:scale-95 transition-all"
                >
                  Recordármelo luego
                </button>
                <button
                  onClick={() => handleDismissAction("never")}
                  className="w-full text-gray-400 font-bold uppercase tracking-widest text-[10px] hover:text-red-500 transition-colors"
                >
                  No mostrar más esta quincena
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}