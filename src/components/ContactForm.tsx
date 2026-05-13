"use client";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

export default function ContactForm() {
  const { user, isSignedIn } = useUser();
  const { role, themeColor } = useTheme();
  const { hapticLight, hapticSuccess, hapticError } = useHaptics();

  const activeBg = themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';
  const activeToggleBg = themeColor === 'blue' ? 'bg-blue-500' : 'bg-red-500';

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    type: "Sugerencia",
    message: ""
  });
  
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  
  // ✅ Nuevo estado para el Modo Anónimo
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (isSignedIn && user) {
      setFormData(prev => ({
        ...prev,
        name: user.fullName || "",
        email: user.primaryEmailAddress?.emailAddress || ""
      }));
    }
  }, [isSignedIn, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    hapticLight();
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setStatus("idle");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    hapticLight();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    hapticLight();
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación dependiente de si es anónimo o no
    if (!isAnonymous && (!formData.name || !formData.email || !formData.message)) {
      hapticError();
      return alert("Por favor llena todos los campos de texto.");
    }
    
    if (isAnonymous && !formData.message) {
      hapticError();
      return alert("Por favor escribe tu mensaje.");
    }

    setStatus("loading");
    hapticLight();

    // Valores finales dependiendo del modo
    const finalName = isAnonymous ? "Anónimo" : formData.name;
    const finalEmail = isAnonymous ? "anonimo@mcwallet.app" : formData.email;

    // Asunto exacto
    const emailSubject = `(${finalName})(${role})+(${formData.type})`;

    const data = new FormData();
    data.append("Nombre", finalName);
    if (!isAnonymous) data.append("Correo", finalEmail); // No mandamos el correo falso si es anónimo para no ensuciar la tabla
    data.append("Tipo_de_Mensaje", formData.type);
    data.append("Mensaje", formData.message);
    
    data.append("_subject", emailSubject);
    data.append("_replyto", finalEmail);
    data.append("_template", "box");
    data.append("_captcha", "false");
    
    if (file) {
      data.append("Foto_Adjunta", file);
    }

    try {
      const response = await fetch(`https://formsubmit.co/juanmrivera0424@gmail.com`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: data
      });

      if (response.ok) {
        setStatus("success");
        hapticSuccess();
        setFormData(prev => ({ ...prev, message: "" }));
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        throw new Error("Error al enviar");
      }
    } catch (error) {
      console.error(error);
      setStatus("error");
      hapticError();
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      
      {/* ✅ Interruptor de Modo Anónimo */}
      <div className="flex items-center justify-between bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 p-4 rounded-2xl">
        <div>
          <h4 className="text-xs font-bold text-gray-900 dark:text-white">Enviar como anónimo</h4>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Ocultar mi nombre y correo</p>
        </div>
        <button
          type="button"
          onClick={() => { hapticLight(); setIsAnonymous(!isAnonymous); }}
          className={`w-12 h-6 rounded-full transition-colors relative outline-none ${isAnonymous ? activeToggleBg : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${isAnonymous ? 'translate-x-6.5 left-0.5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Inputs si NO es anónimo y NO está logueado */}
      {!isAnonymous && !isSignedIn && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5 block pl-1">Tu Nombre</label>
            <input 
              type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Tu nombre"
              className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 px-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5 block pl-1">Tu Correo</label>
            <input 
              type="email" name="email" value={formData.email} onChange={handleChange} placeholder="correo@ejemplo.com"
              className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 px-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all"
            />
          </div>
        </div>
      )}

      {/* Info si NO es anónimo y SÍ está logueado */}
      {!isAnonymous && isSignedIn && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
          Enviando como: <b className="text-gray-900 dark:text-white">{formData.name}</b> <br className="sm:hidden" />({formData.email})
        </p>
      )}

      {/* Selector de Tipo */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5 block pl-1">¿Qué nos quieres contar?</label>
        <select 
          name="type" value={formData.type} onChange={handleChange}
          className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 px-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all appearance-none cursor-pointer"
        >
          <option value="Sugerencia">💡 Sugerencia</option>
          <option value="Reportar error">🐛 Reportar error de la app</option>
          <option value="Comentario positivo">✨ Comentario positivo</option>
          <option value="Comentario negativo">📉 Comentario negativo</option>
        </select>
      </div>

      {/* Mensaje */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5 block pl-1">Tu Mensaje</label>
        <textarea 
          name="message" value={formData.message} onChange={handleChange} rows={4} placeholder="Escribe tu mensaje aquí..."
          className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl py-3 px-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all resize-none"
        />
      </div>

      {/* Botón de Adjuntar Foto */}
      <div>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
        
        {!file ? (
          <button 
            type="button" 
            onClick={() => { hapticLight(); fileInputRef.current?.click(); }}
            className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 dark:text-gray-400 rounded-2xl py-3 font-bold text-xs uppercase tracking-widest hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-lg">📸</span> Adjuntar foto (Opcional)
          </button>
        ) : (
          <div className="w-full border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 rounded-2xl py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-lg">✅</span>
              <span className="text-xs font-bold text-green-700 dark:text-green-400 truncate">
                {file.name}
              </span>
            </div>
            <button 
              type="button" 
              onClick={removeFile}
              className="w-6 h-6 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center font-black text-xs hover:bg-red-200 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Botón Enviar */}
      <button 
        type="submit" 
        disabled={status === "loading" || status === "success"}
        className={`w-full mt-2 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white transition-all shadow-md active:scale-95 flex justify-center items-center gap-2 
          ${status === "success" ? 'bg-green-500 hover:bg-green-600' : 
            status === "error" ? 'bg-red-500 hover:bg-red-600' : 
            activeBg}`}
      >
        {status === "idle" && "Enviar Mensaje"}
        {status === "loading" && <span className="animate-pulse">Enviando...</span>}
        {status === "success" && "¡Mensaje Enviado! ✓"}
        {status === "error" && "Error. Intenta de nuevo ✕"}
      </button>

      {status === "success" && (
        <p className="text-center text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-2">
          Gracias. Revisaremos tu mensaje pronto.
        </p>
      )}
    </form>
  );
}