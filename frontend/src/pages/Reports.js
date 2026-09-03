import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import * as Icons from "lucide-react";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatShort, monthLabel } from "../lib/format";
import { catMeta } from "../lib/constants";
import { Card, Spinner, EmptyState } from "../components/ui";

export default function Reports() {
  const { theme, privacy } = useTheme();
  const { version } = useRefresh();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/analytics").then((r) => setData(r.data)).finally(() => setLoading(false)); }, [version]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={30} className="text-brand" /></div>;

  const axis = theme === "dark" ? "#6B7280" : "#94A3B8";
  const grid = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const trend = (data?.trend || []).map((t) => ({ ...t, label: monthLabel(t.month) }));
  const cats = (data?.category_breakdown || []).map((c) => ({ ...c, color: catMeta(c.category).color }));
  const totalCat = cats.reduce((a, c) => a + c.amount, 0);
  const hasData = trend.length > 0 || cats.length > 0;

  const tip = (props) => {
    const { active, payload, label } = props;
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-surface border border-borderc rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="font-semibold mb-1">{label || payload[0].name}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-mono" style={{ color: p.color || p.fill }}>{p.name}: {formatRp(p.value)}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Laporan</h1>
        <p className="text-tsecondary text-sm mt-1">Lihat uangmu dari berbagai sudut.</p>
      </div>

      {!hasData ? (
        <Card><EmptyState icon={Icons.BarChart3} title="Belum ada data" subtitle="Catat beberapa transaksi dulu untuk melihat analitik." /></Card>
      ) : (
        <>
          {/* Trend */}
          <Card data-testid="analytics-trend-chart">
            <h2 className="font-head font-bold mb-1">Tren Arus Kas</h2>
            <p className="text-xs text-tmuted mb-4">Pemasukan vs pengeluaran 6 bulan terakhir</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: -10, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--brand)" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--rose)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--rose)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={axis} fontSize={11} tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} width={60} />
                  <Tooltip content={tip} />
                  <Area type="monotone" dataKey="income" name="Pemasukan" stroke="var(--brand)" strokeWidth={2.5} fill="url(#gInc)" />
                  <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="var(--rose)" strokeWidth={2.5} fill="url(#gExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Category donut */}
            <Card data-testid="analytics-category-chart">
              <h2 className="font-head font-bold mb-4">Pengeluaran per Kategori</h2>
              {cats.length === 0 ? <EmptyState icon={Icons.PieChart} title="Belum ada pengeluaran" /> : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={cats} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                          {cats.map((c, i) => <Cell key={i} fill={c.color} stroke="none" />)}
                        </Pie>
                        <Tooltip content={tip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-2">
                    {cats.slice(0, 5).map((c) => (
                      <div key={c.category} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                        <span className="flex-1 truncate">{c.category}</span>
                        <span className="text-xs text-tmuted">{totalCat > 0 ? Math.round((c.amount / totalCat) * 100) : 0}%</span>
                        <span className={`font-mono text-xs font-semibold ${privacy ? "privacy-blur" : ""}`}>{formatShort(c.amount, privacy)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/* Savings bar */}
            <Card data-testid="analytics-savings-chart">
              <h2 className="font-head font-bold mb-4">Tabungan per Bulan</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                    <XAxis dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={axis} fontSize={11} tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} width={60} />
                    <Tooltip content={tip} cursor={{ fill: grid }} />
                    <Bar dataKey="savings" name="Tabungan" radius={[6, 6, 0, 0]}>
                      {trend.map((t, i) => <Cell key={i} fill={t.savings >= 0 ? "var(--brand)" : "var(--rose)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
