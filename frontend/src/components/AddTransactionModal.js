import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { CATEGORIES } from "../lib/constants";
import { Modal, Button, Input, Select } from "./ui";

const TYPES = [
  { value: "expense", label: "Pengeluaran", icon: ArrowUpRight, color: "var(--rose)" },
  { value: "income", label: "Pemasukan", icon: ArrowDownLeft, color: "var(--brand)" },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "var(--cyan)" },
];

export default function AddTransactionModal({ open, onClose, onSaved, prefill }) {
  const [wallets, setWallets] = useState([]);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [category, setCategory] = useState("Makanan & Minuman");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/wallets").then((r) => {
      setWallets(r.data);
      if (r.data[0]) setWalletId(r.data[0].id);
      if (r.data[1]) setToWalletId(r.data[1].id);
    });
    if (prefill) {
      setType("expense");
      setAmount(String(prefill.total || ""));
      setCategory(prefill.category || "Lainnya");
      setNote(prefill.merchant || "");
      if (prefill.date) setDate(prefill.date);
    }
  }, [open, prefill]);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Masukkan jumlah yang valid");
    if (!walletId) return toast.error("Pilih dompet dulu");
    if (type === "transfer" && (!toWalletId || toWalletId === walletId))
      return toast.error("Pilih dompet tujuan yang berbeda");
    setSaving(true);
    try {
      await api.post("/transactions", {
        type, amount: amt, wallet_id: walletId,
        to_wallet_id: type === "transfer" ? toWalletId : null,
        category: type === "income" ? (category === "Gaji" || category === "Bonus" ? category : "Gaji") : category,
        note, date, source: prefill ? "ai_receipt" : "manual",
      });
      toast.success("Transaksi tersimpan!");
      onSaved?.();
      onClose();
      setAmount(""); setNote("");
    } catch {
      toast.error("Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Tambah Transaksi" testid="add-transaction-modal">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button key={t.value} data-testid={`txn-type-${t.value}`} onClick={() => setType(t.value)}
              className={clsx("flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors",
                type === t.value ? "border-transparent text-black" : "border-borderc text-tsecondary hover:bg-elevated")}
              style={type === t.value ? { backgroundColor: t.color } : undefined}>
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>

        <Input data-testid="txn-amount-input" label="Jumlah" prefix="Rp" type="number" inputMode="numeric"
          placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />

        <Select data-testid="txn-wallet-select" label={type === "transfer" ? "Dari Dompet" : "Dompet"}
          value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>

        {type === "transfer" && (
          <Select data-testid="txn-to-wallet-select" label="Ke Dompet" value={toWalletId} onChange={(e) => setToWalletId(e.target.value)}>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        )}

        {type === "expense" && (
          <Select data-testid="txn-category-select" label="Kategori" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.filter((c) => !["Gaji", "Bonus"].includes(c.name)).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </Select>
        )}
        {type === "income" && (
          <Select data-testid="txn-income-category-select" label="Sumber" value={category} onChange={(e) => setCategory(e.target.value)}>
            {["Gaji", "Bonus", "Investasi", "Lainnya"].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Catatan" placeholder="opsional" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button data-testid="txn-save-button" onClick={save} disabled={saving} className="w-full" size="lg">
          {saving ? "Menyimpan..." : "Simpan Transaksi"}
        </Button>
      </div>
    </Modal>
  );
}
