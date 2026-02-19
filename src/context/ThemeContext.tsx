"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Role } from '@/constants/rates';



interface ThemeContextType {

  role: Role;

  setRole: (role: Role) => void;

  themeColor: 'blue' | 'red';

  colors: {

    primary: string;

    secondary: string;

    bg: string;

    accent: string;

  };

}



const ThemeContext = createContext<ThemeContextType | undefined>(undefined);



export function ThemeProvider({ children }: { children: ReactNode }) {

  const [role, setRole] = useState<Role>('CREW');

  const themeColor = role === 'CREW' ? 'blue' : 'red';



  const colors = role === 'CREW'

    ? { primary: 'text-blue-600', secondary: 'bg-blue-600', bg: 'bg-blue-50', accent: 'border-blue-200' }

    : { primary: 'text-red-600', secondary: 'bg-red-600', bg: 'bg-red-50', accent: 'border-red-200' };



  return (

    <ThemeContext.Provider value={{ role, setRole, themeColor, colors }}>

      {children}

    </ThemeContext.Provider>

  );

}



export function useTheme() {

  const context = useContext(ThemeContext);

  if (!context) throw new Error("useTheme debe usarse dentro de un ThemeProvider");

  return context;

}