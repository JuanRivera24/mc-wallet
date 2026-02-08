"use client";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/context/ThemeContext";
import { useState } from "react";
import Footer from "@/components/Footer";

export default function NominasPage() {
  const { colors, themeColor } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState("Febrero");

  const meses = ["Enero", "Febrero", "Marzo", "Abril"];

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-5xl mx-auto px-4 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-black tracking-tighter text-gray-900">Historial de Nóminas</h1>
          <p className="text-gray-400 font-bold uppercase text-xs tracking-widest mt-1">Gestión Quincenal 2026</p>
        </header>

        {/* Selector de Meses */}
        <div className="flex gap-4 mb-10 overflow-x-auto pb-4 no-scrollbar">
          {meses.map((mes) => (
            <button
              key={mes}
              onClick={() => setSelectedMonth(mes)}
              className={`px-8 py-3 rounded-2xl font-black transition-all ${
                selectedMonth === mes 
                ? `${colors.secondary} text-white shadow-lg scale-105` 
                : "bg-white text-gray-400 hover:bg-gray-100"
              }`}
            >
              {mes}
            </button>
          ))}
        </div>

        {/* Contenedor de Quincenas */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Quincena 1 */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl transition-shadow cursor-pointer group">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-gray-800">1ra Quincena</h3>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-tighter">Días 01 - 15</p>
              </div>
              <span className={`p-3 rounded-xl ${colors.bg} ${colors.primary} font-black text-xl group-hover:scale-110 transition-transform`}>
                $0
              </span>
            </div>
            <div className="space-y-3 opacity-50">
               <p className="text-sm italic text-gray-400 text-center py-4 border-2 border-dashed rounded-2xl">Aún no hay turnos registrados</p>
            </div>
          </div>

          {/* Quincena 2 */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl transition-shadow cursor-pointer group">
             <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-gray-800">2da Quincena</h3>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-tighter">Días 16 - 31</p>
              </div>
              <span className={`p-3 rounded-xl ${colors.bg} ${colors.primary} font-black text-xl`}>
                $0
              </span>
            </div>
            <div className="space-y-3 opacity-50">
               <p className="text-sm italic text-gray-400 text-center py-4 border-2 border-dashed rounded-2xl">Aún no hay turnos registrados</p>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </main>
  );
}