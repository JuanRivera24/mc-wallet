"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHaptics } from "@/hooks/useHaptics";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { calculateShift } from "@/lib/calculator";
import * as XLSX from "xlsx";

const mesesFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type AuditMode = 'COMPLETA' | 'PARCIAL';
type InputMode = 'FILE' | 'TEXT';
type MismatchSeverity = 'LEVE' | 'MODERADO' | 'GRAVE';

type DiffResult = {
  date: string;
  status: 'MATCH' | 'MISMATCH' | 'MISSING_IN_FILE' | 'MISSING_IN_APP';
  severity?: MismatchSeverity;
  savedShift?: any;
  inputShift?: any;
  differences?: string[];
};

export default function MarcacionesReader() {
  const theme = useTheme?.();
  const role = theme?.role ?? "CREW";
  const themeColor = theme?.themeColor ?? "blue";
  const { hapticLight, hapticSuccess, hapticWarning, hapticError } = useHaptics();
  const { user } = useUser();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Configuración
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedQuincena, setSelectedQuincena] = useState<1 | 2>(new Date().getDate() <= 15 ? 1 : 2);
  const [auditMode, setAuditMode] = useState<AuditMode>('COMPLETA');
  
  // Input Data
  const [inputMode, setInputMode] = useState<InputMode>('FILE');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  
  // Búsqueda Inteligente & Recordar Empleado
  const [searchQuery, setSearchQuery] = useState("");
  const [rememberEmployee, setRememberEmployee] = useState(false);
  const [candidates, setCandidates] = useState<{id: string, name: string}[]>([]);

  // Motor de Auditoría
  const [isProcessing, setIsProcessing] = useState(false);
  const [auditResults, setAuditResults] = useState<DiffResult[]>([]);
  const [selectedResultDates, setSelectedResultDates] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const activeBg = themeColor === "blue" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700";
  const glowShadow = themeColor === "blue" 
    ? "border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.18)] dark:shadow-[0_0_25px_rgba(59,130,246,0.12)]" 
    : "border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.18)] dark:shadow-[0_0_25px_rgba(239,68,68,0.12)]";

  // Cargar preferencia guardada de empleado
  useEffect(() => {
    const saved = localStorage.getItem("mc_audit_saved_employee");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.searchQuery) setSearchQuery(parsed.searchQuery);
        setRememberEmployee(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // --- PARSERS ---
  const parseDate = (d: any): string | null => {
    if (!d) return null;
    if (typeof d === 'number') {
      const date = new Date(Math.round((d - 25569) * 86400 * 1000));
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    }
    let str = String(d).trim();
    if (str.includes(" ")) str = str.split(" ")[0]; 
    if (str.includes("-")) {
      const parts = str.split("-");
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      return str; 
    }
    if (str.includes("/")) {
      const parts = str.split("/"); 
      if (parts[2] && parts[2].length >= 2) {
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return str;
  };

  const parseTime = (t: any): string | null => {
    if (t === undefined || t === null || t === "") return null;
    if (typeof t === 'number') {
      let totalMins = Math.round(t * 24 * 60);
      const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
      const m = (totalMins % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    }
    const str = String(t).trim();
    if (!str || str === "-") return null;
    if (str.includes(":")) {
      const parts = str.split(":");
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return str;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    hapticLight();
    setCandidates([]);
    if (e.target.files?.[0]) {
      setFileName(e.target.files[0].name);
      setFileObj(e.target.files[0]);
    }
  };

  // --- MOTOR DE AUDITORÍA (DIFF) ---
  const processAudit = async (forcedTarget?: {id: string, name: string}) => {
    if (!user) return;
    if (inputMode === 'FILE' && !fileObj) return alert("Sube un archivo primero.");
    if (inputMode === 'TEXT' && !pastedText) return alert("Pega el texto de tus marcaciones.");

    hapticLight();
    setIsProcessing(true);
    setStatusMsg("Mapeando el archivo...");
    setEmployeeName("");

    try {
      let rawRows: any[][] = [];

      // 1. Extraer Datos Crudos
      if (inputMode === 'FILE') {
        const buffer = await fileObj!.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      } else {
        const lines = pastedText.trim().split('\n');
        rawRows = lines.map(line => line.split('\t').map(c => c.trim()));
      }

      // 2. Escaneo de Candidatos
      let uniqueEmployees = new Map<string, {id: string, name: string}>();

      for (const row of rawRows) {
        if (!Array.isArray(row) || row.length < 5) continue;
        let dateIdx = row.findIndex(cell => {
          const str = String(cell).trim();
          return /^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{2}\/\d{2}\/\d{4}$/.test(str) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str);
        });

        if (dateIdx === -1) continue;

        const cId = dateIdx >= 3 ? String(row[dateIdx - 3]).trim() : "";
        const cApellido = dateIdx >= 2 ? String(row[dateIdx - 2]).trim() : "";
        const cNombre = dateIdx >= 1 ? String(row[dateIdx - 1]).trim() : "";
        const fullName = `${cNombre} ${cApellido}`.trim();

        if (fullName) {
          const key = `${cId}-${fullName}`;
          if (!uniqueEmployees.has(key)) uniqueEmployees.set(key, { id: cId, name: fullName });
        }
      }

      let target = forcedTarget;

      if (!target) {
        let matches = Array.from(uniqueEmployees.values());
        
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          matches = matches.filter(e => e.id.includes(q) || e.name.toLowerCase().includes(q));
        }

        if (matches.length === 0) {
          throw new Error("No se encontró a nadie en este archivo con ese nombre o identificación.");
        }
        
        if (matches.length > 1) {
          setCandidates(matches);
          setIsProcessing(false);
          hapticLight();
          return;
        }
        
        target = matches[0];
      }

      // Guardar o limpiar preferencia según el switch
      if (rememberEmployee && target) {
        localStorage.setItem("mc_audit_saved_employee", JSON.stringify({ 
          id: target.id, 
          name: target.name, 
          searchQuery: searchQuery || target.name 
        }));
      } else if (!rememberEmployee) {
        localStorage.removeItem("mc_audit_saved_employee");
      }

      setCandidates([]);
      setEmployeeName(target.name);
      setStatusMsg(`Analizando turnos de ${target.name}...`);

      let inputShifts: any[] = [];

      for (const row of rawRows) {
        if (!Array.isArray(row) || row.length < 5) continue; 

        let dateIdx = row.findIndex(cell => {
          const str = String(cell).trim();
          return /^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{2}\/\d{2}\/\d{4}$/.test(str) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str);
        });

        if (dateIdx === -1) continue; 

        const cId = dateIdx >= 3 ? String(row[dateIdx - 3]).trim() : "";
        const cApellido = dateIdx >= 2 ? String(row[dateIdx - 2]).trim() : "";
        const cNombre = dateIdx >= 1 ? String(row[dateIdx - 1]).trim() : "";
        const fullName = `${cNombre} ${cApellido}`.trim();

        if (fullName !== target.name || cId !== target.id) continue;

        const cDate = parseDate(row[dateIdx]);
        if (!cDate) continue;

        const cEntrada = parseTime(row[dateIdx + 1]);
        const cSalidaBreak = parseTime(row[dateIdx + 2]);
        const cEntradaBreak = parseTime(row[dateIdx + 3]);
        const cSalida = parseTime(row[dateIdx + 5]);

        const monthIndex = parseInt(cDate.split("-")[1]) - 1;
        const day = parseInt(cDate.split("-")[2]);
        
        if (monthIndex !== selectedMonth) continue;
        if (selectedQuincena === 1 && day > 15) continue;
        if (selectedQuincena === 2 && day <= 15) continue;

        inputShifts.push({
          date: cDate,
          startTime: cEntrada,
          endTime: cSalida,
          breakStart: cSalidaBreak,
          breakEnd: cEntradaBreak,
        });
      }

      if (inputShifts.length === 0) {
        throw new Error("Se encontró tu usuario, pero no tienes marcaciones válidas para el mes y quincena seleccionados.");
      }

      setStatusMsg("Obteniendo tus turnos guardados...");
      const q = query(collection(db, "shifts"), where("userId", "==", user.id), where("month", "==", mesesFull[selectedMonth]));
      const snap = await getDocs(q);
      const allSaved = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      const savedShifts = allSaved.filter(s => {
        if (s.id.includes('_split') || s.isOff || s.type !== 'SHIFT') return false;
        const d = parseInt(s.date.split('-')[2]);
        return selectedQuincena === 1 ? d <= 15 : d > 15;
      });

      setStatusMsg("Cruzando datos y calculando gravedad...");
      const results: DiffResult[] = [];
      
      const inputDates = inputShifts.map(s => s.date);
      const savedDates = savedShifts.map(s => s.date);
      const allUniqueDates = Array.from(new Set([...inputDates, ...(auditMode === 'COMPLETA' ? savedDates : [])])).sort();

      allUniqueDates.forEach(dateStr => {
        const input = inputShifts.find(s => s.date === dateStr);
        const saved = savedShifts.find(s => s.date === dateStr);

        if (saved && input) {
          const diffs: string[] = [];
          let hasTimeMismatch = false;
          let hasBreakMismatch = false;
          let isMissingOfficialTime = false;

          if (!input.startTime || !input.endTime) {
            isMissingOfficialTime = true;
            diffs.push("Faltan horas de entrada o salida en el reporte oficial.");
          }

          if (saved.startTime !== input.startTime) {
            hasTimeMismatch = true;
            diffs.push(`Entrada: ${saved.startTime || '--'} ➔ ${input.startTime || '--'}`);
          }
          if (saved.endTime !== input.endTime) {
            hasTimeMismatch = true;
            diffs.push(`Salida: ${saved.endTime || '--'} ➔ ${input.endTime || '--'}`);
          }
          
          if (input.breakStart && input.breakEnd && saved.breakStart && saved.breakEnd) {
             if (saved.breakStart !== input.breakStart || saved.breakEnd !== input.breakEnd) {
                hasBreakMismatch = true;
                diffs.push(`Break: ${saved.breakStart}-${saved.breakEnd} ➔ ${input.breakStart}-${input.breakEnd}`);
             }
          } else if ((input.breakStart && !saved.breakStart) || (!input.breakStart && saved.breakStart)) {
             hasBreakMismatch = true;
             diffs.push("Diferencia en existencia de Break.");
          }

          if (diffs.length > 0) {
            let severity: MismatchSeverity = 'LEVE';

            if (isMissingOfficialTime) {
              severity = 'GRAVE';
            } else if (hasTimeMismatch) {
              severity = 'MODERADO';
            } else if (hasBreakMismatch) {
              severity = 'LEVE';
            }

            results.push({ 
              date: dateStr, 
              status: 'MISMATCH', 
              severity, 
              savedShift: saved, 
              inputShift: input, 
              differences: diffs 
            });
          } else {
            results.push({ date: dateStr, status: 'MATCH', savedShift: saved, inputShift: input });
          }

        } else if (!saved && input) {
          results.push({ date: dateStr, status: 'MISSING_IN_APP', severity: 'GRAVE', inputShift: input });
        } else if (saved && !input) {
          results.push({ date: dateStr, status: 'MISSING_IN_FILE', severity: 'GRAVE', savedShift: saved });
        }
      });

      // ARRIBA: Turnos con novedades (ordenados por fecha)
      // ABAJO: Turnos perfectos (ordenados por fecha)
      const discrepants = results.filter(r => r.status !== 'MATCH').sort((a, b) => a.date.localeCompare(b.date));
      const matches = results.filter(r => r.status === 'MATCH').sort((a, b) => a.date.localeCompare(b.date));
      const sortedResults = [...discrepants, ...matches];

      setAuditResults(sortedResults);
      const defaultSelected = discrepants.map(r => r.date);
      setSelectedResultDates(defaultSelected);

      hapticSuccess();
      setStep(3);

    } catch (error: any) {
      console.error(error);
      hapticError();
      alert(`⚠️ ${error.message}`);
    } finally {
      setIsProcessing(false);
      setStatusMsg("");
    }
  };

  // --- SELECCIÓN Y COPIADO EN ORDEN DE DÍAS ---
  const toggleSelectDate = (date: string) => {
    hapticLight();
    setSelectedResultDates(prev => 
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const toggleSelectAllDiscrepancies = () => {
    hapticLight();
    const allDiscrepantDates = auditResults.filter(r => r.status !== 'MATCH').map(r => r.date);
    if (selectedResultDates.length === allDiscrepantDates.length) {
      setSelectedResultDates([]);
    } else {
      setSelectedResultDates(allDiscrepantDates);
    }
  };

  const handleCopySelectedDiscrepancies = () => {
    const itemsToCopy = auditResults
      .filter(r => selectedResultDates.includes(r.date) && r.status !== 'MATCH')
      .sort((a, b) => a.date.localeCompare(b.date));

    if (itemsToCopy.length === 0) {
      return alert("Selecciona al menos una marcación para copiar.");
    }

    const formattedText = itemsToCopy.map(r => {
      const [y, m, d] = r.date.split('-');
      const dateFormatted = `${d}/${m}/${y}`;
      const s = r.savedShift || r.inputShift;

      const startTimeStr = s?.originalStartTime || s?.startTime || "--:--";
      const endTimeStr = s?.originalEndTime || s?.endTime || "--:--";
      const hasBreak = s?.hasBreak !== undefined ? s.hasBreak : !!(s?.breakStart && s?.breakEnd);
      const breakStr = hasBreak && s?.breakStart && s?.breakEnd
        ? `Break: ${s.breakStart} - ${s.breakEnd}`
        : "Break: Sin break";

      return `${dateFormatted}\nEntrada: ${startTimeStr}\n${breakStr}\nSalida: ${endTimeStr}`;
    }).join("\n\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formattedText).catch(() => {});
    }

    hapticLight();
    alert(itemsToCopy.length === 1 ? "¡Copiado al portapapeles!" : `¡${itemsToCopy.length} registros copiados al portapapeles!`);
  };

  // --- SINCRONIZACIÓN OFICIAL SELECTIVA ---
  const handleSyncToOfficial = async () => {
    if (!user) return;

    const toSync = auditResults.filter(r => (r.status === 'MISMATCH' || r.status === 'MISSING_IN_APP') && selectedResultDates.includes(r.date));

    if (toSync.length === 0) {
      return alert("Selecciona al menos un turno desfasado para sincronizar.");
    }

    hapticWarning();
    if (!confirm(`¿Reemplazar ${toSync.length} turno(s) seleccionado(s) con las marcaciones oficiales?`)) return;

    setIsProcessing(true);
    setStatusMsg("Sincronizando nómina oficial...");

    try {
      for (const res of toSync) {
        const input = res.inputShift;
        const baseDocId = `${user.id}_${input.date}`;

        if (res.status === 'MISMATCH' && res.savedShift) {
          const baseId = res.savedShift.id.replace(/_split.*/, '');
          await deleteDoc(doc(db, "shifts", baseId));
          await deleteDoc(doc(db, "shifts", `${baseId}_split`));
          await deleteDoc(doc(db, "shifts", `${baseId}_split_2`));
        }

        await deleteDoc(doc(db, "shifts", baseDocId));
        await deleteDoc(doc(db, "shifts", `${baseDocId}_split`));
        await deleteDoc(doc(db, "shifts", `${baseDocId}_split_2`));

        let hasBreak = !!(input.breakStart && input.breakEnd);
        const calcs = calculateShift(input.date, input.startTime, input.endTime, hasBreak ? { start: input.breakStart, end: input.breakEnd } : undefined, role, hasBreak);

        const calcArray = Array.isArray(calcs) ? calcs : [calcs];

        await Promise.all(calcArray.map(async (calc: any, i: number) => {
          const idToSave = i === 0 ? baseDocId : i === 1 ? `${baseDocId}_split` : `${baseDocId}_split_${i}`;
          
          const dateParts = calc.date.split('-');
          const calcYear = parseInt(dateParts[0], 10);
          const calcMonthVal = mesesFull[parseInt(dateParts[1], 10) - 1];

          const payload = {
            userId: user.id, 
            type: 'SHIFT',
            startTime: input.startTime, 
            endTime: input.endTime,
            hasBreak, 
            isManualBreak: hasBreak, 
            breakStart: input.breakStart || "", 
            breakEnd: input.breakEnd || "",
            ...calc, 
            isOff: false, 
            month: calcMonthVal,
            year: calcYear,
            timestamp: serverTimestamp()
          };
          
          await setDoc(doc(db, "shifts", idToSave), payload, { merge: true });
        }));
      }

      hapticSuccess();
      alert(`✨ ¡Se han sincronizado ${toSync.length} turno(s) exitosamente!`);
      window.location.reload();

    } catch (error) {
      console.error(error);
      hapticError();
      alert("Error sincronizando los turnos.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 bg-zinc-50 dark:bg-[#0a0a0a] min-h-[60vh] rounded-[3rem] p-6 md:p-10 shadow-xl border border-zinc-200 dark:border-zinc-800 transition-colors">
      
      {/* HEADER STEPS */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-zinc-200 dark:bg-zinc-800 -z-10 rounded-full overflow-hidden">
          <motion.div className={`h-full ${activeBg}`} initial={{ width: "33%" }} animate={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }} transition={{ duration: 0.5 }} />
        </div>
        {[1, 2, 3].map((s) => (
          <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 ${step >= s ? `${activeBg} text-white shadow-lg scale-110` : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
            {s}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        
        {/* PASO 1: CONFIGURACIÓN */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">Marcaciones</h2>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Cruza tus registros con el archivo proporcionado por tu gerente.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Periodo a revisar</label>
                <div className="flex gap-2 mt-2">
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="flex-1 p-3 bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs uppercase text-zinc-700 dark:text-zinc-200 outline-none">
                    {mesesFull.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={selectedQuincena} onChange={(e) => setSelectedQuincena(parseInt(e.target.value) as 1|2)} className="w-24 p-3 bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs uppercase text-zinc-700 dark:text-zinc-200 outline-none">
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                  </select>
                </div>
              </div>

              {/* Casilla Modo de Análisis con Iluminación Destacada */}
              <div className={`bg-white dark:bg-zinc-900 p-5 rounded-3xl border transition-all ${glowShadow}`}>
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                  <span>Modo de Análisis</span>
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                </label>
                <div className="flex bg-zinc-100 dark:bg-[#0a0a0a] p-1 rounded-xl mt-2 border border-zinc-200/50 dark:border-zinc-800/80">
                  <button onClick={() => setAuditMode('COMPLETA')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${auditMode === 'COMPLETA' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}>Completa</button>
                  <button onClick={() => setAuditMode('PARCIAL')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${auditMode === 'PARCIAL' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}>Parcial</button>
                </div>
                <p className="text-[9px] font-bold text-zinc-400 mt-2 text-center leading-tight">
                  {auditMode === 'COMPLETA' ? 'Revisa toda la quincena. Alerta si faltan días que tenías guardados.' : 'Ignora los días que no vengan en el archivo (Ideal para adelantos).'}
                </p>
              </div>
            </div>

            <button onClick={() => { hapticLight(); setStep(2); }} className={`w-full py-4 rounded-2xl font-black text-white uppercase tracking-widest shadow-lg transition-transform active:scale-95 mt-6 ${activeBg}`}>Continuar</button>
          </motion.div>
        )}

        {/* PASO 2: INGRESO DE DATOS */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { hapticLight(); setStep(1); }} className="text-xs font-black text-zinc-400 uppercase">← Volver</button>
              <h2 className="text-xl font-black italic uppercase text-zinc-900 dark:text-white">Cargar Datos</h2>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                <span>Buscar Empleado</span>
                <span className="text-[8px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">Nombre o CC</span>
              </label>
              
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => { setSearchQuery(e.target.value); setCandidates([]); }} 
                placeholder="Ej. Raul o 1000123456" 
                className="w-full mt-2 p-3.5 bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-xl font-black text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
              />
              
              {/* Switch discreto para recordar empleado */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
                <span className="text-[10px] font-bold text-zinc-400">Recordar este empleado para próximos archivos</span>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    const next = !rememberEmployee;
                    setRememberEmployee(next);
                    if (!next) localStorage.removeItem("mc_audit_saved_employee");
                  }}
                  className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${rememberEmployee ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${rememberEmployee ? 'translate-x-3.5' : 'translate-x-0'}`} />
                </button>
              </div>

              <AnimatePresence>
                {candidates.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-black uppercase text-orange-500 mb-2 ml-1">⚠️ Se encontraron varias personas, selecciona la tuya:</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {candidates.map((c, i) => (
                        <button key={i} onClick={() => processAudit(c)} className="w-full flex justify-between items-center p-3 bg-zinc-50 dark:bg-[#0a0a0a] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all">
                          <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">{c.name}</span>
                          {c.id && <span className="text-[10px] font-bold text-zinc-400">CC: {c.id}</span>}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-2 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex bg-zinc-100 dark:bg-[#0a0a0a] p-1 rounded-2xl mb-4">
                <button onClick={() => { hapticLight(); setInputMode('FILE'); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${inputMode === 'FILE' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}>Subir Archivo</button>
                <button onClick={() => { hapticLight(); setInputMode('TEXT'); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${inputMode === 'TEXT' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}>Pegar Texto</button>
              </div>

              {inputMode === 'FILE' ? (
                <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${fileName ? 'border-green-400 bg-green-50/20 dark:bg-green-900/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="text-4xl mb-3">{fileName ? "✅" : "📊"}</div>
                  <p className="text-xs font-bold text-zinc-500">{fileName || "Toca para subir el reporte de McDonald's"}</p>
                </div>
              ) : (
                <textarea 
                  value={pastedText} 
                  onChange={e => { setPastedText(e.target.value); setCandidates([]); }} 
                  placeholder="Pega las filas aquí. No importa si omites los encabezados, la IA encontrará la columna de fecha y deducirá los horarios automáticamente..." 
                  className="w-full h-32 p-4 bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-2xl font-mono text-[10px] text-zinc-700 dark:text-zinc-300 outline-none resize-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <button onClick={() => processAudit()} disabled={isProcessing || candidates.length > 0} className={`w-full py-4 rounded-2xl font-black text-white uppercase tracking-widest shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2 ${activeBg}`}>
              {isProcessing ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {statusMsg}</> : "Iniciar Auditoría"}
            </button>
          </motion.div>
        )}

        {/* PASO 3: RESULTADOS DE LA AUDITORÍA */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { hapticLight(); setStep(2); }} className="text-xs font-black text-zinc-400 uppercase">← Reintentar</button>
              <h2 className="text-xl font-black italic uppercase text-zinc-900 dark:text-white">Diagnóstico</h2>
            </div>

            {employeeName && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-3xl border border-blue-200 dark:border-blue-800/50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-800/50 flex items-center justify-center text-xl shrink-0 shadow-sm">👤</div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Auditoría a nombre de</p>
                    <p className="text-sm font-black text-zinc-900 dark:text-white leading-tight mt-0.5">{employeeName}</p>
                  </div>
                </div>
                {auditResults.some(r => r.status !== 'MATCH') && (
                  <button 
                    onClick={toggleSelectAllDiscrepancies}
                    className="text-[10px] font-black uppercase bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                  >
                    {selectedResultDates.length === auditResults.filter(r => r.status !== 'MATCH').length ? 'Deseleccionar' : 'Seleccionar Todo'}
                  </button>
                )}
              </div>
            )}

            {/* Resumen de Tarjetas */}
            <div className="grid grid-cols-4 gap-2 md:gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-3 md:p-4 rounded-2xl md:rounded-3xl text-center">
                <p className="text-xl md:text-2xl font-black text-green-600 dark:text-green-400">{auditResults.filter(r => r.status === 'MATCH').length}</p>
                <p className="text-[8px] md:text-[9px] font-black uppercase text-green-700 dark:text-green-500 mt-1">Perfectos</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 p-3 md:p-4 rounded-2xl md:rounded-3xl text-center">
                <p className="text-xl md:text-2xl font-black text-yellow-600 dark:text-yellow-400">{auditResults.filter(r => r.severity === 'LEVE').length}</p>
                <p className="text-[8px] md:text-[9px] font-black uppercase text-yellow-700 dark:text-yellow-500 mt-1">Leves</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 p-3 md:p-4 rounded-2xl md:rounded-3xl text-center">
                <p className="text-xl md:text-2xl font-black text-orange-600 dark:text-orange-400">{auditResults.filter(r => r.severity === 'MODERADO').length}</p>
                <p className="text-[8px] md:text-[9px] font-black uppercase text-orange-700 dark:text-orange-500 mt-1">Medios</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3 md:p-4 rounded-2xl md:rounded-3xl text-center">
                <p className="text-xl md:text-2xl font-black text-red-600 dark:text-red-400">{auditResults.filter(r => r.severity === 'GRAVE').length}</p>
                <p className="text-[8px] md:text-[9px] font-black uppercase text-red-700 dark:text-red-500 mt-1">Graves</p>
              </div>
            </div>

            {/* Lista Detallada (Novedades primero por día, luego perfectos por día) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 max-h-72 overflow-y-auto space-y-3">
              {auditResults.length === 0 ? (
                <p className="text-center text-xs font-bold text-zinc-400 py-6">No se encontraron datos para auditar.</p>
              ) : (
                auditResults.map((res, i) => {
                  const isSelected = selectedResultDates.includes(res.date);
                  const isDiscrepant = res.status !== 'MATCH';

                  return (
                    <div 
                      key={i} 
                      onClick={() => isDiscrepant && toggleSelectDate(res.date)}
                      className={`p-4 rounded-2xl border transition-all ${isDiscrepant ? 'cursor-pointer select-none' : ''} ${
                        isSelected ? 'ring-1 ring-blue-500 shadow-sm' : ''
                      } ${
                        res.status === 'MATCH' ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-800/30' :
                        res.severity === 'LEVE' ? 'bg-yellow-50/50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800/50' :
                        res.severity === 'MODERADO' ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800/50' :
                        'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {isDiscrepant && (
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => toggleSelectDate(res.date)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          )}
                          <span className="font-black text-sm text-zinc-800 dark:text-zinc-200">{res.date.split("-").reverse().join("/")}</span>
                        </div>

                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-widest shadow-sm ${
                          res.status === 'MATCH' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                          res.severity === 'LEVE' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
                          res.severity === 'MODERADO' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                        }`}>
                          {res.status === 'MATCH' ? '✓ Perfecto' : res.severity === 'LEVE' ? '⚠️ Leve' : res.severity === 'MODERADO' ? '⚠️ Medio' : '❌ Grave'}
                        </span>
                      </div>

                      {res.status === 'MISMATCH' && res.differences && (
                        <div className={`space-y-1 mt-3 border-t pt-2 ${
                          res.severity === 'LEVE' ? 'border-yellow-200/50 dark:border-yellow-800/50' :
                          res.severity === 'MODERADO' ? 'border-orange-200/50 dark:border-orange-800/50' :
                          'border-red-200/50 dark:border-red-800/50'
                        }`}>
                          {res.differences.map((diff, idx) => (
                            <p key={idx} className={`text-[11px] font-bold ${
                              res.severity === 'LEVE' ? 'text-yellow-800 dark:text-yellow-300' :
                              res.severity === 'MODERADO' ? 'text-orange-800 dark:text-orange-300' :
                              'text-red-800 dark:text-red-300'
                            }`}>
                              <span className="mr-1 opacity-70">•</span> {diff}
                            </p>
                          ))}
                        </div>
                      )}
                      
                      {res.status === 'MISSING_IN_FILE' && (
                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-1">Este turno está en tu app pero NO aparece en el reporte oficial.</p>
                      )}
                      
                      {res.status === 'MISSING_IN_APP' && (
                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-1">Turno faltante en tu app: ({res.inputShift.startTime} - {res.inputShift.endTime}).</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Acciones Finales */}
            {auditResults.some(r => r.status !== 'MATCH') && (
              <div className="pt-2 space-y-3">
                <button 
                  onClick={handleSyncToOfficial} 
                  disabled={isProcessing || selectedResultDates.length === 0} 
                  className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-transform active:scale-95 bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:text-black dark:hover:bg-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Sincronizando...</>
                  ) : (
                    `Sincronizar (${selectedResultDates.length})`
                  )}
                </button>

                <div className="flex justify-center">
                  <button 
                    onClick={handleCopySelectedDiscrepancies} 
                    disabled={selectedResultDates.length === 0}
                    className="py-2 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    📋 Copiar Novedades
                  </button>
                </div>

                <p className="text-[9px] font-bold text-zinc-400 text-center">
                  Sincroniza los turnos seleccionados con las marcaciones oficiales o copia los registros desfasados al portapapeles.
                </p>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}