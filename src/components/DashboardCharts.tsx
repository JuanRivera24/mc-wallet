"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts';
import { useTheme } from "@/context/ThemeContext";

// FORMATEADOR INTELIGENTE PARA EL EJE Y
const formatMoneyAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1).replace('.0', '')}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
};

const CustomTooltipMoney = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 shadow-2xl outline-none">
            <p className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 mb-2">{label}</p>
            {payload.map((item: any, i: number) => (
                <p key={i} className="text-sm text-gray-700 dark:text-gray-200 font-bold">
                    {item.name}: <span className="font-black" style={{ color: item.color }}>${Math.round(item.value).toLocaleString()}</span>
                </p>
            ))}
        </div>
    );
};

const CustomTooltipHours = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 shadow-2xl outline-none">
            <p className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 mb-2">{label}</p>
            {payload.map((item: any, i: number) => (
                <p key={i} className="text-sm text-gray-700 dark:text-gray-200 font-bold">
                    {item.name}: <span className="font-black" style={{ color: item.color }}>{Number(item.value).toFixed(1)} h</span>
                </p>
            ))}
        </div>
    );
};

export function AnnualChart({ data }: { data: any[] }) {
    const { isDarkMode } = useTheme();
    return (
        <div
            className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-gray-800 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }} // Mata el cuadro gris en móviles
        >
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-6 tracking-[0.2em] text-center">Resumen Anual</p>

            {/* Ajustamos el margin-left a 0 para que no corte los números grandes */}
            <ResponsiveContainer width="100%" height={260} className="focus:outline-none">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="barMoney" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isDarkMode ? "#3b82f6" : "#2563eb"} stopOpacity={0.9} />
                            <stop offset="100%" stopColor={isDarkMode ? "#3b82f6" : "#2563eb"} stopOpacity={0.2} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1f2937" : "#f3f4f6"} />
                    <XAxis dataKey="month" stroke={isDarkMode ? "#6b7280" : "#9ca3af"} tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />

                    <YAxis
                        stroke={isDarkMode ? "#6b7280" : "#9ca3af"}
                        tickFormatter={formatMoneyAxis}
                        tick={{ fontSize: 10, fontWeight: 800 }}
                        axisLine={false}
                        tickLine={false}
                        width={45} // Ancho fijo para que el eje Y respire
                    />

                    <Tooltip content={<CustomTooltipMoney />} cursor={{ fill: isDarkMode ? '#1f2937' : '#f9fafb' }} wrapperStyle={{ outline: 'none' }} />
                    <Bar dataKey="net" name="Total Neto" fill="url(#barMoney)" radius={[8, 8, 0, 0]} animationDuration={1000} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function QuincenaCharts({ data }: { data: any }) {
    const { isDarkMode } = useTheme();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* DINERO */}
            <div
                className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-gray-800 transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-6 tracking-[0.2em] text-center">Ingresos Q1 vs Q2</p>
                <ResponsiveContainer width="100%" height={240} className="focus:outline-none">
                    <BarChart data={data.moneyData} barSize={60} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="qMoney" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1f2937" : "#f3f4f6"} />
                        <XAxis dataKey="name" stroke={isDarkMode ? "#6b7280" : "#9ca3af"} tick={{ fontSize: 12, fontWeight: 900 }} axisLine={false} tickLine={false} />
                        <YAxis stroke={isDarkMode ? "#6b7280" : "#9ca3af"} tickFormatter={formatMoneyAxis} tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} width={45} />
                        <Tooltip content={<CustomTooltipMoney />} cursor={{ fill: isDarkMode ? '#1f2937' : '#f9fafb' }} wrapperStyle={{ outline: 'none' }} />
                        <Bar dataKey="value" name="Ingresos" fill="url(#qMoney)" radius={[12, 12, 0, 0]} animationDuration={1000} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* HORAS */}
            <div
                className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-gray-800 transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-6 tracking-[0.2em] text-center">Tendencia Horas Q1 vs Q2</p>
                <ResponsiveContainer width="100%" height={240} className="focus:outline-none">
                    <AreaChart data={data.hoursData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <defs>
                            <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1f2937" : "#f3f4f6"} />
                        <XAxis dataKey="name" stroke={isDarkMode ? "#6b7280" : "#9ca3af"} tick={{ fontSize: 12, fontWeight: 900 }} axisLine={false} tickLine={false} />
                        <YAxis stroke={isDarkMode ? "#6b7280" : "#9ca3af"} tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltipHours />} wrapperStyle={{ outline: 'none' }} />
                        <Area type="monotone" dataKey="value" name="Horas" stroke="#f59e0b" fill="url(#hoursGrad)" strokeWidth={4} activeDot={{ r: 8, strokeWidth: 0, fill: "#f59e0b" }} animationDuration={1000} />          </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}