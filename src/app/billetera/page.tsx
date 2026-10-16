"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import Footer from "@/components/Footer";
import Link from "next/link"; 
import BilleteraTutorial from "@/components/BilleteraTutorial";

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

const POCKET_COLORS = [
  { id: "zinc", bg: "bg-white dark:bg-zinc-900", border: "border-zinc-200 dark:border-zinc-800", text: "text-zinc-900 dark:text-white" },
  { id: "blue", bg: "bg-blue-50 dark:bg-blue-900/10", border: "border-blue-200 dark:border-blue-800/30", text: "text-blue-900 dark:text-blue-100" },
  { id: "purple", bg: "bg-purple-50 dark:bg-purple-900/10", border: "border-purple-200 dark:border-purple-800/30", text: "text-purple-900 dark:text-purple-100" },
  { id: "emerald", bg: "bg-emerald-50 dark:bg-emerald-900/10", border: "border-emerald-200 dark:border-emerald-800/30", text: "text-emerald-900 dark:text-emerald-100" },
  { id: "amber", bg: "bg-amber-50 dark:bg-amber-900/10", border: "border-amber-200 dark:border-amber-800/30", text: "text-amber-900 dark:text-amber-100" },
  { id: "rose", bg: "bg-rose-50 dark:bg-rose-900/10", border: "border-rose-200 dark:border-rose-800/30", text: "text-rose-900 dark:text-rose-100" },
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
  const [recurringConfigs, setRecurringConfigs] = useState<any[]>([]);
  
  // ==========================================
  // 🎮 ESTADOS DE INTERFAZ (UI & Modales)
  // ==========================================
  const [showBalances, setShowBalances] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "INCOME" | "EXPENSE" | "INTERNAL">("ALL");
  const [txModalType, setTxModalType] = useState<"INCOME" | "EXPENSE" | "SAVE_GOAL" | "PAY_DEBT" | "FUND_POCKET" | "WITHDRAW_POCKET" | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryLimit, setShowHistoryLimit] = useState(5);
  const [activeTarget, setActiveTarget] = useState<any | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [payrollPreview, setPayrollPreview] = useState<number | null>(null);

  // Reordenamiento local de bolsillos
  const [localPockets, setLocalPockets] = useState<any[]>([]);

  // ==========================================
  // 📝 ESTADOS DE FORMULARIOS
  // ==========================================
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  
  // Estados para Recurrencia
  const [isRecurring, setIsRecurring] = useState(false); 
  const [recurringDay, setRecurringDay] = useState<number>(new Date().getDate());

  const [isSaving, setIsSaving] = useState(false);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📌");

  const [metaTitle, setMetaTitle] = useState("");
  const [metaTarget, setMetaTarget] = useState("");
  const [metaType, setMetaType] = useState<"GOAL" | "DEBT" | "POCKET">("POCKET");
  const [pocketColor, setPocketColor] = useState("zinc"); // Nuevo estado de color

  const [importMonth, setImportMonth] = useState(MESES[new Date().getMonth()]);
  const [importQuincena, setImportQuincena] = useState(new Date().getDate() <= 15 ? 1 : 2);

  const activeBg = themeColor === 'blue' ? 'bg-blue-600' : 'bg-red-600';
  const activeText = themeColor === 'blue' ? 'text-blue-500' : 'text-red-500';

  const currentMonthNum = new Date().getMonth();
  const currentYearNum = new Date().getFullYear();
  const currentDate = new Date().getDate();

  // ==========================================
  // 📡 CONEXIÓN A FIREBASE Y AUTO-COBRO
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
        // Los bolsillos usan su propiedad 'order' para el drag and drop
        if (a.type === 'POCKET' && b.type === 'POCKET') return (a.order || 0) - (b.order || 0);
        
        const aCompleted = a.targetAmount > 0 && a.currentAmount >= a.targetAmount;
        const bCompleted = b.targetAmount > 0 && b.currentAmount >= b.targetAmount;
        if (aCompleted === bCompleted) return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
        return aCompleted ? 1 : -1;
      });
      setMetas(goalsData);
    });

    const qCats = query(collection(db, "wallet_categories"), where("userId", "==", user.id));
    const unsubCats = onSnapshot(qCats, (snap) => {
      setCustomCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const qRecurring = query(collection(db, "wallet_recurring"), where("userId", "==", user.id), where("active", "==", true));
    const unsubRecurring = onSnapshot(qRecurring, (snap) => {
      setRecurringConfigs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    return () => { unsubTx(); unsubGoals(); unsubCats(); unsubRecurring(); };
  }, [user]);

  // Sincronizar el estado local de bolsillos (para Drag & Drop fluido)
  useEffect(() => {
    setLocalPockets(metas.filter(m => m.type === "POCKET"));
  }, [metas]);

  // 🤖 CRON-JOB: Verifica cobros recurrentes
  useEffect(() => {
    if (!user || recurringConfigs.length === 0) return;

    const checkRecurringTransactions = async () => {
      const batch = writeBatch(db);
      let needsCommit = false;

      for (const config of recurringConfigs) {
        if (currentDate >= config.chargeDay) {
          const thisMonthKey = `${currentYearNum}-${currentMonthNum}`;
          
          if (config.lastProcessedMonth !== thisMonthKey) {
            const txRef = doc(collection(db, "wallet_transactions"));
            batch.set(txRef, {
              userId: user.id, type: config.type, amount: config.amount,
              category: config.category, icon: config.icon, 
              description: `Cobro Automático (${config.description || config.category})`, 
              isRecurring: true, isAutoGenerated: true, timestamp: serverTimestamp(), 
              targetId: config.targetId || null, targetName: config.targetName || null, deleted: false
            });

            const configRef = doc(db, "wallet_recurring", config.id);
            batch.update(configRef, { lastProcessedMonth: thisMonthKey });
            
            if (config.type === 'WITHDRAW_POCKET' && config.targetId) {
                const goalRef = doc(db, "wallet_goals", config.targetId);
                batch.update(goalRef, { currentAmount: increment(-config.amount) });
            }

            needsCommit = true;
          }
        }
      }

      if (needsCommit) {
        try { await batch.commit(); } catch (error) { console.error(error); }
      }
    };

    checkRecurringTransactions();
  }, [recurringConfigs, user, currentMonthNum, currentYearNum, currentDate]);

  // ==========================================
  // 🧠 CEREBRO FINANCIERO ATÓMICO MEJORADO
  // ==========================================
  const analytics = useMemo(() => {
    let cash = 0, incomeMonth = 0, expenseMonth = 0, recurringExpensesMonth = 0;
    const expensesByCategory: Record<string, { label: string, amount: number, icon: string }> = {};

    transactions.forEach(tx => {
      const txDate = tx.timestamp ? tx.timestamp.toDate() : new Date();
      const isThisMonth = txDate.getMonth() === currentMonthNum && txDate.getFullYear() === currentYearNum;

      if (tx.type === 'INCOME' || tx.type === 'GOAL_REDEMPTION') {
        cash += Number(tx.amount); 
        if (isThisMonth && tx.type === 'INCOME') incomeMonth += Number(tx.amount);
      } else if (tx.type === 'EXPENSE' || tx.type === 'WITHDRAW_POCKET') {
        if (tx.type === 'EXPENSE') cash -= Number(tx.amount); 

        if (isThisMonth) {
          expenseMonth += Number(tx.amount);
          if (tx.isRecurring) recurringExpensesMonth += Number(tx.amount);

          const cat = tx.category || "Otros";
          if (!expensesByCategory[cat]) { expensesByCategory[cat] = { label: cat, amount: 0, icon: tx.icon || '💸' }; }
          expensesByCategory[cat].amount += Number(tx.amount);
        }
      } else if (tx.type === 'SAVE_GOAL' || tx.type === 'PAY_DEBT' || tx.type === 'FUND_POCKET') {
        cash -= Number(tx.amount); 
      }
    });

    let savedInGoals = 0, pendingDebts = 0, savedInPockets = 0;
    
    metas.forEach(m => {
      if (m.type === 'GOAL') savedInGoals += m.currentAmount;
      if (m.type === 'DEBT') pendingDebts += (m.targetAmount - m.currentAmount);
      if (m.type === 'POCKET') savedInPockets += m.currentAmount;
    });

    const topExpenses = Object.values(expensesByCategory).sort((a, b) => b.amount - a.amount).slice(0, 3);

    const insights = [];
    const daysInMonth = new Date(currentYearNum, currentMonthNum + 1, 0).getDate();
    const monthProgress = currentDate / daysInMonth; 
    const expensePace = incomeMonth > 0 ? (expenseMonth / incomeMonth) : 0;
    const savingsRate = incomeMonth > 0 ? ((incomeMonth - expenseMonth) / incomeMonth) * 100 : 0;
    const recurringRatio = expenseMonth > 0 ? (recurringExpensesMonth / expenseMonth) * 100 : 0;

    if (expenseMonth > incomeMonth && incomeMonth > 0) {
      insights.push({ type: 'danger', icon: '🚨', text: `¡Déficit! Has gastado $${(expenseMonth - incomeMonth).toLocaleString('es-CO')} más de lo que ha ingresado.` });
    }
    else if (incomeMonth > 0 && expensePace > (monthProgress + 0.20)) {
      insights.push({ type: 'warning', icon: '⏱️', text: `Ritmo acelerado: Llevas el ${Math.round(monthProgress*100)}% del mes, pero ya gastaste el ${Math.round(expensePace*100)}% de tus ingresos.` });
    }
    else if (savingsRate >= 20 && incomeMonth > 0) {
      insights.push({ type: 'success', icon: '🌟', text: `¡Salud Financiera Óptima! Estás reteniendo el ${savingsRate.toFixed(1)}% de tus ingresos este mes.` });
    }

    if (topExpenses.length > 0) {
      const highest = topExpenses[0];
      const percent = Math.round((highest.amount / expenseMonth) * 100);
      if (percent >= 50) {
        insights.push({ type: 'warning', icon: '🎯', text: `Atención: El ${percent}% de tus salidas van solo a "${highest.label}". Intenta diversificar.` });
      }
    }

    if (recurringRatio > 60 && expenseMonth > 0) {
      insights.push({ type: 'warning', icon: '🔁', text: `Tus compromisos fijos representan el ${recurringRatio.toFixed(0)}% de tus gastos. Tu margen de maniobra es bajo.` });
    }

    if (insights.length === 0) {
      if (expenseMonth > 0) {
         insights.push({ type: 'info', icon: '💡', text: `Flujo estable. "${topExpenses[0]?.label}" es tu categoría dominante hoy.` });
      } else {
         insights.push({ type: 'success', icon: '🌱', text: `Mes en blanco. ¡Registra tus movimientos para activar la IA financiera!` });
      }
    }

    const priority: any = { danger: 3, warning: 2, success: 1, info: 0 };
    insights.sort((a, b) => priority[b.type] - priority[a.type]);
    const smartInsight = insights[0];

    return { 
      cashBalance: cash, goalBalance: savedInGoals, pocketBalance: savedInPockets,
      debtBalance: pendingDebts, netWorth: cash + savedInGoals + savedInPockets - pendingDebts, 
      incomeMonth, expenseMonth, topExpenses, smartInsight 
    };
  }, [transactions, metas, currentMonthNum, currentYearNum, currentDate]);

  const currentCategories = useMemo(() => {
    const base = txModalType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const custom = customCategories.filter(c => c.type === (txModalType === 'WITHDRAW_POCKET' ? 'EXPENSE' : txModalType));
    return [...base, ...custom];
  }, [txModalType, customCategories]);

  const filteredTransactions = useMemo(() => {
    if (historyFilter === "ALL") return transactions;
    if (historyFilter === "INTERNAL") return transactions.filter(t => ['SAVE_GOAL', 'PAY_DEBT', 'GOAL_REDEMPTION', 'FUND_POCKET', 'WITHDRAW_POCKET'].includes(t.type));
    return transactions.filter(t => t.type === historyFilter);
  }, [transactions, historyFilter]);

  const goalsList = metas.filter(m => m.type === "GOAL");
  const debtsList = metas.filter(m => m.type === "DEBT");

  const formatCurrency = (val: number) => showBalances ? `$${val.toLocaleString('es-CO')}` : '••••••';

  const isSpecialTx = ['SAVE_GOAL', 'PAY_DEBT', 'FUND_POCKET', 'WITHDRAW_POCKET'].includes(txModalType as string);
  const showCategorySelector = ['INCOME', 'EXPENSE', 'WITHDRAW_POCKET'].includes(txModalType as string);

  const openModal = useCallback((type: any, defaultCat: string = "", target: any = null) => {
    hapticLight(); setAmount(""); setDesc(""); setIsRecurring(false); setRecurringDay(new Date().getDate());
    setShowAddCategory(false); setActiveTarget(target); setSelectedCategory(defaultCat); setTxModalType(type);
  }, [hapticLight]);

  // ==========================================
  // ⚡ ACCIONES CORE DE ESCRITURA
  // ==========================================
  const handleSaveCustomCategory = async () => {
    if (!newCatName || !user || !txModalType) return hapticError();
    const catTypeToSave = txModalType === 'WITHDRAW_POCKET' ? 'EXPENSE' : txModalType;
    try {
      const newCatRef = doc(collection(db, "wallet_categories"));
      await setDoc(newCatRef, {
        userId: user.id, id: newCatRef.id, type: catTypeToSave, icon: newCatIcon || "📌", 
        label: newCatName.trim(), timestamp: serverTimestamp()
      });
      hapticSuccess();
      setNewCatName(""); setNewCatIcon("📌"); setShowAddCategory(false); setSelectedCategory(newCatRef.id);
    } catch (e) { hapticError(); }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0 || !user) {
      hapticError(); alert("Por favor ingresa un monto válido mayor a cero."); return;
    }
    
    setIsSaving(true);
    const categoryData = currentCategories.find(c => c.id === selectedCategory);

    if (isSpecialTx && activeTarget) {
      if ((txModalType === 'SAVE_GOAL' || txModalType === 'PAY_DEBT')) {
        const pending = activeTarget.targetAmount - activeTarget.currentAmount;
        if (numAmount > pending) {
          hapticWarning();
          if (!confirm(`El abono supera el saldo pendiente ($${pending.toLocaleString('es-CO')}). ¿Guardar de todas formas?`)) {
            setIsSaving(false); return;
          }
        }
      }
      if (txModalType === 'WITHDRAW_POCKET') {
        if (numAmount > activeTarget.currentAmount) {
          hapticWarning();
          alert(`No puedes retirar más del saldo que hay en el bolsillo ($${activeTarget.currentAmount.toLocaleString('es-CO')}).`);
          setIsSaving(false); return;
        }
      }
    }

    const batch = writeBatch(db);
    const txRef = doc(collection(db, "wallet_transactions"));

    let txCat = categoryData?.label || "Otros";
    let txIcon = categoryData?.icon || "💵";
    
    if (isSpecialTx) {
      if (txModalType !== 'WITHDRAW_POCKET') txIcon = activeTarget.icon;
      if (txModalType === 'SAVE_GOAL') txCat = `Ahorro: ${activeTarget.title}`;
      if (txModalType === 'PAY_DEBT') txCat = `Abono: ${activeTarget.title}`;
      if (txModalType === 'FUND_POCKET') txCat = `Ingreso a Bolsillo: ${activeTarget.title}`;
    }

    try {
      batch.set(txRef, {
        userId: user.id, type: txModalType, amount: numAmount,
        category: txCat, icon: txIcon, description: desc.trim(), isRecurring: isRecurring, 
        timestamp: serverTimestamp(), targetId: isSpecialTx ? activeTarget.id : null, 
        targetName: isSpecialTx ? activeTarget.title : null, deleted: false
      });

      if (isRecurring && showCategorySelector) {
        const recurringRef = doc(collection(db, "wallet_recurring"));
        batch.set(recurringRef, {
          userId: user.id, type: txModalType, amount: numAmount, category: txCat,
          icon: txIcon, description: desc.trim() || 'Suscripción Creada Manualmente',
          chargeDay: recurringDay, targetId: isSpecialTx ? activeTarget.id : null,
          targetName: isSpecialTx ? activeTarget.title : null, active: true,
          lastProcessedMonth: `${currentYearNum}-${currentMonthNum}`, createdAt: serverTimestamp()
        });
      }

      if (isSpecialTx && activeTarget) {
        const goalRef = doc(db, "wallet_goals", activeTarget.id);
        const amountChange = txModalType === 'WITHDRAW_POCKET' ? -numAmount : numAmount;
        batch.update(goalRef, { currentAmount: increment(amountChange) });
      }
      
      await batch.commit(); hapticSuccess(); setTxModalType(null);
    } catch (e) { hapticError(); alert("Error contable de red."); } finally { setIsSaving(false); }
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    let numTarget = metaType === "POCKET" ? 0 : parseFloat(metaTarget);
    
    if ((metaType !== "POCKET" && (isNaN(numTarget) || numTarget <= 0)) || !metaTitle || !user) return hapticError();
    setIsSaving(true);
    try {
      await addDoc(collection(db, "wallet_goals"), {
        userId: user.id, title: metaTitle.trim(), targetAmount: numTarget, currentAmount: 0, 
        type: metaType, icon: metaType === "GOAL" ? "🎯" : metaType === "POCKET" ? "👛" : "💸", 
        color: metaType === "POCKET" ? pocketColor : "zinc", order: localPockets.length, timestamp: serverTimestamp()
      });
      hapticSuccess(); setShowMetaModal(false); setMetaTitle(""); setMetaTarget(""); setPocketColor("zinc");
    } catch (e) { hapticError(); } finally { setIsSaving(false); }
  };

  // Función para reordenar en Firebase
  const handleReorderPockets = async (newOrder: any[]) => {
    setLocalPockets(newOrder); // Actualización optimista
    hapticLight();
    const batch = writeBatch(db);
    newOrder.forEach((pocket, index) => {
      const ref = doc(db, "wallet_goals", pocket.id);
      batch.update(ref, { order: index });
    });
    try { await batch.commit(); } catch (e) { console.error("Error reordenando"); }
  };

  const handleLiquidateGoal = async (goal: any) => {
    if (!user) return;
    const isGoal = goal.type === "GOAL";
    const isPocket = goal.type === "POCKET";
    
    let confirmMsg = "";
    if (isGoal) confirmMsg = `¿Liquidar meta? Los ahorros ($${goal.currentAmount.toLocaleString('es-CO')}) se devolverán a tu Saldo Disponible.`;
    else if (isPocket) confirmMsg = `¿Eliminar bolsillo? El saldo ($${goal.currentAmount.toLocaleString('es-CO')}) se devolverá a tu Saldo Disponible.`;
    else confirmMsg = `¿Eliminar registro de esta Deuda permanentemente?`;
      
    if (!confirm(confirmMsg)) return;
    hapticWarning();

    const batch = writeBatch(db);
    try {
      if ((isGoal || isPocket) && goal.currentAmount > 0) {
        const txRef = doc(collection(db, "wallet_transactions"));
        batch.set(txRef, {
          userId: user.id, type: "GOAL_REDEMPTION", amount: goal.currentAmount,
          category: isPocket ? `Cierre de Bolsillo: ${goal.title}` : `Retiro de Meta: ${goal.title}`, 
          icon: isPocket ? "👛" : "🎉", description: "Liquidación y retorno de dinero",
          timestamp: serverTimestamp(), deleted: false
        });
      }
      
      const goalRef = doc(db, "wallet_goals", goal.id);
      batch.delete(goalRef);
      
      await batch.commit();
      hapticSuccess();
      if(isGoal && goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0) {
        alert("¡Felicidades! Meta cumplida y dinero liberado a tu cuenta.");
      }
    } catch (e) { hapticError(); alert("Fallo al procesar la liquidación."); }
  };

  const deleteTransaction = async (tx: any) => {
    if (!user || !tx.id) return;
    
    const txTime = tx.timestamp ? tx.timestamp.toMillis() : Date.now();
    const hoursSinceCreation = (Date.now() - txTime) / (1000 * 60 * 60);
    
    if (hoursSinceCreation > 24) {
      hapticError(); alert("Operación denegada. Registros mayores a 24 horas están sellados por seguridad contable."); return;
    }

    if (!confirm("¿Cancelar movimiento? El impacto en tus saldos se revertirá.")) return;
    hapticWarning();

    const batch = writeBatch(db);
    try {
      if (['SAVE_GOAL', 'PAY_DEBT', 'FUND_POCKET', 'WITHDRAW_POCKET'].includes(tx.type) && tx.targetId) {
        const targetGoal = metas.find(m => m.id === tx.targetId);
        if(targetGoal) {
          const goalRef = doc(db, "wallet_goals", tx.targetId);
          const amountChange = tx.type === 'WITHDRAW_POCKET' ? tx.amount : -tx.amount;
          batch.update(goalRef, { currentAmount: increment(amountChange) });
        }
      }
      
      const txRef = doc(db, "wallet_transactions", tx.id);
      batch.update(txRef, { deleted: true, deletedAt: serverTimestamp(), deleteReason: "Reversión de usuario" });
      
      await batch.commit();
      setExpandedTxId(null); hapticSuccess();
    } catch (e) { hapticError(); alert("No se pudo revertir."); }
  };

  const previewPayroll = async () => {
    if (!user) return;
    let grandTotal = 0;
    const qShifts = query(collection(db, "shifts"), where("userId", "==", user.id), where("month", "==", importMonth), where("year", "==", currentYearNum));
    const snapShifts = await getDocs(qShifts);
    snapShifts.forEach(doc => {
      const data = doc.data();
      if(!data.date) return;
      const dayNumber = parseInt(data.date.split('-')[2], 10);
      const shiftQ = dayNumber <= 15 ? 1 : 2;
      if (shiftQ === importQuincena) grandTotal += (Number(data.netPay) || 0);
    });

    const qBV = query(collection(db, "bigVentas"), where("userId", "==", user.id), where("month", "==", importMonth), where("quincena", "==", importQuincena), where("year", "==", currentYearNum));
    const snapBV = await getDocs(qBV);
    snapBV.forEach(doc => { grandTotal += (Number(doc.data().value) || 0) * 0.92; });

    const qPrima = query(collection(db, "primas"), where("userId", "==", user.id), where("month", "==", importMonth), where("quincena", "==", importQuincena), where("year", "==", currentYearNum));
    const snapPrima = await getDocs(qPrima);
    snapPrima.forEach(doc => { grandTotal += (Number(doc.data().value) || 0); });

    const qED = query(collection(db, "extraDeductions"), where("userId", "==", user.id), where("month", "==", importMonth), where("quincena", "==", importQuincena), where("year", "==", currentYearNum));
    const snapED = await getDocs(qED);
    snapED.forEach(doc => { grandTotal -= (Number(doc.data().value) || 0); });

    setPayrollPreview(grandTotal > 0 ? grandTotal : 0);
  };

  const importFromPayroll = async () => {
    if (!user || payrollPreview === null || payrollPreview <= 0) return hapticError();
    setIsSaving(true); hapticLight();

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

  const getModalTitle = () => {
    switch(txModalType) {
        case 'SAVE_GOAL': return `Ahorrar en ${activeTarget?.title}`;
        case 'PAY_DEBT': return `Pagar ${activeTarget?.title}`;
        case 'FUND_POCKET': return `Ingresar a ${activeTarget?.title}`;
        case 'WITHDRAW_POCKET': return `Gastar desde ${activeTarget?.title}`;
        case 'INCOME': return 'Registrar Ingreso';
        case 'EXPENSE': return 'Registrar Gasto';
        default: return '';
    }
  }

  const insightStyles = {
    danger: "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-300",
    warning: "bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 text-orange-800 dark:text-orange-300",
    success: "bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900/30 text-green-800 dark:text-green-300",
    info: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-blue-800 dark:text-blue-300"
  }[analytics.smartInsight.type as 'danger'|'warning'|'success'|'info'];

  const closeTxModal = () => setTxModalType(null);

  return (
    <main className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors text-zinc-900 dark:text-zinc-100 font-sans">
      <Navbar />
      
      <div className="flex-1 pt-6 px-4 max-w-2xl w-full mx-auto space-y-6 pb-12">
        
        <div className="flex items-center -mb-2">
          <Link 
            href="/servicios" 
            onClick={() => hapticLight()} 
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-xl transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Servicios
          </Link>
        </div>

        {/* ========================================================= */}
        {/* 1. DASHBOARD ESTRATÉGICO */}
        {/* ========================================================= */}
        <div id="wallet-dashboard" className="space-y-3 scroll-mt-24">
          <div className={`p-6 rounded-[2rem] bg-gradient-to-br ${themeColor === 'blue' ? 'from-blue-600 to-blue-500' : 'from-red-600 to-red-500'} text-white shadow-xl relative overflow-hidden`}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex justify-between items-start relative z-10">
              <div className="w-full">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 flex items-center gap-2">
                  Cash Disponible 
                  <button onClick={() => setShowBalances(!showBalances)} className="bg-black/10 hover:bg-black/20 p-1.5 rounded-md backdrop-blur-md transition-colors">{showBalances ? '👁️' : '🙈'}</button>
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mt-1 truncate w-full">
                  {formatCurrency(analytics.cashBalance)}
                </h2>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6 relative z-10">
              <button onClick={() => openModal("INCOME", "nomina")} className="flex-1 bg-white/20 hover:bg-white/30 py-3.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider backdrop-blur-sm transition-all active:scale-95">+ Ingreso</button>
              <button onClick={() => openModal("EXPENSE", "comida")} className="flex-1 bg-black/20 hover:bg-black/30 py-3.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider backdrop-blur-sm transition-all active:scale-95">- Gasto</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-center transition-all overflow-hidden">
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-zinc-400">Patrimonio Neto</span>
              <span className="text-sm sm:text-lg font-black mt-1 truncate">{formatCurrency(analytics.netWorth)}</span>
            </div>
            <div className="grid grid-rows-3 gap-2">
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-2.5 rounded-2xl flex justify-between items-center overflow-hidden">
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500">Bolsillos</span>
                <span className="text-[10px] sm:text-xs font-black text-blue-700 dark:text-blue-400 truncate pl-2">{formatCurrency(analytics.pocketBalance)}</span>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 p-2.5 rounded-2xl flex justify-between items-center overflow-hidden">
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-green-600 dark:text-green-500">Metas</span>
                <span className="text-[10px] sm:text-xs font-black text-green-700 dark:text-green-400 truncate pl-2">{formatCurrency(analytics.goalBalance)}</span>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 p-2.5 rounded-2xl flex justify-between items-center overflow-hidden">
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-500">Deudas</span>
                <span className="text-[10px] sm:text-xs font-black text-red-700 dark:text-red-400 truncate pl-2">{showBalances ? `-${formatCurrency(analytics.debtBalance)}` : '••••••'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. CEREBRO FINANCIERO */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 opacity-5 blur-3xl rounded-full pointer-events-none"></div>

          <header className="flex justify-between items-start sm:items-end relative z-10 flex-col sm:flex-row gap-2 sm:gap-0">
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white">Flujo del Mes</h3>
              <p className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Asesor en tiempo real</p>
            </div>
            <button id="wallet-import-btn" onClick={() => { setShowImportModal(true); setPayrollPreview(null); }} className={`w-full sm:w-auto text-[10px] font-black uppercase bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-2 sm:py-1.5 rounded-lg transition-colors shadow-sm ${activeText} active:scale-95`}>
              📥 Traer Nómina
            </button>
          </header>

          <div className={`border p-3.5 rounded-2xl flex items-start gap-3 relative z-10 transition-colors ${insightStyles}`}>
            <span className="text-xl shrink-0 leading-none">{analytics.smartInsight.icon}</span>
            <p className="text-[10px] sm:text-[11px] font-bold leading-relaxed">{analytics.smartInsight.text}</p>
          </div>

          {showBalances && (
            <div className="space-y-1.5 relative z-10 mt-2">
              <div className="flex justify-between text-[10px] sm:text-[11px] font-black">
                <span className="text-green-500 truncate pr-2">In: ${analytics.incomeMonth.toLocaleString('es-CO')}</span>
                <span className="text-red-500 truncate pl-2">Out: ${analytics.expenseMonth.toLocaleString('es-CO')}</span>
              </div>
              <div className="w-full h-2.5 flex rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-inner">
                <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${analytics.incomeMonth === 0 ? 0 : (analytics.incomeMonth / (analytics.incomeMonth + analytics.expenseMonth)) * 100}%` }}></div>
                <div className="bg-red-500 h-full transition-all duration-1000" style={{ width: `${analytics.expenseMonth === 0 ? 0 : (analytics.expenseMonth / (analytics.incomeMonth + analytics.expenseMonth)) * 100}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. BOLSILLOS (POCKETS) DRAG & DROP Y COLORES */}
        {/* ========================================================= */}
        <section id="wallet-pockets" className="space-y-3 pt-2 scroll-mt-24">
          <div className="flex flex-row justify-between items-center px-2 gap-2">
            <div className="shrink-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Bolsillos 👛</h3>
              <p className="text-[8px] text-zinc-400 mt-0.5 hidden sm:block">Manten presionado para reordenar</p>
            </div>
            <button onClick={() => { setMetaType("POCKET"); setShowMetaModal(true); setPocketColor("zinc"); }} className="text-[9px] sm:text-[10px] font-black uppercase text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 rounded-lg active:scale-95 transition-all truncate">
              + Crear Bolsillo
            </button>
          </div>
          
          {localPockets.length === 0 ? (
            <div className="bg-transparent border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-[10px] sm:text-xs text-zinc-400 font-bold">No tienes bolsillos. Úsalos para separar efectivo, Nequi o ahorros libres.</p>
            </div>
          ) : (
            <Reorder.Group axis="y" values={localPockets} onReorder={handleReorderPockets} className="flex flex-col gap-3">
              {localPockets.map(pocket => {
                const colorConfig = POCKET_COLORS.find(c => c.id === (pocket.color || 'zinc')) || POCKET_COLORS[0];
                return (
                  <Reorder.Item 
                    key={pocket.id} 
                    value={pocket} 
                    className={`p-4 rounded-2xl border shadow-sm relative overflow-hidden transition-all cursor-grab active:cursor-grabbing hover:shadow-md ${colorConfig.bg} ${colorConfig.border}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm font-bold flex items-center gap-2 truncate pr-2 ${colorConfig.text}`}>
                        <span className="text-xl shrink-0">{pocket.icon}</span> <span className="truncate">{pocket.title}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm sm:text-base font-black ${colorConfig.text}`}>
                          {formatCurrency(pocket.currentAmount)}
                        </span>
                        <span className="text-black/10 dark:text-white/10 px-1 hidden sm:block">⠿</span>
                      </div>
                    </div>

                    <div className="flex flex-nowrap gap-2 items-center mt-3 pt-3 border-t border-black/5 dark:border-white/5 w-full">
                      <button onClick={() => openModal("FUND_POCKET", "", pocket)} className="flex-1 min-w-0 text-[9px] sm:text-[10px] font-black text-green-700 bg-green-500/10 py-2.5 rounded-lg hover:bg-green-500/20 transition-colors shadow-sm active:scale-95 px-1 truncate">
                        + AGREGAR
                      </button>
                      <button onClick={() => openModal("WITHDRAW_POCKET", "comida", pocket)} className="flex-1 min-w-0 text-[9px] sm:text-[10px] font-black text-red-700 dark:text-red-400 bg-red-500/10 py-2.5 rounded-lg hover:bg-red-500/20 transition-colors shadow-sm active:scale-95 px-1 truncate">
                        - GASTAR
                      </button>
                      <button onClick={() => handleLiquidateGoal(pocket)} className="w-10 shrink-0 flex items-center justify-center text-zinc-500 bg-black/5 dark:bg-white/5 hover:text-red-500 hover:bg-red-500/20 rounded-lg transition-colors py-2.5 h-[34px] sm:h-[38px]">
                        ✕
                      </button>
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </section>


        {/* ========================================================= */}
        {/* 4. METAS (GOALS) */}
        {/* ========================================================= */}
        <section id="wallet-goals" className="space-y-3 pt-2 scroll-mt-24">
          <div className="flex flex-row justify-between items-center px-2 gap-2">
            <div className="shrink-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Metas 🎯</h3>
            </div>
            <button onClick={() => { setMetaType("GOAL"); setShowMetaModal(true); }} className="text-[9px] sm:text-[10px] font-black uppercase text-green-500 hover:text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-lg active:scale-95 transition-all truncate">
              + Crear Meta
            </button>
          </div>
          
          {goalsList.length === 0 ? (
            <div className="bg-transparent border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-[10px] sm:text-xs text-zinc-400 font-bold">No tienes metas con objetivo. Úsalas para compras futuras.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {goalsList.map(meta => {
                const percentage = Math.min((meta.currentAmount / meta.targetAmount) * 100, 100);
                const isCompleted = percentage >= 100;
                return (
                  <div key={meta.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                    <div className="flex justify-between mb-3 items-center relative z-10 gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate flex items-center gap-2">
                        <span className="text-base shrink-0">{meta.icon}</span> <span className="truncate">{meta.title}</span>
                      </span>
                      <div className="flex gap-2 items-center shrink-0">
                        {!isCompleted ? (
                          <button onClick={() => openModal("SAVE_GOAL", "", meta)} className="text-[8px] sm:text-[9px] font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors shadow-sm active:scale-95">
                            ABONAR
                          </button>
                        ) : (
                          <span className="text-[8px] sm:text-[9px] font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md">✨ CUMPLIDA</span>
                        )}
                        <button onClick={() => handleLiquidateGoal(meta)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative z-10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className="h-full bg-green-500 rounded-full" />
                    </div>
                    <div className="flex justify-between mt-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider relative z-10">
                      <span className="text-green-500">{formatCurrency(meta.currentAmount)}</span>
                      <span className="text-zinc-400 truncate pl-2">Meta: {formatCurrency(meta.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* 5. DEUDAS */}
        {/* ========================================================= */}
        <section id="wallet-debts" className="space-y-3 pt-2 scroll-mt-24">
          <div className="flex flex-row justify-between items-center px-2 gap-2">
            <div className="shrink-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Obligaciones 💸</h3>
            </div>
            <button onClick={() => { setMetaType("DEBT"); setShowMetaModal(true); }} className="text-[9px] sm:text-[10px] font-black uppercase text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg active:scale-95 transition-all truncate">
              + Registrar Deuda
            </button>
          </div>
          
          {debtsList.length === 0 ? (
            <div className="bg-transparent border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-[10px] sm:text-xs text-zinc-400 font-bold">Excelente, no tienes deudas pendientes.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {debtsList.map(meta => {
                const percentage = Math.min((meta.currentAmount / meta.targetAmount) * 100, 100);
                const isCompleted = percentage >= 100;
                return (
                  <div key={meta.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-2xl border transition-all shadow-sm ${isCompleted ? 'border-zinc-200 dark:border-zinc-800 opacity-60' : 'border-red-100 dark:border-red-900/30'}`}>
                    <div className="flex justify-between mb-3 items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate flex items-center gap-2">
                        <span className="text-base shrink-0">{meta.icon}</span> <span className="truncate">{meta.title}</span>
                      </span>
                      <div className="flex gap-2 items-center shrink-0">
                        {!isCompleted ? (
                          <button onClick={() => openModal("PAY_DEBT", "", meta)} className="text-[8px] sm:text-[9px] font-black text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md hover:bg-red-100 transition-colors shadow-sm active:scale-95">
                            PAGAR
                          </button>
                        ) : (
                          <span className="text-[8px] sm:text-[9px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 rounded-md">✓ SALDADA</span>
                        )}
                        <button onClick={() => handleLiquidateGoal(meta)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={`h-full rounded-full ${isCompleted ? 'bg-zinc-400' : 'bg-red-500'}`} />
                    </div>
                    <div className="flex justify-between mt-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                      <span className={isCompleted ? 'text-zinc-500' : 'text-red-500'}>Abonado: {formatCurrency(meta.currentAmount)}</span>
                      <span className="text-zinc-400 truncate pl-2">Deuda: {formatCurrency(meta.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* 6. HISTORIAL BLINDADO (ROJOS/VERDES/AZULES) */}
        {/* ========================================================= */}
        <section id="wallet-ledger" className="space-y-3 pb-8 pt-4 scroll-mt-24">
          <div className="flex justify-between items-center px-2 flex-wrap gap-2">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Libro Contable</h3>
              <p className="text-[8px] text-zinc-400 mt-0.5">Auditoría con bloqueo 24h</p>
            </div>
            
            <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value as any)} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 py-2 px-3 rounded-xl outline-none cursor-pointer max-w-[140px] sm:max-w-none">
              <option value="ALL">Todo</option>
              <option value="INCOME">Ingresos</option>
              <option value="EXPENSE">Gastos</option>
              <option value="INTERNAL">Internos</option>
            </select>
          </div>
          
          <div className="space-y-2">
            {filteredTransactions.slice(0, showHistoryLimit).map(tx => {
              const isExpanded = expandedTxId === tx.id;
              const txTime = tx.timestamp ? tx.timestamp.toMillis() : Date.now();
              const hoursSinceCreation = (Date.now() - txTime) / (1000 * 60 * 60);
              const isDeletable = hoursSinceCreation <= 24;

              // 🎨 LÓGICA DE COLORES DEL HISTORIAL
              const isIncome = tx.type === 'INCOME' || tx.type === 'GOAL_REDEMPTION';
              const isExpense = tx.type === 'EXPENSE' || tx.type === 'WITHDRAW_POCKET';
              const isTransfer = tx.type === 'SAVE_GOAL' || tx.type === 'PAY_DEBT' || tx.type === 'FUND_POCKET';
              
              const amountColor = isIncome ? 'text-green-500' : isExpense ? 'text-red-500' : isTransfer ? 'text-blue-500' : 'text-zinc-900 dark:text-white';
              
              return (
                <div key={tx.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
                  <button onClick={() => { hapticLight(); setExpandedTxId(isExpanded ? null : tx.id); }} className="w-full flex justify-between items-center p-3 sm:p-4 outline-none">
                    <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg shrink-0 ${isTransfer ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                        {tx.icon}
                      </div>
                      <div className="text-left truncate pr-2">
                        <p className="text-[11px] sm:text-xs font-bold text-zinc-900 dark:text-white truncate flex items-center flex-wrap gap-1">
                          {tx.category} 
                          {tx.type === 'WITHDRAW_POCKET' && <span className="text-[7px] sm:text-[8px] bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-1.5 py-0.5 rounded font-black tracking-widest">{tx.targetName?.toUpperCase() || 'BOLSILLO'}</span>}
                          {tx.isAutoGenerated && <span className="text-[7px] sm:text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded">🤖 AUTO</span>}
                          {tx.isRecurring && !tx.isAutoGenerated && <span className="text-[7px] sm:text-[8px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded">FIJO</span>}
                        </p>
                        <p className="text-[8px] sm:text-[9px] text-zinc-400 mt-0.5 font-bold uppercase tracking-wider">
                          {tx.timestamp ? tx.timestamp.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs sm:text-sm font-black shrink-0 pl-2 ${amountColor}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </button>

                  <AnimatePresence mode="wait">
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="bg-zinc-50/50 dark:bg-black/20 border-t border-zinc-100 dark:border-zinc-800 p-3 sm:p-4 space-y-3 sm:space-y-4">
                        {tx.description ? (
                          <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 dark:text-zinc-400 italic px-1">📝 "{tx.description}"</p>
                        ) : (
                          <p className="text-[10px] sm:text-[11px] font-medium text-zinc-400 dark:text-zinc-600 italic px-1">Sin detalles adicionales.</p>
                        )}
                        
                        {isDeletable ? (
                          <button onClick={() => deleteTransaction(tx)} className="w-full py-3 sm:py-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-red-100 transition-colors shadow-sm">
                            Deshacer Movimiento
                          </button>
                        ) : (
                          <div className="w-full py-2.5 sm:py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 font-black text-[9px] sm:text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed border border-dashed border-zinc-300 dark:border-zinc-700">
                            🔒 Registro Sellado (+24h)
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
      {/* 🟢 MODAL: NUEVA TRANSACCIÓN (RESPONSIVE & ANTI-PARPADEO) */}
      {/* ============================================================== */}
      <AnimatePresence mode="wait">
        {txModalType && (
          <motion.div 
            key="tx-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div 
              key="tx-modal-content"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} 
              transition={{ type: "spring", damping: 25, stiffness: 300 }} 
              className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-5 sm:p-6 space-y-5 shadow-2xl pb-safe flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3 sm:pb-4 shrink-0">
                <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white truncate pr-2">
                  {getModalTitle()}
                </h3>
                <button onClick={closeTxModal} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center shrink-0">✕</button>
              </div>

              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-5 pr-1">
                <form id="tx-form" onSubmit={handleSaveTransaction} className="space-y-5">
                  <div className="relative flex items-center justify-center py-2">
                    <span className="absolute left-2 sm:left-4 text-2xl sm:text-3xl font-black text-zinc-300 dark:text-zinc-700">$</span>
                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full text-4xl sm:text-5xl font-black text-center bg-transparent outline-none py-2 text-zinc-900 dark:text-white" autoFocus />
                  </div>

                  {showCategorySelector && (
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1 flex justify-between">
                        <span>Categoría</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 p-1">
                        {currentCategories.map(cat => (
                          <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.id)} className={`px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition-all flex items-center gap-1 sm:gap-1.5 ${selectedCategory === cat.id ? `${activeBg} text-white border-transparent shadow-md scale-105` : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                            <span>{cat.icon}</span> {cat.label}
                          </button>
                        ))}
                        
                        <button type="button" onClick={() => setShowAddCategory(!showAddCategory)} className={`px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase border border-dashed transition-colors flex items-center gap-1 ${showAddCategory ? 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-800 dark:text-zinc-200' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'}`}>
                          {showAddCategory ? '✕ Cancelar' : '+ Nueva'}
                        </button>
                      </div>
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {showAddCategory && showCategorySelector && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-2 overflow-hidden bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} placeholder="🎨" className="w-10 sm:w-12 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center text-base sm:text-lg outline-none focus:border-blue-500 shrink-0" maxLength={2} />
                        <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nombre..." className="flex-1 min-w-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 sm:px-4 text-[11px] sm:text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-500" />
                        <button type="button" onClick={handleSaveCustomCategory} disabled={!newCatName} className={`px-3 sm:px-4 rounded-xl font-black text-white transition-opacity disabled:opacity-50 shrink-0 ${activeBg}`}>✓</button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Detalles Adicionales</label>
                      <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Opcional: Descripción..." className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl text-[11px] sm:text-xs font-bold outline-none text-zinc-900 dark:text-white" />
                    </div>
                    
                    {showCategorySelector && (
                      <div className="space-y-2">
                        <label className={`flex items-center gap-3 p-3 border rounded-2xl cursor-pointer transition-colors ${isRecurring ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800'}`}>
                          <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-4 h-4 sm:w-5 sm:h-5 rounded-md border-zinc-300 text-blue-600 focus:ring-blue-500 shrink-0" />
                          <div>
                            <p className={`text-[11px] sm:text-xs font-bold ${isRecurring ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>Suscripción Automática (Fija)</p>
                            <p className="text-[8px] sm:text-[9px] text-zinc-400 font-medium">Se descontará de tu saldo cada mes.</p>
                          </div>
                        </label>
                        
                        <AnimatePresence mode="wait">
                          {isRecurring && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                               <div className="flex items-center justify-between p-3 mt-1 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800/50 rounded-2xl shadow-sm">
                                  <span className="text-[10px] sm:text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Día de cobro en el mes:</span>
                                  <input type="number" min="1" max="31" value={recurringDay} onChange={e => setRecurringDay(parseInt(e.target.value) || 1)} className="w-16 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 py-1.5 px-2 rounded-lg text-center text-xs font-black text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500" />
                               </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </form>
              </div>

              <div className="pt-2 shrink-0 border-t border-zinc-100 dark:border-zinc-800 mt-2">
                <button type="submit" form="tx-form" disabled={isSaving || !amount || (showCategorySelector && !selectedCategory)} className={`w-full py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${txModalType === 'WITHDRAW_POCKET' ? 'bg-red-600' : activeBg}`}>
                  {isSaving ? 'Registrando...' : 'Confirmar Movimiento'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 🎯 MODAL: NUEVA META, DEUDA O BOLSILLO */}
      {/* ============================================================== */}
      <AnimatePresence mode="wait">
        {showMetaModal && (
          <motion.div 
            key="meta-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div 
              key="meta-modal-content"
              layout initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} 
              transition={{ type: "spring", damping: 25, stiffness: 300 }} 
              className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2rem] p-5 sm:p-6 space-y-5 shadow-2xl border border-zinc-100 dark:border-zinc-800 pb-safe"
            >
              
              <div className="flex gap-1.5 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto hide-scrollbar">
                <button onClick={() => setMetaType("POCKET")} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all ${metaType === "POCKET" ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-500'}`}>👛 Bolsillo</button>
                <button onClick={() => setMetaType("GOAL")} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all ${metaType === "GOAL" ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-500'}`}>🎯 Meta</button>
                <button onClick={() => setMetaType("DEBT")} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all ${metaType === "DEBT" ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-500'}`}>💸 Deuda</button>
              </div>

              <form onSubmit={handleSaveMeta} className="space-y-4">
                <motion.div layout className="space-y-1.5">
                  <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Título del Objetivo</label>
                  <input autoComplete="off" name="meta-title-no-autofill" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={metaType === "POCKET" ? "Ej: Efectivo, Nequi..." : "Ej: Enganche moto..."} className="w-full p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] sm:text-xs font-bold outline-none text-zinc-900 dark:text-white focus:border-blue-500 transition-colors" />
                </motion.div>

                {metaType === "POCKET" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pt-1">
                    <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Color del Bolsillo</label>
                    <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      {POCKET_COLORS.map(c => (
                        <button key={c.id} type="button" onClick={() => setPocketColor(c.id)} className={`w-8 h-8 rounded-full ${c.bg} ${c.border} border-2 transition-all ${pocketColor === c.id ? 'scale-125 shadow-md border-zinc-400 dark:border-zinc-500' : 'opacity-60 hover:opacity-100'}`} />
                      ))}
                    </div>
                  </motion.div>
                )}
                
                <AnimatePresence mode="popLayout">
                  {metaType !== "POCKET" && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: "auto" }} 
                      exit={{ opacity: 0, height: 0 }} 
                      transition={{ opacity: { duration: 0.2 } }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 pt-2">
                        <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Monto a alcanzar</label>
                        <div className="relative">
                          <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 font-black text-zinc-400">$</span>
                          <input autoComplete="off" name="meta-target-no-autofill" type="number" step="0.01" value={metaTarget} onChange={e => setMetaTarget(e.target.value)} placeholder="0" className="w-full p-3.5 sm:p-4 pl-7 sm:pl-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-black outline-none text-zinc-900 dark:text-white focus:border-blue-500 transition-colors" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div layout className="pt-2 sm:pt-4 space-y-2.5 sm:space-y-3 flex flex-col">
                  <button type="submit" disabled={isSaving || !metaTitle || (metaType !== 'POCKET' && !metaTarget)} className={`w-full py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${metaType === "POCKET" ? 'bg-blue-600' : metaType === "GOAL" ? 'bg-green-600' : 'bg-red-600'}`}>
                    Crear {metaType === "POCKET" ? 'Bolsillo' : 'Objetivo'}
                  </button>
                  <button type="button" onClick={() => setShowMetaModal(false)} className="w-full py-2.5 sm:py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                    Cancelar
                  </button>
                </motion.div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 🤖 MODAL: IMPORTADOR DE NÓMINA SEGURO */}
      {/* ============================================================== */}
      <AnimatePresence mode="wait">
        {showImportModal && (
          <motion.div 
            key="import-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div 
              key="import-modal-content"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} 
              transition={{ type: "spring", damping: 25, stiffness: 300 }} 
              className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2rem] p-5 sm:p-6 space-y-5 shadow-2xl border border-zinc-100 dark:border-zinc-800 pb-safe"
            >
              <div className="text-center space-y-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center text-xl sm:text-2xl mx-auto mb-2 sm:mb-3">📥</div>
                <h3 className="font-black text-lg sm:text-xl text-zinc-900 dark:text-white">Importar Nómina</h3>
                <p className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2 sm:px-4">Convierte los turnos en saldo disponible.</p>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Mes del turno</label>
                  <select value={importMonth} onChange={e => { setImportMonth(e.target.value); setPayrollPreview(null); }} className="w-full p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] sm:text-xs font-black uppercase tracking-wider outline-none text-center text-zinc-900 dark:text-white appearance-none">
                    {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Quincena a liquidar</label>
                  <div className="flex gap-2">
                    <button onClick={() => { setImportQuincena(1); setPayrollPreview(null); }} className={`flex-1 py-3 sm:py-3.5 rounded-xl font-black uppercase text-[10px] sm:text-xs tracking-widest border transition-all ${importQuincena === 1 ? `${activeBg} text-white shadow-md border-transparent` : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>Q1 (1-15)</button>
                    <button onClick={() => { setImportQuincena(2); setPayrollPreview(null); }} className={`flex-1 py-3 sm:py-3.5 rounded-xl font-black uppercase text-[10px] sm:text-xs tracking-widest border transition-all ${importQuincena === 2 ? `${activeBg} text-white shadow-md border-transparent` : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>Q2 (16-31)</button>
                  </div>
                </div>

                <div className="pt-2 space-y-2.5 sm:space-y-3">
                  {payrollPreview === null ? (
                    <button onClick={previewPayroll} className={`w-full py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-md transition-all active:scale-95 ${activeBg}`}>Analizar Turnos</button>
                  ) : (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-2xl text-center border border-blue-100 dark:border-blue-900/50">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Total Neto A Recibir</p>
                      <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">${payrollPreview.toLocaleString('es-CO')}</p>
                      <button onClick={importFromPayroll} disabled={isSaving || payrollPreview <= 0} className={`mt-3 w-full py-2.5 sm:py-3 rounded-xl text-white font-black uppercase text-[9px] sm:text-[10px] tracking-widest shadow-md disabled:opacity-50 ${activeBg}`}>
                        {isSaving ? 'Sincronizando...' : 'Ingresar a Disponible'}
                      </button>
                    </div>
                  )}
                  <button onClick={() => setShowImportModal(false)} className="w-full py-2.5 sm:py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">Cancelar</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <BilleteraTutorial />

      <div className="w-full border-t border-zinc-200 dark:border-zinc-800 pt-8 mt-auto"><Footer /></div>
    </main>
  );
}