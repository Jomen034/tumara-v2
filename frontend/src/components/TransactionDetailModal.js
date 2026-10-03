import React, { useState } from "react";
import * as Icons from "lucide-react";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Calendar, Wallet as WalletIcon, Tag, User, Sparkles, Trash2, Pencil, Target, Receipt, Search } from "lucide-react";
import { formatRp, formatDate } from "../lib/format";
import { catMeta } from "../lib/constants";
import { getUserAvatar } from "../lib/avatars";
import { Modal, Button } from "./ui";

export default function TransactionDetailModal({
  open,
  onClose,
  transaction: t,
  wallets = [],
  memberMap = {},
  privacy = false,
  onEdit,
  onDelete,
}) {
  const [itemSearch, setItemSearch] = useState("");

  if (!t) return null;

  const [goalTitle, setGoalTitle] = useState("");
  useEffect(() => {
    if (t?.goal_id) {
      api.get("/goals")
        .then((r) => {
          const found = r.data?.find((g) => g.id === t.goal_id);
          if (found) setGoalTitle(`${found.emoji || "🎯"} ${found.title}`);
        })
        .catch(() => {});
    } else {
      setGoalTitle("");
    }
  }, [t?.goal_id]);

  const isIncome = t.type === "income";
  const isTransfer = t.type === "transfer";
  const m = catMeta(isTransfer ? "Transfer" : t.category, t.type);
  const Ic = isTransfer ? Icons.ArrowLeftRight : (Icons[m.icon] || Icons.MoreHorizontal);

  const walletFrom = wallets.find((w) => w.id === t.wallet_id);
  const walletTo = wallets.find((w) => w.id === t.to_wallet_id);
  const member = memberMap?.[t.member_id];

  const typeConfig = {
    expense: { label: "Pengeluaran", color: "var(--rose)", icon: ArrowUpRight, bg: "bg-rose/10 text-rose" },
    income: { label: "Pemasukan", color: "var(--brand)", icon: ArrowDownLeft, bg: "bg-brand/10 text-brand" },
    transfer: { label: "Transfer", color: "var(--cyan)", icon: ArrowLeftRight, bg: "bg-cyan/10 text-cyan" },
  }[t.type] || { label: "Transaksi", color: "var(--brand)", icon: Tag, bg: "bg-elevated text-tprimary" };

  const TypeIcon = typeConfig.icon;

  const getSourceLabel = (src) => {
    switch (src) {
      case "ai_receipt": return "Scan Struk (AI)";
      case "ai_text": return "Teks Pintar (AI)";
      case "goal_deposit": return "Setoran Tujuan Nabung";
      default: return "Input Manual";
    }
  };

  const subItems = t.items || [];
  const subItemCategories = Object.entries(
    subItems.reduce((acc, it) => {
      const p = Number(it.price) || 0;
      if (p > 0) {
        const c = it.category || t.category || "Lainnya";
        acc[c] = (acc[c] || 0) + p;
      }
      return acc;
    }, {})
  );

  const filteredSubItems = subItems.filter((it) => {
    if (!itemSearch.trim()) return true;
    const q = itemSearch.toLowerCase();
    return (
      (it.name || "").toLowerCase().includes(q) ||
      (it.category || "").toLowerCase().includes(q)
    );
  });

  return (
    <Modal open={open} onClose={onClose} title="Detail Transaksi" testid="transaction-detail-modal" size="md">
      <div className="space-y-6">
        {/* Main Amount Card */}
        <div className="rounded-2xl bg-elevated/60 border border-borderc p-5 text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3" style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}>
            <TypeIcon size={14} />
            {typeConfig.label}
          </div>
          <p className={`text-3xl sm:text-4xl font-head font-extrabold font-mono tracking-tight ${privacy ? "privacy-blur" : ""}`} style={{ color: typeConfig.color }}>
            {isIncome ? "+" : isTransfer ? "" : "-"}{formatRp(t.amount, privacy)}
          </p>
          {t.note && <p className="text-sm font-medium text-tprimary mt-2">{t.note}</p>}
        </div>

        {/* Detailed Fields */}
        <div className="space-y-3.5 divide-y divide-borderc/40 text-sm">
          {/* Wallet */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-tmuted flex items-center gap-2">
              <WalletIcon size={16} />
              {isTransfer ? "Alur Dompet" : "Dompet"}
            </span>
            <span className="font-medium text-tprimary text-right">
              {isTransfer ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-rose font-semibold">{walletFrom?.name || "Dompet Asal"}</span>
                  <span className="text-tmuted">➔</span>
                  <span className="text-brand font-semibold">{walletTo?.name || "Dompet Tujuan"}</span>
                </span>
              ) : (
                walletFrom?.name || "Dompet tidak ditemukan"
              )}
            </span>
          </div>

          {/* Category */}
          <div className="flex items-center justify-between pt-3.5">
            <span className="text-tmuted flex items-center gap-2">
              <Tag size={16} />
              Kategori
            </span>
            <span className="font-medium flex items-center gap-1.5 text-tprimary">
              <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color}25` }}>
                <Ic size={12} style={{ color: m.color }} />
              </div>
              {t.category}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center justify-between pt-3.5">
            <span className="text-tmuted flex items-center gap-2">
              <Calendar size={16} />
              Tanggal
            </span>
            <span className="font-medium text-tprimary font-mono">{formatDate(t.date || t.created_at)}</span>
          </div>

          {/* Goal Link if present */}
          {t.goal_id && (
            <div className="flex items-center justify-between pt-3.5">
              <span className="text-tmuted flex items-center gap-2">
                <Target size={16} className="text-brand" />
                Terkait Tujuan
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand/15 text-brand flex items-center gap-1">
                {goalTitle || "🎯 Terhubung ke Nabung"}
              </span>
            </div>
          )}

          {/* Member (Household) */}
          {member && (
            <div className="flex items-center justify-between pt-3.5">
              <span className="text-tmuted flex items-center gap-2">
                <User size={16} />
                Dicatat Oleh
              </span>
              <span className="font-medium flex items-center gap-2 text-tprimary">
                <img src={getUserAvatar(member)} alt="" className="w-5 h-5 rounded-full object-cover shadow-sm" />
                {member.name}
              </span>
            </div>
          )}

          {/* Source */}
          <div className="flex items-center justify-between pt-3.5">
            <span className="text-tmuted flex items-center gap-2">
              <Sparkles size={16} />
              Metode Input
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-elevated text-tsecondary font-medium">
              {getSourceLabel(t.source)}
            </span>
          </div>
        </div>

        {/* Sub-Items Detail Section (Rincian Barang Belanjaan) */}
        {subItems.length > 0 && (
          <div className="pt-2 border-t border-borderc/40 space-y-3" data-testid="txn-subitems-section">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-tprimary flex items-center gap-1.5 uppercase tracking-wider">
                <Receipt size={14} className="text-brand" />
                Rincian Barang ({subItems.length} Item)
              </span>
              <span className={`text-xs font-mono text-tmuted font-medium ${privacy ? "privacy-blur" : ""}`}>
                Total {formatRp(subItems.reduce((s, it) => s + (Number(it.price) || 0), 0), privacy)}
              </span>
            </div>

            {/* Category Breakdown Chips if multiple categories */}
            {subItemCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 py-0.5">
                {subItemCategories.map(([catName, amt]) => {
                  const itemCatMeta = catMeta(catName);
                  return (
                    <span
                      key={catName}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-elevated border border-borderc/60 text-tsecondary"
                    >
                      <span>{itemCatMeta.emoji}</span>
                      <span>{catName}:</span>
                      <strong className={`text-tprimary font-mono ${privacy ? "privacy-blur" : ""}`}>
                        {formatRp(amt, privacy)}
                      </strong>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search inside sub-items if > 5 items */}
            {subItems.length > 5 && (
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tmuted" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Cari dalam daftar barang..."
                  className="w-full bg-elevated border border-borderc rounded-xl pl-8 pr-3 py-1.5 text-xs text-tprimary placeholder:text-tmuted focus:border-brand focus:outline-none"
                />
              </div>
            )}

            {/* Scrollable list */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-borderc/30 rounded-xl bg-surface p-2.5 border border-borderc/60">
              {filteredSubItems.map((it, idx) => {
                const itMeta = catMeta(it.category || t.category);
                return (
                  <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-tprimary truncate">
                        {it.name}
                        {it.quantity && it.quantity > 1 ? ` (x${it.quantity})` : ""}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-tmuted">
                        <span>{itMeta.emoji}</span>
                        <span>{it.category || t.category}</span>
                      </span>
                    </div>
                    <span className={`font-mono font-semibold text-tprimary shrink-0 ${privacy ? "privacy-blur" : ""}`}>
                      {formatRp(it.price, privacy)}
                    </span>
                  </div>
                );
              })}
              {filteredSubItems.length === 0 && (
                <p className="text-center text-xs text-tmuted py-3">Tidak ada barang yang cocok</p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-2">
          {onDelete && (
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                onDelete(t.id);
              }}
              className="text-rose hover:bg-rose/10 hover:border-rose/30"
              data-testid="detail-delete-btn"
            >
              <Trash2 size={16} />
              Hapus
            </Button>
          )}
          {onEdit && (
            <Button
              className="flex-1"
              onClick={() => {
                onClose();
                onEdit(t);
              }}
              data-testid="detail-edit-btn"
            >
              <Pencil size={16} />
              Edit Transaksi
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
