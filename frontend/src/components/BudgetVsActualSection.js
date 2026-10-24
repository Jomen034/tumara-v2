import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import {
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import clsx from "clsx";
import { formatRp, formatShort } from "../lib/format";
import { catMeta } from "../lib/constants";
import { Card, Button, Badge, Progress, Spinner } from "./ui";

const PACING_BADGES = {
  frugal: { label: "Sangat Hemat & Terkendali", color: "var(--brand)", bg: "bg-brand/10", border: "border-brand/30" },
  balanced: { label: "Pacing Ideal & Seimbang", color: "var(--cyan)", bg: "bg-cyan/10", border: "border-cyan/30" },
  fast: { label: "Pacing Cepat (Waspada)", color: "var(--amber)", bg: "bg-amber/10", border: "border-amber/30" },
  over: { label: "Defisit (Over Budget)", color: "var(--rose)", bg: "bg-rose/10", border: "border-rose/30" },
  idle: { label: "Belum Ada Pengeluaran", color: "var(--tmuted)", bg: "bg-elevated", border: "border-borderc" },
};

export default function BudgetVsActualSection({
  budget,
  analytics,
  privacy,
  selectedMonth,
  monthNames,
  onApplyRecommendation,
  onConsultAdvisor,
  applying,
}) {
  const [expandedInsights, setExpandedInsights] = useState(true);

  if (!budget) return null;

  const totalBudget = budget.total_budget || budget.categories?.reduce((a, b) => a + (b.limit || 0), 0) || 0;
  const totalSpent = budget.total_spent || 0;
  const variance = totalBudget - totalSpent;
  const isSurplus = variance >= 0;
  const realizationPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const pacingInfo = PACING_BADGES[analytics?.pacing_status] || PACING_BADGES.balanced;
  const elapsedDayPct = analytics?.elapsed_day_pct || 0;
  const currentDay = analytics?.current_day || 1;
  const totalDays = analytics?.total_days || 30;

  const topSurplus = analytics?.top_surplus || [];
  const topDeficit = analytics?.top_deficit || [];
  const recommendations = analytics?.smart_recommendations || [];

  return (
    <Card className="relative overflow-hidden space-y-4 border-brand/20 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-borderc">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-head font-bold text-sm sm:text-base text-tprimary">
                Rangkuman Budget vs Aktual & Pacing Finansial
              </h2>
              <span
                className={clsx(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  pacingInfo.bg,
                  pacingInfo.border
                )}
                style={{ color: pacingInfo.color }}
              >
                {pacingInfo.label}
              </span>
            </div>
            <p className="text-xs text-tsecondary mt-0.5">
              {analytics?.pacing_desc || "Evaluasi perbandingan rencana pengeluaran awal bulan dengan transaksi riil tercatat."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedInsights(!expandedInsights)}
            className="text-xs text-tsecondary"
          >
            <span>{expandedInsights ? "Ciutkan" : "Rincian"}</span>
            {expandedInsights ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onConsultAdvisor}
            className="text-xs border-brand/30 text-brand hover:bg-brand/10"
            title="Buka obrolan CFO Tumara AI untuk evaluasi komprehensif"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">Tanya Tumara AI</span>
            <span className="sm:hidden">Tanya AI</span>
          </Button>
        </div>
      </div>

      {/* 3-Column Macro Metric Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Rencana Awal */}
        <div className="p-3.5 rounded-xl bg-elevated/40 border border-borderc">
          <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider">
            Rencana Anggaran
          </span>
          <div className={`text-lg sm:text-xl font-mono font-bold mt-1 text-tprimary ${privacy ? "privacy-blur" : ""}`}>
            {formatRp(totalBudget, privacy)}
          </div>
          <span className="text-[11px] text-tsecondary mt-0.5 block">
            {budget.categories?.length || 0} pos anggaran ditetapkan
          </span>
        </div>

        {/* Realisasi Belanja */}
        <div className="p-3.5 rounded-xl bg-elevated/40 border border-borderc">
          <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider">
            Realisasi Pengeluaran
          </span>
          <div className={`text-lg sm:text-xl font-mono font-bold mt-1 text-tprimary ${privacy ? "privacy-blur" : ""}`}>
            {formatRp(totalSpent, privacy)}
          </div>
          <span className="text-[11px] text-tsecondary mt-0.5 block flex items-center gap-1">
            <span>{realizationPct}% terserap dari rencana</span>
          </span>
        </div>

        {/* Selisih / Variance */}
        <div
          className={clsx(
            "p-3.5 rounded-xl border",
            isSurplus ? "bg-brand/5 border-brand/20" : "bg-rose/5 border-rose/20"
          )}
        >
          <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider">
            Selisih Berjalan (Variance)
          </span>
          <div
            className={clsx(
              "text-lg sm:text-xl font-mono font-bold mt-1",
              isSurplus ? "text-brand" : "text-rose",
              privacy ? "privacy-blur" : ""
            )}
          >
            {isSurplus ? `+${formatRp(variance, privacy)}` : `-${formatRp(Math.abs(variance), privacy)}`}
          </div>
          <span className={clsx("text-[11px] font-medium mt-0.5 block", isSurplus ? "text-brand" : "text-rose")}>
            {isSurplus ? "🟢 Surplus Hemat (Sisa Dana Aman)" : "🔴 Defisit Belanja (Over Budget)"}
          </span>
        </div>
      </div>

      {/* Pacing Speed Barometer Comparison */}
      <div className="p-3.5 rounded-xl bg-surface border border-borderc space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-tprimary flex items-center gap-1.5">
            <Calendar size={14} className="text-brand" />
            Laju Penyerapan Anggaran vs Perjalanan Waktu Bulan Ini
          </span>
          <span className="text-[11px] font-mono text-tmuted">
            Hari ke-{currentDay} dari {totalDays}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-tsecondary">
            <span>Perjalanan Kalender:</span>
            <span className="font-mono font-semibold text-tprimary">{elapsedDayPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full bg-cyan transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, elapsedDayPct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-tsecondary pt-1">
            <span>Penyerapan Anggaran Riil:</span>
            <span
              className={clsx(
                "font-mono font-bold",
                realizationPct > 100
                  ? "text-rose"
                  : realizationPct > elapsedDayPct + 10
                  ? "text-amber"
                  : "text-brand"
              )}
            >
              {realizationPct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-elevated overflow-hidden">
            <div
              className={clsx(
                "h-full transition-all duration-500 rounded-full",
                realizationPct > 100
                  ? "bg-rose"
                  : realizationPct > elapsedDayPct + 10
                  ? "bg-amber"
                  : "bg-brand"
              )}
              style={{ width: `${Math.min(100, realizationPct)}%` }}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expandedInsights && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-1"
          >
            {/* Actionable Insights: Top Surplus & Top Deficit Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Top Surplus */}
              <div className="p-3.5 rounded-xl bg-surface border border-borderc space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-brand flex items-center gap-1.5">
                    <ArrowDownRight size={15} /> Pos Paling Longgar (Surplus Tertinggi)
                  </span>
                  <span className="text-[10px] text-tmuted font-medium">Bisa dialihkan</span>
                </div>

                {topSurplus.length === 0 ? (
                  <p className="text-xs text-tmuted py-2 italic">Belum ada pos surplus tercatat.</p>
                ) : (
                  <div className="space-y-1.5">
                    {topSurplus.map((item) => {
                      const meta = catMeta(item.category);
                      const IconCat = Icons[meta?.icon] || Icons.HelpCircle;
                      return (
                        <div
                          key={item.category}
                          className="flex items-center justify-between p-2 rounded-lg bg-elevated/40 border border-borderc/50 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">{meta?.emoji || "📦"}</span>
                            <span className="truncate font-medium text-tprimary">{item.category}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-mono font-bold text-brand ${privacy ? "privacy-blur" : ""}`}>
                              +{formatShort(item.surplus, privacy)}
                            </span>
                            <span className="text-[10px] text-tmuted block">
                              {item.pct}% terpakai
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Deficit / Under Pressure */}
              <div className="p-3.5 rounded-xl bg-surface border border-borderc space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose flex items-center gap-1.5">
                    <ArrowUpRight size={15} /> Pos Paling Tertekan / Defisit
                  </span>
                  <span className="text-[10px] text-tmuted font-medium">Perlu penyesuaian</span>
                </div>

                {topDeficit.length === 0 ? (
                  <div className="p-3 rounded-lg bg-brand/5 border border-brand/20 text-xs text-brand flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>Luar biasa! Tidak ada pos pengeluaran yang over budget bulan ini.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {topDeficit.map((item) => {
                      const meta = catMeta(item.category);
                      const IconCat = Icons[meta?.icon] || Icons.HelpCircle;
                      return (
                        <div
                          key={item.category}
                          className="flex items-center justify-between p-2 rounded-lg bg-elevated/40 border border-borderc/50 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">{meta?.emoji || "📦"}</span>
                            <span className="truncate font-medium text-tprimary">{item.category}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-mono font-bold text-rose ${privacy ? "privacy-blur" : ""}`}>
                              {item.deficit ? `+${formatShort(item.deficit, privacy)} Over` : `${item.pct}% Limit`}
                            </span>
                            <span className="text-[10px] text-tmuted block">
                              {formatShort(item.spent, privacy)} / {formatShort(item.limit, privacy)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Smart Next-Month Reallocation Banner */}
            {recommendations.length > 0 ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-brand/10 via-surface to-brand/5 border border-brand/30 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-brand text-black flex items-center justify-center shrink-0">
                      <Sparkles size={15} />
                    </div>
                    <div>
                      <h4 className="font-head font-bold text-xs sm:text-sm text-tprimary">
                        Rekomendasi Penyesuaian Anggaran Bulan Depan (AI Smart Budgeting)
                      </h4>
                      <p className="text-[11px] text-tsecondary">
                        Berdasarkan data riil pengeluaran bulan ini agar alokasi budgetmu semakin presisi dan realistis.
                      </p>
                    </div>
                  </div>
                </div>

                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface/90 border border-borderc flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 flex-1">
                      <span className="font-bold text-tprimary flex items-center gap-1.5">
                        <Zap size={14} className="text-amber shrink-0" />
                        {rec.title}
                      </span>
                      <p className="text-tsecondary text-[11px] leading-relaxed">
                        {rec.description}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={applying}
                        onClick={() => onApplyRecommendation?.(rec)}
                        className="text-xs bg-brand text-black font-semibold hover:brightness-110 shadow-sm"
                        title="Terapkan pergeseran limit ini ke budget bulan depan"
                      >
                        {applying ? <Spinner size={13} /> : <Zap size={13} />}
                        <span>Terapkan ke Bulan Depan</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-elevated/40 border border-borderc flex items-center justify-between gap-3 text-xs text-tsecondary">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-brand shrink-0" />
                  <span>
                    Struktur anggaranmu sudah sangat seimbang dan disiplin. Pertahankan ritme belanja ini untuk bulan berikutnya!
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onConsultAdvisor}
                  className="text-xs text-brand shrink-0"
                >
                  <MessageSquare size={13} /> Diskusi dengan CFO
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
