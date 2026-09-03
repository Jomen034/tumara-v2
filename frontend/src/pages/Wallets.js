import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp } from "../lib/format";
import { WALLET_TYPES, WALLET_PRESETS, walletMeta } from "../lib/constants";
import { Card, Button, Modal, Input, Select, Badge, Spinner, EmptyState } from "../components/ui";

export default function Wallets() {
  const { privacy } = useTheme();
  const { bump } = useRefresh();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", type: "bank", balance: "", color: "#00E676" });

  const load = () => api.get("/wallets").then((r) => setWallets(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openNew = (preset) => {
    setEditing(null);
    const t = preset?.type || "bank";
    setForm({ name: preset?.name || "", type: t, balance: "", color: walletMeta(t).color });
    setOpen(true);
  };
  const openEdit = (w) => { setEditing(w); setForm({ name: w.name, type: w.type, balance: String(w.balance), color: w.color }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama dompet wajib diisi");
    const payload = { name: form.name.trim(), type: form.type, balance: parseFloat(form.balance) || 0, color: form.color, icon: walletMeta(form.type).icon };
    try {
      if (editing) await api.put(`/wallets/${editing.id}`, payload);
      else await api.post("/wallets", payload);
      toast.success(editing ? "Dompet diperbarui" : "Dompet ditambahkan");
      setOpen(false); load(); bump();
    } catch { toast.error("Gagal menyimpan"); }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus dompet ini?")) return;
    await api.delete(`/wallets/${id}`); toast.success("Dompet dihapus"); load(); bump();
  };

  const totalAssets = wallets.filter((w) => !["credit_card", "paylater"].includes(w.type)).reduce((a, w) => a + w.balance, 0);
  const totalDebt = wallets.filter((w) => ["credit_card", "paylater"].includes(w.type)).reduce((a, w) => a + w.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Dompet</h1>
          <p className="text-tsecondary text-sm mt-1">Kelola semua akun & saldomu.</p>
        </div>
        <Button data-testid="add-wallet-button" onClick={() => openNew()}><Plus size={16} /> Dompet</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><p className="text-xs text-tmuted font-semibold uppercase">Total Aset</p><p className={`text-2xl font-head font-bold font-mono text-brand mt-1 ${privacy ? "privacy-blur" : ""}`}>{formatRp(totalAssets, privacy)}</p></Card>
        <Card><p className="text-xs text-tmuted font-semibold uppercase">Total Utang</p><p className={`text-2xl font-head font-bold font-mono text-rose mt-1 ${privacy ? "privacy-blur" : ""}`}>{formatRp(totalDebt, privacy)}</p></Card>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner className="text-brand" size={28} /></div> : wallets.length === 0 ? (
        <Card>
          <EmptyState icon={Icons.Wallet} title="Belum ada dompet" subtitle="Tambah cepat dari pilihan populer:" />
          <div className="flex flex-wrap gap-2 justify-center pb-4">
            {WALLET_PRESETS.map((p) => (
              <button key={p.name} onClick={() => openNew(p)} data-testid={`preset-${p.name.toLowerCase()}`}
                className="px-3.5 py-2 rounded-full bg-elevated text-sm font-medium hover:bg-borderc transition-colors">{p.name}</button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {wallets.map((w, i) => {
            const m = walletMeta(w.type);
            const Ic = Icons[m.icon] || Icons.Wallet;
            const isDebt = ["credit_card", "paylater"].includes(w.type);
            return (
              <motion.div key={w.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card hover className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${w.color}22` }}>
                    <Ic size={22} style={{ color: w.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><p className="font-semibold truncate">{w.name}</p><Badge color={m.color}>{m.label}</Badge></div>
                    <p className={`font-mono font-bold text-lg ${isDebt ? "text-rose" : ""} ${privacy ? "privacy-blur" : ""}`}>{formatRp(w.balance, privacy)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => openEdit(w)} data-testid={`edit-wallet-${w.id}`} className="p-2 rounded-lg hover:bg-elevated text-tsecondary"><Pencil size={15} /></button>
                    <button onClick={() => del(w.id)} data-testid={`delete-wallet-${w.id}`} className="p-2 rounded-lg hover:bg-elevated text-tmuted hover:text-rose"><Trash2 size={15} /></button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Dompet" : "Tambah Dompet"} testid="wallet-modal">
        <div className="space-y-4">
          <Input label="Nama Dompet" placeholder="cth. BCA, GoPay" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="wallet-name-input" />
          <Select label="Jenis" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, color: walletMeta(e.target.value).color })} data-testid="wallet-type-select">
            {WALLET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input label={["credit_card", "paylater"].includes(form.type) ? "Total Tagihan (Rp)" : "Saldo Awal (Rp)"} prefix="Rp" type="number" placeholder="0" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} data-testid="wallet-balance-input" />
          <Button onClick={save} className="w-full" size="lg" data-testid="wallet-save-button">{editing ? "Simpan Perubahan" : "Tambah Dompet"}</Button>
        </div>
      </Modal>
    </div>
  );
}
