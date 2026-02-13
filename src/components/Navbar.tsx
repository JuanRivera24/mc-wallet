"use client";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  const { role, setRole, themeColor } = useTheme(); 
  const [isOpen, setIsOpen] = useState(false);

  // Clases dinámicas para colores activos
  const activeText = themeColor === 'blue' ? 'text-blue-600' : 'text-red-600';
  const activeBg = themeColor === 'blue' ? 'bg-blue-50' : 'bg-red-50';

  // Función para alternar rol con un solo click
  const toggleRole = () => {
    setRole(role === 'CREW' ? 'ENTRENADOR' : 'CREW');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-100 h-20 transition-all">
      <div className="max-w-7xl mx-auto px-4 h-full flex justify-between items-center relative">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2 z-50 hover:opacity-80 transition-opacity">
          <span className="text-3xl">🍔</span>
          <span className={`font-black text-xl md:text-2xl tracking-tighter ${activeText}`}>
            McWallet
          </span>
        </Link>

        {/* ENLACES ESCRITORIO (Centrados) */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 gap-8 text-[11px] font-black uppercase tracking-widest text-gray-400">
          <Link href="/#nosotros" className="hover:text-black transition-colors py-2">Nosotros</Link>
          <Link href="/#tarifas" className="hover:text-black transition-colors py-2">Tarifas</Link>
          <Link href="/#calculadora" className="hover:text-black transition-colors py-2">Calculadora</Link>
          <SignedIn>
            <Link href="/nominas" className={`hover:brightness-110 transition-colors py-2 ${activeText}`}>
              📂 Mis Nóminas
            </Link>
          </SignedIn>
        </div>

        {/* ACCIONES DERECHA */}
        <div className="flex items-center gap-3 md:gap-4 z-50">
          
          {/* SWITCH DE ROL (INTERRUPTOR ÚNICO) */}
          <button 
            onClick={toggleRole}
            className="bg-gray-100 rounded-full p-1 shadow-inner flex cursor-pointer hover:bg-gray-200 transition-colors active:scale-95"
            aria-label="Cambiar Rol"
          >
            {/* Lado CREW */}
            <span className={`px-3 py-1.5 rounded-full text-[10px] md:text-[11px] font-black transition-all duration-300 
              ${role === 'CREW' ? 'bg-white shadow-sm text-blue-600 scale-100' : 'text-gray-400 scale-95'}`}>
              CREW
            </span>
            
            {/* Lado ENTR */}
            <span className={`px-3 py-1.5 rounded-full text-[10px] md:text-[11px] font-black transition-all duration-300 
              ${role === 'ENTRENADOR' ? 'bg-white shadow-sm text-red-600 scale-100' : 'text-gray-400 scale-95'}`}>
              ENTR
            </span>
          </button>

          {/* Separador */}
          <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

          {/* Auth & Avatar */}
          <div className="flex items-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="font-black text-[10px] md:text-xs uppercase tracking-widest bg-black text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 hover:scale-105 transition-all shadow-lg shadow-black/20">
                  Ingresar
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-9 h-9 rounded-xl border-2 border-white shadow-sm" } }} />
            </SignedIn>
          </div>

          {/* BOTÓN HAMBURGUESA (Móvil) */}
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="md:hidden p-2 -mr-2 text-gray-800 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors focus:outline-none"
          >
            {isOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* MENÚ MÓVIL(Full Screen Overlay suave) */}
      <div className={`md:hidden absolute top-20 left-0 w-full bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden ${isOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="flex flex-col p-6 space-y-2">
          <Link href="/#nosotros" onClick={() => setIsOpen(false)} className="text-xs font-black tracking-widest text-gray-400 hover:text-black py-4 border-b border-gray-50 hover:pl-2 transition-all">
            NOSOTROS
          </Link>
          <Link href="/#tarifas" onClick={() => setIsOpen(false)} className="text-xs font-black tracking-widest text-gray-400 hover:text-black py-4 border-b border-gray-50 hover:pl-2 transition-all">
            TARIFAS
          </Link>
          <Link href="/#calculadora" onClick={() => setIsOpen(false)} className="text-xs font-black tracking-widest text-gray-400 hover:text-black py-4 border-b border-gray-50 hover:pl-2 transition-all">
            CALCULADORA
          </Link>
          <SignedIn>
            <Link href="/nominas" onClick={() => setIsOpen(false)} className={`mt-4 block w-full text-center text-xs font-black tracking-widest uppercase py-4 rounded-2xl ${activeBg} ${activeText}`}>
              📂 IR A MIS NÓMINAS 
            </Link>
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}