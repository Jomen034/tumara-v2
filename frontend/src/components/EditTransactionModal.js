import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Check, X } from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { CATEGORIES } from "../lib/constants";
import { Modal, Button, Input, Select } from "./ui";

const TYPES = [
  { value: "expense", label: "Pengeluaran", icon: ArrowUpRight, color: "var(--rose)" },
  { value: "income", label: "Pemasukan", icon: ArrowDownLeft, color: "var(--brand)" },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "var(--cyan)" },
];

export default function EditTransactionModal({ open, onClose, transaction: t, wallets = [], onSaved }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [category, setCategory] = useState("Makanan & Minuman");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !t) return;
    setType(t.type || "expense");
    setAmount(String(t.amount || ""));
    setWalletId(t.wallet_id || (wallets[0]?.id || ""));
    setToWalletId(t.to_wallet_id || (wallets[1]?.id || ""));
    setCategory(t.category || "Makanan & Minuman");
    setNote(t.note || "");
    setDate(t.date || (t.created_at ? t.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)));
  }, [open, t, wallets]);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Masukkan jumlah yang valid");
    if (!walletId) return toast.error("Pilih dompet dulu");
    if (type === "transfer" && (!toWalletId || toWalletId === walletId)) {
      return toast.error("Pilih dompet tujuan yang berbeda");
    }

    setSaving(true);
    try {
      await api.put(`/transactions/${t.id}`, {
        type,
        amount: amt,
        wallet_id: walletId,
        to_wallet_id: type === "transfer" ? toWalletId : null,
        category: type === "income" ? (["Gaji", "Bonus", "Investasi", "Lainnya"].includes(category) ? category : "Gaji") : category,
        note,
        date,
      });
      toast.success("Perubahan transaksi berhasil disimpan!");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  if (!t) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit Transaksi" testid="edit-transaction-modal">
      <div className="space-y-4">
        {/* Type selector */}
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              data-testid={`edit-txn-type-${item.value}`}
              onClick={() => setType(item.value)}
              className={clsx(
                "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors",
                type === item.value ? "border-transparent text-black" : "border-borderc text-tsecondary hover:bg-elevated"
              )}
              style={type === item.value ? { backgroundColor: item.color } : undefined}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </div>

        {/* Amount */}
        <Input
          data-testid="edit-txn-amount-input"
          label="Jumlah"
          prefix="Rp"
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {/* Source Wallet */}
        <Select
          data-testid="edit-txn-wallet-select"
          label={type === "transfer" ? "Dari Dompet" : "Dompet"}
          value={walletId}
          onChange={(e) => setWalletId(e.target.value)}
        >
          {wallets.length === 0 && <option value="">Belum ada dompet</option>}
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} (Saldo: Rp {w.balance?.toLocaleString("id-ID")})
            </option>
          ))}
        </Select>

        {/* To Wallet (for transfer) */}
        {type === "transfer" && (
          <Select
            data-testid="edit-txn-to-wallet-select"
            label="Ke Dompet"
            value={toWalletId}
            onChange={(e) => setToWalletId(e.target.value)}
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} (Saldo: Rp {w.balance?.toLocaleString("id-ID")})
              </option>
            ))}
          </Select>
        )}

        {/* Category */}
        {type === "expense" && (
          <Select
            data-testid="edit-txn-category-select"
            label="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.filter((c) => !["Gaji", "Bonus"].includes(c.name)).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {type === "income" && (
          <Select
            data-testid="edit-txn-income-category-select"
            label="Sumber"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["Gaji", "Bonus", "Investasi", "Lainnya"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}

        {/* Date: Dedicated full-width row */}
        <Input
          label="Tanggal"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="edit-txn-date-input"
        />

        {/* Note: Dedicated full-width row */}
        <Input
          label="Catatan"
          placeholder="cth. Makan siang kantor, bensin, langganan Netflix (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="edit-txn-note-input"
        />

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            <X size={16} /> Batal
          </Button>
          <Button data-testid="edit-txn-save-button" onClick={save} disabled={saving} className="flex-1">
            {saving ? "Menyimpan..." : <><Check size={16} /> Simpan Perubahan</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
