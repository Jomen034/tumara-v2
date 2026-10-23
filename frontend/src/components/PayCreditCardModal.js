import React, { useState, useEffect, useMemo } from "react";
import * as Icons from "lucide-react";
import {
  CreditCard,
  CheckCircle2,
  Wallet as WalletIcon,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { formatRp, formatDate } from "../lib/format";
import { walletMeta } from "../lib/constants";
import { useTheme } from "../context/ThemeContext";
import { Modal, Button, Badge, Spinner, Input, Select } from "./ui";

export default function PayCreditCardModal({
  open,
  onClose,
  creditCard,
  wallets = [],
  onSuccess,
}) {
  const { privacy } = useTheme();
  const [sourceWalletId, setSourceWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Asset wallets eligible for paying debt (Bank, Cash, E-Wallet)
  const eligibleWallets = useMemo(() => {
    return wallets.filter((w) => !["credit_card", "paylater"].includes(w.type));
  }, [wallets]);

  useEffect(() => {
    if (open && creditCard) {
      const curDebt = Math.max(0, Number(creditCard.balance) || 0);
      setAmount(curDebt > 0 ? String(curDebt) : "");

      // Default source wallet: pick bank/cash with highest balance, or first eligible
      if (eligibleWallets.length > 0) {
        const sortedByBal = [...eligibleWallets].sort(
          (a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0)
        );
        setSourceWalletId(sortedByBal[0].id);
      } else {
        setSourceWalletId("");
      }

      const today = new Date().toISOString().slice(0, 10);
      setPaidDate(today);
      setNote(`Pembayaran Tagihan ${creditCard.name}`);
    }
  }, [open, creditCard, eligibleWallets]);

  if (!creditCard) return null;

  const m = walletMeta(creditCard.type);
  const Ic = Icons[m.icon] || CreditCard;
  const currentDebt = Math.max(0, Number(creditCard.balance) || 0);
  const effectiveAmount = parseFloat(amount) > 0 ? parseFloat(amount) : 0;
  const sourceWallet = wallets.find((w) => w.id === sourceWalletId);
  const sourceBal = Number(sourceWallet?.balance) || 0;

  const remainingDebt = Math.max(0, currentDebt - effectiveAmount);
  const nextSourceBal = sourceBal - effectiveAmount;
  const isSourceInsufficient = sourceWallet && effectiveAmount > sourceBal;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!sourceWalletId) {
      return toast.error("Pilih rekening sumber pembayaran");
    }
    if (effectiveAmount <= 0) {
      return toast.error("Masukkan nominal pembayaran lebih dari 0");
    }

    setSubmitting(true);
    try {
      const payload = {
        credit_card_wallet_id: creditCard.id,
        from_wallet_id: sourceWalletId,
        amount: effectiveAmount,
        paid_date: paidDate || new Date().toISOString().slice(0, 10),
        note: note.trim() || undefined,
      };

      await api.post("/bills/pay-credit-card", payload);
      toast.success(
        `🎉 Berhasil membayar tagihan ${creditCard.name} sebesar ${formatRp(effectiveAmount, privacy)}!`
      );
      onSuccess?.();
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
      title="Bayar Tagihan Kartu Kredit"
      testid="pay-credit-card-modal"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card Header Banner */}
        <div className="rounded-2xl bg-elevated/70 border border-borderc p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${creditCard.color}22` }}
            >
              <Ic size={22} style={{ color: creditCard.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-tprimary truncate">
                {creditCard.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge color={creditCard.color}>{m.label}</Badge>
                {creditCard.due_day && (
                  <span className="text-[11px] text-tmuted font-medium">
                    Jatuh tempo tgl {creditCard.due_day}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] text-tmuted uppercase font-semibold block">
              Tagihan Terpakai
            </span>
            <span
              className={`font-mono font-bold text-base sm:text-lg text-rose ${
                privacy ? "privacy-blur" : ""
              }`}
            >
              {formatRp(currentDebt, privacy)}
            </span>
          </div>
        </div>

        {/* Source Wallet Selection */}
        <Select
          label="Bayar Dari (Sumber Dana)"
          value={sourceWalletId}
          onChange={(e) => setSourceWalletId(e.target.value)}
          data-testid="pay-cc-source-wallet"
        >
          {eligibleWallets.length === 0 ? (
            <option value="">Tidak ada rekening bank/tunai tersedia</option>
          ) : (
            eligibleWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({walletMeta(w.type).label} — Saldo: {formatRp(w.balance, privacy)})
              </option>
            ))
          )}
        </Select>

        {/* Amount Input */}
        <div className="space-y-1.5">
          <Input
            label="Nominal Pembayaran (Rp)"
            prefix="Rp"
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-testid="pay-cc-amount-input"
          />

          {/* Quick Amount Shortcut Chips */}
          {currentDebt > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => setAmount(String(currentDebt))}
                className="text-xs px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/30 text-brand font-semibold hover:bg-brand/20 transition-colors"
              >
                Bayar Penuh ({formatRp(currentDebt, privacy)})
              </button>
              {currentDebt >= 1000000 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.min(currentDebt, 1000000)))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-elevated border border-borderc text-tsecondary hover:text-tprimary hover:bg-hover transition-colors"
                >
                  Rp 1.000.000
                </button>
              )}
              {currentDebt >= 500000 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.min(currentDebt, 500000)))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-elevated border border-borderc text-tsecondary hover:text-tprimary hover:bg-hover transition-colors"
                >
                  Rp 500.000
                </button>
              )}
              {currentDebt >= 200000 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.min(currentDebt, 200000)))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-elevated border border-borderc text-tsecondary hover:text-tprimary hover:bg-hover transition-colors"
                >
                  Rp 200.000
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Balance Preview Card */}
        {sourceWallet && effectiveAmount > 0 && (
          <div className="rounded-xl p-3 bg-surface border border-borderc space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-tmuted">Sisa Tagihan Kartu Setelah Bayar:</span>
              <span
                className={`font-mono font-bold ${
                  remainingDebt === 0 ? "text-brand" : "text-rose"
                } ${privacy ? "privacy-blur" : ""}`}
              >
                {remainingDebt === 0 ? "LUNAS (Rp 0)" : formatRp(remainingDebt, privacy)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-tmuted">Sisa Saldo {sourceWallet.name}:</span>
              <span
                className={`font-mono font-bold ${
                  isSourceInsufficient ? "text-rose" : "text-tprimary"
                } ${privacy ? "privacy-blur" : ""}`}
              >
                {formatRp(nextSourceBal, privacy)}
              </span>
            </div>

            {isSourceInsufficient && (
              <div className="flex items-center gap-1.5 text-rose text-[11px] pt-1 border-t border-borderc/40 font-medium">
                <AlertTriangle size={13} className="shrink-0" />
                <span>Saldo rekening sumber tidak mencukupi untuk nominal ini.</span>
              </div>
            )}
          </div>
        )}

        {/* Date & Note Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Tanggal Bayar"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            data-testid="pay-cc-date-input"
          />

          <Input
            label="Catatan (Opsional)"
            placeholder="cth. Pelunasan CC BCA"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="pay-cc-note-input"
          />
        </div>

        {/* Accounting Integrity Disclaimer */}
        <div className="rounded-xl p-3 bg-elevated/50 border border-borderc/60 flex items-start gap-2.5 text-xs text-tmuted">
          <Info size={15} className="text-brand shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Pembayaran ini akan dicatat sebagai <strong>Transfer</strong> dari rekening ke kartu kredit. Saldo tagihan kartu kredit langsung berkurang tanpa menduplikasi pos pengeluaran.
          </p>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full mt-2"
          size="lg"
          disabled={submitting || !sourceWalletId || effectiveAmount <= 0}
          data-testid="pay-cc-confirm-button"
        >
          {submitting ? (
            <Spinner size={16} />
          ) : (
            <>
              <CheckCircle2 size={16} />
              Konfirmasi Pembayaran ({formatRp(effectiveAmount, privacy)})
            </>
          )}
        </Button>
      </form>
    </Modal>
  );
}
