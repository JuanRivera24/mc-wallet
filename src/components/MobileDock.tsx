"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function MobileDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { colors, themeColor } = useTheme();

  const isActive = (path: string) => pathname === path;
  const activeColor = themeColor === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';

  // Navegación inteligente para evitar errores con los anclajes (#)
  const handleHashNavigation = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (pathname === '/') {
      e.preventDefault();
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    // Redujimos el bottom a 3 y ajustamos el padding/ancho para que se vea más anclada
    <div className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-[100] w-[96%] max-w-sm pb-safe">
      <div className="flex items-center justify-between bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-2xl border border-gray-200 dark:border-gray-800 rounded-[2rem] p-1.5 shadow-xl dark:shadow-black/80">
        
        {/* 1. BOTÓN INICIO (Calculadora) - Flex-1 amplía el área táctil */}
        <Link href="/" className="flex-1 flex justify-center">
          <motion.div whileTap={{ scale: 0.85 }} className={`flex flex-col items-center justify-center w-full max-w-[4rem] h-14 rounded-2xl transition-colors ${isActive('/') ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={isActive('/') ? 2.5 : 1.5} stroke="currentColor" className={`w-6 h-6 ${isActive('/') ? activeColor : 'text-gray-500'}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className={`text-[10px] font-black mt-0.5 ${isActive('/') ? activeColor : 'text-gray-500'}`}>Inicio</span>
          </motion.div>
        </Link>

        {/* 2. BOTÓN TARIFAS */}
        <Link href="/#tarifas" onClick={(e) => handleHashNavigation(e, 'tarifas')} className="flex-1 flex justify-center">
          <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center justify-center w-full max-w-[4rem] h-14 rounded-2xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-black mt-0.5 text-gray-500">Tarifas</span>
          </motion.div>
        </Link>

        {/* 3. BOTÓN NÓMINAS */}
        <SignedIn>
          <Link href="/nominas" className="flex-1 flex justify-center">
            <motion.div whileTap={{ scale: 0.85 }} className={`flex flex-col items-center justify-center w-full max-w-[4rem] h-14 rounded-2xl transition-colors ${isActive('/nominas') ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={isActive('/nominas') ? 2.5 : 1.5} stroke="currentColor" className={`w-6 h-6 ${isActive('/nominas') ? activeColor : 'text-gray-500'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <span className={`text-[10px] font-black mt-0.5 ${isActive('/nominas') ? activeColor : 'text-gray-500'}`}>Nóminas</span>
            </motion.div>
          </Link>
        </SignedIn>
        <SignedOut>
          <div className="flex-1 flex justify-center">
            <div className="flex flex-col items-center justify-center w-full max-w-[4rem] h-14 rounded-2xl opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              <span className="text-[10px] font-black mt-0.5 text-gray-500">Nóminas</span>
            </div>
          </div>
        </SignedOut>

        {/* 4. BOTÓN PERFIL / AUTH */}
        <div className="flex-1 flex justify-center">
          <SignedIn>
            <div className="flex flex-col items-center justify-center w-full max-w-[4rem] h-14">
              <motion.div whileTap={{ scale: 0.85 }}>
                <UserButton appearance={{ elements: { avatarBox: "w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm" } }} />
              </motion.div>
              <span className="text-[10px] font-black mt-0.5 text-gray-500">Perfil</span>
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <motion.button whileTap={{ scale: 0.85 }} className="flex flex-col items-center justify-center w-full max-w-[4rem] h-14 text-gray-500">
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center border-2 border-transparent">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                </div>
                <span className="text-[10px] font-black mt-0.5">Entrar</span>
              </motion.button>
            </SignInButton>
          </SignedOut>
        </div>

      </div>
    </div>
  );
}
