"use client";
import { useTheme } from "@/context/ThemeContext";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  const { role, setRole, themeColor } = useTheme(); 

  const activeText = themeColor === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';

  const toggleRole = () => setRole(role === 'CREW' ? 'ENTRENADOR' : 'CREW');

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-900 h-[72px] lg:h-20 transition-all">
      <div className="max-w-7xl mx-auto px-4 h-full flex justify-between items-center relative">

        <Link href="/" className="flex items-center gap-1 sm:gap-2 z-50 hover:opacity-80 transition-opacity">
          <span className="text-2xl sm:text-3xl">🍔</span>
          <span className={`font-black text-lg sm:text-xl lg:text-2xl tracking-tighter ${activeText}`}>McWallet</span>
        </Link>

        {/* hidden lg:flex -> Solo se muestra en laptops y computadores */}
        <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 gap-8 text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          <Link href="/#nosotros" className="hover:text-black dark:hover:text-white transition-colors py-2">Nosotros</Link>
          <Link href="/#tarifas" className="hover:text-black dark:hover:text-white transition-colors py-2">Tarifas</Link>
          <Link href="/#calculadora" className="hover:text-black dark:hover:text-white transition-colors py-2">Calculadora</Link>
          <SignedIn>
            <Link href="/nominas" className={`hover:brightness-110 transition-colors py-2 ${activeText}`}>📂 Mis Nóminas</Link>
          </SignedIn>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 z-50">

          <button onClick={toggleRole} className="bg-gray-100 dark:bg-gray-800 rounded-full p-1 shadow-inner flex cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95" aria-label="Cambiar Rol">
            <span className={`px-3.5 py-1.5 lg:px-4 lg:py-2 rounded-full text-[10px] sm:text-[11px] lg:text-xs font-black transition-all duration-300 ${role === 'CREW' ? 'bg-white dark:bg-gray-900 shadow-sm text-blue-600 dark:text-blue-400 scale-100' : 'text-gray-400 dark:text-gray-500 scale-95'}`}>CREW</span>
            <span className={`px-3.5 py-1.5 lg:px-4 lg:py-2 rounded-full text-[10px] sm:text-[11px] lg:text-xs font-black transition-all duration-300 ${role === 'ENTRENADOR' ? 'bg-white dark:bg-gray-900 shadow-sm text-red-600 dark:text-red-400 scale-100' : 'text-gray-400 dark:text-gray-500 scale-95'}`}>ENTR</span>
          </button>

          {/* hidden lg:flex -> Solo se muestra en laptops y computadores */}
          <div className="hidden lg:flex items-center gap-4 border-l border-gray-200 dark:border-gray-800 pl-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="font-black text-xs uppercase tracking-widest bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 hover:scale-105 transition-all shadow-lg shadow-black/20">
                  Ingresar
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-9 h-9 rounded-xl border-2 border-white dark:border-gray-800 shadow-sm" } }} />
            </SignedIn>
          </div>

        </div>
      </div>
    </nav>
  );
}
