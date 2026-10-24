import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  HelpCircle,
  Percent,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import api from "../lib/api";
import { formatRp, formatShort } from "../lib/format";
import { catMeta } from "../lib/constants";
import { Modal, Button, Badge, Spinner } from "./ui";

const GROUP_LABEL = { needs: "Kebutuhan", wants: "Keinginan", savings: "Tabungan" };
const GROUP_COLOR = { needs: "var(--brand)", wants: "var(--amber)", savings: "var(--cyan)" };

export default function NextMonthBudgetModal({
  open,
  onClose,
  budget,
  recommendation,
  selectedMonth,
  monthNames,
  onSaved,
}) {
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  // Compute next month info
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const baseMonth = selectedMonth || currentMonthStr;
  const [y, m] = baseMonth.split("-").map(Number);
  const nextDate = new Date(y, m, 1);
  const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthName = monthNames ? monthNames[nextDate.getMonth()] : "Bulan Depan";
  const nextYear = nextDate.getFullYear();

  const monthlyIncome = budget?.monthly_income || 0;

  // Initialize categories with recommendation applied
  const applyPresetRecommendation = () => {
    if (!budget?.categories) return;
    const initial = budget.categories.map((c) => {
      let limit = parseFloat(c.limit) || 0;
      if (recommendation && recommendation.amount > 0) {
        if (c.category === recommendation.from_category) {
          limit = Math.max(0, limit - recommendation.amount);
        } else if (c.category === recommendation.to_category) {
          limit = limit + recommendation.amount;
        }
      }
      return {
        category: c.category,
        group: c.group || "needs",
        limit: Math.round(limit),
      };
    });
    setCategories(initial);
  };

  const applySameAsCurrent = () => {
    if (!budget?.categories) return;
    const same = budget.categories.map((c) => ({
      category: c.category,
      group: c.group || "needs",
      limit: Math.round(parseFloat(c.limit) || 0),
    }));
    setCategories(same);
  };

  useEffect(() => {
    if (open) {
      applyPresetRecommendation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, budget, recommendation]);

  // Real-time recalculation of 50/30/20 & total
  const totalAllocated = categories.reduce((sum, c) => sum + (parseFloat(c.limit) || 0), 0);
  const unallocated = Math.max(0, monthlyIncome - totalAllocated);
  const isOverAllocated = totalAllocated > monthlyIncome && monthlyIncome > 0;
  const overAllocatedAmount = Math.max(0, totalAllocated - monthlyIncome);

  const groupTotals = { needs: 0, wants: 0, savings: 0 };
  categories.forEach((c) => {
    const g = c.group || "needs";
    if (groupTotals[g] !== undefined) {
      groupTotals[g] += parseFloat(c.limit) || 0;
    }
  });

  const needsPct = monthlyIncome > 0 ? Math.round((groupTotals.needs / monthlyIncome) * 100) : 0;
  const wantsPct = monthlyIncome > 0 ? Math.round((groupTotals.wants / monthlyIncome) * 100) : 0;
  const savingsPct = monthlyIncome > 0 ? Math.round((groupTotals.savings / monthlyIncome) * 100) : 0;

  const handleLimitChange = (idx, value) => {
    const val = Math.max(0, parseFloat(value) || 0);
    setCategories((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], limit: val };
      return next;
    });
  };

  const handleSaveBudget = async () => {
    if (categories.length === 0) return;
    setSaving(true);
    try {
      await api.post("/budget", {
        monthly_income: monthlyIncome,
        mode: budget?.mode || "percentage",
        month: nextMonthStr,
        categories: categories.map((c) => ({
          category: c.category,
          group: c.group,
          limit: parseFloat(c.limit) || 0,
        })),
      });

      toast.success(
        `Anggaran untuk ${nextMonthName} ${nextYear} berhasil disimpan & diaktifkan! 🎯`,
        {
          action: {
            label: `Buka ${nextMonthName}`,
            onClick: () => onSaved?.(nextMonthStr),
          },
        }
      );
      onClose();
      onSaved?.(nextMonthStr);
    } catch {
      toast.error("Gagal menyimpan anggaran bulan depan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Tinjau & Sesuaikan Anggaran: ${nextMonthName} ${nextYear}`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Subtitle / Philosophy header */}
        <p className="text-xs text-tsecondary -mt-2">
          Tumara memproses data aktual bulan ini dan memberikan rekomendasi, namun <strong>kendali dan keputusan akhir sepenuhnya berada di tanganmu</strong>. Kamu bebas menyesuaikan angka limit tiap pos di bawah.
        </p>

        {/* Reflection & Financial Trade-Off Banner */}
        {recommendation ? (
          <div
            className={clsx(
              "p-3.5 rounded-2xl border space-y-2 text-xs",
              recommendation.priority_level === "warning"
                ? "bg-amber/10 border-amber/30 text-tprimary"
                : "bg-brand/10 border-brand/30 text-tprimary"
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold",
                  recommendation.priority_level === "warning" ? "bg-amber text-black" : "bg-brand text-black"
                )}
              >
                <Sparkles size={15} />
              </div>
              <div className="flex-1">
                <span className="font-bold text-xs sm:text-sm block">
                  {recommendation.title}
                </span>
                <span className="text-[11px] text-tsecondary">
                  Prinsip 50/30/20: {recommendation.tradeoff_note}
                </span>
              </div>
            </div>

            <p className="text-xs text-tsecondary leading-relaxed bg-surface p-2.5 rounded-xl border border-borderc">
              {recommendation.description}
            </p>

            {recommendation.reflection_question && (
              <div className="p-2.5 rounded-xl bg-elevated border border-borderc flex items-start gap-2 text-[11px] text-tprimary">
                <HelpCircle size={15} className="text-brand shrink-0 mt-0.5" />
                <span className="italic leading-relaxed">{recommendation.reflection_question}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-brand/5 border border-brand/20 text-xs text-brand flex items-center gap-2">
            <ShieldCheck size={18} className="shrink-0" />
            <span>
              Seluruh pos anggaranmu berjalan disiplin dalam batas wajar. Kamu dapat menggunakan komposisi saat ini atau menyesuaikan sesuai kebutuhan bulan depan.
            </span>
          </div>
        )}

        {/* Preset Action Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <span className="text-xs font-semibold text-tprimary">
            Daftar Alokasi Limit per Pos:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {recommendation && recommendation.amount > 0 && (
              <button
                type="button"
                onClick={applyPresetRecommendation}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 transition-colors flex items-center gap-1"
                title="Terapkan saran rekomendasi AI"
              >
                <Zap size={12} /> Saran AI
              </button>
            )}
            <button
              type="button"
              onClick={applySameAsCurrent}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-elevated text-tsecondary hover:text-tprimary border border-borderc transition-colors flex items-center gap-1"
              title="Samakan seluruh limit dengan bulan berjalan"
            >
              <RotateCcw size={12} /> Samakan Bulan Ini
            </button>
          </div>
        </div>

        {/* Interactive Category Limit Table / List */}
        <div className="max-h-[38vh] overflow-y-auto space-y-2 pr-1 border border-borderc rounded-2xl p-2 bg-bg">
          {categories.map((c, idx) => {
            const meta = catMeta(c.category);
            const originalCat = budget?.categories?.find((b) => b.category === c.category);
            const currentLimit = originalCat ? parseFloat(originalCat.limit) || 0 : 0;
            const diffFromCurrent = c.limit - currentLimit;

            return (
              <div
                key={c.category}
                className="flex items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-xl bg-surface border border-borderc hover:border-brand transition-all text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-base shrink-0">{meta?.emoji || "📦"}</span>
                  <div className="min-w-0">
                    <span className="font-semibold text-tprimary block truncate text-xs sm:text-sm">
                      {c.category}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-tmuted">
                      <Badge color={GROUP_COLOR[c.group] || "var(--brand)"}>
                        {GROUP_LABEL[c.group] || "Kebutuhan"}
                      </Badge>
                      <span>Limit bulan ini: {formatShort(currentLimit)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {diffFromCurrent !== 0 && (
                    <span
                      className={clsx(
                        "text-[10px] font-mono font-bold hidden xs:inline sm:inline",
                        diffFromCurrent > 0 ? "text-brand" : "text-amber"
                      )}
                    >
                      {diffFromCurrent > 0 ? `+${formatShort(diffFromCurrent)}` : formatShort(diffFromCurrent)}
                    </span>
                  )}
                  <div className="relative w-32 sm:w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tmuted text-xs font-mono pointer-events-none select-none z-10">
                      Rp
                    </span>
                    <input
                      type="number"
                      step={50000}
                      min={0}
                      value={c.limit}
                      onChange={(e) => handleLimitChange(idx, e.target.value)}
                      className="w-full bg-elevated border border-borderc focus:border-brand rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-tprimary placeholder:text-tmuted focus:outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live 50/30/20 & Total Realtime Barometer */}
        <div className="p-3.5 rounded-2xl bg-surface border border-borderc space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-tprimary flex items-center gap-1.5">
              <Percent size={14} className="text-brand" />
              Proyeksi Komposisi Kaidah 50 / 30 / 20 Bulan Depan
            </span>
            <div className="text-right">
              <span className="text-[11px] text-tmuted">Total Alokasi: </span>
              <strong className={clsx("font-mono text-sm", isOverAllocated ? "text-rose" : "text-tprimary")}>
                {formatRp(totalAllocated)}
              </strong>
            </div>
          </div>

          {/* 3-color proportional bar */}
          <div className="h-2.5 rounded-full bg-elevated overflow-hidden flex">
            <div
              style={{ width: `${Math.min(100, needsPct)}%` }}
              className="bg-brand transition-all duration-300"
              title={`Kebutuhan: ${needsPct}%`}
            />
            <div
              style={{ width: `${Math.min(100, wantsPct)}%` }}
              className="bg-amber transition-all duration-300"
              title={`Keinginan: ${wantsPct}%`}
            />
            <div
              style={{ width: `${Math.min(100, savingsPct)}%` }}
              className="bg-cyan transition-all duration-300"
              title={`Tabungan: ${savingsPct}%`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-tsecondary flex-wrap gap-2 pt-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand inline-block" />
              Kebutuhan: <strong className="font-mono text-tprimary">{needsPct}%</strong> (Target 50%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber inline-block" />
              Keinginan: <strong className="font-mono text-tprimary">{wantsPct}%</strong> (Target 30%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan inline-block" />
              Tabungan: <strong className="font-mono text-tprimary">{savingsPct}%</strong> (Target 20%)
            </span>
          </div>

          {/* Warning or Zero-based confirmation */}
          {isOverAllocated ? (
            <div className="p-2 rounded-xl bg-rose/10 border border-rose/30 text-rose text-xs flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                Total anggaran melebihi penghasilan ({formatRp(monthlyIncome)}) sebesar{" "}
                <strong className="font-mono">{formatRp(overAllocatedAmount)}</strong>. Kurangi limit beberapa pos.
              </span>
            </div>
          ) : unallocated > 0 ? (
            <div className="p-2 rounded-xl bg-cyan/10 border border-cyan/30 text-cyan text-xs flex items-center gap-1.5">
              <Wallet size={14} className="shrink-0" />
              <span>
                Ada surplus <strong className="font-mono">{formatRp(unallocated)}</strong> dari penghasilan yang belum dianggarkan.
              </span>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-brand/10 border border-brand/30 text-brand text-xs flex items-center gap-1.5">
              <Check size={14} className="shrink-0" />
              <span>
                Sempurna! 100% penghasilan teralokasi disiplin sesuai kaidah Zero-Based Budgeting.
              </span>
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-borderc">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            onClick={handleSaveBudget}
            disabled={saving || categories.length === 0}
            className="bg-brand text-black font-semibold hover:brightness-110 shadow-sm"
          >
            {saving ? <Spinner size={16} /> : <Check size={16} />}
            <span>Simpan & Aktifkan Anggaran {nextMonthName}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
