import React, { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import {
  Pencil,
  Plus,
  Calendar,
  Flame,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Check,
  X,
  Receipt,
  Clock,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import api from "../lib/api";
import { formatRp, formatDate, formatShort } from "../lib/format";
import { catMeta } from "../lib/constants";
import { useTheme } from "../context/ThemeContext";
import { Modal, Button, Badge, Progress, Spinner, Input } from "./ui";

const GROUP_LABEL = {
  needs: "Kebutuhan",
  wants: "Keinginan",
  savings: "Tabungan",
};

const GROUP_COLOR = {
  needs: "var(--brand)",
  wants: "var(--amber)",
  savings: "var(--cyan)",
};

export default function BudgetDetailModal({
  category,
  initialGroup = "needs",
  initialLimit = 0,
  open,
  onClose,
  onAddExpense,
  onUpdated,
}) {
  const { privacy } = useTheme();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  const categoryName = typeof category === "string" ? category : category?.category;

  const fetchDetail = async () => {
    if (!categoryName) return;
    setLoading(true);
    try {
      const res = await api.get(`/budget/category/${encodeURIComponent(categoryName)}`);
      setDetail(res.data);
      setLimitInput(String(res.data.limit || 0));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && categoryName) {
      setEditingLimit(false);
      fetchDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categoryName]);

  if (!categoryName) return null;

  const meta = catMeta(categoryName);
  const IconComp = (meta?.icon && Icons[meta.icon]) || Icons.Tag;

  const spent = detail ? detail.spent : 0;
  const limit = detail ? detail.limit : initialLimit;
  const group = (detail && detail.group) || initialGroup;
  const remaining = detail ? detail.remaining : Math.max(0, limit - spent);
  const isOver = detail ? detail.over : spent > limit && limit > 0;
  const overAmount = detail ? detail.over_amount : Math.max(0, spent - limit);
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const daysLeft = detail?.days_left ?? 1;
  const safeDailySpend = detail?.safe_daily_spend ?? 0;
  const dailySpentAvg = detail?.daily_spent_avg ?? 0;
  const txns = detail?.transactions || [];

  const handleSaveLimit = async () => {
    const val = parseFloat(limitInput);
    if (isNaN(val) || val < 0) {
      return toast.error("Masukkan angka limit yang valid");
    }
    setSavingLimit(true);
    try {
      await api.put(`/budget/category/${encodeURIComponent(categoryName)}`, {
        limit: val,
        group,
      });
      toast.success(`Limit ${categoryName} berhasil diperbarui! 🎯`);
      setEditingLimit(false);
      fetchDetail();
      if (onUpdated) onUpdated();
    } catch {
      toast.error("Gagal memperbarui limit kategori");
    } finally {
      setSavingLimit(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={categoryName}
      testid="budget-detail-modal"
      size="md"
    >
      <div className="space-y-5">
        {/* Header Hero Banner */}
        <div className="rounded-2xl bg-elevated/60 border border-borderc p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-borderc"
              style={{
                backgroundColor: `${meta.color || "var(--brand)"}20`,
                color: meta.color || "var(--brand)",
              }}
            >
              <IconComp size={24} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg sm:text-xl text-tprimary truncate">
                {categoryName}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge color={GROUP_COLOR[group] || "var(--brand)"}>
                  {GROUP_LABEL[group] || "Kategori"}
                </Badge>
                {isOver ? (
                  <Badge color="var(--rose)">
                    <AlertTriangle size={12} /> Overbudget {formatShort(overAmount, privacy)}
                  </Badge>
                ) : pct >= 80 ? (
                  <Badge color="var(--amber)">
                    <AlertCircle size={12} /> Waspada ({pct}%)
                  </Badge>
                ) : (
                  <Badge color="var(--brand)">
                    <CheckCircle2 size={12} /> Aman ({pct}%)
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLimitInput(String(limit));
              setEditingLimit(!editingLimit);
            }}
            className="shrink-0 text-xs"
            title="Sesuaikan limit kategori ini"
          >
            <Pencil size={13} />
            <span className="hidden sm:inline">Ubah Limit</span>
          </Button>
        </div>

        {/* Quick Inline Limit Editor */}
        {editingLimit && (
          <div className="p-4 rounded-2xl bg-surface border border-brand/50 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tprimary flex items-center gap-1.5">
                <Pencil size={13} className="text-brand" /> Atur Limit Kategori Ini
              </span>
              <button
                type="button"
                onClick={() => setEditingLimit(false)}
                className="text-tmuted hover:text-tsecondary"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                prefix="Rp"
                type="number"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                placeholder="0"
                autoFocus
                className="font-mono text-sm"
              />
              <Button
                size="md"
                onClick={handleSaveLimit}
                disabled={savingLimit}
                className="shrink-0"
              >
                {savingLimit ? <Spinner size={14} /> : <Check size={14} />} Simpan
              </Button>
            </div>
          </div>
        )}

        {/* Progress & 3-Column Quota Stats */}
        <div className="rounded-2xl bg-surface border border-borderc p-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-tsecondary">
            <span>PENGGUNAAN KUOTA BULAN INI</span>
            <span className={clsx("font-mono", isOver ? "text-rose" : "text-tprimary")}>
              {pct}%
            </span>
          </div>

          <Progress
            value={pct}
            color={isOver ? "var(--rose)" : pct >= 80 ? "var(--amber)" : "var(--brand)"}
            className="h-2.5"
          />

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-borderc text-center">
            <div className="p-2 rounded-xl bg-elevated/40">
              <span className="text-[11px] text-tmuted block font-medium">Terpakai</span>
              <span
                className={clsx(
                  "font-mono font-bold text-sm block mt-0.5",
                  privacy && "privacy-blur",
                  isOver ? "text-rose" : "text-tprimary"
                )}
              >
                {formatRp(spent, privacy)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-elevated/40">
              <span className="text-[11px] text-tmuted block font-medium">Limit</span>
              <span
                className={clsx(
                  "font-mono font-bold text-sm text-tprimary block mt-0.5",
                  privacy && "privacy-blur"
                )}
              >
                {formatRp(limit, privacy)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-elevated/40">
              <span className="text-[11px] text-tmuted block font-medium">
                {isOver ? "Defisit" : "Sisa Kuota"}
              </span>
              <span
                className={clsx(
                  "font-mono font-bold text-sm block mt-0.5",
                  privacy && "privacy-blur",
                  isOver ? "text-rose" : "text-brand"
                )}
              >
                {isOver
                  ? `-${formatRp(overAmount, privacy)}`
                  : formatRp(remaining, privacy)}
              </span>
            </div>
          </div>
        </div>

        {/* Smart Daily Burn Rate & Pace Advisor */}
        <div
          className={clsx(
            "rounded-2xl border p-4 transition-colors",
            isOver
              ? "bg-rose/10 border-rose/30 text-rose"
              : pct >= 80
              ? "bg-amber/10 border-amber/30 text-amber"
              : "bg-brand/10 border-brand/30 text-brand"
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={clsx(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                isOver ? "bg-rose/20" : pct >= 80 ? "bg-amber/20" : "bg-brand/20"
              )}
            >
              {isOver ? (
                <AlertTriangle size={18} />
              ) : (
                <Flame size={18} />
              )}
            </div>
            <div className="flex-1 text-xs">
              <div className="font-bold text-sm text-tprimary mb-1">
                {isOver
                  ? "Batas Anggaran Terlewati"
                  : `Batas Belanja Aman: ${formatRp(safeDailySpend, privacy)} / hari`}
              </div>
              <p className="text-tsecondary leading-relaxed">
                {isOver ? (
                  <>
                    Kategori ini sudah defisit{" "}
                    <strong className="text-rose font-mono">
                      {formatRp(overAmount, privacy)}
                    </strong>
                    . Disarankan menahan belanja di pos ini untuk sisa{" "}
                    <strong>{daysLeft} hari</strong> bulan ini agar tidak semakin membengkak.
                  </>
                ) : remaining > 0 ? (
                  <>
                    Untuk mempertahankan sisa anggaran sebesar{" "}
                    <strong className="text-tprimary font-mono">
                      {formatRp(remaining, privacy)}
                    </strong>{" "}
                    selama <strong className="text-tprimary">{daysLeft} hari ke depan</strong>,
                    pengeluaran maksimal harian adalah{" "}
                    <strong className="text-brand font-mono">
                      {formatRp(safeDailySpend, privacy)}/hari
                    </strong>
                    . (Rata-rata terpakai saat ini:{" "}
                    <span className="font-mono text-tsecondary">
                      {formatRp(dailySpentAvg, privacy)}/hari
                    </span>
                    )
                  </>
                ) : (
                  <>Limit anggaran pos ini telah habis untuk bulan ini.</>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: + Catat Pengeluaran */}
        <div>
          <Button
            onClick={() => {
              if (onAddExpense) {
                onAddExpense(categoryName);
              }
            }}
            className="w-full"
            size="md"
          >
            <Plus size={16} /> Catat Pengeluaran di {categoryName}
          </Button>
        </div>

        {/* Transactions List this Month */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-tsecondary uppercase tracking-wider flex items-center gap-1.5">
              <Receipt size={14} className="text-brand" /> Transaksi Bulan Ini
            </h4>
            <span className="text-xs text-tmuted font-mono">
              {txns.length} transaksi
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size={24} className="text-brand" />
            </div>
          ) : txns.length === 0 ? (
            <div className="p-6 rounded-2xl bg-elevated/40 border border-borderc text-center">
              <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center mx-auto mb-2 text-tmuted">
                <Clock size={18} />
              </div>
              <p className="text-sm font-medium text-tsecondary">Belum ada pengeluaran</p>
              <p className="text-xs text-tmuted mt-0.5">
                Belum ada transaksi di pos {categoryName} pada bulan ini.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {txns.map((t, idx) => (
                <div
                  key={t.id || idx}
                  className="p-3 rounded-xl bg-surface border border-borderc flex items-center justify-between gap-3 text-xs hover:border-brand/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-tprimary truncate">
                      {t.note || categoryName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-tmuted text-[11px]">
                      <Calendar size={11} />
                      <span>{formatDate(t.date)}</span>
                      {t.source && t.source !== "manual" && (
                        <span className="px-1.5 py-0.5 rounded bg-elevated text-[10px]">
                          {t.source}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={clsx(
                      "font-mono font-bold text-rose shrink-0 text-right",
                      privacy && "privacy-blur"
                    )}
                  >
                    -{formatRp(t.amount, privacy)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
