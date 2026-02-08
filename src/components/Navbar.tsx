"use client";
import { useTheme } from "@/context/ThemeContext";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Navbar() {
  const { role, setRole, themeColor } = useTheme();

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-20 flex items-center">
      <div className="max-w-7xl mx-auto px-4 w-full flex justify-between items-center">
        
        <Link href="/" className="flex items-center gap-2">
          <span className="text-3xl">🍔</span>
          <span className={`font-black text-2xl tracking-tighter ${themeColor === 'blue' ? 'text-blue-600' : 'text-red-600'}`}>
            McWallet
          </span>
        </Link>

        {/* Links de Navegación */}
        <div className="hidden md:flex gap-8 text-[10px] font-black uppercase tracking-widest text-gray-400">
          <Link href="/#nosotros" className="hover:text-black transition">Nosotros</Link>
          <Link href="/#tarifas" className="hover:text-black transition">Tarifas</Link>
          <Link href="/#calculadora" className="hover:text-black transition">Calculadora</Link>
          <SignedIn>
            <Link href="/nominas" className={`hover:text-black transition ${themeColor === 'blue' ? 'text-blue-600' : 'text-red-600'}`}>
              📂 Mis Nóminas
            </Link>
          </SignedIn>
        </div>

        <div className="flex items-center gap-4">
          {/* Switch de Rol */}
          <button 
            onClick={() => setRole(role === 'CREW' ? 'ENTRENADOR' : 'CREW')}
            className="flex bg-gray-100 rounded-full p-1 shadow-inner transition-all hover:bg-gray-200"
          >
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${role === 'CREW' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>
              CREW
            </span>
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${role === 'ENTRENADOR' ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}>
              PRO
            </span>
          </button>

          <div className="border-l pl-4 border-gray-100">
            <SignedOut>
              <SignInButton mode="modal">
                <button className={`font-black text-xs uppercase tracking-widest ${themeColor === 'blue' ? 'text-blue-600' : 'text-red-600'}`}>
                  Entrar
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  );
}