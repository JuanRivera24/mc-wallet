"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useUser } from "@clerk/nextjs";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, increment, Timestamp } from "firebase/firestore";

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

  // Forms
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Custom Cats
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📌");

  // Goals/Debts
  const [metaTitle, setMetaTitle] = useState("");
  const [metaTarget, setMetaTarget] = useState("");
  const [metaType, setMetaType] = useState<"GOAL" | "DEBT">("GOAL");

  // Import
  const [importMonth, setImportMonth] = useState(MESES[new Date().getMonth()]);
  const [importQuincena, setImportQuincena] = useState(new Date().getDate() <= 15 ? 1 : 2);

  const activeBg = themeColor === 'blue' ? 'bg-blue-600' : 'bg-red-600';

  useEffect(() => {
    if (!user) return;
    const qTx = query(collection(db, "wallet_transactions"), where("userId", "==", user.id));
    const unsubTx = onSnapshot(qTx, (snap) => {
      const txs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      txs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setTransactions(txs);
    });

    const qGoals = query(collection(db, "wallet_goals"), where("userId", "==", user.id));
    const unsubGoals = onSnapshot(qGoals, (snap) => {
      setMetas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const qCats = query(collection(db, "wallet_categories"), where("userId", "==", user.id));
    const unsubCats = onSnapshot(qCats, (snap) => {
      setCustomCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    return () => { unsubTx(); unsubGoals(); unsubCats(); };
  }, [user]);

  const balance = useMemo(() => {
    return transactions.reduce((acc, curr) => curr.type === 'INCOME' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);
  }, [transactions]);

  const currentCategories = useMemo(() => {
    const base = txModalType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const custom = customCategories.filter(c => c.type === txModalType);
    return [...base, ...custom];
  }, [txModalType, customCategories]);

  // --- ACTIONS ---

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !user) return hapticError();
    setIsSaving(true);
    const isPayment = txModalType === 'PAYMENT';
    const numericAmount = Number(amount);
    const categoryData = currentCategories.find(c => c.id === selectedCategory);

    try {
      await addDoc(collection(db, "wallet_transactions"), {
        userId: user.id,
        type: isPayment ? 'EXPENSE' : txModalType,
        isAbono: isPayment,
        amount: numericAmount,
        category: isPayment ? `Abono: ${activeTarget.title}` : (categoryData?.label || "Otros"),
        icon: isPayment ? activeTarget.icon : (categoryData?.icon || "💵"),
        description: desc,
        timestamp: serverTimestamp(),
        targetId: isPayment ? activeTarget.id : null
      });

      if (isPayment) {
        await updateDoc(doc(db, "wallet_goals", activeTarget.id), { currentAmount: increment(numericAmount) });
      }
      hapticSuccess();
      setTxModalType(null);
    } catch (e) { hapticError(); } finally { setIsSaving(false); }
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaTitle || !metaTarget || !user) return hapticError();
    setIsSaving(true);
    try {
      await addDoc(collection(db, "wallet_goals"), {
        userId: user.id, title: metaTitle, targetAmount: Number(metaTarget),
        currentAmount: 0, type: metaType, icon: metaType === "GOAL" ? "🎯" : "💸",
        timestamp: serverTimestamp()
      });
      hapticSuccess();
      setShowMetaModal(false);
      setMetaTitle(""); setMetaTarget("");
    } catch (e) { hapticError(); } finally { setIsSaving(false); }
  };

  const handleSaveCustomCategory = async () => {
    if (!newCatName || !user) return hapticError();
    try {
      const newId = `custom_${Date.now()}`;
      await addDoc(collection(db, "wallet_categories"), {
        userId: user.id, id: newId, type: txModalType, icon: newCatIcon, label: newCatName, timestamp: serverTimestamp()
      });
      setNewCatName(""); setShowAddCategory(false); setSelectedCategory(newId);
    } catch (e) { hapticError(); }
  };

  const deleteTransaction = async (tx: any) => {
    if (!user || !tx.timestamp) return;
    const isExpired = Timestamp.now().toMillis() - tx.timestamp.toMillis() > 24 * 60 * 60 * 1000;
    if (isExpired) return alert("El tiempo para eliminar caducó.");
    hapticWarning();
    try {
      if (tx.isAbono && tx.targetId) {
        await updateDoc(doc(db, "wallet_goals", tx.targetId), { currentAmount: increment(-tx.amount) });
      }
      await deleteDoc(doc(db, "wallet_transactions", tx.id));
      setExpandedTxId(null);
      hapticSuccess();
    } catch (e) { hapticError(); }
  };

  const importFromPayroll = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const q = query(collection(db, "shifts"), where("userId", "==", user.id), where("month", "==", importMonth));
      const snap = await getDocs(q);
      let total = 0;
      snap.forEach(doc => {
        const data = doc.data();
        const q = parseInt(data.date.split('-')[2]) <= 15 ? 1 : 2;
        if (q === importQuincena) total += (Number(data.netPay) || 0);
      });
      if (total > 0) {
        await addDoc(collection(db, "wallet_transactions"), {
          userId: user.id, type: "INCOME", amount: total, category: "Nómina", icon: "💰",
          description: `Importado: ${importMonth} Q${importQuincena}`, timestamp: serverTimestamp()
        });
        hapticSuccess();
        setShowImportModal(false);
      } else { alert("No hay datos en esa quincena."); }
    } catch (e) { hapticError(); } finally { setIsSaving(false); }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24 transition-colors">
      <Navbar />
      
      <div className="pt-6 px-4 max-w-2xl mx-auto space-y-5">
        
        {/* CARD DE SALDO */}
        <div className={`p-6 rounded-[2rem] bg-gradient-to-br ${themeColor === 'blue' ? 'from-blue-600 to-blue-500' : 'from-red-600 to-red-500'} text-white shadow-xl`}>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Saldo Disponible</span>
          <h2 className="text-4xl font-black tracking-tighter">${balance.toLocaleString('es-CO')}</h2>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setTxModalType("INCOME"); setAmount(""); setDesc(""); setSelectedCategory("nomina"); }} className="flex-1 bg-white/20 py-3 rounded-xl text-[10px] font-black uppercase">+ Ingreso</button>
            <button onClick={() => { setTxModalType("EXPENSE"); setAmount(""); setDesc(""); setSelectedCategory("comida"); }} className="flex-1 bg-black/20 py-3 rounded-xl text-[10px] font-black uppercase">- Gasto</button>
          </div>
        </div>

        <button onClick={() => setShowImportModal(true)} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-4 text-xs font-black uppercase tracking-widest text-gray-500 shadow-sm">
          🔄 Sincronizar desde Nómina
        </button>

        {/* METAS (Glow Verde) */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mis Metas 🎯</h3>
            <button onClick={() => { setMetaType("GOAL"); setShowMetaModal(true); }} className="text-[10px] font-black uppercase text-green-500">+ Nueva Meta</button>
          </div>
          <div className="grid gap-3">
            {metas.filter(m => m.type === "GOAL").map(meta => (
              <div key={meta.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-bold dark:text-white">{meta.icon} {meta.title}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setActiveTarget(meta); setTxModalType("PAYMENT"); setAmount(""); }} className="text-[9px] font-black text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">ABONAR</button>
                    <button onClick={() => deleteDoc(doc(db, "wallet_goals", meta.id))} className="text-[9px] font-black text-gray-400">✕</button>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${Math.min((meta.currentAmount / meta.targetAmount) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-[9px] font-bold text-gray-400 uppercase">
                  <span>${meta.currentAmount.toLocaleString()}</span>
                  <span>Meta: ${meta.targetAmount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DEUDAS (Glow Rojo) */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mis Deudas 💸</h3>
            <button onClick={() => { setMetaType("DEBT"); setShowMetaModal(true); }} className="text-[10px] font-black uppercase text-red-500">+ Nueva Deuda</button>
          </div>
          <div className="grid gap-3">
            {metas.filter(m => m.type === "DEBT").map(meta => (
              <div key={meta.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-bold dark:text-white">{meta.icon} {meta.title}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setActiveTarget(meta); setTxModalType("PAYMENT"); setAmount(""); }} className="text-[9px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">ABONAR</button>
                    <button onClick={() => deleteDoc(doc(db, "wallet_goals", meta.id))} className="text-[9px] font-black text-gray-400">✕</button>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${Math.min((meta.currentAmount / meta.targetAmount) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-[9px] font-bold text-gray-400 uppercase">
                  <span>Abonado: ${meta.currentAmount.toLocaleString()}</span>
                  <span>Total: ${meta.targetAmount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* HISTORIAL ACORDEÓN */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Historial</h3>
          <div className="space-y-2">
            {transactions.slice(0, showHistoryLimit).map(tx => {
              const isExpanded = expandedTxId === tx.id;
              const isExpired = Timestamp.now().toMillis() - (tx.timestamp?.toMillis() || 0) > 24 * 60 * 60 * 1000;
              const impact = balance === 0 ? "0" : ((tx.amount / Math.abs(balance)) * 100).toFixed(1);

              return (
                <div key={tx.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                  <button onClick={() => { hapticLight(); setExpandedTxId(isExpanded ? null : tx.id); }} className="w-full flex justify-between items-center p-4 text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{tx.icon}</span>
                      <div>
                        <p className="text-xs font-bold dark:text-white leading-none">{tx.category}</p>
                        <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold">{tx.timestamp?.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-black ${tx.type === 'INCOME' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}${tx.amount.toLocaleString()}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
                        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl">
                          <span className="text-[9px] font-black text-gray-400 uppercase">Impacto en disponible</span>
                          <span className={`text-xs font-black ${tx.type === 'INCOME' ? 'text-green-500' : 'text-red-500'}`}>{tx.type === 'INCOME' ? '+' : '-'}{impact}%</span>
                        </div>
                        {tx.description && <p className="text-xs font-medium text-gray-600 dark:text-gray-400 italic px-1">"{tx.description}"</p>}
                        <button 
                          onClick={() => deleteTransaction(tx)} disabled={isExpired}
                          className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 font-black text-[10px] uppercase tracking-widest disabled:opacity-40"
                        >
                          {isExpired ? 'Eliminar caducó (24h)' : 'Eliminar Movimiento'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {transactions.length > showHistoryLimit && (
              <button onClick={() => setShowHistoryLimit(prev => prev + 10)} className="w-full py-3 text-[10px] font-black uppercase text-blue-500">Mostrar Más</button>
            )}
          </div>
        </section>
      </div>

      {/* MODAL TRANSACCION */}
      <AnimatePresence>
        {txModalType && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end justify-center">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white dark:bg-[#0a0a0a] w-full max-w-md rounded-t-[2.5rem] p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xl dark:text-white">{txModalType === 'PAYMENT' ? `Abono a ${activeTarget?.title}` : 'Nuevo Registro'}</h3>
                <button onClick={() => setTxModalType(null)} className="text-gray-400">✕</button>
              </div>
              <form onSubmit={handleSaveTransaction} className="space-y-6">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full text-5xl font-black text-center bg-transparent dark:text-white outline-none" autoFocus />
                {txModalType !== 'PAYMENT' && (
                  <div className="flex flex-wrap gap-2">
                    {currentCategories.map(cat => (
                      <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${selectedCategory === cat.id ? `${activeBg} text-white border-transparent` : 'border-gray-200 dark:border-gray-800 dark:text-gray-400'}`}>{cat.icon} {cat.label}</button>
                    ))}
                    <button type="button" onClick={() => setShowAddCategory(!showAddCategory)} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase border border-dashed border-gray-300 dark:text-gray-400">+ Nuevo</button>
                  </div>
                )}
                <AnimatePresence>
                  {showAddCategory && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="flex gap-2 overflow-hidden">
                      <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} className="w-12 bg-gray-100 dark:bg-gray-800 rounded-xl text-center text-xl" />
                      <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nombre" className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 text-xs font-bold dark:text-white outline-none" />
                      <button type="button" onClick={handleSaveCustomCategory} className="bg-blue-500 text-white px-4 rounded-xl font-black">✓</button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción / Nota" className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl outline-none dark:text-white font-bold" />
                <button type="submit" disabled={isSaving || !amount} className={`w-full py-4 rounded-2xl text-white font-black uppercase ${activeBg}`}>{isSaving ? 'Guardando...' : 'Confirmar'}</button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* MODAL META/DEUDA */}
        {showMetaModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-[#0a0a0a] w-full max-w-sm rounded-[2rem] p-6 space-y-6 shadow-2xl">
              <h3 className="font-black text-xl dark:text-white text-center">Nuevo Objetivo</h3>
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button onClick={() => setMetaType("GOAL")} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${metaType === "GOAL" ? 'bg-white dark:bg-gray-700 dark:text-white' : 'text-gray-400'}`}>Ahorro</button>
                <button onClick={() => setMetaType("DEBT")} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${metaType === "DEBT" ? 'bg-white dark:bg-gray-700 dark:text-white' : 'text-gray-400'}`}>Deuda</button>
              </div>
              <form onSubmit={handleSaveMeta} className="space-y-4">
                <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={metaType === "GOAL" ? "Ej: Moto Hornet 125" : "Ej: Deuda de la U"} className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 dark:text-white font-bold outline-none" />
                <input type="number" value={metaTarget} onChange={e => setMetaTarget(e.target.value)} placeholder="Monto Total ($)" className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 dark:text-white font-bold outline-none" />
                <button type="submit" disabled={isSaving || !metaTitle} className={`w-full py-4 rounded-2xl text-white font-black uppercase ${metaType === "GOAL" ? 'bg-green-600' : 'bg-red-600'}`}>{isSaving ? 'Creando...' : 'Crear'}</button>
                <button type="button" onClick={() => setShowMetaModal(false)} className="w-full py-2 text-[10px] font-black text-gray-400 uppercase">Cerrar</button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* MODAL IMPORTAR */}
        {showImportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-[#0a0a0a] w-full max-w-sm rounded-[2rem] p-6 space-y-6 shadow-2xl">
              <h3 className="font-black text-xl dark:text-white text-center">Importar Nómina</h3>
              <div className="space-y-4">
                <select value={importMonth} onChange={e => setImportMonth(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 dark:text-white font-bold outline-none cursor-pointer appearance-none text-center">
                  {MESES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setImportQuincena(1)} className={`flex-1 py-3 rounded-xl font-bold ${importQuincena === 1 ? activeBg + ' text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>Q1</button>
                  <button onClick={() => setImportQuincena(2)} className={`flex-1 py-3 rounded-xl font-bold ${importQuincena === 2 ? activeBg + ' text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>Q2</button>
                </div>
                <button onClick={importFromPayroll} disabled={isSaving} className={`w-full py-4 rounded-2xl text-white font-black uppercase ${activeBg}`}>{isSaving ? 'Sincronizando...' : 'Traer Dinero'}</button>
                <button onClick={() => setShowImportModal(false)} className="w-full py-2 text-[10px] font-black text-gray-400 uppercase">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}