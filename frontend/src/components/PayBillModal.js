import React, { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import {
  CheckCircle2,
  Wallet as WalletIcon,
  Calendar,
  AlertTriangle,
  ReceiptText,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { formatRp, formatDate } from "../lib/format";
import { catMeta, walletMeta } from "../lib/constants";
import { useTheme } from "../context/ThemeContext";
import { Modal, Button, Badge, Spinner } from "./ui";

export default function PayBillModal({
  open,
  onClose,
  bill,
  wallets = [],
  onSuccess,
}) {
  const { privacy } = useTheme();
  const [walletId, setWalletId] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [note, setNote] = useState("");
  const [recordTransaction, setRecordTransaction] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && bill) {
      // Pick initial wallet
      if (bill.wallet_id && wallets.some((w) => w.id === bill.wallet_id)) {
        setWalletId(bill.wallet_id);
      } else if (wallets.length > 0) {
        // Fallback to first non-debt wallet, or first wallet
        const preferred = wallets.find((w) => !["credit_card", "paylater"].includes(w.type)) || wallets[0];
        setWalletId(preferred?.id || "");
      } else {
        setWalletId("");
      }

      // Default paid date = today
      const today = new Date().toISOString().slice(0, 10);
      setPaidDate(today);

      // Default note
      const isInstallment = bill.bill_type === "installment";
      if (isInstallment) {
        const nextTenor = (bill.paid_tenor || 0) + 1;
        const tot = bill.total_tenor;
        setNote(`Bayar cicilan ke-${nextTenor}/${tot || "?"}: ${bill.name}`);
      } else {
        setNote(`Bayar tagihan: ${bill.name}`);
      }
      setRecordTransaction(true);
    }
  }, [open, bill, wallets]);

  if (!bill) return null;

  const isInstallment = bill.bill_type === "installment";
  const m = catMeta(bill.category);
  const Ic = Icons[m.icon] || ReceiptText;

  const selectedWallet = wallets.find((w) => w.id === walletId);
  const isDebtWallet = selectedWallet && ["credit_card", "paylater"].includes(selectedWallet.type);

  // Compute balance preview
  let balancePreview = null;
  if (selectedWallet && recordTransaction) {
    const curBal = Number(selectedWallet.balance) || 0;
    if (isDebtWallet) {
      // Debt increases when charged
      const nextDebt = curBal + bill.amount;
      balancePreview = {
        label: "Total tagihan kartu bertambah:",
        before: curBal,
        after: nextDebt,
        isWarning: selectedWallet.credit_limit && nextDebt > selectedWallet.credit_limit,
      };
    } else {
      // Asset decreases
      const nextBal = curBal - bill.amount;
      balancePreview = {
        label: "Sisa saldo setelah bayar:",
        before: curBal,
        after: nextBal,
        isWarning: nextBal < 0,
      };
    }
  }

  const handleConfirm = async (e) => {
    e?.preventDefault();
    if (recordTransaction && !walletId) {
      return toast.error("Silakan pilih dompet untuk memotong pembayaran");
    }

    setSubmitting(true);
    try {
      const payload = {
        wallet_id: recordTransaction ? walletId : null,
        paid_date: paidDate || new Date().toISOString().slice(0, 10),
        note: note.trim() || undefined,
        record_transaction: recordTransaction,
      };

      const res = await api.post(`/bills/${bill.id}/pay`, payload);
      const updated = res.data;

      if (updated.is_completed) {
        toast.success(`🎉 Luar biasa! "${bill.name}" telah lunas sepenuhnya!`);
      } else if (recordTransaction && selectedWallet) {
        toast.success(
          `Pembayaran "${bill.name}" sebesar ${formatRp(bill.amount, privacy)} berhasil dicatat dari ${selectedWallet.name}!`
        );
      } else {
        toast.success(`Tagihan "${bill.name}" berhasil ditandai lunas untuk siklus ini!`);
      }

      onSuccess?.(updated);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mencatat pembayaran tagihan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Konfirmasi Pembayaran Tagihan"
      testid="pay-bill-confirm-modal"
      size="sm"
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        {/* Bill Summary Hero Card */}
        <div className="p-4 rounded-2xl bg-elevated/70 border border-borderc flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${m.color}22` }}
            >
              <Ic size={20} style={{ color: m.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-tprimary truncate">{bill.name}</p>
              <p className="text-xs text-tmuted flex items-center gap-1.5 mt-0.5">
                <span>{bill.category}</span>
                {isInstallment && (
                  <Badge color="var(--cyan)">
                    Cicilan {(bill.paid_tenor || 0) + 1}/{bill.total_tenor || "?"}
                  </Badge>
                )}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-tmuted uppercase block font-semibold">Nominal</span>
            <span
              className={`font-mono text-base font-bold text-brand ${
                privacy ? "privacy-blur" : ""
              }`}
            >
              {formatRp(bill.amount, privacy)}
            </span>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5">
          {/* Toggle: Record Transaction */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-borderc">
            <div className="pr-2">
              <label htmlFor="record-trx-toggle" className="text-xs font-semibold text-tprimary cursor-pointer block">
                Potong Saldo & Catat Transaksi
              </label>
              <p className="text-[11px] text-tmuted mt-0.5">
                Otomatis mencatat pengeluaran di mutasi dompet & laporan anggaran
              </p>
            </div>
            <input
              id="record-trx-toggle"
              type="checkbox"
              checked={recordTransaction}
              onChange={(e) => setRecordTransaction(e.target.checked)}
              className="w-4 h-4 text-brand bg-elevated border-borderc rounded focus:ring-brand accent-brand cursor-pointer shrink-0"
            />
          </div>

          {/* Wallet Selector (Shown when recordTransaction is true) */}
          {recordTransaction ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-tsecondary flex items-center gap-1.5">
                <WalletIcon size={13} className="text-brand" />
                Bayar Menggunakan Dompet / Rekening
              </label>
              <div className="relative">
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full bg-elevated border border-borderc rounded-xl px-3 py-2.5 text-sm text-tprimary focus:border-brand focus:outline-none appearance-none cursor-pointer"
                  data-testid="pay-wallet-select"
                >
                  <option value="">-- Pilih Dompet Pembayar --</option>
                  {wallets.map((w) => {
                    const wm = walletMeta(w.type);
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} ({wm.label}) · {formatRp(w.balance, privacy)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Balance Simulation Preview */}
              {balancePreview && (
                <div
                  className={`text-xs px-3 py-2 rounded-xl flex items-center justify-between font-mono ${
                    balancePreview.isWarning
                      ? "bg-rose/10 text-rose border border-rose/25"
                      : "bg-elevated/40 text-tsecondary border border-borderc/40"
                  }`}
                >
                  <span className="text-[11px] font-sans font-medium flex items-center gap-1">
                    {balancePreview.isWarning && <AlertTriangle size={12} />}
                    {balancePreview.label}
                  </span>
                  <span className="font-bold">
                    {formatRp(balancePreview.after, privacy)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber/10 border border-amber/25 text-amber text-xs flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                <strong>Catatan:</strong> Tidak ada saldo dompet yang dipotong dan tidak ada transaksi baru yang dibuat. Siklus tagihan hanya akan dimajukan ke periode berikutnya.
              </span>
            </div>
          )}

          {/* Paid Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-tsecondary flex items-center gap-1.5">
              <Calendar size={13} className="text-brand" />
              Tanggal Pembayaran
            </label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full bg-elevated border border-borderc rounded-xl px-3 py-2 text-sm text-tprimary focus:border-brand focus:outline-none"
              data-testid="pay-date-input"
            />
          </div>

          {/* Optional Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-tsecondary flex items-center gap-1.5">
              <FileText size={13} className="text-brand" />
              Catatan Pengeluaran (Opsional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Bayar tagihan wifi via BCA"
              className="w-full bg-elevated border border-borderc rounded-xl px-3 py-2 text-sm text-tprimary focus:border-brand focus:outline-none"
              data-testid="pay-note-input"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5 pt-3 border-t border-borderc">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Batal
          </Button>

          <Button
            type="submit"
            disabled={submitting || (recordTransaction && !walletId)}
            className="flex-1"
            data-testid="confirm-pay-bill-btn"
          >
            {submitting ? (
              <>
                <Spinner size={15} /> Memproses...
              </>
            ) : (
              <>
                <CheckCircle2 size={15} /> Konfirmasi & Bayar
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
