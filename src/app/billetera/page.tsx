"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import Footer from "@/components/Footer";

import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, getDocs, doc, updateDoc, increment,
  writeBatch, setDoc
} from "firebase/firestore";

// ==========================================
// 📚 CATÁLOGOS BASE DE LA APP
// ==========================================
const EXPENSE_CATEGORIES = [
  { id: "comida", icon: "🍔", label: "Comida" },
  { id: "transporte", icon: "🚌", label: "Transporte" },
  { id: "suscripciones", icon: "📱", label: "Suscripciones" },
  { id: "servicios", icon: "💡", label: "Servicios" },
  { id: "compras", icon: "🛍️", label: "Compras" },
  { id: "ocio", icon: "🍿", label: "Ocio" },
  { id: "salud", icon: "💊", label: "Salud" },
  { id: "educacion", icon: "📚", label: "Educación" },
];

const INCOME_CATEGORIES = [
  { id: "nomina", icon: "💰", label: "Nómina" },
  { id: "transferencia", icon: "🏦", label: "Transferencias" },
  { id: "ventas", icon: "🤝", label: "Ventas" },
  { id: "ahorros", icon: "🐖", label: "Rendimientos" },
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function BilleteraPage() {
  const theme = useTheme?.(); 
  const themeColor = theme?.themeColor ?? "blue";
  const { hapticLight, hapticSuccess, hapticError, hapticWarning } = useHaptics();
  const { user } = useUser();
  
  // ==========================================
  // 🗄️ ESTADOS GLOBALES (Base de Datos)
  // ==========================================
  const [transactions, setTransactions] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  
  // ==========================================
  // 🎮 ESTADOS DE INTERFAZ (UI & Modales)
  // ==========================================
  const [showBalances, setShowBalances] = useState(true); // 🔥 Ocultar saldos tipo Nequi
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "INCOME" | "EXPENSE" | "INTERNAL">("ALL"); // 🔥 Filtros Historial
  const [txModalType, setTxModalType] = useState<"INCOME" | "EXPENSE" | "SAVE_GOAL" | "PAY_DEBT" | null>(null); // 🔥 Separación Semántica
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryLimit, setShowHistoryLimit] = useState(5);
  const [activeTarget, setActiveTarget] = useState<any | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [payrollPreview, setPayrollPreview] = useState<number | null>(null); // 🔥 Previsualización de nómina

  // ==========================================
  // 📝 ESTADOS DE FORMULARIOS
  // ==========================================
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isRecurring, setIsRecurring] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📌");

  const [metaTitle, setMetaTitle] = useState("");
  const [metaTarget, setMetaTarget] = useState("");
  const [metaType, setMetaType] = useState<"GOAL" | "DEBT">("GOAL");

  const [importMonth, setImportMonth] = useState(MESES[new Date().getMonth()]);
  const [importQuincena, setImportQuincena] = useState(new Date().getDate() <= 15 ? 1 : 2);

  const activeBg = themeColor === 'blue' ? 'bg-blue-600' : 'bg-red-600';
  const activeText = themeColor === 'blue' ? 'text-blue-500' : 'text-red-500';
  const activeBorder = themeColor === 'blue' ? 'border-blue-500' : 'border-red-500';

  // ==========================================
  // 📡 CONEXIÓN A FIREBASE
  // ==========================================
  useEffect(() => {
    if (!user) return;
    
    const qTx = query(collection(db, "wallet_transactions"), where("userId", "==", user.id), where("deleted", "==", false));
    const unsubTx = onSnapshot(qTx, (snap) => {
      const txs = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (b.timestamp?.toMillis() || Date.now()) - (a.timestamp?.toMillis() || Date.now()));
      setTransactions(txs);
    });

    const qGoals = query(collection(db, "wallet_goals"), where("userId", "==", user.id));
    const unsubGoals = onSnapshot(qGoals, (snap) => {
      const goalsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      goalsData.sort((a, b) => {
        const aCompleted = a.currentAmount >= a.targetAmount;
        const bCompleted = b.currentAmount >= b.targetAmount;
        if (aCompleted === bCompleted) return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
        return aCompleted ? 1 : -1;
      });
      setMetas(goalsData);
    });

    const qCats = query(collection(db, "wallet_categories"), where("userId", "==", user.id));
    const unsubCats = onSnapshot(qCats, (snap) => {
      setCustomCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    return () => { unsubTx(); unsubGoals(); unsubCats(); };
  }, [user]);

  // ==========================================
  // 🧠 CEREBRO FINANCIERO ATÓMICO
  // ==========================================
  const currentMonthNum = new Date().getMonth();
  const currentYearNum = new Date().getFullYear();

  const analytics = useMemo(() => {
    let cash = 0;
    let incomeMonth = 0;
    let expenseMonth = 0;
    const expensesByCategory: Record<string, { label: string, amount: number, icon: string }> = {};

    transactions.forEach(tx => {
      const txDate = tx.timestamp ? tx.timestamp.toDate() : new Date();
      const isThisMonth = txDate.getMonth() === currentMonthNum && txDate.getFullYear() === currentYearNum;

      // 🔥 Lógica Contable Fuerte
      if (tx.type === 'INCOME' || tx.type === 'GOAL_REDEMPTION') {
        cash += Number(tx.amount); // Entra dinero (o vuelve de una meta)
        if (isThisMonth && tx.type === 'INCOME') incomeMonth += Number(tx.amount);
      } else if (tx.type === 'EXPENSE') {
        cash -= Number(tx.amount); // Gasto real
        if (isThisMonth) {
          expenseMonth += Number(tx.amount);
          if (!expensesByCategory[tx.category]) {
            expensesByCategory[tx.category] = { label: tx.category, amount: 0, icon: tx.icon || '💸' };
          }
          expensesByCategory[tx.category].amount += Number(tx.amount);
        }
      } else if (tx.type === 'SAVE_GOAL' || tx.type === 'PAY_DEBT') {
        cash -= Number(tx.amount); // El dinero sale del Disponible hacia el bolsillo o a pagar deuda
      }
    });

    let savedInGoals = 0;
    let pendingDebts = 0;
    
    metas.forEach(m => {
      if (m.type === 'GOAL') savedInGoals += m.currentAmount;
      if (m.type === 'DEBT') pendingDebts += (m.targetAmount - m.currentAmount);
    });

    const topExpenses = Object.values(expensesByCategory).sort((a, b) => b.amount - a.amount).slice(0, 3);

    let smartInsight = "Tus finanzas están estables. ¡Sigue así!";
    if (expenseMonth > incomeMonth && incomeMonth > 0) {
      smartInsight = "⚠️ Cuidado, estás gastando más de lo que ingresas este mes.";
    } else if (topExpenses.length > 0) {
      const highest = topExpenses[0];
      const percent = Math.round((highest.amount / expenseMonth) * 100);
      smartInsight = `💡 El ${percent}% de tus gastos se van en ${highest.label}.`;
    }

    return { cashBalance: cash, goalBalance: savedInGoals, debtBalance: pendingDebts, netWorth: cash + savedInGoals - pendingDebts, incomeMonth, expenseMonth, topExpenses, smartInsight };
  }, [transactions, metas]);

  const currentCategories = useMemo(() => {
    const base = txModalType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const custom = customCategories.filter(c => c.type === txModalType);
    return [...base, ...custom];
  }, [txModalType, customCategories]);

  // 🔥 Filtro de Historial
  const filteredTransactions = useMemo(() => {
    if (historyFilter === "ALL") return transactions;
    if (historyFilter === "INTERNAL") return transactions.filter(t => t.type === 'SAVE_GOAL' || t.type === 'PAY_DEBT' || t.type === 'GOAL_REDEMPTION');
    return transactions.filter(t => t.type === historyFilter);
  }, [transactions, historyFilter]);

  // 🔥 SOLUCIÓN: Agregadas las listas filtradas de metas y deudas que faltaban
  const goalsList = metas.filter(m => m.type === "GOAL");
  const debtsList = metas.filter(m => m.type === "DEBT");

  // Funciones Helpers
  const formatCurrency = (val: number) => showBalances ? `$${val.toLocaleString('es-CO')}` : '••••••';

  // ==========================================
  // ⚡ ACCIONES CORE DE ESCRITURA (BATCHES & SEGURIDAD)
  // ==========================================
  
  // 1. Guardar Categoría (Bug Fix Identidad)
  const handleSaveCustomCategory = async () => {
    if (!newCatName || !user || !txModalType) return hapticError();
    try {
      // 🔥 Creación segura: doc() genera el ID, setDoc lo escribe atómicamente.
      const newCatRef = doc(collection(db, "wallet_categories"));
      await setDoc(newCatRef, {
        userId: user.id, 
        id: newCatRef.id, 
        type: txModalType, 
        icon: newCatIcon || "📌", 
        label: newCatName.trim(), 
        timestamp: serverTimestamp()
      });
      hapticSuccess();
      setNewCatName(""); setNewCatIcon("📌"); setShowAddCategory(false); setSelectedCategory(newCatRef.id);
    } catch (e) { hapticError(); }
  };

  // 2. Guardar Movimiento (Escritura Atómica & Validación Dura)
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    
    // 🔥 Validación Dura
    if (isNaN(numAmount) || numAmount <= 0 || !user) {
      hapticError();
      alert("Por favor ingresa un monto válido mayor a cero.");
      return;
    }
    
    setIsSaving(true);
    const isPaymentOrSave = txModalType === 'SAVE_GOAL' || txModalType === 'PAY_DEBT';
    const categoryData = currentCategories.find(c => c.id === selectedCategory);

    if (isPaymentOrSave && activeTarget) {
      const pending = activeTarget.targetAmount - activeTarget.currentAmount;
      if (numAmount > pending) {
        hapticWarning();
        if (!confirm(`El abono supera el saldo pendiente ($${pending.toLocaleString('es-CO')}). ¿Guardar de todas formas?`)) {
          setIsSaving(false); return;
        }
      }
    }

    // 🔥 Batch Write Contable
    const batch = writeBatch(db);
    const txRef = doc(collection(db, "wallet_transactions"));

    try {
      batch.set(txRef, {
        userId: user.id,
        type: txModalType,
        amount: numAmount,
        category: isPaymentOrSave ? (txModalType === 'SAVE_GOAL' ? `Ahorro: ${activeTarget.title}` : `Abono: ${activeTarget.title}`) : (categoryData?.label || "Otros"),
        icon: isPaymentOrSave ? activeTarget.icon : (categoryData?.icon || "💵"),
        description: desc.trim(),
        isRecurring: isRecurring, 
        timestamp: serverTimestamp(),
        targetId: isPaymentOrSave ? activeTarget.id : null,
        deleted: false
      });

      if (isPaymentOrSave && activeTarget) {
        const goalRef = doc(db, "wallet_goals", activeTarget.id);
        batch.update(goalRef, { currentAmount: increment(numAmount) });
      }
      
      await batch.commit(); // Si algo falla, se revierte todo
      hapticSuccess();
      closeTxModal();
    } catch (e) { hapticError(); alert("Error contable de red."); } finally { setIsSaving(false); }
  };

  // 3. Crear Nueva Meta/Deuda
  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTarget = parseFloat(metaTarget);
    if (isNaN(numTarget) || numTarget <= 0 || !metaTitle || !user) return hapticError();
    setIsSaving(true);
    try {
      await addDoc(collection(db, "wallet_goals"), {
        userId: user.id, title: metaTitle.trim(), targetAmount: numTarget, currentAmount: 0, 
        type: metaType, icon: metaType === "GOAL" ? "🎯" : "💸", timestamp: serverTimestamp()
      });
      hapticSuccess(); setShowMetaModal(false); setMetaTitle(""); setMetaTarget("");
    } catch (e) { hapticError(); } finally { setIsSaving(false); }
  };

  // 🔥 4. Liquidar / Eliminar Meta o Deuda (Flujo del Dinero)
  const handleLiquidateGoal = async (goal: any) => {
    if (!user) return;
    const isGoal = goal.type === "GOAL";
    
    // Mensaje Dinámico
    let confirmMsg = isGoal 
      ? `¿Liquidar meta? Los ahorros ($${goal.currentAmount.toLocaleString('es-CO')}) se devolverán a tu Saldo Disponible.`
      : `¿Eliminar registro de esta Deuda permanentemente?`;
      
    if (!confirm(confirmMsg)) return;
    hapticWarning();

    const batch = writeBatch(db);
    try {
      // Si es una META (Ahorro) con dinero, lo devolvemos al Disponible
      if (isGoal && goal.currentAmount > 0) {
        const txRef = doc(collection(db, "wallet_transactions"));
        batch.set(txRef, {
          userId: user.id, type: "GOAL_REDEMPTION", amount: goal.currentAmount,
          category: `Retiro de Meta: ${goal.title}`, icon: "🎉", description: "Liquidación y retorno de ahorros",
          timestamp: serverTimestamp(), deleted: false
        });
      }
      
      // Destruimos el objetivo
      const goalRef = doc(db, "wallet_goals", goal.id);
      batch.delete(goalRef);
      
      await batch.commit();
      hapticSuccess();
      if(isGoal && goal.currentAmount >= goal.targetAmount) {
        alert("¡Felicidades! Meta cumplida y dinero liberado a tu cuenta.");
      }
    } catch (e) { hapticError(); alert("Fallo al procesar la liquidación."); }
  };

  // 5. Soft Delete de Transacciones (Regla 24h & Reversiones)
  const deleteTransaction = async (tx: any) => {
    if (!user || !tx.id) return;
    
    // 🔥 Seguridad 24 Horas
    const txTime = tx.timestamp ? tx.timestamp.toMillis() : Date.now();
    const hoursSinceCreation = (Date.now() - txTime) / (1000 * 60 * 60);
    
    if (hoursSinceCreation > 24) {
      hapticError();
      alert("Operación denegada. Registros mayores a 24 horas están sellados por seguridad contable.");
      return;
    }

    if (!confirm("¿Cancelar movimiento? El impacto en tus saldos se revertirá.")) return;
    hapticWarning();

    const batch = writeBatch(db);
    try {
      // Reversión atómica si era un abono
      if ((tx.type === 'SAVE_GOAL' || tx.type === 'PAY_DEBT') && tx.targetId) {
        const targetGoal = metas.find(m => m.id === tx.targetId);
        if(targetGoal) {
          const goalRef = doc(db, "wallet_goals", tx.targetId);
          batch.update(goalRef, { currentAmount: increment(-tx.amount) });
        }
      }
      
      // Auditoría: Soft Delete
      const txRef = doc(db, "wallet_transactions", tx.id);
      batch.update(txRef, { deleted: true, deletedAt: serverTimestamp(), deleteReason: "Reversión de usuario" });
      
      await batch.commit();
      setExpandedTxId(null); hapticSuccess();
    } catch (e) { hapticError(); alert("No se pudo revertir."); }
  };

  // 🔥 6. Motor Importador de Nómina (Con Preview)
  const previewPayroll = async () => {
    if (!user) return;
    const qShifts = query(collection(db, "shifts"), where("userId", "==", user.id), where("month", "==", importMonth));
    const snap = await getDocs(qShifts);
    let total = 0;
    
    snap.forEach(doc => {
      const data = doc.data();
      if(!data.date) return;
      const dayNumber = parseInt(data.date.split('-')[2], 10);
      const shiftQ = dayNumber <= 15 ? 1 : 2;
      if (shiftQ === importQuincena) total += (Number(data.netPay) || 0);
    });
    setPayrollPreview(total);
  };

  const importFromPayroll = async () => {
    if (!user || payrollPreview === null || payrollPreview <= 0) return hapticError();
    setIsSaving(true);
    hapticLight();

    const uniqueRef = `payroll_${currentYearNum}_${importMonth}_Q${importQuincena}`;
    const importDescription = `Liquidación Nómina ${importMonth.toUpperCase()} Q${importQuincena}`;

    try {
      const txCheckQuery = query(collection(db, "wallet_transactions"), where("userId", "==", user.id), where("payrollRef", "==", uniqueRef), where("deleted", "==", false));
      const duplicateSnap = await getDocs(txCheckQuery);
      
      if (!duplicateSnap.empty) {
        hapticError(); alert("Ya has extraído el saldo de esta quincena."); setIsSaving(false); return;
      }

      await addDoc(collection(db, "wallet_transactions"), {
        userId: user.id, type: "INCOME", amount: payrollPreview, category: "Nómina Quincenal", 
        icon: "💳", description: importDescription, payrollRef: uniqueRef, 
        timestamp: serverTimestamp(), deleted: false
      });
      
      hapticSuccess();
      alert(`¡Éxito! Se inyectaron $${payrollPreview.toLocaleString('es-CO')} a tu Disponible.`);
      setShowImportModal(false); setPayrollPreview(null);
    } catch (e) { hapticError(); } finally { setIsSaving(false); }
  };

  const closeTxModal = () => { setTxModalType(null); setAmount(""); setDesc(""); setActiveTarget(null); setShowAddCategory(false); setIsRecurring(false); };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24 transition-colors text-zinc-900 dark:text-zinc-100 font-sans">
      <Navbar />
      
      <div className="pt-6 px-4 max-w-2xl mx-auto space-y-6">
        
        {/* ========================================================= */}
        {/* 1. DASHBOARD ESTRATÉGICO (4 CAPAS DE SALDO) */}
        {/* ========================================================= */}
        <div className="space-y-3">
          <div className={`p-6 rounded-[2rem] bg-gradient-to-br ${themeColor === 'blue' ? 'from-blue-600 to-blue-500' : 'from-red-600 to-red-500'} text-white shadow-xl relative overflow-hidden`}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-start relative z-10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 flex items-center gap-2">
                  Cash Disponible 
                  <button onClick={() => setShowBalances(!showBalances)} className="bg-black/10 hover:bg-black/20 p-1.5 rounded-md backdrop-blur-md transition-colors">{showBalances ? '👁️' : '🙈'}</button>
                </span>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tighter mt-1 truncate">
                  {formatCurrency(analytics.cashBalance)}
                </h2>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6 relative z-10">
              <button onClick={() => { setTxModalType("INCOME"); setAmount(""); setSelectedCategory("nomina"); }} className="flex-1 bg-white/20 hover:bg-white/30 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider backdrop-blur-sm transition-all active:scale-95">+ Ingreso</button>
              <button onClick={() => { setTxModalType("EXPENSE"); setAmount(""); setSelectedCategory("comida"); }} className="flex-1 bg-black/20 hover:bg-black/30 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider backdrop-blur-sm transition-all active:scale-95">- Gasto</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-center transition-all">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Patrimonio Neto</span>
              <span className="text-lg font-black mt-1">{formatCurrency(analytics.netWorth)}</span>
            </div>
            <div className="grid grid-rows-2 gap-2">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 p-3 rounded-2xl flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-green-600 dark:text-green-500">Ahorros</span>
                <span className="text-xs font-black text-green-700 dark:text-green-400">{formatCurrency(analytics.goalBalance)}</span>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 p-3 rounded-2xl flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-500">Deudas</span>
                <span className="text-xs font-black text-red-700 dark:text-red-400">{showBalances ? `-${formatCurrency(analytics.debtBalance)}` : '••••••'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. CEREBRO FINANCIERO & GRÁFICAS */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 opacity-5 blur-3xl rounded-full pointer-events-none"></div>

          <header className="flex justify-between items-end relative z-10">
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white">Flujo del Mes</h3>
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Análisis en tiempo real</p>
            </div>
            <button onClick={() => { setShowImportModal(true); setPayrollPreview(null); }} className={`text-[10px] font-black uppercase bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm ${activeText} active:scale-95`}>
              📥 Traer Nómina
            </button>
          </header>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl flex items-start gap-3 relative z-10">
            <span className="text-blue-500 text-lg shrink-0">🤖</span>
            <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-snug">{analytics.smartInsight}</p>
          </div>

          {showBalances && (
            <div className="space-y-1 relative z-10">
              <div className="flex justify-between text-[11px] font-black">
                <span className="text-green-500">In: ${analytics.incomeMonth.toLocaleString('es-CO')}</span>
                <span className="text-red-500">Out: ${analytics.expenseMonth.toLocaleString('es-CO')}</span>
              </div>
              <div className="w-full h-2.5 flex rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${analytics.incomeMonth === 0 ? 0 : (analytics.incomeMonth / (analytics.incomeMonth + analytics.expenseMonth)) * 100}%` }}></div>
                <div className="bg-red-500 h-full transition-all duration-1000" style={{ width: `${analytics.expenseMonth === 0 ? 0 : (analytics.expenseMonth / (analytics.incomeMonth + analytics.expenseMonth)) * 100}%` }}></div>
              </div>
            </div>
          )}

          {analytics.topExpenses.length > 0 && showBalances && (
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3 relative z-10">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">🔥 Top Fugas de Capital</span>
              {analytics.topExpenses.map((exp, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm shadow-sm">{exp.icon}</span>
                    <span className="text-zinc-600 dark:text-zinc-300 capitalize">{exp.label}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 w-1/3">
                    <span className="text-zinc-500 dark:text-zinc-400">${exp.amount.toLocaleString('es-CO')}</span>
                    <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="bg-red-400 h-full rounded-full transition-all" style={{ width: `${(exp.amount / analytics.expenseMonth) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. BOLSILLOS (METAS) */}
        {/* ========================================================= */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Bolsillos & Metas 🎯</h3>
            </div>
            <button onClick={() => { setMetaType("GOAL"); setShowMetaModal(true); }} className="text-[10px] font-black uppercase text-green-500 hover:text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
              + Crear Meta
            </button>
          </div>
          
          {goalsList.length === 0 ? (
            <div className="bg-transparent border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-xs text-zinc-400 font-bold">No tienes metas activas. Separa tu dinero en bolsillos.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {goalsList.map(meta => {
                const percentage = Math.min((meta.currentAmount / meta.targetAmount) * 100, 100);
                const isCompleted = percentage >= 100;
                return (
                  <div key={meta.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                    <div className="flex justify-between mb-3 items-center relative z-10">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate pr-2 flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span> {meta.title}
                      </span>
                      <div className="flex gap-2 items-center">
                        {!isCompleted ? (
                          <button onClick={() => { setActiveTarget(meta); setTxModalType("SAVE_GOAL"); setAmount(""); }} className="text-[9px] font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors shadow-sm active:scale-95">
                            ABONAR
                          </button>
                        ) : (
                          <span className="text-[9px] font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-md">✨ CUMPLIDA</span>
                        )}
                        <button onClick={() => handleLiquidateGoal(meta)} className="w-8 h-8 flex items-center justify-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative z-10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className="h-full bg-green-500 rounded-full" />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-wider relative z-10">
                      <span className="text-green-500">{formatCurrency(meta.currentAmount)}</span>
                      <span className="text-zinc-400">Objetivo: {formatCurrency(meta.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>


        {/* ========================================================= */}
        {/* 4. DEUDAS */}
        {/* ========================================================= */}
        <section className="space-y-3 pt-2">
          <div className="flex justify-between items-center px-2">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Obligaciones 💸</h3>
            </div>
            <button onClick={() => { setMetaType("DEBT"); setShowMetaModal(true); }} className="text-[10px] font-black uppercase text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
              + Registrar Deuda
            </button>
          </div>
          
          {debtsList.length === 0 ? (
            <div className="bg-transparent border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-xs text-zinc-400 font-bold">Excelente, no tienes deudas pendientes.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {debtsList.map(meta => {
                const percentage = Math.min((meta.currentAmount / meta.targetAmount) * 100, 100);
                const isCompleted = percentage >= 100;
                return (
                  <div key={meta.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-2xl border transition-all shadow-sm ${isCompleted ? 'border-zinc-200 dark:border-zinc-800 opacity-60' : 'border-red-100 dark:border-red-900/30'}`}>
                    <div className="flex justify-between mb-3 items-center">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate pr-2 flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span> {meta.title}
                      </span>
                      <div className="flex gap-2 items-center">
                        {!isCompleted ? (
                          <button onClick={() => { setActiveTarget(meta); setTxModalType("PAY_DEBT"); setAmount(""); }} className="text-[9px] font-black text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md hover:bg-red-100 transition-colors shadow-sm active:scale-95">
                            PAGAR CUOTA
                          </button>
                        ) : (
                          <span className="text-[9px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">✓ SALDADA</span>
                        )}
                        <button onClick={() => handleLiquidateGoal(meta)} className="w-8 h-8 flex items-center justify-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={`h-full rounded-full ${isCompleted ? 'bg-zinc-400' : 'bg-red-500'}`} />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-wider">
                      <span className={isCompleted ? 'text-zinc-500' : 'text-red-500'}>Abonado: {formatCurrency(meta.currentAmount)}</span>
                      <span className="text-zinc-400">Total Deuda: {formatCurrency(meta.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* 5. HISTORIAL BLINDADO (FILTROS Y REGLA DE 24H) */}
        {/* ========================================================= */}
        <section className="space-y-3 pb-8 pt-4">
          <div className="flex justify-between items-center px-2">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Libro Contable</h3>
              <p className="text-[8px] text-zinc-400 mt-0.5">Auditoría con bloqueo 24h</p>
            </div>
            
            <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value as any)} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 py-2 px-3 rounded-xl outline-none cursor-pointer">
              <option value="ALL">Todo</option>
              <option value="INCOME">Ingresos</option>
              <option value="EXPENSE">Gastos</option>
              <option value="INTERNAL">Internos / Bolsillos</option>
            </select>
          </div>
          
          <div className="space-y-2">
            {filteredTransactions.slice(0, showHistoryLimit).map(tx => {
              const isExpanded = expandedTxId === tx.id;
              
              const txTime = tx.timestamp ? tx.timestamp.toMillis() : Date.now();
              const hoursSinceCreation = (Date.now() - txTime) / (1000 * 60 * 60);
              const isDeletable = hoursSinceCreation <= 24;

              const isIncome = tx.type === 'INCOME' || tx.type === 'GOAL_REDEMPTION';
              const isTransfer = tx.type === 'SAVE_GOAL' || tx.type === 'PAY_DEBT';
              
              return (
                <div key={tx.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
                  <button onClick={() => { hapticLight(); setExpandedTxId(isExpanded ? null : tx.id); }} className="w-full flex justify-between items-center p-4 outline-none">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${isTransfer ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                        {tx.icon}
                      </div>
                      <div className="text-left truncate pr-2">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1">
                          {tx.category} {tx.isRecurring && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded">FIJO</span>}
                        </p>
                        <p className="text-[9px] text-zinc-400 mt-0.5 font-bold uppercase tracking-wider">
                          {tx.timestamp ? tx.timestamp.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-black shrink-0 ${isIncome ? 'text-green-500' : isTransfer ? 'text-blue-500' : 'text-zinc-900 dark:text-white'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-zinc-50/50 dark:bg-black/20 border-t border-zinc-100 dark:border-zinc-800 p-4 space-y-4">
                        {tx.description ? (
                          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 italic px-1">📝 "{tx.description}"</p>
                        ) : (
                          <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 italic px-1">Sin detalles adicionales.</p>
                        )}
                        
                        {isDeletable ? (
                          <button onClick={() => deleteTransaction(tx)} className="w-full py-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-colors shadow-sm">
                            Deshacer Movimiento (Túnel 24h)
                          </button>
                        ) : (
                          <div className="w-full py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed border border-dashed border-zinc-300 dark:border-zinc-700">
                            🔒 Registro Sellado Contablemente (+24h)
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            
            {filteredTransactions.length === 0 && (
              <div className="p-6 text-center text-xs font-bold text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                No hay movimientos con este filtro.
              </div>
            )}
            
            {filteredTransactions.length > showHistoryLimit && (
              <button onClick={() => setShowHistoryLimit(prev => prev + 10)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl active:scale-95 transition-all">
                Cargar Más Movimientos
              </button>
            )}
          </div>
        </section>
      </div>

      {/* ============================================================== */}
      {/* 🟢 MODAL: NUEVA TRANSACCIÓN Y CREACIÓN DE CATEGORÍAS */}
      {/* ============================================================== */}
      <AnimatePresence>
        {txModalType && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end justify-center">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-t-[2.5rem] p-6 space-y-6 shadow-2xl pb-safe">
              
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <h3 className="font-black text-lg text-zinc-900 dark:text-white">
                  {txModalType === 'SAVE_GOAL' ? `Ahorrar en ${activeTarget?.title}` : txModalType === 'PAY_DEBT' ? `Pagar ${activeTarget?.title}` : txModalType === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Gasto'}
                </h3>
                <button onClick={closeTxModal} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold hover:bg-zinc-200 transition-colors">✕</button>
              </div>

              <form onSubmit={handleSaveTransaction} className="space-y-6">
                
                {/* Input de Monto */}
                <div className="relative flex items-center justify-center">
                  <span className="absolute left-4 text-3xl font-black text-zinc-300 dark:text-zinc-700">$</span>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full text-5xl font-black text-center bg-transparent outline-none py-4 text-zinc-900 dark:text-white" autoFocus />
                </div>

                {/* Categorías (Solo para Gastos e Ingresos, no transferencias/abonos) */}
                {txModalType !== 'SAVE_GOAL' && txModalType !== 'PAY_DEBT' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1 flex justify-between">
                      <span>Categoría</span>
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                      {currentCategories.map(cat => (
                        <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 ${selectedCategory === cat.id ? `${activeBg} text-white border-transparent shadow-md scale-105` : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                          <span>{cat.icon}</span> {cat.label}
                        </button>
                      ))}
                      
                      {/* Botón de Agregar Personalizada */}
                      <button type="button" onClick={() => setShowAddCategory(!showAddCategory)} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase border border-dashed transition-colors flex items-center gap-1 ${showAddCategory ? 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-800 dark:text-zinc-200' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'}`}>
                        {showAddCategory ? '✕ Cancelar' : '+ Nueva Categoría'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Mini Formulario de Categoría Customizada */}
                <AnimatePresence>
                  {showAddCategory && txModalType !== 'SAVE_GOAL' && txModalType !== 'PAY_DEBT' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-2 overflow-hidden bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} placeholder="🎨" className="w-12 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center text-lg outline-none focus:border-blue-500" maxLength={2} />
                      <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Ej: Transporte (3 bloques)" className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-500" />
                      <button type="button" onClick={handleSaveCustomCategory} disabled={!newCatName} className={`px-4 rounded-xl font-black text-white transition-opacity disabled:opacity-50 ${activeBg}`}>✓</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Nota Extra y Toggle Recurrente */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Detalles Adicionales</label>
                    <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Opcional: Detalles del movimiento..." className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-3.5 px-4 rounded-2xl text-xs font-bold outline-none text-zinc-900 dark:text-white" />
                  </div>
                  
                  {/* Opción de Gasto/Ingreso Fijo */}
                  {txModalType !== 'SAVE_GOAL' && txModalType !== 'PAY_DEBT' && (
                    <label className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl cursor-pointer">
                      <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className={`w-5 h-5 rounded-md border-zinc-300 text-blue-600 focus:ring-blue-500`} />
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">Marcar como Recurrente</p>
                        <p className="text-[9px] text-zinc-400 font-medium">Útil para reportes de gastos fijos (Netflix, Plan Celular).</p>
                      </div>
                    </label>
                  )}
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isSaving || !amount || (txModalType !== 'SAVE_GOAL' && txModalType !== 'PAY_DEBT' && !selectedCategory)} className={`w-full py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${activeBg}`}>
                    {isSaving ? 'Registrando...' : 'Confirmar Movimiento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 🎯 MODAL: NUEVA META O DEUDA */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showMetaModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-[2rem] p-6 space-y-6 shadow-2xl border border-zinc-100 dark:border-zinc-800">
              
              <div className="flex gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setMetaType("GOAL")} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${metaType === "GOAL" ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-500'}`}>🎯 Ahorro Libre</button>
                <button onClick={() => setMetaType("DEBT")} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${metaType === "DEBT" ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-500'}`}>💸 Obligación</button>
              </div>

              <form onSubmit={handleSaveMeta} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Título del Objetivo</label>
                  <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={metaType === "GOAL" ? "Ej: Enganche Honda Hornet 125..." : "Ej: Préstamo familiar..."} className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold outline-none text-zinc-900 dark:text-white focus:border-blue-500 transition-colors" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Monto a alcanzar</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-zinc-400">$</span>
                    <input type="number" step="0.01" value={metaTarget} onChange={e => setMetaTarget(e.target.value)} placeholder="0" className="w-full p-4 pl-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-black outline-none text-zinc-900 dark:text-white focus:border-blue-500 transition-colors" />
                  </div>
                </div>

                <div className="pt-4 space-y-3 flex flex-col">
                  <button type="submit" disabled={isSaving || !metaTitle || !metaTarget} className={`w-full py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${metaType === "GOAL" ? 'bg-green-600' : 'bg-red-600'}`}>
                    Crear Objetivo
                  </button>
                  <button type="button" onClick={() => setShowMetaModal(false)} className="w-full py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 🤖 MODAL: IMPORTADOR DE NÓMINA SEGURO */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-[2rem] p-6 space-y-6 shadow-2xl border border-zinc-100 dark:border-zinc-800">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">📥</div>
                <h3 className="font-black text-xl text-zinc-900 dark:text-white">Importar Nómina</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-4">Convierte los turnos calculados en saldo disponible.</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Mes del turno</label>
                  <select value={importMonth} onChange={e => { setImportMonth(e.target.value); setPayrollPreview(null); }} className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-black uppercase tracking-wider outline-none text-center text-zinc-900 dark:text-white appearance-none">
                    {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Quincena a liquidar</label>
                  <div className="flex gap-2">
                    <button onClick={() => { setImportQuincena(1); setPayrollPreview(null); }} className={`flex-1 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest border transition-all ${importQuincena === 1 ? `${activeBg} text-white shadow-md border-transparent` : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>Q1 (1-15)</button>
                    <button onClick={() => { setImportQuincena(2); setPayrollPreview(null); }} className={`flex-1 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest border transition-all ${importQuincena === 2 ? `${activeBg} text-white shadow-md border-transparent` : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>Q2 (16-31)</button>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  {payrollPreview === null ? (
                    <button onClick={previewPayroll} className={`w-full py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-md transition-all active:scale-95 ${activeBg}`}>Analizar Turnos</button>
                  ) : (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl text-center border border-blue-100 dark:border-blue-900/50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Monto Encontrado</p>
                      <p className="text-2xl font-black text-blue-600 dark:text-blue-400">${payrollPreview.toLocaleString('es-CO')}</p>
                      <button onClick={importFromPayroll} disabled={isSaving || payrollPreview <= 0} className={`mt-3 w-full py-3 rounded-xl text-white font-black uppercase text-[10px] tracking-widest shadow-md disabled:opacity-50 ${activeBg}`}>
                        {isSaving ? 'Sincronizando...' : 'Ingresar a Disponible'}
                      </button>
                    </div>
                  )}
                  <button onClick={() => setShowImportModal(false)} className="w-full py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">Cancelar</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full border-t border-gray-100 dark:border-gray-900/50 pt-8"><Footer /></div>
    </main>
  );
}