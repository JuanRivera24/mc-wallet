"use client";
import { useTheme } from "@/context/ThemeContext";

export default function Footer() {
  const { themeColor } = useTheme();

  return (
    <footer className="bg-white border-t border-gray-100 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-4xl">🍔</span>
            <span className={`font-black text-3xl tracking-tighter ${themeColor === 'blue' ? 'text-blue-600' : 'text-red-600'}`}>
              McWallet
            </span>
          </div>
          
          <p className="text-gray-400 font-medium max-w-sm mx-auto text-sm leading-relaxed mb-10">
            Calculamos cada minuto de tu esfuerzo con la precisión que te mereces. 
            Hecho por Crews para el equipo de Arcos Dorados.
          </p>

          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 mb-12">
            <a href="#nosotros" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-black transition">Inicio</a>
            <a href="#tarifas" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-black transition">Tarifas</a>
            <a href="#calculadora" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-black transition">Calculadora</a>
          </div>

          <div className="w-full border-t border-gray-50 pt-10">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">
              2026 © McWallet • Todos los derechos reservados
            </p>
            <p className="text-gray-300 text-[9px] uppercase tracking-[0.2em] max-w-lg mx-auto leading-relaxed">
              Herramienta educativa independiente. McDonald&apos;s y Arcos Dorados son marcas registradas de sus respectivos dueños.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}