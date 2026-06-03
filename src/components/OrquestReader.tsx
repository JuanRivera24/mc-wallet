"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

import { useHaptics } from "@/hooks/useHaptics";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";

// Importamos tu lógica exacta de la calculadora (Mantiene los turnos split nocturnos)
import { calculateShift } from "@/lib/calculator";

import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const mesesFull = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export default function OrquestReader() {
  const theme = useTheme?.(); 
  const role = theme?.role ?? "CREW";
  const themeColor = theme?.themeColor ?? "blue";

  const { hapticLight, hapticSuccess, hapticWarning, hapticError } = useHaptics();
  const { user } = useUser();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  
  const [ocrStatus, setOcrStatus] = useState("");
  const [conflictingShifts, setConflictingShifts] = useState<any[]>([]);
  const [newShiftsToSave, setNewShiftsToSave] = useState<any[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const activeColor = themeColor === "blue" ? "text-blue-500" : "text-red-500";
  const activeBg = themeColor === "blue" ? "bg-blue-600" : "bg-red-600";

  const handleInfoClick = () => { hapticLight(); setIsModalOpen(true); };
  const handleCloseModal = () => { hapticLight(); setIsModalOpen(false); };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    hapticSuccess();
    if (event.target.files?.[0]) {
      setFileName(event.target.files[0].name);
      setFileObj(event.target.files[0]);
    }
  };

  const handleProcessClick = async () => {
    if (!user || !fileObj) return;

    hapticLight();
    setIsProcessing(true);
    setOcrStatus("Enviando a la IA...");

    try {
      const formData = new FormData();
      formData.append("image", fileObj);

      const response = await fetch("/api/orquest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `Error del servidor: ${response.status}`);
      }

      if (!data.shifts || data.shifts.length === 0) {
        throw new Error("No se detectaron turnos válidos en la imagen.");
      }

      setOcrStatus("Calculando nómina real...");

      const finalExtractedShifts: any[] = [];
      const currentYear = new Date().getFullYear();

      let runningMonth = selectedMonth;
      let runningYear = currentYear;
      let lastDay: number | null = null;

      for (const shift of data.shifts) {
        const st = shift.startTime ? shift.startTime.trim() : "";
        const et = shift.endTime ? shift.endTime.trim() : "";

        if (st === "" || et === "" || st === "-") {
          shift.isOff = true;
          shift.startTime = "";
          shift.endTime = "";
        }

        const dayNum = parseInt(shift.day, 10);
        if (isNaN(dayNum)) continue;

        if (lastDay !== null && dayNum < lastDay) {
          runningMonth++;
          if (runningMonth > 11) {
            runningMonth = 0;
            runningYear++;
          }
        }
        lastDay = dayNum;

        const paddedMonth = String(runningMonth + 1).padStart(2, "0");
        const paddedDay = String(dayNum).padStart(2, "0");
        const cleanDateStr = `${runningYear}-${paddedMonth}-${paddedDay}`;

        if (shift.isOff) {
          finalExtractedShifts.push({
            date: cleanDateStr,
            startTime: "",
            endTime: "",
            isOff: true,
            rawFragments: [{
              date: cleanDateStr,
              netPay: 0,
              salaryBase: 0,
              transportAux: 0,
              deductions: 0,
              totalHours: 0,
              hoursDay: 0,
              hoursNight: 0,
              isOff: true
            }]
          });
          continue;
        }

        const calcs = calculateShift(cleanDateStr, shift.startTime, shift.endTime, undefined, role, true);
        
        if (calcs) {
          finalExtractedShifts.push({
            date: cleanDateStr,
            startTime: shift.startTime,
            endTime: shift.endTime,
            isOff: false,
            rawFragments: Array.isArray(calcs) ? calcs : [calcs]
          });
        }
      }

      setNewShiftsToSave(finalExtractedShifts);

      setOcrStatus("Verificando calendario...");
      const q = query(collection(db, "shifts"), where("userId", "==", user.id));
      const snap = await getDocs(q);

      const allShifts = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      const conflicts = allShifts.filter((oldShift) => {
        return oldShift.date && finalExtractedShifts.some((newShift: any) => newShift.date === oldShift.date);
      });

      conflicts.sort((a, b) => a.date.localeCompare(b.date));

      if (conflicts.length > 0) {
        setConflictingShifts(conflicts);
        setShowReplaceModal(true);
        hapticWarning();
      } else {
        setShowVerifyModal(true);
        hapticLight();
      }

    } catch (error: any) {
      console.error(error);
      hapticError();
      alert(`⚠️ ${error.message}`);
    } finally {
      setIsProcessing(false);
      setOcrStatus("");
    }
  };

  const handleReplaceShifts = async () => {
    hapticLight();
    setIsProcessing(true);
    setOcrStatus("Purgando registros viejos...");

    try {
      for (const shift of conflictingShifts) {
        await deleteDoc(doc(db, "shifts", shift.id));
      }
      await saveNewShiftsToFirebase(newShiftsToSave);
    } catch (error) {
      console.error(error);
      hapticError();
      alert("Error limpiando registros de Firebase.");
      setIsProcessing(false);
    }
  };

  const saveNewShiftsToFirebase = async (shiftsData: any[]) => {
    if (!user?.id) {
      hapticError();
      alert("⚠️ Error de sesión: No se detectó un usuario activo.");
      return;
    }

    const userId = user.id;

    try {
      for (const extracted of shiftsData) {
        const baseDocId = `${userId}_${extracted.date}`;
        
        await deleteDoc(doc(db, "shifts", `${baseDocId}_split`));

        let autoBreakStart = "";
        let autoBreakEnd = "";
        let hasBreak = false;

        if (!extracted.isOff) {
          const [sh, sm] = extracted.startTime.split(":").map(Number);
          const [eh, em] = extracted.endTime.split(":").map(Number);
          let sMins = sh * 60 + sm;
          let eMins = eh * 60 + em;
          if (eMins <= sMins) eMins += 1440;

          hasBreak = (eMins - sMins) >= 330;

          if (hasBreak) {
            const mid = Math.floor((sMins + eMins) / 2);
            const formatMins = (mins: number) => {
              const h = Math.floor((mins % 1440) / 60).toString().padStart(2, "0");
              const m = (mins % 60).toString().padStart(2, "0");
              return `${h}:${m}`;
            };
            autoBreakStart = formatMins(mid - 15);
            autoBreakEnd = formatMins(mid + 15);
          }
        }

        await Promise.all(extracted.rawFragments.map(async (calc: any, i: number) => {
          const idToSave = i === 0 ? baseDocId : `${baseDocId}_split`;
          const dateParts = calc.date.split('-');
          const shiftMonthVal = mesesFull[parseInt(dateParts[1], 10) - 1];

          const payload = {
            userId: userId,
            type: 'SHIFT',
            startTime: extracted.startTime,
            endTime: extracted.endTime,
            hasBreak: extracted.isOff ? false : hasBreak,
            isManualBreak: false,
            breakStart: autoBreakStart,
            breakEnd: autoBreakEnd,
            ...calc,
            isOff: extracted.isOff,
            month: shiftMonthVal,
            year: parseInt(dateParts[0], 10),
            timestamp: serverTimestamp()
          };

          await setDoc(doc(db, "shifts", idToSave), payload, { merge: true });
        }));
      }

      hapticSuccess();
      alert(`✨ ¡${shiftsData.length} turnos sincronizados en la Nómina!`);
      
      setFileName(null);
      setFileObj(null);
      setShowReplaceModal(false);
      setShowVerifyModal(false);
      setConflictingShifts([]);
      setNewShiftsToSave([]);
      setIsProcessing(false);

      window.location.reload();
    } catch (e) {
      console.error(e);
      hapticError();
      alert("Error crítico guardando los fragmentos de nómina.");
    }
  };

  return (
    <div className="relative w-full text-zinc-800 dark:text-zinc-100 space-y-5">
      {/* BOTÓN INFO */}
      <button
        onClick={handleInfoClick}
        className={`absolute top-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-dashed outline-none transition-colors ${
          themeColor === "blue" 
            ? "border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-zinc-900" 
            : "border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-zinc-900"
        }`}
      >
        <span className={`font-black text-lg ${activeColor}`}>i</span>
      </button>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="space-y-4 text-center">
        <header>
          <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Exportar Horario IA
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
            Configura el mes base y sube tu captura de Orquest.
          </p>
        </header>

        {/* SELECTOR DE MES */}
        <div className="text-left max-w-xs mx-auto">
          <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-2 italic">
            Mes del primer turno de la imagen
          </label>
          <div className="relative mt-1">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl font-bold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-200 outline-none cursor-pointer transition-all hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-400"
            >
              {mesesFull.map((mes, idx) => (
                <option key={idx} value={idx} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-bold">
                  {mes}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* INPUT DE ARCHIVO */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer group max-w-xs mx-auto ${
            fileName
              ? "border-green-400 bg-green-50/20 dark:bg-green-950/10"
              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700"
          }`}
        >
          <input
            type="file"
            accept="image/png, image/jpeg"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          <div className="flex flex-col items-center gap-3">
            <span className={`text-3xl transition-transform ${fileName ? "scale-110" : "grayscale group-hover:grayscale-0"}`}>
              {fileName ? "✅" : "📸"}
            </span>
            {fileName ? (
              <p className="text-xs font-bold text-green-600 dark:text-green-400 truncate w-full px-4">
                {fileName}
              </p>
            ) : (
              <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
                Toca o arrastra tu captura aquí
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleProcessClick}
          disabled={!fileName || isProcessing}
          className="w-full max-w-xs mx-auto py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all shadow-md active:scale-95 disabled:opacity-40 flex justify-center items-center gap-2 outline-none bg-zinc-900 dark:bg-zinc-100 !text-white dark:!text-zinc-900 hover:brightness-110"
        >
          {isProcessing ? (
            <>
              <span className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
              {ocrStatus || "Procesando..."}
            </>
          ) : (
            "Procesar Horario"
          )}
        </button>
      </div>

      {/* MODAL REEMPLAZO */}
      <AnimatePresence>
        {showReplaceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-6 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800 space-y-5"
            >
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 rounded-full flex items-center justify-center text-3xl mx-auto">⚠️</div>
              <div>
                <h3 className="font-black text-xl leading-tight text-zinc-900 dark:text-zinc-100">Días ya Registrados</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Se encontraron <span className="font-bold text-zinc-800 dark:text-zinc-200">{conflictingShifts.length} turnos guardados</span> en estas fechas.</p>
                <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-2 rounded-xl mt-3 max-h-24 overflow-y-auto text-[10px] font-bold text-zinc-500 dark:text-zinc-400 text-left px-3 space-y-1">
                  {conflictingShifts.map((s) => (
                    <div key={s.id}>• {s.date.split("-").reverse().join("/")} {s.isOff ? "(Día Libre)" : `(${s.startTime} - ${s.endTime})`}</div>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-4">¿Deseas eliminarlos de la nómina y <span className="font-bold text-red-500">reemplazarlos</span>?</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={handleReplaceShifts} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-xs uppercase transition-all hover:bg-red-600">
                  {isProcessing ? "Procesando..." : "Confirmar y Reemplazar"}
                </button>
                <button onClick={() => { hapticLight(); setShowReplaceModal(false); }} disabled={isProcessing} className="w-full py-4 font-black text-xs uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-500">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL VERIFICACIÓN PREVIA */}
      <AnimatePresence>
        {showVerifyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-6 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800 space-y-5"
            >
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-3xl mx-auto">🔍</div>
              <div>
                <h3 className="font-black text-xl leading-tight text-zinc-900 dark:text-zinc-100">Revisar Carga</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium">La IA detectó estos <span className="font-bold text-zinc-800 dark:text-zinc-200">{newShiftsToSave.length} días</span>. Confirma antes de guardar:</p>
                <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-2 rounded-xl mt-3 max-h-36 overflow-y-auto text-[10px] font-bold text-zinc-500 dark:text-zinc-400 text-left px-3 space-y-1">
                  {newShiftsToSave.map((s, idx) => (
                    <div key={idx}>• {s.date.split("-").reverse().join("/")} {s.isOff ? <span className="text-gray-400 font-normal italic">(Día Libre)</span> : <span className="text-zinc-700 dark:text-zinc-300">({s.startTime} - {s.endTime})</span>}</div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={() => saveNewShiftsToFirebase(newShiftsToSave)} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-green-500 text-white font-black text-xs uppercase hover:bg-green-600">
                  {isProcessing ? "Guardando..." : "Confirmar y Guardar"}
                </button>
                <button onClick={() => { hapticLight(); setShowVerifyModal(false); }} disabled={isProcessing} className="w-full py-4 font-black text-xs uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-500">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}