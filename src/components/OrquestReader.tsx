"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

import { useHaptics } from "@/hooks/useHaptics";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";

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
            hasBreak: false,
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

        let hasBreak = false;
        const [sh, sm] = st.split(":").map(Number);
        const [eh, em] = et.split(":").map(Number);
        let sMins = sh * 60 + sm;
        let eMins = eh * 60 + em;
        if (eMins <= sMins) eMins += 1440;
        hasBreak = (eMins - sMins) >= 330;

        const calcs = calculateShift(cleanDateStr, shift.startTime, shift.endTime, undefined, role, hasBreak);
        
        if (calcs) {
          finalExtractedShifts.push({
            date: cleanDateStr,
            startTime: shift.startTime,
            endTime: shift.endTime,
            isOff: false,
            hasBreak: hasBreak,
            rawFragments: Array.isArray(calcs) ? calcs : [calcs]
          });
        }
      }

      setOcrStatus("Verificando calendario...");
      const q = query(collection(db, "shifts"), where("userId", "==", user.id));
      const snap = await getDocs(q);

      const allShifts = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      const strictlyNewShifts: any[] = [];
      const actualConflicts: any[] = [];
      let exactMatchesCount = 0;

      for (const newShift of finalExtractedShifts) {
        // ✅ FIX MAESTRO: Buscamos por la RAÍZ del ID. 
        // Esto captura los fragmentos `_split` que hayan caído al día siguiente.
        const baseId = `${user.id}_${newShift.date}`;
        const oldShiftsOnDate = allShifts.filter(old => 
          (old.id === baseId || String(old.id).startsWith(`${baseId}_split`)) &&
          (!old.type || old.type === 'SHIFT')
        );

        if (oldShiftsOnDate.length > 0) {
          // Tomamos el padre para comparar las horas iniciales
          const oldMainShift = oldShiftsOnDate.find(old => !String(old.id).includes("_split")) || oldShiftsOnDate[0];

          const isExactMatch =
            oldMainShift.startTime === newShift.startTime &&
            oldMainShift.endTime === newShift.endTime &&
            Boolean(oldMainShift.isOff) === Boolean(newShift.isOff);

          if (isExactMatch) {
            exactMatchesCount++;
          } else {
            // Si no cuadra, TODOS los fragmentos asociados a ese turno se marcan como conflicto para ser borrados
            oldShiftsOnDate.forEach(old => {
              if (!actualConflicts.some(c => c.id === old.id)) {
                actualConflicts.push(old);
              }
            });
            strictlyNewShifts.push(newShift);
          }
        } else {
          strictlyNewShifts.push(newShift);
        }
      }

      if (strictlyNewShifts.length === 0 && exactMatchesCount > 0) {
        hapticSuccess();
        alert(`✨ Todo al día. Se omitieron ${exactMatchesCount} turnos de la imagen porque ya estaban guardados exactamente igual en tu calendario.`);
        setFileName(null);
        setFileObj(null);
        setIsProcessing(false);
        setOcrStatus("");
        return;
      }

      // Ordenar conflictos para mostrarlos limpios en la UI
      actualConflicts.sort((a, b) => (a.originalDate || a.date).localeCompare(b.originalDate || b.date));

      setNewShiftsToSave(strictlyNewShifts);
      setConflictingShifts(actualConflicts);

      if (actualConflicts.length > 0) {
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
        
        // ✅ FIX: Limpieza defensiva total antes de insertar el nuevo turno IA
        await deleteDoc(doc(db, "shifts", baseDocId));
        await deleteDoc(doc(db, "shifts", `${baseDocId}_split`));
        await deleteDoc(doc(db, "shifts", `${baseDocId}_split_2`));

        let autoBreakStart = "";
        let autoBreakEnd = "";

        if (!extracted.isOff && extracted.hasBreak) {
          const [sh, sm] = extracted.startTime.split(":").map(Number);
          const [eh, em] = extracted.endTime.split(":").map(Number);
          let sMins = sh * 60 + sm;
          let eMins = eh * 60 + em;
          if (eMins <= sMins) eMins += 1440;

          const mid = Math.floor((sMins + eMins) / 2);
          const formatMins = (mins: number) => {
            const h = Math.floor((mins % 1440) / 60).toString().padStart(2, "0");
            const m = (mins % 60).toString().padStart(2, "0");
            return `${h}:${m}`;
          };
          autoBreakStart = formatMins(mid - 15);
          autoBreakEnd = formatMins(mid + 15);
        }

        await Promise.all(extracted.rawFragments.map(async (calc: any, i: number) => {
          const idToSave = i === 0 ? baseDocId : i === 1 ? `${baseDocId}_split` : `${baseDocId}_split_${i}`;
          
          // ✅ EXTRACCIÓN DINÁMICA: Aplica mes y año correctos si cruzó la medianoche
          const dateParts = calc.date.split('-');
          const shiftMonthVal = mesesFull[parseInt(dateParts[1], 10) - 1];
          const shiftYearVal = parseInt(dateParts[0], 10);

          const payload = {
            userId: userId,
            type: 'SHIFT',
            startTime: extracted.startTime,
            endTime: extracted.endTime,
            hasBreak: extracted.isOff ? false : extracted.hasBreak,
            isManualBreak: false,
            breakStart: autoBreakStart,
            breakEnd: autoBreakEnd,
            ...calc,
            isOff: extracted.isOff,
            month: shiftMonthVal,
            year: shiftYearVal,
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
      <button
        onClick={handleInfoClick}
        className={`absolute z-20 top-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-dashed outline-none transition-colors cursor-pointer hover:scale-110 active:scale-95 animate-pulse ${
          themeColor === "blue" 
            ? "border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-zinc-900" 
            : "border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-zinc-900"
        }`}
      >
        <span className={`font-black text-lg ${activeColor}`}>i</span>
      </button>

      <div className="space-y-4 text-center">
        <header>
          <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Exportar Horario IA
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
            Configura el mes base y sube tu captura de Orquest.      Esta sección se encuentra en una versión temprana, si al procesar, aparece algún error, presiona nuevamente procesar.
          </p>
        </header>

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

      {/* 1. MODAL INSTRUCCIONES MEJORADO */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] shadow-2xl relative flex flex-col overflow-hidden border border-zinc-100 dark:border-zinc-800"
            >
              <button onClick={handleCloseModal} className="absolute top-4 right-4 z-30 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-colors">✕</button>
              
              <div className="w-full h-64 sm:h-72 bg-zinc-100/50 dark:bg-zinc-950/50 relative flex items-center justify-center p-2 border-b border-zinc-200 dark:border-zinc-800">
                <Image src="/orquest_example.png" alt="Ejemplo Orquest" fill className="object-contain drop-shadow-xl" priority />
              </div>

              <div className="p-6 flex flex-col gap-4">
                <header><h3 className="font-black text-xl flex items-center gap-2 text-zinc-900 dark:text-zinc-100"><span className={activeColor}>i</span> ¿Cómo funciona?</h3></header>
                <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  <p>La IA extraerá las 7 tarjetas y hará un cálculo automático:</p>
                  <ul className="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300 font-bold">
                    <li>Sincroniza recargos (Dominicales y Nocturnos).</li>
                    <li>Asigna el turno al calendario del mes actual.</li>
                    <li>Guarda los Días Libres automáticamente.</li>
                  </ul>
                </div>
                <button onClick={handleCloseModal} className={`w-full mt-2 py-3.5 rounded-2xl font-black text-xs uppercase text-white ${activeBg}`}>Entendido</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MODAL REEMPLAZO (Comparador "Nuevos vs Viejos") */}
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
              className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-6 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800 space-y-4"
            >
              <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 rounded-full flex items-center justify-center text-2xl mx-auto">⚠️</div>
              
              <div>
                <h3 className="font-black text-xl leading-tight text-zinc-900 dark:text-zinc-100">Conflicto de Fechas</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Revisa lo que vas a guardar vs lo que se borrará.</p>
                
                <div className="flex gap-2 mt-4 h-36">
                  <div className="flex-1 bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/50 rounded-xl p-2 flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-green-600 dark:text-green-500 mb-2 border-b border-green-200 dark:border-green-900/50 pb-1">Nuevos (IA)</span>
                    <div className="overflow-y-auto pr-1 flex-1 space-y-1.5 text-left">
                      {newShiftsToSave.map((s, idx) => (
                        <div key={idx} className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                           <span className="text-zinc-400 dark:text-zinc-500 mr-1">{s.date.split("-")[2]}/{s.date.split("-")[1]}</span>
                           {s.isOff ? <span className="italic text-green-600/70 dark:text-green-400/70">Libre</span> : `${s.startTime}-${s.endTime}`}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-xl p-2 flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-red-500 dark:text-red-500 mb-2 border-b border-red-200 dark:border-red-900/50 pb-1">A Reemplazar</span>
                    <div className="overflow-y-auto pr-1 flex-1 space-y-1.5 text-left">
                      {conflictingShifts.map((s) => {
                        let tag = "";
                        if (s.type && s.type !== "SHIFT") tag = `(${s.type})`;
                        else if (s.isOff) tag = "Libre";
                        else tag = `${s.startTime}-${s.endTime}`;
                        
                        return (
                          <div key={s.id} className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 line-through decoration-red-300 dark:decoration-red-800">
                             <span className="mr-1">{(s.originalDate || s.date).split("-")[2]}/{(s.originalDate || s.date).split("-")[1]}</span>
                             {tag}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button onClick={handleReplaceShifts} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-xs uppercase transition-all hover:bg-red-600">
                  {isProcessing ? "Reemplazando..." : "Confirmar y Reemplazar"}
                </button>
                <button onClick={() => { hapticLight(); setShowReplaceModal(false); }} disabled={isProcessing} className="w-full py-3 font-black text-xs uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-500">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MODAL VERIFICACIÓN PREVIA (Lista Limpia) */}
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
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-3xl mx-auto">✨</div>
              <div>
                <h3 className="font-black text-xl leading-tight text-zinc-900 dark:text-zinc-100">Revisar Carga</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">La IA extrajo <span className="font-bold text-zinc-800 dark:text-zinc-200">{newShiftsToSave.length} turnos</span> nuevos. Confirma para guardarlos:</p>
                
                <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-3 rounded-xl mt-4 max-h-40 overflow-y-auto text-[11px] font-bold text-zinc-600 dark:text-zinc-300 text-left space-y-2">
                  {newShiftsToSave.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-zinc-200/50 dark:border-zinc-800/50 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-zinc-500 dark:text-zinc-400">{s.date.split("-").reverse().join("/")}</span>
                      <span>{s.isOff ? <span className="text-zinc-400 dark:text-zinc-600 font-normal italic">Día Libre</span> : <span className={`${activeColor} bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md`}>{s.startTime} - {s.endTime}</span>}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={() => saveNewShiftsToFirebase(newShiftsToSave)} disabled={isProcessing} className="w-full py-4 rounded-2xl bg-green-500 text-white font-black text-xs uppercase hover:bg-green-600">
                  {isProcessing ? "Guardando..." : "Confirmar y Guardar"}
                </button>
                <button onClick={() => { hapticLight(); setShowVerifyModal(false); }} disabled={isProcessing} className="w-full py-3 font-black text-xs uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-500">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}