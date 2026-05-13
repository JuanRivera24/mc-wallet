"use client";
import { useState } from "react";
import { useHaptics } from "@/hooks/useHaptics";
import { useTheme } from "@/context/ThemeContext";

export default function Calculator4x1000() {
  const [amount, setAmount] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const { hapticLight, hapticSuccess } = useHaptics();
  const { themeColor } = useTheme();

  // Convierte el texto (con puntos) a un número real para la matemática
  const numericAmount = parseFloat(amount.replace(/\D/g, '')) || 0;
  
  // La fórmula sagrada colombiana: el 0.4%
  const tax = numericAmount * 0.004;
  const total = numericAmount + tax;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    hapticLight();
    const val = e.target.value.replace(/\D/g, ''); // Solo permite números
    setAmount(val);
    setCopied(false);
  };

  const handleCopy = () => {
    if (tax > 0) {
      navigator.clipboard.writeText(Math.round(tax).toString());
      setCopied(true);
      hapticSuccess();
      // Devuelve el botón a su estado normal después de 2 segundos
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Campo de Entrada */}
      <div>
        <label className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 block pl-1">
          Monto a transferir o retirar
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">$</span>
          <input 
            type="text" 
            inputMode="numeric"
            value={numericAmount > 0 ? numericAmount.toLocaleString('es-CO') : ''}
            onChange={handleAmountChange}
            placeholder="0"
            className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl py-4 pl-10 pr-4 text-2xl font-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Tarjeta de Resultado */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 relative overflow-hidden shadow-sm">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Impuesto (4x1000)</span>
          
          {/* Botón de Copiar */}
          {tax > 0 && (
            <button 
              onClick={handleCopy}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all active:scale-95 ${copied ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          )}
        </div>
        
        {/* El valor del impuesto en grande */}
        <p className={`text-4xl font-black tracking-tighter transition-colors ${tax > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-300 dark:text-gray-700'}`}>
          ${Math.round(tax).toLocaleString('es-CO')}
        </p>
        
        {/* Resumen Total */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Debes tener en total:</span>
          <span className="text-sm font-black text-gray-900 dark:text-white">${Math.round(total).toLocaleString('es-CO')}</span>
        </div>
      </div>
    </div>
  );
}