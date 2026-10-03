import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  Pencil,
  Receipt,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { formatRp, formatDate } from "../lib/format";
import { walletMeta, catMeta } from "../lib/constants";
import { useTheme } from "../context/ThemeContext";
import { Modal, Button, Badge, Progress, Spinner, EmptyState } from "./ui";

export default function WalletDetailModal({
  wallet,
  open,
  onClose,
  onEdit,
  onAddTransaction,
  onSelectTxn,
}) {
  const { privacy } = useTheme();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !wallet?.id) return;
    setLoading(true);
    api
      .get(`/wallets/${wallet.id}/detail`, { params: { limit: 10 } })
      .then((res) => setDetail(res.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, wallet?.id]);

  if (!wallet) return null;

  const m = walletMeta(wallet.type);
  const Ic = Icons[m.icon] || Wallet;
  const isDebt = ["credit_card", "paylater"].includes(wallet.type);
  const hasLimit = isDebt && (wallet.credit_limit || 0) > 0;
  const sisaLimit = hasLimit ? Math.max(0, wallet.credit_limit - wallet.balance) : 0;
  const utilPct = hasLimit
    ? Math.min(100, Math.round((wallet.balance / wallet.credit_limit) * 100))
    : 0;
  const utilColor =
    utilPct > 70 ? "var(--rose)" : utilPct > 30 ? "#F59E0B" : "var(--brand)";

  const recentTxns = [...(detail?.recent_transactions || [])].sort((a, b) => {
    const dA = a.date || (a.created_at ? a.created_at.slice(0, 10) : "");
    const dB = b.date || (b.created_at ? b.created_at.slice(0, 10) : "");
    if (dA !== dB) return dB.localeCompare(dA);
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
  const flow = detail?.monthly_flow || { inflow: 0, outflow: 0, net: 0 };
  const txnCount = detail?.transaction_count || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={wallet.name}
      testid="wallet-detail-modal"
      size="md"
    >
      <div className="space-y-5">
        {/* Wallet Identity Header Banner */}
        <div className="rounded-2xl bg-elevated/60 border border-borderc p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${wallet.color}22` }}
            >
              <Ic size={26} style={{ color: wallet.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-tprimary truncate">{wallet.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge color={m.color}>{m.label}</Badge>
                {hasLimit && (
                  <Badge color={utilColor}>
                    {utilPct > 70
                      ? "Utilisasi Tinggi"
                      : utilPct > 30
                      ? "Utilisasi Waspada"
                      : "Utilisasi Sehat"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              onEdit?.(wallet);
            }}
            className="p-2.5 rounded-xl bg-surface border border-borderc hover:bg-elevated text-tsecondary hover:text-tprimary transition-colors shrink-0"
            title="Edit Dompet"
          >
            <Pencil size={16} />
          </button>
        </div>

        {/* Balance & Credit Limit Status */}
        <div className="rounded-2xl bg-surface border border-borderc p-4 sm:p-5 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider block">
                {isDebt ? "Tagihan Terpakai Saat Ini" : "Saldo Saat Ini"}
              </span>
              <p
                className={`font-mono font-bold text-2xl sm:text-3xl ${
                  isDebt ? "text-rose" : "text-brand"
                } ${privacy ? "privacy-blur" : ""}`}
              >
                {formatRp(wallet.balance, privacy)}
              </p>
            </div>

            {hasLimit && (
              <div className="text-right">
                <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider block">
                  Sisa Limit
                </span>
                <p
                  className={`font-mono font-bold text-lg sm:text-xl text-cyan ${
                    privacy ? "privacy-blur" : ""
                  }`}
                >
                  {formatRp(sisaLimit, privacy)}
                </p>
              </div>
            )}
          </div>

          {hasLimit && (
            <div className="space-y-1.5 pt-2 border-t border-borderc/40">
              <div className="flex justify-between items-center text-xs text-tmuted font-mono">
                <span>
                  Utilisasi:{" "}
                  <strong style={{ color: utilColor }}>{utilPct}%</strong>
                </span>
                <span>Plafon {formatRp(wallet.credit_limit, privacy)}</span>
              </div>
              <Progress value={utilPct} color={utilColor} className="h-2" />
            </div>
          )}
        </div>

        {/* Mini Arus Kas Dompet Bulan Ini */}
        <div className="rounded-2xl bg-elevated/40 border border-borderc/60 p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-tmuted uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} className="text-brand" /> Arus Kas Rekening Bulan Ini
            </span>
            <span className="text-[11px] text-tmuted font-mono font-medium">
              Net:{" "}
              <strong
                className={clsx(
                  flow.net > 0 ? "text-brand" : flow.net < 0 ? "text-rose" : "text-tprimary",
                  privacy && "privacy-blur"
                )}
              >
                {flow.net >= 0 ? "+" : ""}
                {formatRp(flow.net, privacy)}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-surface/80 rounded-xl p-2.5 border border-borderc/60">
              <span className="text-tmuted text-[10px] uppercase font-semibold flex items-center gap-1">
                <ArrowDownLeft size={12} className="text-brand" /> Uang Masuk
              </span>
              <p
                className={`font-mono font-bold text-sm text-brand mt-0.5 truncate ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                +{formatRp(flow.inflow, privacy)}
              </p>
            </div>

            <div className="bg-surface/80 rounded-xl p-2.5 border border-borderc/60">
              <span className="text-tmuted text-[10px] uppercase font-semibold flex items-center gap-1">
                <ArrowUpRight size={12} className="text-rose" /> Uang Keluar
              </span>
              <p
                className={`font-mono font-bold text-sm text-rose mt-0.5 truncate ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                -{formatRp(flow.outflow, privacy)}
              </p>
            </div>
          </div>
        </div>

        {/* 10 Mutasi Terakhir */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-tmuted uppercase tracking-wider">
              10 Mutasi Terakhir ({txnCount})
            </h4>
            {txnCount > 0 && (
              <button
                onClick={() => {
                  onClose();
                  navigate("/transactions");
                }}
                className="text-xs text-brand hover:underline font-semibold flex items-center gap-0.5"
              >
                Semua Transaksi <ChevronRight size={13} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="text-brand" size={24} />
            </div>
          ) : recentTxns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-borderc py-8 text-center bg-elevated/20">
              <Receipt size={28} className="text-tmuted mx-auto mb-2" />
              <p className="font-semibold text-sm text-tprimary">Belum ada transaksi</p>
              <p className="text-xs text-tmuted mt-0.5">
                Mutasi yang menggunakan dompet ini akan otomatis tercatat di sini.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-borderc bg-surface divide-y divide-borderc/40 overflow-hidden">
              {recentTxns.map((t) => {
                const cm = catMeta(t.category);
                const CatIcon = Icons[cm.icon] || Icons.ReceiptText;
                const isIncome = t.type === "income";
                const isTransfer = t.type === "transfer";
                const isIncomingTransfer = isTransfer && t.to_wallet_id === wallet.id;
                const positive = isIncome || isIncomingTransfer;

                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTxn?.(t)}
                    className="flex items-center justify-between p-3 sm:p-3.5 hover:bg-elevated/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cm.color}22` }}
                      >
                        <CatIcon size={16} style={{ color: cm.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-tprimary truncate group-hover:text-brand transition-colors">
                          {t.note || t.category}
                        </p>
                        <p className="text-[11px] text-tmuted truncate mt-0.5">
                          <span>{formatDate(t.date) || t.date}</span> · <span>{t.category}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <p
                        className={`font-mono font-bold text-sm ${
                          positive ? "text-brand" : "text-rose"
                        } ${privacy ? "privacy-blur" : ""}`}
                      >
                        {positive ? "+" : "-"}
                        {formatRp(t.amount, privacy)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              onEdit?.(wallet);
            }}
            className="w-full text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-4 whitespace-nowrap justify-center"
          >
            <Pencil size={14} className="shrink-0" /> Edit Dompet
          </Button>

          <Button
            onClick={() => {
              onClose();
              onAddTransaction?.(wallet);
            }}
            className="w-full text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-4 whitespace-nowrap justify-center"
          >
            <Plus size={15} className="shrink-0" /> Catat Transaksi
          </Button>
        </div>
      </div>
    </Modal>
  );
}
