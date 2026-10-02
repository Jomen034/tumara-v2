import React, { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import {
  ReceiptText,
  Calendar,
  Wallet as WalletIcon,
  CheckCircle2,
  Pencil,
  Trash2,
  Clock,
  Sparkles,
  AlertTriangle,
  Tag,
  ArrowRight,
  TrendingDown,
  History,
} from "lucide-react";
import api from "../lib/api";
import { formatRp, formatDate } from "../lib/format";
import { catMeta } from "../lib/constants";
import { Modal, Button, Badge, Progress, Spinner } from "./ui";

const RECUR_LABELS = {
  monthly: "Bulanan",
  weekly: "Mingguan",
  yearly: "Tahunan",
  once: "Sekali Bayar",
};

export default function BillDetailModal({
  open,
  onClose,
  bill,
  wallets = [],
  privacy = false,
  onPay,
  onEdit,
  onDelete,
  paying = false,
}) {
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (open && bill?.id) {
      setLoadingHistory(true);
      api
        .get(`/bills/${bill.id}/history`)
        .then((res) => setHistory(res.data))
        .catch(() => setHistory(null))
        .finally(() => setLoadingHistory(false));
    } else {
      setHistory(null);
    }
  }, [open, bill?.id]);

  if (!bill) return null;

  const isInstallment = bill.bill_type === "installment";
  const isCompleted = bill.is_completed || (isInstallment && bill.total_tenor > 0 && bill.paid_tenor >= bill.total_tenor);
  const wallet = wallets.find((w) => w.id === bill.wallet_id);
  const m = catMeta(bill.category);
  const Ic = Icons[m.icon] || ReceiptText;

  const dueColor = (d) => {
    if (isCompleted) return "var(--brand)";
    return d < 0 ? "var(--rose)" : d <= 3 ? "var(--amber)" : "var(--brand)";
  };

  const dueLabel = (d) => {
    if (isCompleted) return "Lunas Sepenuhnya 🎉";
    return d < 0
      ? `Telat ${Math.abs(d)} hari`
      : d === 0
      ? "Jatuh tempo hari ini"
      : `${d} hari lagi`;
  };

  const totalTenor = bill.total_tenor || 0;
  const paidTenor = bill.paid_tenor || 0;
  const remainingTenor = Math.max(0, totalTenor - paidTenor);
  const progressPct = totalTenor > 0 ? Math.min(100, Math.round((paidTenor / totalTenor) * 100)) : 0;
  const remainingAmount = remainingTenor * bill.amount;
  const totalPaidEstimate = paidTenor * bill.amount;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detail Tagihan"
      testid="bill-detail-modal"
      size="md"
    >
      <div className="space-y-6">
        {/* Main Bill Header Card */}
        <div className="rounded-2xl bg-elevated/70 border border-borderc p-5 sm:p-6 text-center relative overflow-hidden">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3"
            style={{ backgroundColor: `${dueColor(bill.days_until)}22` }}
          >
            <Ic size={24} style={{ color: dueColor(bill.days_until) }} />
          </div>

          <h3 className="font-head font-extrabold text-xl text-tprimary truncate max-w-xs mx-auto">
            {bill.name}
          </h3>

          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge color={dueColor(bill.days_until)}>
              {!isCompleted && bill.days_until <= 3 && <AlertTriangle size={11} />}
              {dueLabel(bill.days_until)}
            </Badge>
            <Badge color={isInstallment ? "var(--cyan)" : "var(--brand)"}>
              {isInstallment ? "Cicilan Ber-tenor" : "Tagihan Rutin"}
            </Badge>
          </div>

          <p
            className={`text-3xl sm:text-4xl font-head font-extrabold font-mono mt-3 ${
              bill.days_until < 0 && !isCompleted ? "text-rose" : "text-tprimary"
            } ${privacy ? "privacy-blur" : ""}`}
          >
            {formatRp(bill.amount, privacy)}
            <span className="text-xs font-normal text-tmuted font-sans">
              {" "}
              / {RECUR_LABELS[bill.recurrence] || "periode"}
            </span>
          </p>

          {bill.note && (
            <p className="text-xs text-tsecondary mt-2 max-w-md mx-auto italic">
              "{bill.note}"
            </p>
          )}
        </div>

        {/* Installment Tenor Widget (If Loan / Installment) */}
        {isInstallment && totalTenor > 0 && (
          <div className="rounded-2xl bg-cyan/5 border border-cyan/20 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan flex items-center gap-1.5">
                <Sparkles size={14} /> Progress Cicilan
              </span>
              <span className="font-mono text-xs font-bold text-cyan">
                {progressPct}% ({paidTenor}/{totalTenor})
              </span>
            </div>

            <Progress
              value={progressPct}
              color={isCompleted ? "var(--brand)" : "var(--cyan)"}
              className="h-2"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="bg-surface/80 rounded-xl p-2.5 border border-borderc">
                <span className="text-tmuted block">Sudah Terbayar</span>
                <span className={`font-mono font-bold text-brand ${privacy ? "privacy-blur" : ""}`}>
                  {formatRp(totalPaidEstimate, privacy)}
                </span>
                <span className="text-[10px] text-tmuted block">({paidTenor}x bayar)</span>
              </div>

              <div className="bg-surface/80 rounded-xl p-2.5 border border-borderc">
                <span className="text-tmuted block">Sisa Kewajiban</span>
                <span className={`font-mono font-bold ${remainingTenor > 0 ? "text-rose" : "text-brand"} ${privacy ? "privacy-blur" : ""}`}>
                  {formatRp(remainingAmount, privacy)}
                </span>
                <span className="text-[10px] text-tmuted block">({remainingTenor}x lagi)</span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-surface/80 rounded-xl p-2.5 border border-borderc">
                <span className="text-tmuted block">Status Angsuran</span>
                <span className="font-semibold text-tprimary block">
                  {isCompleted ? "Lunas Sepenuhnya" : `Cicilan ke-${paidTenor + 1}`}
                </span>
                <span className="text-[10px] text-tmuted block">
                  {isCompleted ? "Tidak ada tagihan lagi" : `Dari ${totalTenor} angsuran`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Specs */}
        <div className="space-y-3 divide-y divide-borderc/40 text-sm">
          <div className="flex items-center justify-between pt-1">
            <span className="text-tmuted flex items-center gap-2">
              <Calendar size={16} />
              Jatuh Tempo Berikutnya
            </span>
            <span className="font-medium font-mono text-tprimary">
              {formatDate(bill.next_due_date)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="text-tmuted flex items-center gap-2">
              <Clock size={16} />
              Perulangan
            </span>
            <span className="font-medium text-tprimary">
              {RECUR_LABELS[bill.recurrence] || bill.recurrence}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="text-tmuted flex items-center gap-2">
              <Tag size={16} />
              Kategori
            </span>
            <span className="font-medium text-tprimary flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${m.color}25` }}
              >
                <Ic size={11} style={{ color: m.color }} />
              </div>
              {bill.category}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="text-tmuted flex items-center gap-2">
              <WalletIcon size={16} />
              Bayar Otomatis Dari
            </span>
            <span className="font-medium text-tprimary">
              {wallet ? (
                <span className="font-semibold text-brand">{wallet.name}</span>
              ) : (
                <span className="text-tmuted">— Tidak otomatis catat —</span>
              )}
            </span>
          </div>
        </div>

        {/* Payment History Log */}
        <div className="space-y-3 pt-2 border-t border-borderc">
          <div className="flex items-center justify-between">
            <h4 className="font-head font-bold text-sm text-tprimary uppercase tracking-wider flex items-center gap-1.5">
              <History size={16} className="text-brand" />
              Riwayat Bayar di Tumara
            </h4>
            {history && history.payment_count_in_app > 0 && (
              <span className="text-xs text-tmuted font-mono">
                {history.payment_count_in_app}x · {formatRp(history.total_paid_in_app, privacy)}
              </span>
            )}
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-6 text-sm text-tsecondary gap-2">
              <Spinner size={16} className="text-brand" /> Memuat riwayat...
            </div>
          ) : !history || history.transactions?.length === 0 ? (
            <div className="rounded-xl bg-elevated/40 border border-borderc p-4 text-center">
              <p className="text-xs text-tsecondary">
                Belum ada riwayat pembayaran yang tercatat via Tumara.
              </p>
              <p className="text-[11px] text-tmuted mt-0.5">
                Setiap kali Anda menekan tombol "Bayar", riwayat mutasi akan tercatat otomatis di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 divide-y divide-borderc/40">
              {history.transactions.map((tx) => (
                <div key={tx.id} className="pt-2 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-tprimary">{tx.note || "Bayar Tagihan"}</p>
                    <p className="text-tmuted mt-0.5">{formatDate(tx.date || tx.created_at)}</p>
                  </div>
                  <span className={`font-mono font-bold text-rose ${privacy ? "privacy-blur" : ""}`}>
                    -{formatRp(tx.amount, privacy)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="space-y-2 pt-2 border-t border-borderc">
          <div className="flex gap-2">
            {!isCompleted && (
              <Button
                onClick={() => onPay?.(bill)}
                disabled={paying}
                className="flex-1"
                size="md"
              >
                <CheckCircle2 size={16} />
                {paying ? "Mencatat Pembayaran..." : "Bayar Tagihan Ini"}
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => onEdit?.(bill)}
              className={isCompleted ? "flex-1" : "shrink-0"}
              size="md"
            >
              <Pencil size={15} /> Edit
            </Button>

            <button
              onClick={() => onDelete?.(bill.id)}
              className="p-2.5 rounded-full hover:bg-elevated text-tmuted hover:text-rose transition-colors shrink-0"
              title="Hapus tagihan"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
