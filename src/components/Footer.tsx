"use client";
import { useTheme } from "@/context/ThemeContext";

export default function Footer() {
  const { themeColor } = useTheme();

  return (
    <footer className="bg-white border-t border-gray-100 py-8 md:pt-16 md:pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center text-center">
          
          {/* Logo Pequeño */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🍔</span>
            <span className={`font-black text-xl md:text-2xl tracking-tighter ${themeColor === 'blue' ? 'text-blue-600' : 'text-red-600'}`}>
              McWallet
            </span>
          </div>
          
          <p className="text-gray-400 font-medium max-w-xs mx-auto text-[10px] md:text-sm leading-relaxed mb-6">
            Hecho por Crews, para Crews. <br className="md:hidden"/>
            Precisión milimétrica.
          </p>

          {/* Enlaces Compactos */}
          <div className="flex gap-6 md:gap-10 mb-8">
            <a href="#nosotros" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition">Inicio</a>
            <a href="#tarifas" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition">Tarifas</a>
            <a href="#calculadora" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition">Calc</a>
          </div>

          {/* Legal Mínimo */}
          <div className="w-full border-t border-gray-50 pt-6">
            <p className="text-gray-300 text-[9px] font-bold uppercase tracking-widest mb-1">
              2026 © McWallet
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}