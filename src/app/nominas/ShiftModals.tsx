"use client";
import React from "react";
import { useTheme } from "@/context/ThemeContext";

interface NormalModalProps {
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  editingShiftId: string | null;
  selectedDate: Date | null;
  startTime: string; setStartTime: (v: string) => void;
  endTime: string; setEndTime: (v: string) => void;
  hasBreak: boolean; setHasBreak: (v: boolean) => void;
  isManualBreak: boolean; setIsManualBreak: (v: boolean) => void;
  breakStart: string; setBreakStart: (v: string) => void;
  breakEnd: string; setBreakEnd: (v: string) => void;
  breakError: string | null;
  autoCalculateBreak: (start: string, end: string) => void;
  handleSaveShift: (isOff: boolean) => void;
}

export function NormalShiftModal({
  showModal, setShowModal, editingShiftId, selectedDate,
  startTime, setStartTime, endTime, setEndTime,
  hasBreak, setHasBreak, isManualBreak, setIsManualBreak,
  breakStart, setBreakStart, breakEnd, setBreakEnd,
  breakError, autoCalculateBreak, handleSaveShift
}: NormalModalProps) {
  const { colors } = useTheme();

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[2.5rem] p-8 md:p-10 animate-in zoom-in-95 border border-gray-100 dark:border-gray-800 shadow-2xl transition-colors">
        <h3 className="text-2xl font-black mb-8 text-center uppercase italic dark:text-white">
          {editingShiftId ? 'Editar Turno' : 'Nuevo Turno'}
        </h3>
        {selectedDate && (
          <p className="text-center text-gray-400 dark:text-gray-500 font-bold mb-6">
            {selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        )}

        <div className="space-y-6 mb-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Entrada</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (!isManualBreak) autoCalculateBreak(e.target.value, endTime);
                }}
                className="w-full p-4 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl font-black border-none outline-none focus:ring-2 ring-black dark:focus:ring-gray-600 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Salida</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  if (!isManualBreak) autoCalculateBreak(startTime, e.target.value);
                }}
                className="w-full p-4 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl font-black border-none outline-none focus:ring-2 ring-black dark:focus:ring-gray-600 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className={`p-4 rounded-2xl border-2 transition-colors ${hasBreak ? colors.accent : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] md:text-xs font-black uppercase transition-colors ${hasBreak ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>¿Turno con Break?</span>
                <button onClick={() => {
                  const nextBreak = !hasBreak;
                  setHasBreak(nextBreak);
                  if (nextBreak) {
                    setIsManualBreak(false);
                    autoCalculateBreak(startTime, endTime);
                  }
                }} className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative ${hasBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div className={`absolute top-1 w-3 h-3 md:w-4 md:h-4 bg-white rounded-full transition-all ${hasBreak ? 'left-[1.35rem] md:left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border-2 border-dashed transition-all duration-300 ${!hasBreak ? 'opacity-40 pointer-events-none border-gray-100 dark:border-gray-800' : (isManualBreak ? colors.accent : 'border-gray-100 dark:border-gray-800')}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase">¿Break Manual?</span>
                <button onClick={() => {
                  const nextState = !isManualBreak;
                  setIsManualBreak(nextState);
                  if (!nextState && hasBreak) {
                    autoCalculateBreak(startTime, endTime);
                  }
                }} disabled={!hasBreak} className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative ${isManualBreak ? colors.secondary : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div className={`absolute top-1 w-3 h-3 md:w-4 md:h-4 bg-white rounded-full transition-all ${isManualBreak ? 'left-[1.35rem] md:left-7' : 'left-1'}`} />
                </button>
              </div>

              {hasBreak && (
                <div className="animate-in fade-in slide-in-from-top-2 mt-3">
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <input 
                      type="time" 
                      value={breakStart} 
                      onChange={(e) => setBreakStart(e.target.value)} 
                      disabled={!isManualBreak}
                      className={`p-3 bg-white dark:bg-gray-800 dark:text-white rounded-xl text-xs font-bold border outline-none transition-colors ${!isManualBreak ? 'opacity-50 cursor-not-allowed border-gray-100 dark:border-gray-800' : (breakError ? 'border-red-400 focus:ring-red-200' : 'border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-gray-200')}`} 
                    />
                    <input 
                      type="time" 
                      value={breakEnd} 
                      onChange={(e) => setBreakEnd(e.target.value)} 
                      disabled={!isManualBreak}
                      className={`p-3 bg-white dark:bg-gray-800 dark:text-white rounded-xl text-xs font-bold border outline-none transition-colors ${!isManualBreak ? 'opacity-50 cursor-not-allowed border-gray-100 dark:border-gray-800' : (breakError ? 'border-red-400 focus:ring-red-200' : 'border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-gray-200')}`} 
                    />
                  </div>
                  {!isManualBreak && <p className="text-[9px] font-bold text-gray-400 uppercase text-center mb-1 tracking-widest">⏱️ Auto-calculado</p>}
                  {breakError && <p className="text-[10px] font-bold text-red-500 animate-pulse mt-1 text-center">{breakError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={() => setShowModal(false)} className="flex-1 font-bold text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition-colors">CANCELAR</button>
          <button
            onClick={() => handleSaveShift(false)}
            disabled={!!breakError}
            className={`flex-[2] py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all
              ${breakError ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed shadow-none scale-100' : `${colors.secondary} hover:scale-105 shadow-xl border border-black dark:border-transparent`}`}
          >
            GUARDAR
          </button>
        </div>
      </div>
    </div>
  );
}

interface SpecialModalProps {
  showSpecialModal: boolean;
  setShowSpecialModal: (v: boolean) => void;
  editingShiftId: string | null;
  selectedDate: Date | null;
  hasNormalShiftForModal: boolean;
  specialTab: 'REUNION' | 'COMPENSATORIO' | 'INCAPACIDAD';
  setSpecialTab: (v: 'REUNION' | 'COMPENSATORIO' | 'INCAPACIDAD') => void;
  incapacidadType: 'HORAS' | 'TURNO';
  setIncapacidadType: (v: 'HORAS' | 'TURNO') => void;
  specialHours: string; setSpecialHours: (v: string) => void;
  specialRateType: string; setSpecialRateType: (v: string) => void;
  startTime: string; setStartTime: (v: string) => void;
  endTime: string; setEndTime: (v: string) => void;
  hasBreak: boolean; setHasBreak: (v: boolean) => void;
  isManualBreak: boolean;
  autoCalculateBreak: (start: string, end: string) => void;
  specialTransport: boolean; setSpecialTransport: (v: boolean) => void;
  handleSaveSpecial: () => void;
}

export function SpecialShiftModal({
  showSpecialModal, setShowSpecialModal, editingShiftId, selectedDate,
  hasNormalShiftForModal, specialTab, setSpecialTab,
  incapacidadType, setIncapacidadType,
  specialHours, setSpecialHours, specialRateType, setSpecialRateType,
  startTime, setStartTime, endTime, setEndTime,
  hasBreak, setHasBreak, isManualBreak, autoCalculateBreak,
  specialTransport, setSpecialTransport, handleSaveSpecial
}: SpecialModalProps) {
  
  if (!showSpecialModal) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col">
        <div className="p-8 pb-4 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-2xl font-black text-center uppercase italic dark:text-white mb-2">
            {editingShiftId ? 'Editar Evento' : 'Eventos Especiales'}
          </h3>
          {selectedDate && (
            <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              {selectedDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 bg-gray-100 dark:bg-gray-800 p-1 m-4 rounded-xl">
          <button
            onClick={() => setSpecialTab('REUNION')}
            disabled={!!editingShiftId && specialTab !== 'REUNION'}
            className={`py-3 text-[9px] font-black uppercase rounded-lg transition-all ${!!editingShiftId && specialTab !== 'REUNION' ? 'opacity-30 cursor-not-allowed text-gray-400'
                : specialTab === 'REUNION' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            Reunión
          </button>
          <button
            onClick={() => {
              if (hasNormalShiftForModal) alert("Día con turno. Elimínalo e inténtalo de nuevo para agregar un Compensatorio.");
              else setSpecialTab('COMPENSATORIO');
            }}
            disabled={!!editingShiftId && specialTab !== 'COMPENSATORIO'}
            className={`py-3 text-[9px] font-black uppercase rounded-lg transition-all ${(!!editingShiftId && specialTab !== 'COMPENSATORIO') || hasNormalShiftForModal ? 'opacity-30 cursor-not-allowed text-gray-400'
                : specialTab === 'COMPENSATORIO' ? 'bg-white dark:bg-gray-700 text-yellow-500 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            Compensa.
          </button>
          <button
            onClick={() => {
              if (hasNormalShiftForModal) alert("Día con turno. Elimínalo e inténtalo de nuevo para agregar una Incapacidad.");
              else setSpecialTab('INCAPACIDAD');
            }}
            disabled={!!editingShiftId && specialTab !== 'INCAPACIDAD'}
            className={`py-3 text-[9px] font-black uppercase rounded-lg transition-all ${(!!editingShiftId && specialTab !== 'INCAPACIDAD') || hasNormalShiftForModal ? 'opacity-30 cursor-not-allowed text-gray-400'
                : specialTab === 'INCAPACIDAD' ? 'bg-white dark:bg-gray-700 text-red-500 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            Incapacidad
          </button>
        </div>

        <div className="px-8 pb-8 space-y-6">
          {specialTab === 'INCAPACIDAD' && (
            <div className="flex gap-2">
              <button onClick={() => setIncapacidadType('HORAS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg border-2 ${incapacidadType === 'HORAS' ? 'border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>Por Horas</button>
              <button onClick={() => setIncapacidadType('TURNO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg border-2 ${incapacidadType === 'TURNO' ? 'border-red-500 text-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>Turno Completo</button>
            </div>
          )}

          {(specialTab !== 'INCAPACIDAD' || incapacidadType === 'HORAS') && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Cantidad de Horas</label>
                <input type="number" step="0.1" placeholder="Ej: 2.5" value={specialHours} onChange={(e) => setSpecialHours(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-2xl font-black border-2 border-gray-100 dark:border-gray-700 outline-none focus:border-black transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Tipo de Hora a Pagar</label>
                <select value={specialRateType} onChange={(e) => setSpecialRateType(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-2xl font-black border-2 border-gray-100 dark:border-gray-700 outline-none focus:border-black transition-colors appearance-none">
                  <option value="ORDINARY">Ordinaria Diurna</option>
                  <option value="ORDINARY_NIGHT">Ordinaria Nocturna</option>
                  <option value="SUNDAY">Dom/Fest Diurno</option>
                  <option value="SUNDAY_NIGHT">Dom/Fest Nocturno</option>
                </select>
              </div>
            </div>
          )}

          {specialTab === 'INCAPACIDAD' && incapacidadType === 'TURNO' && (
            <div className="space-y-4 animate-in fade-in">
              <p className="text-[9px] font-bold text-red-500 uppercase text-center">Calcula tu día para inyectarlo en la prox. quincena</p>
              <div className="grid grid-cols-2 gap-4">
                <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); if (!isManualBreak) autoCalculateBreak(e.target.value, endTime); }} className="w-full p-3 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl font-black border outline-none" />
                <input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); if (!isManualBreak) autoCalculateBreak(startTime, e.target.value); }} className="w-full p-3 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl font-black border outline-none" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-500">¿Con Break?</span>
                <button onClick={() => setHasBreak(!hasBreak)} className={`w-10 h-5 rounded-full relative transition-all ${hasBreak ? 'bg-red-500' : 'bg-gray-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${hasBreak ? 'left-6' : 'left-1'}`} /></button>
              </div>
            </div>
          )}

          <div className={`p-4 rounded-2xl border-2 transition-colors flex items-center justify-between ${specialTransport ? 'border-green-400 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-800'}`}>
            <div>
              <p className="text-[10px] md:text-xs font-black uppercase text-gray-700 dark:text-gray-300">Aux. Transporte</p>
              <p className="text-[8px] font-bold uppercase text-gray-400">¿Aplica subsidio este día?</p>
            </div>
            <button onClick={() => setSpecialTransport(!specialTransport)} className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative ${specialTransport ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <div className={`absolute top-1 w-3 h-3 md:w-4 md:h-4 bg-white rounded-full transition-all ${specialTransport ? 'left-[1.35rem] md:left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex gap-4 pt-2">
            <button onClick={() => setShowSpecialModal(false)} className="flex-1 font-bold text-gray-400 hover:text-black dark:hover:text-white transition-colors">CANCELAR</button>
            <button onClick={handleSaveSpecial} className={`flex-[2] py-4 rounded-2xl text-black font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl
              ${specialTab === 'REUNION' ? 'bg-orange-500 text-white' : specialTab === 'COMPENSATORIO' ? 'bg-yellow-400 text-black' : 'bg-red-500 text-white'}`}>GUARDAR</button>
          </div>
        </div>
      </div>
    </div>
  );
}