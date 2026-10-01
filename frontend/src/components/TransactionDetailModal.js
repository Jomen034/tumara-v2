import React from "react";
import * as Icons from "lucide-react";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Calendar, Wallet as WalletIcon, Tag, User, Sparkles, Trash2, Pencil, Target } from "lucide-react";
import { formatRp, formatDate } from "../lib/format";
import { catMeta } from "../lib/constants";
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
  if (!t) return null;

  const m = catMeta(t.category);
  const Ic = Icons[m.icon] || Icons.MoreHorizontal;
  const isIncome = t.type === "income";
  const isTransfer = t.type === "transfer";

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
                🎯 Terhubung ke Nabung
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
                <img src={member.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${member.name}`} alt="" className="w-5 h-5 rounded-full object-cover" />
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
