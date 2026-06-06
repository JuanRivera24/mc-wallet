"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useUser } from "@clerk/nextjs";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AlertSettings() {
  const theme = useTheme?.();
  const themeColor = theme?.themeColor ?? "blue";
  const { hapticLight, hapticSuccess, hapticError } = useHaptics();
  const { user } = useUser();

  const activeBg = themeColor === "blue" ? "bg-blue-600" : "bg-red-600";
  const activeText = themeColor === "blue" ? "text-blue-600" : "text-red-600";

  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de Notificaciones y Comportamiento
  const [alerts, setAlerts] = useState({
    soundEnabled: true,
    vibrateEnabled: true,
    shifts: true,
    shiftAdvanceMin: 120, 
    daysOff: true,
    orquestRequests: true, 
    orquestSchedules: true, 
    paydays: true, 
  });

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "user_settings", user.id);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().alerts) {
        setAlerts(snap.data().alerts);
      }
    } catch (e) {
      console.error("Error al cargar configuraciones", e);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = async () => {
    hapticLight();
    if (!('Notification' in window)) {
      alert("Tu navegador no soporta notificaciones nativas.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      hapticSuccess();
      sendTestNotification();
    }
  };

  const toggleAlert = (key: keyof typeof alerts) => {
    hapticLight();
    setAlerts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    hapticLight();
    
    try {
      await setDoc(doc(db, "user_settings", user.id), { alerts }, { merge: true });
      hapticSuccess();
    } catch (e) {
      hapticError();
      alert("Error guardando preferencias.");
    } finally {
      setIsSaving(false);
    }
  };

  const sendTestNotification = () => {
    if (Notification.permission === "granted") {
      if (alerts.vibrateEnabled && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      
      new Notification("McWallet: Alerta de Prueba 🍔", {
        body: "¡Perfecto! Así te avisaremos de tus turnos, pagos y horarios.",
        icon: "/icon-192x192.png", 
        silent: !alerts.soundEnabled 
      });
    }
  };

  if (isLoading) {
    return <div className="text-center p-8 text-xs font-bold text-zinc-500 animate-pulse">Cargando preferencias...</div>;
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 bg-zinc-50 dark:bg-[#0a0a0a] min-h-[70vh] rounded-[2.5rem] p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 transition-colors font-sans">
      
      {permission !== "granted" && (
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 p-4 rounded-3xl flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center text-2xl shadow-sm">
            🔕
          </div>
          <div>
            <h3 className="font-black text-orange-800 dark:text-orange-400 text-sm">Notificaciones Apagadas</h3>
            <p className="text-[10px] font-bold text-orange-600 dark:text-orange-500/80 mt-1">Dale permiso a McWallet para avisarte fuera de la app.</p>
          </div>
          <button onClick={requestPermission} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors shadow-sm">
            Habilitar Permisos
          </button>
        </div>
      )}

      {/* COMPORTAMIENTO HARDWARE */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${activeText}`}>
            Comportamiento
          </h3>
          {permission === "granted" && (
            <button onClick={sendTestNotification} className="text-[9px] font-black uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
              Probar Alerta
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => toggleAlert('soundEnabled')} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${alerts.soundEnabled ? `border-transparent ${activeBg} text-white shadow-md` : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-400'}`}>
            <span className="text-2xl">🎵</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Sonido</span>
          </button>
          
          <button onClick={() => toggleAlert('vibrateEnabled')} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${alerts.vibrateEnabled ? `border-transparent ${activeBg} text-white shadow-md` : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-400'}`}>
            <span className="text-2xl">📳</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Vibración</span>
          </button>
        </div>
      </section>

      <div className="space-y-4">
        
        {/* OPERACIÓN & TURNOS */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className={`text-[10px] font-black uppercase tracking-widest mb-4 ${activeText}`}>
            Operación Diaria
          </h3>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-white">Aviso de Turno</p>
              <p className="text-[10px] text-zinc-500 font-medium">Alerta automática antes de tu hora de entrada.</p>
            </div>
            <button onClick={() => toggleAlert('shifts')} className={`w-12 h-6 rounded-full transition-colors relative ${alerts.shifts ? activeBg : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <motion.div layout className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm ${alerts.shifts ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <AnimatePresence>
            {alerts.shifts && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                  Tiempo de anticipación
                </label>
                <select 
                  value={alerts.shiftAdvanceMin} 
                  onChange={(e) => { hapticLight(); setAlerts(prev => ({ ...prev, shiftAdvanceMin: Number(e.target.value) })); }}
                  className="w-full bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl text-xs font-black tracking-wide text-zinc-700 dark:text-zinc-300 outline-none"
                >
                  <option value={30}>30 Minutos antes</option>
                  <option value={60}>1 Hora antes</option>
                  <option value={90}>1 Hora y media</option>
                  <option value={120}>2 Horas antes</option>
                  <option value={150}>2 Horas y media</option>
                  <option value={180}>3 Horas antes</option>
                  <option value={240}>4 Horas antes</option>
                </select>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-white">Días Libres</p>
              <p className="text-[10px] text-zinc-500 font-medium">Aviso matutino para confirmar tu descanso.</p>
            </div>
            <button onClick={() => toggleAlert('daysOff')} className={`w-12 h-6 rounded-full transition-colors relative ${alerts.daysOff ? activeBg : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <motion.div layout className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm ${alerts.daysOff ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </section>

        {/* GESTIÓN ORQUEST */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className={`text-[10px] font-black uppercase tracking-widest mb-4 ${activeText}`}>
            Gestión Orquest
          </h3>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                📅 Peticiones Libres
              </p>
              <p className="text-[10px] text-zinc-500 font-medium leading-tight mt-0.5">Recordatorio para pedir tu disponibilidad a tiempo.</p>
            </div>
            <button onClick={() => toggleAlert('orquestRequests')} className={`w-12 h-6 rounded-full transition-colors relative ${alerts.orquestRequests ? activeBg : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <motion.div layout className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm ${alerts.orquestRequests ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                👀 Nuevos Horarios
              </p>
              <p className="text-[10px] text-zinc-500 font-medium leading-tight mt-0.5">Alerta para revisar la nueva malla cuando suele estar lista.</p>
            </div>
            <button onClick={() => toggleAlert('orquestSchedules')} className={`w-12 h-6 rounded-full transition-colors relative ${alerts.orquestSchedules ? activeBg : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <motion.div layout className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm ${alerts.orquestSchedules ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </section>

        {/* FINANZAS */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                💰 Días de Nómina Crew
              </p>
              <p className="text-[10px] text-zinc-500 font-medium leading-tight mt-0.5">Alertas precisas basadas en el cronograma oficial.</p>
            </div>
            <button onClick={() => toggleAlert('paydays')} className={`w-12 h-6 rounded-full transition-colors relative ${alerts.paydays ? activeBg : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <motion.div layout className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm ${alerts.paydays ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </section>

      </div>

      <button 
        onClick={handleSave} 
        disabled={isSaving}
        className={`w-full mt-4 py-4 rounded-2xl font-black text-white uppercase text-xs tracking-widest shadow-md transition-all active:scale-95 flex justify-center items-center gap-2 ${activeBg}`}
      >
        {isSaving ? (
          <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
        ) : (
          "Guardar Configuración"
        )}
      </button>

    </div>
  );
}