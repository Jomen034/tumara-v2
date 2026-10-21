import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import {
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  ExternalLink,
  Sparkles,
  Wallet,
  CheckCircle2,
  Receipt,
  Tag,
} from "lucide-react";
import api from "../lib/api";
import { formatRp } from "../lib/format";
import { catMeta } from "../lib/constants";
import { Modal, Button, Spinner, Badge } from "./ui";
import TransactionDetailModal from "./TransactionDetailModal";

export default function DayJournalModal({
  open,
  onClose,
  date,
  onAddTransaction,
  onSaved,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);

  useEffect(() => {
    if (!open || !date) return;
    setLoading(true);
    Promise.all([
      api.get("/transactions", { params: { date, limit: 100 } }),
      api.get("/wallets"),
    ])
      .then(([tRes, wRes]) => {
        setTransactions(tRes.data || []);
        setWallets(wRes.data || []);
      })
      .catch(() => {
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  }, [open, date]);

  if (!open || !date) return null;

  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w]));

  // Indonesian date formatter
  const formattedDateTitle = (() => {
    try {
      const parts = date.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
    } catch {}
    return date;
  })();

  const expenseTotal = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const incomeTotal = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const handleOpenFullPage = () => {
    onClose();
    navigate(`/transactions?date=${date}`);
  };

  const handleAddNew = () => {
    onClose();
    if (onAddTransaction) {
      onAddTransaction(date);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-xs text-tmuted font-normal">Jurnal Keuangan Harian</p>
              <h3 className="font-head font-bold text-sm sm:text-base text-tprimary">
                {formattedDateTitle}
              </h3>
            </div>
          </div>
        }
        testid="day-journal-modal"
      >
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-rose/10 border border-rose/20">
              <span className="text-[11px] font-medium text-rose flex items-center gap-1">
                <ArrowUpRight size={13} /> Pengeluaran
              </span>
              <p className="text-sm sm:text-base font-bold font-mono text-rose mt-0.5">
                {formatRp(expenseTotal)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-brand/10 border border-brand/20">
              <span className="text-[11px] font-medium text-brand flex items-center gap-1">
                <ArrowDownLeft size={13} /> Pemasukan
              </span>
              <p className="text-sm sm:text-base font-bold font-mono text-brand mt-0.5">
                {formatRp(incomeTotal)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-elevated border border-borderc col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-tsecondary flex items-center gap-1">
                <CheckCircle2 size={13} className="text-brand" /> Total Catatan
              </span>
              <p className="text-sm sm:text-base font-bold font-mono text-tprimary mt-0.5">
                {transactions.length} transaksi
              </p>
            </div>
          </div>

          {/* Transactions List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-tsecondary uppercase tracking-wider">
                Daftar Transaksi ({transactions.length})
              </span>
              {transactions.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenFullPage}
                  className="text-xs text-brand hover:underline font-medium inline-flex items-center gap-1"
                >
                  Buka di Transaksi <ExternalLink size={12} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
                <Spinner size={24} className="text-brand" />
                <p className="text-xs text-tmuted">Memuat transaksi tanggal ini...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl bg-surface border border-dashed border-borderc text-center">
                <div className="w-12 h-12 rounded-full bg-elevated mx-auto flex items-center justify-center mb-2.5 text-tmuted">
                  <Sparkles size={20} className="text-brand" />
                </div>
                <h4 className="text-sm font-bold text-tprimary">Belum Ada Catatan</h4>
                <p className="text-xs text-tmuted max-w-xs mx-auto mt-1 mb-4">
                  Tidak ada transaksi yang tercatat pada tanggal ini. Tetap jaga kebiasaan finansialmu dengan mencatatnya sekarang!
                </p>
                <Button onClick={handleAddNew} size="sm">
                  <Plus size={15} /> Catat Transaksi di Tanggal Ini
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {transactions.map((t) => {
                  const isExp = t.type === "expense";
                  const isInc = t.type === "income";
                  const meta = catMeta(t.type === "transfer" ? "Transfer" : t.category, t.type);
                  const IconComp = Icons[meta.icon] || Tag;
                  const walletName = walletMap[t.wallet_id]?.name || "Dompet";

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTxn(t)}
                      className="p-3 rounded-xl bg-surface hover:bg-elevated border border-borderc flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: meta.color ? `${meta.color}20` : "var(--elevated)",
                            color: meta.color || "inherit",
                          }}
                        >
                          <IconComp size={17} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold truncate group-hover:text-brand transition-colors">
                            {t.note || t.category}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-tmuted mt-0.5 truncate">
                            <span>{t.category}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Wallet size={10} /> {walletName}
                            </span>
                            {t.bill_id && (
                              <>
                                <span>•</span>
                                <span className="text-cyan font-medium">Tagihan</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-mono font-bold ${
                            isExp ? "text-rose" : isInc ? "text-brand" : "text-cyan"
                          }`}
                        >
                          {isExp ? "-" : isInc ? "+" : ""}
                          {formatRp(t.amount)}
                        </span>
                        {t.items && t.items.length > 0 && (
                          <p className="text-[10px] text-tmuted font-medium">
                            {t.items.length} item
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="pt-2 border-t border-borderc flex flex-col sm:flex-row gap-2">
            <Button onClick={handleAddNew} className="flex-1" size="md">
              <Plus size={16} /> Catat di Tanggal Ini
            </Button>
            {transactions.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleOpenFullPage}
                className="flex-1"
                size="md"
              >
                <ExternalLink size={15} /> Lihat di Halaman Transaksi
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Transaction Detail if clicked */}
      {selectedTxn && (
        <TransactionDetailModal
          open={!!selectedTxn}
          onClose={() => setSelectedTxn(null)}
          transaction={selectedTxn}
          wallets={wallets}
          onDelete={() => {
            setSelectedTxn(null);
            // Refresh day transactions
            api.get("/transactions", { params: { date, limit: 100 } })
              .then((r) => setTransactions(r.data || []));
            onSaved?.();
          }}
        />
      )}
    </>
  );
}
