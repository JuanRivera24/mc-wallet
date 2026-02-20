"use client";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link"; // Importamos Link para navegación interna

export default function Footer() {
  const { themeColor, isDarkMode, toggleDarkMode } = useTheme();

  return (
    <footer className="bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-gray-900 py-8 md:pt-16 md:pb-10 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center text-center">

          {/* Logo Pequeño */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🍔</span>
            <span className={`font-black text-xl md:text-2xl tracking-tighter ${themeColor === 'blue' ? 'text-blue-600' : 'text-red-600'}`}>
              McWallet
            </span>
          </div>

          <p className="text-gray-400 dark:text-gray-600 font-medium max-w-xs mx-auto text-[10px] md:text-sm leading-relaxed mb-6">
            Hecho por Crews, para Crews. <br className="md:hidden"/>
            Precisión milimétrica.
          </p>

          {/* Enlaces y Botón Oscuro */}
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 mb-8">
            <div className="flex gap-6 md:gap-10">
              {/* Agregamos la / antes del # para que funcionen desde cualquier página */}
              <Link href="/#nosotros" className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition">Inicio</Link>
              <Link href="/#tarifas" className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition">Tarifas</Link>
              <Link href="/#calculadora" className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition">Calc</Link>
            </div>

            {/* INTERRUPTOR PEQUEÑITO */}
            <button 
              onClick={toggleDarkMode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              {isDarkMode ? '☀️ Claro' : '🌙 Oscuro'}
            </button>
          </div>

          {/* Legal Mínimo */}
          <div className="w-full border-t border-gray-50 dark:border-gray-900 pt-6">
            <p className="text-gray-300 dark:text-gray-700 text-[9px] font-bold uppercase tracking-widest mb-1">
              2026 © McWallet
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
