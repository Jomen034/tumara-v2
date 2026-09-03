import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Plus, Trash2, Pencil, CheckCircle2, CalendarClock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp } from "../lib/format";
import { CATEGORIES } from "../lib/constants";
import { Card, Button, Modal, Input, Select, Spinner, EmptyState, Badge } from "../components/ui";

const RECUR = { monthly: "Bulanan", weekly: "Mingguan", yearly: "Tahunan", once: "Sekali" };

export default function Bills() {
  const { privacy } = useTheme();
  const { bump } = useRefresh();
  const [bills, setBills] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", amount: "", category: "Tagihan & Utilitas", recurrence: "monthly", next_due_date: "", wallet_id: "" });

  const load = () => Promise.all([api.get("/bills"), api.get("/wallets")])
    .then(([b, w]) => { setBills(b.data); setWallets(w.data); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", amount: "", category: "Tagihan & Utilitas", recurrence: "monthly", next_due_date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), wallet_id: wallets[0]?.id || "" }); setOpen(true); };
  const openEdit = (b) => { setEditing(b); setForm({ name: b.name, amount: String(b.amount), category: b.category, recurrence: b.recurrence, next_due_date: b.next_due_date, wallet_id: b.wallet_id || "" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama tagihan wajib diisi");
    if (!form.next_due_date) return toast.error("Pilih tanggal jatuh tempo");
    const payload = { ...form, amount: parseFloat(form.amount) || 0, wallet_id: form.wallet_id || null };
    try {
      if (editing) await api.put(`/bills/${editing.id}`, payload);
      else await api.post("/bills", payload);
      toast.success(editing ? "Tagihan diperbarui" : "Tagihan ditambahkan"); setOpen(false); load();
    } catch { toast.error("Gagal menyimpan"); }
  };

  const [payingId, setPayingId] = useState(null);
  const pay = async (b) => {
    if (payingId) return;
    setPayingId(b.id);
    try { await api.post(`/bills/${b.id}/pay`); toast.success(`"${b.name}" ditandai lunas${b.wallet_id ? " + tercatat" : ""}!`); await load(); bump(); }
    catch { toast.error("Gagal"); }
    finally { setPayingId(null); }
  };
  const del = async (id) => { if (!window.confirm("Hapus tagihan ini?")) return; await api.delete(`/bills/${id}`); load(); };

  const dueColor = (d) => d < 0 ? "var(--rose)" : d <= 3 ? "var(--amber)" : "var(--brand)";
  const dueLabel = (d) => d < 0 ? `Telat ${Math.abs(d)} hari` : d === 0 ? "Jatuh tempo hari ini" : `${d} hari lagi`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Tagihan</h1>
          <p className="text-tsecondary text-sm mt-1">Jangan sampai telat bayar lagi.</p>
        </div>
        <Button onClick={openNew} data-testid="add-bill-button"><Plus size={16} /> Tagihan</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner className="text-brand" size={28} /></div> :
        bills.length === 0 ? (
          <Card><EmptyState icon={CalendarClock} title="Belum ada tagihan" subtitle="Tambahkan tagihan rutin seperti listrik, internet, atau langganan." action={<Button onClick={openNew} size="sm">Tambah Tagihan</Button>} /></Card>
        ) : (
          <div className="space-y-3" data-testid="bills-list">
            {bills.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="flex items-center gap-4 py-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${dueColor(b.days_until)}22` }}>
                    <Icons.ReceiptText size={20} style={{ color: dueColor(b.days_until) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{b.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge color={dueColor(b.days_until)}>{b.days_until <= 3 && <AlertTriangle size={11} />} {dueLabel(b.days_until)}</Badge>
                      <span className="text-xs text-tmuted">{RECUR[b.recurrence]}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold ${privacy ? "privacy-blur" : ""}`}>{formatRp(b.amount, privacy)}</p>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <Button size="sm" onClick={() => pay(b)} disabled={payingId === b.id} data-testid={`pay-bill-${b.id}`}><CheckCircle2 size={15} /> {payingId === b.id ? "..." : "Bayar"}</Button>
                      <button onClick={() => openEdit(b)} className="p-2 rounded-lg hover:bg-elevated text-tsecondary"><Pencil size={14} /></button>
                      <button onClick={() => del(b.id)} data-testid={`delete-bill-${b.id}`} className="p-2 rounded-lg hover:bg-elevated text-tmuted hover:text-rose"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Tagihan" : "Tagihan Baru"} testid="bill-modal">
        <div className="space-y-4">
          <Input label="Nama Tagihan" placeholder="cth. Listrik PLN, Netflix" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="bill-name-input" />
          <Input label="Jumlah" prefix="Rp" type="number" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="bill-amount-input" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jatuh Tempo" type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} data-testid="bill-date-input" />
            <Select label="Perulangan" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
              {Object.entries(RECUR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <Select label="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.filter((c) => !["Gaji", "Bonus"].includes(c.name)).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </Select>
          <Select label="Bayar dari (opsional)" value={form.wallet_id} onChange={(e) => setForm({ ...form, wallet_id: e.target.value })}>
            <option value="">— Tidak otomatis catat —</option>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <Button onClick={save} className="w-full" size="lg" data-testid="bill-save-button">{editing ? "Simpan" : "Tambah Tagihan"}</Button>
        </div>
      </Modal>
    </div>
  );
}
