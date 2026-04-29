"use client";
import React from "react";

// Función utilitaria copiada aquí para que el componente sea independiente
const toMinutes = (t?: string) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h * 60) + m;
};

// Definimos qué datos necesita recibir este componente para funcionar
interface ShiftListProps {
  turnosLista: any[];
  expandedShiftId: string | null;
  incapacidadType: 'HORAS' | 'TURNO';
  handleToggleExpand: (id: string) => void;
  handleOpenEdit: (e: React.MouseEvent, shift: any) => void;
  handleRecalculate: (e: React.MouseEvent, shift: any) => void;
  handleDelete: (e: React.MouseEvent, id: string) => void;
}

export default function ShiftList({
  turnosLista,
  expandedShiftId,
  incapacidadType,
  handleToggleExpand,
  handleOpenEdit,
  handleRecalculate,
  handleDelete,
}: ShiftListProps) {
  
  return (
    <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[500px] overflow-y-auto">
      {turnosLista.length === 0 ? (
        <div className="p-10 text-center text-gray-300 dark:text-gray-600 font-bold italic">
          No hay turnos registrados en esta quincena.
        </div>
      ) : (
        turnosLista.map((s) => (
          <div
            key={s.id}
            onClick={() => !s.isOff && handleToggleExpand(s.id)}
            className={`transition-colors cursor-pointer group ${s.isOff ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
          >
            {/* LIST ITEM PRINCIPAL */}
            <div className="p-4 md:p-8 flex justify-between items-center gap-2 md:gap-4">
              
              {/* Información a la Izquierda */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-2 md:gap-3 mb-1">
                  <span className={`flex-shrink-0 w-3 h-3 rounded-full border border-black dark:border-transparent ${
                    s.isOff ? 'bg-red-500' : 
                    s.type === 'REUNION' ? 'bg-orange-400' : 
                    s.type === 'COMPENSATORIO' ? 'bg-yellow-400' : 
                    s.type === 'INCAPACIDAD' ? 'bg-white border-2 border-red-500' : 'bg-green-500'
                  }`}></span>
                  <p className="font-black text-lg md:text-xl text-gray-800 dark:text-gray-200 capitalize truncate">
                    {new Date(Number(s.date.split('-')[0]), Number(s.date.split('-')[1]) - 1, Number(s.date.split('-')[2])).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}
                  </p>
                </div>

                <div className="flex flex-col md:flex-row md:items-center text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide pl-[1.25rem] md:pl-6 leading-tight gap-0.5 md:gap-0">
                  {s.isOff ? (
                    <span>Día de Descanso</span>
                  ) : s.startTime ? (
                    <>
                      <span>{s.startTime} - {s.endTime}</span>
                      <span className="hidden md:inline mx-1.5 text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-gray-500 dark:text-gray-400">{Number(s.totalHours || 0).toFixed(1)}H</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-500 dark:text-gray-400">{Number(s.totalHours || 0).toFixed(1)}H</span>
                      <span className="hidden md:inline mx-1.5 text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-[9px] md:text-xs text-gray-400">{s.type === 'INCAPACIDAD' && incapacidadType === 'HORAS' ? 'INCAPACIDAD' : s.type}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Información y Botones a la Derecha */}
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                <div className="text-right flex-shrink-0 mr-[3%]">
                  {!s.isOff && s.type !== 'INCAPACIDAD' && (
                    <p className="font-black text-base md:text-xl text-gray-900 dark:text-white">
                      ${Math.floor(s.netPay).toLocaleString()}
                    </p>
                  )}
                  {!s.isOff && s.type === 'INCAPACIDAD' && (
                    <p className="font-bold text-[9px] md:text-xs text-red-500 uppercase">En Prox. Q.</p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 md:gap-2.5">
                  <button
                    onClick={(e) => handleOpenEdit(e, s)}
                    className="p-1 md:p-1.5 text-xs md:text-sm scale-[1.3] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors z-10"
                    title="Editar Turno"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={(e) => handleRecalculate(e, s)}
                    className="p-1 md:p-1.5 text-xs md:text-sm scale-[1.3] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-blue-500 dark:hover:bg-blue-600 hover:text-white transition-colors z-10"
                    title="Recalcular rápido"
                  >
                    🔄
                  </button>

                  <button
                    onClick={(e) => handleDelete(e, s.id)}
                    className="p-1 md:p-1.5 text-xs md:text-sm scale-[1.3] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-red-500 dark:hover:bg-red-600 hover:text-white transition-colors z-10"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>

            {/* DESGLOSE AL EXPANDIR (PARA TODOS LOS TURNOS MENOS OFF) */}
            {!s.isOff && expandedShiftId === s.id && (
              <div className="px-6 pb-6 md:px-8 md:pb-8 animate-in slide-in-from-top-2 fade-in duration-300">
                <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 transition-colors shadow-inner">
                  
                  {/* Resumen General del Turno */}
                  <div className="grid grid-cols-3 gap-2 md:gap-4 text-center mb-4 pb-4 border-b border-gray-200/50 dark:border-gray-700">
                    <div>
                      <p className="text-[9px] md:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Base (Horas)</p>
                      <p className="font-black text-gray-700 dark:text-gray-300">${Math.floor(s.salaryBase || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] md:text-[10px] font-bold text-green-600 dark:text-green-500 uppercase">Aux. Transp</p>
                      <p className="font-black text-green-700 dark:text-green-400">+${Math.floor(s.transportAux || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] md:text-[10px] font-bold text-red-400 uppercase">Deducciones</p>
                      <p className="font-black text-red-600 dark:text-red-400">-${Math.floor(s.deductions || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* TIMELINE VISUAL CON LOS COLORES CORREGIDOS */}
                  {(!s.type || s.type === 'SHIFT' || (s.type === 'INCAPACIDAD' && s.startTime)) && (
                    <div className="flex justify-center mb-4">
                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl shadow-sm flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-wider">
                        <span className="text-gray-800 dark:text-gray-100">ET: {s.startTime || "--:--"}</span>
                        
                        {s.hasBreak && s.breakStart && s.breakEnd && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="text-green-400 dark:text-green-300">EB: {s.breakStart}</span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="text-red-400 dark:text-red-300">SB: {s.breakEnd}</span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="text-yellow-400 dark:text-yellow-200">
                              TB: {(() => {
                                let sMins = toMinutes(s.breakStart);
                                let eMins = toMinutes(s.breakEnd);
                                if (eMins < sMins) eMins += 24 * 60;
                                const diff = eMins - sMins;
                                const h = Math.floor(diff / 60).toString().padStart(2, '0');
                                const m = (diff % 60).toString().padStart(2, '0');
                                return `${h}:${m}`;
                              })()}
                            </span>
                          </>
                        )}
                        
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className="text-gray-800 dark:text-gray-100">ST: {s.endTime || "--:--"}</span>
                      </div>
                    </div>
                  )}

                  {/* TIEMPO EXACTO */}
                  <div className="flex justify-center mb-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">⏳ Tiempo Exacto:</span>
                      <span className="text-sm font-black text-gray-800 dark:text-gray-200">
                        {(() => {
                          const exactMins = Math.round((Number(s.totalHours) || 0) * 60);
                          const h = Math.floor(exactMins / 60);
                          const m = exactMins % 60;
                          return `${h}h ${m.toString().padStart(2, '0')}m`;
                        })()}
                      </span>
                    </div>
                  </div>

                  <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest text-center mb-3">Desglose de Horas de este Evento</p>

                  {/* Desglose Detallado de Horas */}
                  {(!s.type || s.type === 'SHIFT' || (s.type === 'INCAPACIDAD' && s.startTime)) ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-2 text-center">
                      {s.hOrdD > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Ord. Diurna</p><p className="font-black text-sm text-gray-800 dark:text-gray-200">{Number(s.hOrdD).toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pOrdD).toLocaleString()}</p></div>}
                      {s.hOrdN > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Ord. Nocturna</p><p className="font-black text-sm text-blue-500 dark:text-blue-300">{Number(s.hOrdN).toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pOrdN).toLocaleString()}</p></div>}
                      {s.hDomD > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Dom/Fest Diurno</p><p className="font-black text-sm text-orange-500 dark:text-orange-400">{Number(s.hDomD).toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pDomD).toLocaleString()}</p></div>}
                      {s.hDomN > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Dom/Fest Noct</p><p className="font-black text-sm text-orange-600 dark:text-orange-500">{Number(s.hDomN).toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pDomN).toLocaleString()}</p></div>}

                      {s.hExtD > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Extra Diurna</p><p className="font-black text-sm text-red-500 dark:text-red-400">{Number(s.hExtD).toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pExtD).toLocaleString()}</p></div>}
                      {s.hExtN > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Extra Nocturna</p><p className="font-black text-sm text-red-600 dark:text-red-500">{Number(s.hExtN).toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pExtN).toLocaleString()}</p></div>}
                      {s.hExtDomD > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Extra Dom D.</p><p className="font-black text-sm text-purple-500 dark:text-purple-400">{Number(s.hExtDomD).toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pExtDomD).toLocaleString()}</p></div>}
                      {s.hExtDomN > 0 && <div><p className="text-[8px] font-bold text-gray-400 uppercase">Extra Dom N.</p><p className="font-black text-sm text-purple-600 dark:text-purple-500">{Number(s.hExtDomN).toFixed(1)} h</p><p className="text-[9px] font-bold text-gray-500">${Math.floor(s.pExtDomN).toLocaleString()}</p></div>}
                    </div>
                  ) : (
                    <div className="flex justify-center text-center">
                      <div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase">{s.type === 'INCAPACIDAD' ? 'INCAPACIDAD (POR HORAS)' : s.type}</p>
                        <p className="font-black text-lg text-gray-800 dark:text-gray-200">{Number(s.totalHours || 0).toFixed(1)} h</p>
                        <p className="text-[9px] font-bold text-gray-500">${Math.floor(s.salaryBase || 0).toLocaleString()} {s.specialRateKey ? `(${s.specialRateKey})` : ''}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}