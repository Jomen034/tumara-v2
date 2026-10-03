import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import * as Icons from "lucide-react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Flame,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ChevronDown,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  BarChart3,
  Layers,
} from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatShort, monthLabel, formatDate } from "../lib/format";
import { catMeta } from "../lib/constants";
import { Card, Spinner, EmptyState, Badge, Progress } from "../components/ui";

const PERIOD_OPTIONS = [
  { value: "this_month", label: "Bulan Ini" },
  { value: "last_month", label: "Bulan Lalu" },
  { value: "3m", label: "3 Bulan Terakhir" },
  { value: "6m", label: "6 Bulan Terakhir" },
  { value: "ytd", label: "Tahun Berjalan (YTD)" },
  { value: "all", label: "Semua Waktu" },
];

const NET_RANGE_OPTIONS = [
  { value: "1m", label: "1B" },
  { value: "3m", label: "3B" },
  { value: "6m", label: "6B" },
  { value: "1y", label: "1T" },
  { value: "all", label: "Semua" },
];

export default function Reports() {
  const { theme, privacy } = useTheme();
  const { version } = useRefresh();
  const [data, setData] = useState(null);
  const [netHistory, setNetHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");
  const [netRange, setNetRange] = useState("all");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get("/analytics", { params: { period } }),
      api.get("/networth/history", { params: { range: netRange } }),
    ])
      .then(([a, n]) => {
        setData(a.data);
        setNetHistory(n.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, period]);

  // Load net worth history specifically when range changes
  const handleRangeChange = async (r) => {
    setNetRange(r);
    try {
      const res = await api.get("/networth/history", { params: { range: r } });
      setNetHistory(res.data);
    } catch {}
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={32} className="text-brand" />
      </div>
    );
  }

  const axis = theme === "dark" ? "#6B7280" : "#94A3B8";
  const grid = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const kpi = data?.kpi || {
    current_net_worth: 0,
    assets: 0,
    debt: 0,
    net_worth_delta: 0,
    net_worth_delta_pct: 0,
    period_income: 0,
    period_expense: 0,
    period_net: 0,
    savings_rate: 0,
    daily_expense_avg: 0,
    tx_count: 0,
  };

  const trend = (data?.trend || []).map((t) => ({
    ...t,
    label: monthLabel(t.month),
  }));

  const cats = (data?.category_breakdown || []).map((c) => ({
    ...c,
    color: catMeta(c.category).color,
  }));
  const totalCat = cats.reduce((a, c) => a + c.amount, 0);

  const net = (netHistory || []).map((s) => ({
    ...s,
    label: s.date.slice(5),
  }));

  const topExpenses = data?.top_expenses || [];
  const monthlyTable = data?.monthly_table || [];

  const tip = (props) => {
    const { active, payload, label } = props;
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-surface border border-borderc rounded-xl px-3.5 py-2.5 text-xs shadow-xl space-y-1">
        <p className="font-semibold text-tprimary mb-1 border-b border-borderc pb-1">
          {label || payload[0].name}
        </p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="text-tsecondary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
              {p.name}:
            </span>
            <span
              className={clsx("font-mono font-bold", privacy && "privacy-blur")}
              style={{ color: p.color || p.fill }}
            >
              {formatRp(p.value, privacy)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Period Filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold text-tprimary">
            Laporan Finansial
          </h1>
          <p className="text-tsecondary text-sm mt-1">
            Lihat perkembangan kekayaan, tren arus kas, dan rincian belanja.
          </p>
        </div>

        {/* Period Selector */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand pointer-events-none">
            <Calendar size={15} />
          </span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-surface border border-borderc rounded-xl pl-9 pr-9 py-2 text-sm text-tprimary font-medium focus:border-brand focus:outline-none appearance-none cursor-pointer shadow-sm hover:border-brand/50 transition-colors"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Periode: {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-tmuted">
            <ChevronDown size={14} />
          </div>
        </div>
      </div>

      {/* Hero Financial Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Net Worth */}
        <Card className="p-4 sm:p-5 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-tmuted font-semibold uppercase tracking-wider">
              Kekayaan Bersih
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan/10 text-cyan flex items-center justify-center">
              <Wallet size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={clsx(
                "text-2xl sm:text-3xl font-head font-extrabold font-mono",
                privacy && "privacy-blur"
              )}
            >
              {formatRp(kpi.current_net_worth, privacy)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {kpi.net_worth_delta >= 0 ? (
              <span className="text-brand font-semibold flex items-center gap-0.5">
                <TrendingUp size={13} /> +{formatShort(kpi.net_worth_delta, privacy)} ({kpi.net_worth_delta_pct}%)
              </span>
            ) : (
              <span className="text-rose font-semibold flex items-center gap-0.5">
                <TrendingDown size={13} /> -{formatShort(Math.abs(kpi.net_worth_delta), privacy)} ({kpi.net_worth_delta_pct}%)
              </span>
            )}
            <span className="text-tmuted">vs snapshot lalu</span>
          </div>
        </Card>

        {/* KPI 2: Net Cash Flow */}
        <Card className="p-4 sm:p-5 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-tmuted font-semibold uppercase tracking-wider">
              Arus Kas Bersih
            </span>
            <div
              className={clsx(
                "w-7 h-7 rounded-lg flex items-center justify-center",
                kpi.period_net >= 0 ? "bg-brand/10 text-brand" : "bg-rose/10 text-rose"
              )}
            >
              {kpi.period_net >= 0 ? (
                <ArrowDownLeft size={15} />
              ) : (
                <ArrowUpRight size={15} />
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={clsx(
                "text-2xl sm:text-3xl font-head font-extrabold font-mono",
                kpi.period_net >= 0 ? "text-brand" : "text-rose",
                privacy && "privacy-blur"
              )}
            >
              {kpi.period_net >= 0 ? "+" : ""}
              {formatRp(kpi.period_net, privacy)}
            </span>
          </div>
          <div className="text-xs text-tmuted flex items-center justify-between">
            <span>Masuk: +{formatShort(kpi.period_income, privacy)}</span>
            <span>Keluar: -{formatShort(kpi.period_expense, privacy)}</span>
          </div>
        </Card>

        {/* KPI 3: Savings Rate */}
        <Card className="p-4 sm:p-5 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-tmuted font-semibold uppercase tracking-wider">
              Tingkat Tabungan
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber/10 text-amber flex items-center justify-center">
              <PiggyBank size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-head font-extrabold font-mono text-tprimary">
              {kpi.savings_rate}%
            </span>
            <Badge
              color={
                kpi.savings_rate >= 20
                  ? "var(--brand)"
                  : kpi.savings_rate > 0
                  ? "var(--amber)"
                  : "var(--rose)"
              }
              className="ml-auto"
            >
              {kpi.savings_rate >= 20 ? "Sangat Baik" : kpi.savings_rate > 0 ? "Cukup" : "Defisit"}
            </Badge>
          </div>
          <p className="text-xs text-tmuted truncate">
            {kpi.savings_rate >= 20
              ? "Di atas target ideal 20%"
              : "Idealnya sisihkan minimal 20%"}
          </p>
        </Card>

        {/* KPI 4: Daily Burn Average */}
        <Card className="p-4 sm:p-5 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-tmuted font-semibold uppercase tracking-wider">
              Rata-rata Harian
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose/10 text-rose flex items-center justify-center">
              <Flame size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={clsx(
                "text-2xl sm:text-3xl font-head font-extrabold font-mono text-tprimary",
                privacy && "privacy-blur"
              )}
            >
              {formatRp(kpi.daily_expense_avg, privacy)}
            </span>
            <span className="text-xs text-tmuted">/ hari</span>
          </div>
          <p className="text-xs text-tmuted">
            Total {kpi.tx_count} transaksi pengeluaran
          </p>
        </Card>
      </div>

      {/* Perkembangan Net Worth Area Chart */}
      <Card data-testid="networth-history-chart" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-head font-bold text-lg text-tprimary">
              Perkembangan Net Worth
            </h2>
            <p className="text-xs text-tmuted mt-0.5">
              Pertumbuhan aset vs liabilitas utang dari waktu ke waktu
            </p>
          </div>

          {/* Time range buttons */}
          <div className="flex items-center gap-1 bg-elevated/80 p-1 rounded-xl border border-borderc">
            {NET_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleRangeChange(opt.value)}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-semibold transition-colors",
                  netRange === opt.value
                    ? "bg-brand text-black shadow-sm"
                    : "text-tsecondary hover:text-tprimary"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {net.length === 0 ? (
          <div className="py-12 text-center text-sm text-tmuted">
            Belum ada snapshot net worth yang tercatat.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={net} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAssets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke={axis}
                  fontSize={11}
                  tickFormatter={(v) => formatShort(v)}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip content={tip} />
                <Area
                  type="monotone"
                  dataKey="assets"
                  name="Total Aset"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  fill="url(#gAssets)"
                  dot={net.length < 8}
                />
                <Area
                  type="monotone"
                  dataKey="debt"
                  name="Total Utang"
                  stroke="var(--rose)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="none"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="net_worth"
                  name="Net Worth"
                  stroke="var(--cyan)"
                  strokeWidth={3}
                  fill="url(#gNet)"
                  dot={net.length < 8}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Tren Arus Kas Bulanan */}
      <Card data-testid="analytics-trend-chart" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-head font-bold text-lg text-tprimary">
              Tren Arus Kas & Tabungan
            </h2>
            <p className="text-xs text-tmuted mt-0.5">
              Perbandingan pemasukan, pengeluaran, dan akumulasi surplus bulanan
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-tsecondary">
              <span className="w-2.5 h-2.5 rounded-full bg-brand" /> Pemasukan
            </span>
            <span className="flex items-center gap-1.5 text-tsecondary">
              <span className="w-2.5 h-2.5 rounded-full bg-rose" /> Pengeluaran
            </span>
          </div>
        </div>

        {trend.length === 0 ? (
          <div className="py-12 text-center text-sm text-tmuted">
            Belum ada data transaksi yang cukup untuk melihat tren arus kas.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--rose)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--rose)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke={axis}
                  fontSize={11}
                  tickFormatter={(v) => formatShort(v)}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip content={tip} />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Pemasukan"
                  stroke="var(--brand)"
                  strokeWidth={2.5}
                  fill="url(#gInc)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Pengeluaran"
                  stroke="var(--rose)"
                  strokeWidth={2.5}
                  fill="url(#gExp)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Grid: Kategori Donut & 5 Pengeluaran Terbesar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Category Breakdown */}
        <Card data-testid="analytics-category-chart" className="space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-head font-bold text-lg text-tprimary">
                Pengeluaran per Kategori
              </h2>
              <p className="text-xs text-tmuted mt-0.5">
                Total pengeluaran:{" "}
                <strong className={clsx("text-tprimary font-mono", privacy && "privacy-blur")}>
                  {formatRp(totalCat, privacy)}
                </strong>
              </p>
            </div>
            <span className="text-xs text-tmuted font-mono">{cats.length} kategori</span>
          </div>

          {cats.length === 0 ? (
            <div className="py-12 text-center text-sm text-tmuted flex-1 flex items-center justify-center">
              Belum ada transaksi pengeluaran pada periode ini.
            </div>
          ) : (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="h-44 sm:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cats}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {cats.map((c, i) => (
                        <Cell key={i} fill={c.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={tip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category bars list */}
              <div className="space-y-2 max-h-44 sm:max-h-52 overflow-y-auto pr-1">
                {cats.map((c) => {
                  const pct = totalCat > 0 ? Math.round((c.amount / totalCat) * 100) : 0;
                  return (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-tprimary truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.category}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          <span className="text-tmuted text-[11px]">{pct}%</span>
                          <span className={clsx("font-bold text-tprimary", privacy && "privacy-blur")}>
                            {formatShort(c.amount, privacy)}
                          </span>
                        </div>
                      </div>
                      <Progress value={pct} color={c.color} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Top 5 Largest Expenses */}
        <Card className="space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-head font-bold text-lg text-tprimary">
                Pengeluaran Terbesar
              </h2>
              <p className="text-xs text-tmuted mt-0.5">
                5 transaksi pengeluaran terbesar di periode ini
              </p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-rose/10 text-rose flex items-center justify-center shrink-0">
              <Receipt size={15} />
            </div>
          </div>

          {topExpenses.length === 0 ? (
            <div className="py-12 text-center text-sm text-tmuted flex-1 flex items-center justify-center">
              Belum ada transaksi pengeluaran pada periode ini.
            </div>
          ) : (
            <div className="space-y-2.5 flex-1">
              {topExpenses.map((t, idx) => (
                <div
                  key={t.id || idx}
                  className="p-3 rounded-xl bg-surface border border-borderc flex items-center justify-between gap-3 text-xs hover:border-brand/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-elevated text-tmuted font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-tprimary truncate">
                        {t.note || t.category}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-tmuted text-[11px] min-w-0">
                        <span className="shrink-0">{formatDate(t.date)}</span>
                        <span className="shrink-0 text-tmuted/60">·</span>
                        <span className="truncate max-w-[90px] sm:max-w-none">{t.wallet_name}</span>
                        <span className="shrink-0 text-tmuted/60">·</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-elevated text-[10px] whitespace-nowrap shrink-0">
                          {t.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "font-mono font-bold text-rose shrink-0 text-xs sm:text-sm pl-2",
                      privacy && "privacy-blur"
                    )}
                  >
                    -{formatRp(t.amount, privacy)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Monthly Performance Breakdown Table */}
      <Card className="space-y-4">
        <div>
          <h2 className="font-head font-bold text-lg text-tprimary">
            Rangkuman Kinerja Bulanan
          </h2>
          <p className="text-xs text-tmuted mt-0.5">
            Riwayat arus kas, akumulasi tabungan, dan rasio tabungan bulanan
          </p>
        </div>

        {monthlyTable.length === 0 ? (
          <div className="py-8 text-center text-sm text-tmuted">
            Belum ada riwayat transaksi bulanan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-borderc text-tmuted font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Bulan</th>
                  <th className="py-2.5 px-3 text-right">Pemasukan</th>
                  <th className="py-2.5 px-3 text-right">Pengeluaran</th>
                  <th className="py-2.5 px-3 text-right">Arus Kas Bersih</th>
                  <th className="py-2.5 px-3 text-center">Savings Rate</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderc font-mono">
                {monthlyTable.map((row) => (
                  <tr key={row.month} className="hover:bg-elevated/40 transition-colors">
                    <td className="py-3 px-3 font-sans font-semibold text-tprimary whitespace-nowrap">
                      {monthLabel(row.month)}
                    </td>
                    <td
                      className={clsx(
                        "py-3 px-3 text-right text-brand font-bold whitespace-nowrap",
                        privacy && "privacy-blur"
                      )}
                    >
                      +{formatRp(row.income, privacy)}
                    </td>
                    <td
                      className={clsx(
                        "py-3 px-3 text-right text-rose font-bold whitespace-nowrap",
                        privacy && "privacy-blur"
                      )}
                    >
                      -{formatRp(row.expense, privacy)}
                    </td>
                    <td
                      className={clsx(
                        "py-3 px-3 text-right font-bold whitespace-nowrap",
                        row.savings >= 0 ? "text-brand" : "text-rose",
                        privacy && "privacy-blur"
                      )}
                    >
                      {row.savings >= 0 ? "+" : ""}
                      {formatRp(row.savings, privacy)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="font-semibold text-tprimary">
                        {row.savings_rate}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap font-sans">
                      <Badge
                        color={
                          row.status === "surplus"
                            ? "var(--brand)"
                            : row.status === "deficit"
                            ? "var(--rose)"
                            : "var(--cyan)"
                        }
                      >
                        {row.status === "surplus"
                          ? "Surplus"
                          : row.status === "deficit"
                          ? "Defisit"
                          : "Imbang"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
