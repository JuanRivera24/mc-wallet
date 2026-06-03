"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, increment } from "firebase/firestore";

// ✅ CATEGORÍAS AMPLIADAS
const EXPENSE_CATEGORIES = [
  { id: "comida", icon: "🍔", label: "Comida" },
  { id: "transporte", icon: "🚌", label: "Transporte" },
  { id: "compras", icon: "🛍️", label: "Compras" },
  { id: "servicios", icon: "💡", label: "Servicios" },
  { id: "ocio", icon: "🍿", label: "Ocio" },
  { id: "salud", icon: "💊", label: "Salud" },
  { id: "educacion", icon: "📚", label: "Educación" },
  { id: "hogar", icon: "🏠", label: "Hogar" },
  { id: "mascotas", icon: "🐶", label: "Mascotas" },
  { id: "regalos", icon: "🎁", label: "Regalos" },
];

const INCOME_CATEGORIES = [
  { id: "nomina", icon: "💰", label: "Nómina" },
  { id: "transferencia", icon: "🏦", label: "Transferencia" },
  { id: "ventas", icon: "🤝", label: "Ventas" },
  { id: "ahorros", icon: "🐖", label: "Ahorros" },
  { id: "premios", icon: "🏆", label: "Premios" },
  { id: "regalos_in", icon: "🎁", label: "Regalos" },
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function BilleteraPage() {
  const { themeColor } = useTheme();
  const { hapticLight, hapticSuccess, hapticError, hapticWarning } = useHaptics();
  const { user } = useUser();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  
  // Modales y UI
  const [txModalType, setTxModalType] = useState<"INCOME" | "EXPENSE" | "PAYMENT" | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryLimit, setShowHistoryLimit] = useState(5);
  const [activeTarget, setActiveTarget] = useState<any | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Forms Transacciones
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Categorías Personalizadas
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📌");

  // Metas / Deudas
  const [metaTitle, setMetaTitle] = useState("");
  const [metaTarget, setMetaTarget] = useState("");
  const [metaType, setMetaType] = useState<"GOAL" | "DEBT">("GOAL");

  // Importar Nómina
  const [importMonth, setImportMonth] = useState(MESES[new Date().getMonth()]);
  const [importQuincena, setImportQuincena] = useState(new Date().getDate() <= 15 ? 1 : 2);

  const activeBg = themeColor === 'blue' ? 'bg-blue-600' : 'bg-red-600';
  const activeText = themeColor === 'blue' ? 'text-blue-500' : 'text-red-500';

  // --- OBTENCIÓN DE DATOS (FIREBASE) ---
  useEffect(() => {
    if (!user) return;
    
    // Transacciones
    const qTx = query(collection(db, "wallet_transactions"), where("userId", "==", user.id));
    const unsubTx = onSnapshot(qTx, (snap) => {
      const txs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      txs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setTransactions(txs);
    });

    // Metas y Deudas
    const qGoals = query(collection(db, "wallet_goals"), where("userId", "==", user.id));
    const unsubGoals = onSnapshot(qGoals, (snap) => {
      const goalsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Ordenamos para que las completadas bajen
      goalsData.sort((a, b) => {
        const aCompleted = a.currentAmount >= a.targetAmount;
        const bCompleted = b.currentAmount >= b.targetAmount;
        if (aCompleted === bCompleted) return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
        return aCompleted ? 1 : -1;
      });
      setMetas(goalsData);
    });

    // Categorías Custom
    const qCats = query(collection(db, "wallet_categories"), where("userId", "==", user.id));
    const unsubCats = onSnapshot(qCats, (snap) => {
      setCustomCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    return () => { unsubTx(); unsubGoals(); unsubCats(); };
  }, [user]);

  // --- CÁLCULOS DERIVADOS ---
  const balance = useMemo(() => {
    return transactions.reduce((acc, curr) => curr.type === 'INCOME' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);
  }, [transactions]);

  const currentCategories = useMemo(() => {
    const base = txModalType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const custom = customCategories.filter(c => c.type === txModalType);
    return [...base, ...custom];
  }, [txModalType, customCategories]);

  const goalsList = metas.filter(m => m.type === "GOAL");
  const debtsList = metas.filter(m => m.type === "DEBT");

  // --- ACCIONES CORE ---

  // 1. Guardar Transacción (Ingreso, Gasto o Abono)
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !user) {
      hapticError();
      return;
    }
    
    setIsSaving(true);
    const isPayment = txModalType === 'PAYMENT';
    const numericAmount = Number(amount);
    const categoryData = currentCategories.find(c => c.id === selectedCategory);

    // Evitar abonar más del total necesario (Opcional, pero buena práctica de UX)
    if (isPayment && activeTarget) {
      const pending = activeTarget.targetAmount - activeTarget.currentAmount;
      if (numericAmount > pending) {
        hapticWarning();
        const conf = confirm(`El abono supera el saldo pendiente ($${pending.toLocaleString('es-CO')}). ¿Guardar de todas formas?`);
        if (!conf) {
          setIsSaving(false);
          return;
        }
      }
    }

    try {
      await addDoc(collection(db, "wallet_transactions"), {
        userId: user.id,
        type: isPayment ? 'EXPENSE' : txModalType,
        isAbono: isPayment,
        amount: numericAmount,
        category: isPayment ? `Abono: ${activeTarget.title}` : (categoryData?.label || "Otros"),
        icon: isPayment ? activeTarget.icon : (categoryData?.icon || "💵"),
        description: desc.trim(),
        timestamp: serverTimestamp(),
        targetId: isPayment ? activeTarget.id : null
      });

      if (isPayment && activeTarget) {
        await updateDoc(doc(db, "wallet_goals", activeTarget.id), { 
          currentAmount: increment(numericAmount) 
        });
      }
      
      hapticSuccess();
      closeTxModal();
    } catch (e) {
      console.error("Error guardando tx:", e);
      hapticError();
      alert("Error al guardar el registro.");
    } finally { 
      setIsSaving(false); 
    }
  };

  // 2. Guardar Nueva Meta / Deuda
  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaTitle || !metaTarget || !user) return hapticError();
    setIsSaving(true);
    try {
      await addDoc(collection(db, "wallet_goals"), {
        userId: user.id, 
        title: metaTitle.trim(), 
        targetAmount: Number(metaTarget),
        currentAmount: 0, 
        type: metaType, 
        icon: metaType === "GOAL" ? "🎯" : "💸",
        timestamp: serverTimestamp()
      });
      hapticSuccess();
      setShowMetaModal(false);
      setMetaTitle(""); 
      setMetaTarget("");
    } catch (e) { 
      console.error(e);
      hapticError(); 
    } finally { 
      setIsSaving(false); 
    }
  };

  // 3. Crear Categoría Personalizada
  const handleSaveCustomCategory = async () => {
    if (!newCatName || !user) return hapticError();
    try {
      const newId = `custom_${Date.now()}`;
      await addDoc(collection(db, "wallet_categories"), {
        userId: user.id, 
        id: newId, 
        type: txModalType, 
        icon: newCatIcon || "📌", 
        label: newCatName.trim(), 
        timestamp: serverTimestamp()
      });
      setNewCatName(""); 
      setNewCatIcon("📌");
      setShowAddCategory(false); 
      setSelectedCategory(newId);
    } catch (e) { 
      hapticError(); 
    }
  };

  // 4. Eliminar Transacción y Revertir Abonos (SIN LÍMITE DE TIEMPO)
  const deleteTransaction = async (tx: any) => {
    if (!user || !tx.id) return;
    
    const conf = confirm("¿Estás seguro de eliminar este movimiento del historial?");
    if (!conf) return;

    hapticWarning();
    try {
      // Si fue un abono, intentamos devolverle el dinero a la meta/deuda
      if (tx.isAbono && tx.targetId) {
        try {
          await updateDoc(doc(db, "wallet_goals", tx.targetId), { 
            currentAmount: increment(-tx.amount) 
          });
        } catch (updateErr) {
          // Si la meta ya fue eliminada, updateDoc fallará. Lo ignoramos y seguimos borrando la tx.
          console.warn("La meta asociada ya no existe, procediendo a borrar solo el historial.");
        }
      }
      
      // Eliminamos el registro del historial
      await deleteDoc(doc(db, "wallet_transactions", tx.id));
      setExpandedTxId(null);
      hapticSuccess();
    } catch (e) { 
      console.error("Error eliminando tx:", e);
      hapticError(); 
      alert("No se pudo eliminar el movimiento.");
    }
  };

  // 5. Importar Nómina con Validación Antiduplicados
  const importFromPayroll = async () => {
    if (!user) return;
    setIsSaving(true);
    hapticLight();

    const importDescription = `Importado: ${importMonth} Q${importQuincena}`;

    try {
      // 1. Verificación Anti-Duplicados: Revisar si ya existe este ingreso exacto
      const txCheckQuery = query(
        collection(db, "wallet_transactions"), 
        where("userId", "==", user.id),
        where("description", "==", importDescription)
      );
      const duplicateSnap = await getDocs(txCheckQuery);
      
      if (!duplicateSnap.empty) {
        hapticError();
        alert(`Ya has traído el dinero de ${importMonth.toUpperCase()} (Q${importQuincena}) previamente.`);
        setIsSaving(false);
        return;
      }

      // 2. Buscar en la colección shifts de la nómina
      const qShifts = query(
        collection(db, "shifts"), 
        where("userId", "==", user.id), 
        where("month", "==", importMonth)
      );
      
      const snap = await getDocs(qShifts);
      let totalToImport = 0;
      
      snap.forEach(doc => {
        const data = doc.data();
        if(!data.date) return;
        
        const dayNumber = parseInt(data.date.split('-')[2], 10);
        const shiftQuincena = dayNumber <= 15 ? 1 : 2;
        
        if (shiftQuincena === importQuincena) {
          totalToImport += (Number(data.netPay) || 0);
        }
      });

      if (totalToImport > 0) {
        await addDoc(collection(db, "wallet_transactions"), {
          userId: user.id, 
          type: "INCOME", 
          amount: totalToImport, 
          category: "Nómina", 
          icon: "💰",
          description: importDescription, 
          timestamp: serverTimestamp()
        });
        hapticSuccess();
        alert(`¡Trajiste $${totalToImport.toLocaleString('es-CO')} a tu billetera exitosamente!`);
        setShowImportModal(false);
      } else { 
        hapticWarning();
        alert(`No encontramos turnos calculados para la quincena ${importQuincena} de ${importMonth}.`); 
      }
    } catch (e) { 
      console.error("Error importando nómina:", e);
      hapticError(); 
      alert("Hubo un error de conexión al traer el dinero.");
    } finally { 
      setIsSaving(false); 
    }
  };

  // --- HELPERS ---
  const closeTxModal = () => {
    setTxModalType(null);
    setAmount("");
    setDesc("");
    setActiveTarget(null);
    setShowAddCategory(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24 transition-colors">
      <Navbar />
      
      <div className="pt-6 px-4 max-w-2xl mx-auto space-y-6">
        
        {/* CARD DE SALDO */}
        <div className={`p-6 rounded-[2rem] bg-gradient-to-br ${themeColor === 'blue' ? 'from-blue-600 to-blue-500' : 'from-red-600 to-red-500'} text-white shadow-xl relative overflow-hidden`}>
          {/* Decoración de fondo */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
          
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80 relative z-10">Saldo Disponible</span>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter mt-1 relative z-10 truncate">
            ${(balance || 0).toLocaleString('es-CO')}
          </h2>
          
          <div className="flex gap-2 mt-5 relative z-10">
            <button onClick={() => { setTxModalType("INCOME"); setAmount(""); setDesc(""); setSelectedCategory("nomina"); }} className="flex-1 bg-white/20 hover:bg-white/30 transition-colors py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider backdrop-blur-sm shadow-sm">+ Ingreso</button>
            <button onClick={() => { setTxModalType("EXPENSE"); setAmount(""); setDesc(""); setSelectedCategory("comida"); }} className="flex-1 bg-black/20 hover:bg-black/30 transition-colors py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider backdrop-blur-sm shadow-sm">- Gasto</button>
          </div>
        </div>

        {/* BOTÓN SINCRO NÓMINA */}
        <button onClick={() => setShowImportModal(true)} className={`w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-all rounded-2xl py-4 px-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 shadow-sm active:scale-[0.98]`}>
          <span className="text-lg">🔄</span> Traer dinero de Nómina
        </button>

        {/* METAS (Glow Verde) */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mis Metas 🎯</h3>
            <button onClick={() => { setMetaType("GOAL"); setShowMetaModal(true); }} className="text-[10px] font-black uppercase text-green-500 hover:text-green-600 transition-colors">+ Nueva Meta</button>
          </div>
          
          {goalsList.length === 0 ? (
            <div className="bg-gray-100/50 dark:bg-gray-900/30 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center">
              <p className="text-xs text-gray-400 font-bold">No tienes metas de ahorro activas.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {goalsList.map(meta => {
                const percentage = Math.min((meta.currentAmount / meta.targetAmount) * 100, 100);
                const isCompleted = percentage >= 100;
                
                return (
                  <div key={meta.id} className={`bg-white dark:bg-gray-900 p-4 rounded-2xl border transition-all ${isCompleted ? 'border-green-200 dark:border-green-900/50 opacity-80' : 'border-gray-100 dark:border-gray-800 shadow-[0_0_15px_rgba(34,197,94,0.05)]'}`}>
                    <div className="flex justify-between mb-3 items-center">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate pr-2">
                        {meta.icon} {meta.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {isCompleted ? (
                          <span className="text-[9px] font-black text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md">✨ LOGRADO</span>
                        ) : (
                          <button onClick={() => { setActiveTarget(meta); setTxModalType("PAYMENT"); setAmount(""); }} className="text-[9px] font-black text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 transition-colors px-3 py-1.5 rounded-md">
                            ABONAR
                          </button>
                        )}
                        <button onClick={() => { if(confirm("¿Eliminar esta meta? Se conservará el historial de transacciones.")) deleteDoc(doc(db, "wallet_goals", meta.id)) }} className="text-[10px] font-black text-gray-300 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center">✕</button>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className="h-full bg-green-500" />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase">
                      <span className={isCompleted ? 'text-green-500' : ''}>${meta.currentAmount.toLocaleString('es-CO')}</span>
                      <span>Meta: ${meta.targetAmount.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* DEUDAS (Glow Rojo) */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mis Deudas 💸</h3>
            <button onClick={() => { setMetaType("DEBT"); setShowMetaModal(true); }} className="text-[10px] font-black uppercase text-red-500 hover:text-red-600 transition-colors">+ Nueva Deuda</button>
          </div>

          {debtsList.length === 0 ? (
            <div className="bg-gray-100/50 dark:bg-gray-900/30 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center">
              <p className="text-xs text-gray-400 font-bold">Todo al día. No hay deudas pendientes.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {debtsList.map(meta => {
                const percentage = Math.min((meta.currentAmount / meta.targetAmount) * 100, 100);
                const isCompleted = percentage >= 100;

                return (
                  <div key={meta.id} className={`bg-white dark:bg-gray-900 p-4 rounded-2xl border transition-all ${isCompleted ? 'border-gray-200 dark:border-gray-700 opacity-70 grayscale' : 'border-gray-100 dark:border-gray-800 shadow-[0_0_15px_rgba(239,68,68,0.05)]'}`}>
                    <div className="flex justify-between mb-3 items-center">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate pr-2">
                        {meta.icon} {meta.title}
                      </span>
                      <div className="flex gap-2 items-center shrink-0">
                        {isCompleted ? (
                          <span className="text-[9px] font-black text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">✓ SALDADA</span>
                        ) : (
                          <button onClick={() => { setActiveTarget(meta); setTxModalType("PAYMENT"); setAmount(""); }} className="text-[9px] font-black text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors px-3 py-1.5 rounded-md">
                            PAGAR
                          </button>
                        )}
                        <button onClick={() => { if(confirm("¿Eliminar esta deuda? Se conservará el historial de pagos.")) deleteDoc(doc(db, "wallet_goals", meta.id)) }} className="text-[10px] font-black text-gray-300 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center">✕</button>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={`h-full ${isCompleted ? 'bg-gray-400' : 'bg-red-500'}`} />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase">
                      <span className={isCompleted ? 'text-gray-500' : ''}>Abonado: ${meta.currentAmount.toLocaleString('es-CO')}</span>
                      <span>Total: ${meta.targetAmount.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* HISTORIAL ACORDEÓN */}
        <section className="space-y-3 pb-8">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Historial de Movimientos</h3>
          
          {transactions.length === 0 ? (
            <div className="bg-transparent border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
              <p className="text-2xl mb-2">🧾</p>
              <p className="text-xs text-gray-400 font-bold">Tu billetera está en cero.</p>
              <p className="text-[10px] text-gray-500 mt-1">Registra un ingreso o trae tu nómina para comenzar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, showHistoryLimit).map(tx => {
                const isExpanded = expandedTxId === tx.id;
                // Calculo de impacto seguro evitando división por cero
                const impactRaw = balance === 0 ? 0 : (tx.amount / Math.abs(balance)) * 100;
                const impact = impactRaw > 999 ? "+999" : impactRaw.toFixed(1);

                return (
                  <div key={tx.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-gray-200 dark:hover:border-gray-700">
                    <button onClick={() => { hapticLight(); setExpandedTxId(isExpanded ? null : tx.id); }} className="w-full flex justify-between items-center p-4 text-left outline-none">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-lg shrink-0">
                          {tx.icon}
                        </div>
                        <div className="truncate pr-2">
                          <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate">{tx.category}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5 uppercase font-bold tracking-wider">
                            {tx.timestamp ? tx.timestamp.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Guardando...'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-black shrink-0 ${tx.type === 'INCOME' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'}${tx.amount.toLocaleString('es-CO')}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="bg-gray-50/50 dark:bg-[#0a0a0a]/50 border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
                          <div className="flex justify-between items-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3 rounded-xl shadow-sm">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Impacto en disponible</span>
                            <span className={`text-xs font-black ${tx.type === 'INCOME' ? 'text-green-500' : 'text-red-500'}`}>{tx.type === 'INCOME' ? '+' : '-'}{impact}%</span>
                          </div>
                          
                          {tx.description && (
                            <div className="px-1">
                              <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400 italic">📝 "{tx.description}"</p>
                            </div>
                          )}
                          
                          <button 
                            onClick={() => deleteTransaction(tx)}
                            className="w-full py-3.5 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          >
                            Eliminar Movimiento
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              
              {transactions.length > showHistoryLimit && (
                <button onClick={() => setShowHistoryLimit(prev => prev + 10)} className={`w-full py-4 text-[10px] font-black uppercase tracking-widest ${activeText} bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}>
                  Mostrar Más Movimientos
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ============================================================== */}
      {/* MODAL PRINCIPAL DE TRANSACCIONES (INGRESO / GASTO / ABONO) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {txModalType && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end justify-center">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="bg-white dark:bg-[#0a0a0a] w-full max-w-md rounded-t-[2.5rem] p-6 space-y-6 shadow-2xl pb-safe">
              
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-4">
                <h3 className="font-black text-lg text-gray-900 dark:text-white">
                  {txModalType === 'PAYMENT' ? `Abonar a ${activeTarget?.title}` : txModalType === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Gasto'}
                </h3>
                <button onClick={closeTxModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">✕</button>
              </div>

              <form onSubmit={handleSaveTransaction} className="space-y-6">
                
                {/* Input de Monto Gigante */}
                <div className="relative flex items-center justify-center">
                  <span className="absolute left-4 text-3xl font-black text-gray-300 dark:text-gray-700 pointer-events-none">$</span>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    placeholder="0" 
                    className="w-full text-5xl font-black text-center bg-transparent text-gray-900 dark:text-white outline-none py-4" 
                    autoFocus 
                  />
                </div>

                {/* Selector de Categorías (Oculto si es Abono a Deuda/Meta) */}
                {txModalType !== 'PAYMENT' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Categoría</label>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {currentCategories.map(cat => (
                        <button 
                          key={cat.id} 
                          type="button" 
                          onClick={() => setSelectedCategory(cat.id)} 
                          className={`px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5
                            ${selectedCategory === cat.id 
                              ? `${activeBg} text-white border-transparent shadow-md scale-105` 
                              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                            }`}
                        >
                          <span className="text-sm">{cat.icon}</span> {cat.label}
                        </button>
                      ))}
                      
                      {/* Botón de Agregar Personalizada */}
                      <button type="button" onClick={() => setShowAddCategory(!showAddCategory)} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase border border-dashed transition-colors flex items-center gap-1 ${showAddCategory ? 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-800 dark:text-gray-200' : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:border-gray-400'}`}>
                        {showAddCategory ? '✕ Cancelar' : '+ Nueva'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Mini Formulario de Categoría Nueva */}
                <AnimatePresence>
                  {showAddCategory && txModalType !== 'PAYMENT' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-2 overflow-hidden bg-gray-50 dark:bg-gray-900/50 p-2 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} placeholder="🎨" className="w-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-center text-lg outline-none focus:border-blue-500" maxLength={2} />
                      <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nombre categoría" className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                      <button type="button" onClick={handleSaveCustomCategory} disabled={!newCatName} className={`px-4 rounded-xl font-black text-white transition-opacity disabled:opacity-50 ${activeBg}`}>✓</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Nota / Descripción */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Nota (Opcional)</label>
                  <input 
                    type="text" 
                    value={desc} 
                    onChange={e => setDesc(e.target.value)} 
                    placeholder="¿De qué trata este movimiento?" 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 py-3.5 px-4 rounded-2xl outline-none text-gray-900 dark:text-white text-xs font-bold focus:border-gray-300 dark:focus:border-gray-700 transition-colors" 
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeTxModal} className="flex-1 py-4 rounded-2xl bg-gray-100 dark:bg-gray-900 text-gray-500 font-black uppercase text-xs tracking-widest hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSaving || !amount} className={`flex-[2] py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-md hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 ${activeBg}`}>
                    {isSaving ? <span className="animate-pulse">Guardando...</span> : 'Confirmar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL CREAR META O DEUDA */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showMetaModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white dark:bg-[#0a0a0a] w-full max-w-sm rounded-[2rem] p-6 space-y-6 shadow-2xl border border-gray-100 dark:border-gray-800">
              
              <div className="text-center space-y-1">
                <h3 className="font-black text-xl text-gray-900 dark:text-white">Nuevo Objetivo</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Organiza tus finanzas</p>
              </div>

              {/* Toggle Meta / Deuda */}
              <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                <button onClick={() => setMetaType("GOAL")} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${metaType === "GOAL" ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}>🎯 Ahorro</button>
                <button onClick={() => setMetaType("DEBT")} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${metaType === "DEBT" ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}>💸 Deuda</button>
              </div>

              <form onSubmit={handleSaveMeta} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Título</label>
                  <input 
                    value={metaTitle} 
                    onChange={e => setMetaTitle(e.target.value)} 
                    placeholder={metaType === "GOAL" ? "Ej: Moto nueva, Viaje..." : "Ej: Deuda tarjeta, Préstamo..."} 
                    className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-xs font-bold outline-none focus:border-blue-500 transition-colors" 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Monto Total a alcanzar</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">$</span>
                    <input 
                      type="number" 
                      value={metaTarget} 
                      onChange={e => setMetaTarget(e.target.value)} 
                      placeholder="0" 
                      className="w-full p-4 pl-8 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm font-black outline-none focus:border-blue-500 transition-colors" 
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button type="submit" disabled={isSaving || !metaTitle || !metaTarget} className={`w-full py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-md hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 ${metaType === "GOAL" ? 'bg-green-600' : 'bg-red-600'}`}>
                    {isSaving ? 'Creando...' : 'Guardar Objetivo'}
                  </button>
                  <button type="button" onClick={() => setShowMetaModal(false)} className="w-full py-3 rounded-2xl bg-gray-100 dark:bg-gray-900 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL IMPORTAR NÓMINA */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white dark:bg-[#0a0a0a] w-full max-w-sm rounded-[2rem] p-6 space-y-6 shadow-2xl border border-gray-100 dark:border-gray-800">
              
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">💰</div>
                <h3 className="font-black text-xl text-gray-900 dark:text-white">Importar Nómina</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-4 leading-relaxed">
                  Trae el cálculo de tus turnos directamente a tu billetera.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Mes del turno</label>
                  <select value={importMonth} onChange={e => setImportMonth(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-xs font-black uppercase tracking-wider outline-none cursor-pointer appearance-none text-center">
                    {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Selecciona la Quincena</label>
                  <div className="flex gap-2">
                    <button onClick={() => setImportQuincena(1)} className={`flex-1 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest border transition-all ${importQuincena === 1 ? `${activeBg} text-white border-transparent shadow-md` : 'bg-gray-50 dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-800'}`}>Quincena 1</button>
                    <button onClick={() => setImportQuincena(2)} className={`flex-1 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest border transition-all ${importQuincena === 2 ? `${activeBg} text-white border-transparent shadow-md` : 'bg-gray-50 dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-800'}`}>Quincena 2</button>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <button onClick={importFromPayroll} disabled={isSaving} className={`w-full py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-md hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 ${activeBg}`}>
                    {isSaving ? <span className="animate-pulse">Calculando...</span> : 'Sincronizar Dinero'}
                  </button>
                  <button onClick={() => setShowImportModal(false)} className="w-full py-3 rounded-2xl bg-gray-100 dark:bg-gray-900 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}