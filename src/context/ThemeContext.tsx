"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Role } from '@/constants/rates';

interface ThemeContextType {
  role: Role;
  setRole: (role: Role) => void;
  themeColor: 'blue' | 'red';
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  colors: {
    primary: string;
    secondary: string;
    bg: string;
    accent: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>('CREW');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Usamos 'mounted' para evitar que la página parpadee antes de leer la memoria
  const [mounted, setMounted] = useState(false);

  // 1. Cargar preferencias desde localStorage al iniciar la app
  useEffect(() => {
    const savedRole = localStorage.getItem('mcwallet_role') as Role;
    const savedDarkMode = localStorage.getItem('mcwallet_dark') === 'true';

    if (savedRole) {
      setRoleState(savedRole);
    }
    
    if (savedDarkMode) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    
    setMounted(true);
  }, []);

  // 2. Función para cambiar el rol y guardarlo
  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem('mcwallet_role', newRole);
  };

  // 3. Función para alternar el modo oscuro y guardarlo
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem('mcwallet_dark', String(newMode));
      
      // Activa o desactiva la clase global de Tailwind
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newMode;
    });
  };

  const themeColor = role === 'CREW' ? 'blue' : 'red';

  // 4. Adaptamos el color de fondo base para que se ponga gris oscuro en modo dark
  const colors = role === 'CREW' 
    ? { primary: 'text-blue-600', secondary: 'bg-blue-600', bg: isDarkMode ? 'bg-[#0a0a0a]' : 'bg-blue-50', accent: 'border-blue-200' }
    : { primary: 'text-red-600', secondary: 'bg-red-600', bg: isDarkMode ? 'bg-[#0a0a0a]' : 'bg-red-50', accent: 'border-red-200' };

  if (!mounted) {
    return <div className="invisible">{children}</div>; 
  }

  return (
    <ThemeContext.Provider value={{ role, setRole, themeColor, isDarkMode, toggleDarkMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  return context;
}