import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, PiggyBank, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatDate } from "../lib/format";
import { Card, Button, Modal, Input, Progress, Spinner, EmptyState } from "../components/ui";

const PRESETS = [
  { title: "Dana Darurat 6 Bulan", emoji: "🛟", color: "#00E676" },
  { title: "Liburan ke Bali", emoji: "🏝️", color: "#00F0FF" },
  { title: "DP Rumah", emoji: "🏠", color: "#FFB800" },
  { title: "Gadget Baru", emoji: "📱", color: "#A78BFA" },
];

export default function Goals() {
  const { privacy } = useTheme();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", target_amount: "", deadline: "", emoji: "🎯", color: "#00F0FF" });
  const [depositId, setDepositId] = useState(null);
  const [depositAmt, setDepositAmt] = useState("");

  const load = () => api.get("/goals").then((r) => setGoals(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openNew = (preset) => { setForm({ title: preset?.title || "", target_amount: "", deadline: "", emoji: preset?.emoji || "🎯", color: preset?.color || "#00F0FF" }); setOpen(true); };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Nama tujuan wajib diisi");
    const target = parseFloat(form.target_amount);
    if (!target || target <= 0) return toast.error("Target harus lebih dari 0");
    try {
      await api.post("/goals", { title: form.title.trim(), target_amount: target, deadline: form.deadline || null, emoji: form.emoji, color: form.color });
      toast.success("Tujuan dibuat!"); setOpen(false); load();
    } catch { toast.error("Gagal menyimpan"); }
  };

  const deposit = async () => {
    const amt = parseFloat(depositAmt);
    if (!amt || amt <= 0) return toast.error("Jumlah tidak valid");
    await api.post(`/goals/${depositId}/deposit`, { amount: amt });
    toast.success("Setoran ditambahkan! 🎉"); setDepositId(null); setDepositAmt(""); load();
  };

  const del = async (id) => { if (!window.confirm("Hapus tujuan ini?")) return; await api.delete(`/goals/${id}`); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Tujuan</h1>
          <p className="text-tsecondary text-sm mt-1">Nabung dengan target yang jelas.</p>
        </div>
        <Button onClick={() => openNew()} data-testid="add-goal-button"><Plus size={16} /> Tujuan</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner className="text-brand" size={28} /></div> :
        goals.length === 0 ? (
          <Card>
            <EmptyState icon={PiggyBank} title="Belum ada tujuan" subtitle="Mulai dari ide populer ini:" />
            <div className="flex flex-wrap gap-2 justify-center pb-4">
              {PRESETS.map((p) => (
                <button key={p.title} onClick={() => openNew(p)} className="px-3.5 py-2 rounded-full bg-elevated text-sm font-medium hover:bg-borderc transition-colors">{p.emoji} {p.title}</button>
              ))}
            </div>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {goals.map((g, i) => {
              const pct = g.target_amount > 0 ? (g.saved_amount / g.target_amount) * 100 : 0;
              const done = pct >= 100;
              return (
                <motion.div key={g.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card data-testid={`goal-card-${g.id}`} className="relative">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{g.emoji}</span>
                        <div>
                          <p className="font-semibold">{g.title}</p>
                          {g.deadline && <p className="text-xs text-tmuted">Target: {formatDate(g.deadline)}</p>}
                        </div>
                      </div>
                      <button onClick={() => del(g.id)} data-testid={`delete-goal-${g.id}`} className="p-1.5 rounded-lg hover:bg-elevated text-tmuted hover:text-rose"><Trash2 size={15} /></button>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className={`font-mono font-semibold ${privacy ? "privacy-blur" : ""}`}>{formatRp(g.saved_amount, privacy)}</span>
                        <span className={`font-mono text-tmuted text-xs ${privacy ? "privacy-blur" : ""}`}>/ {formatRp(g.target_amount, privacy)}</span>
                      </div>
                      <Progress value={pct} color={done ? "var(--brand)" : g.color} />
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs font-semibold" style={{ color: done ? "var(--brand)" : g.color }}>
                          {done ? <span className="flex items-center gap-1"><PartyPopper size={13} /> Tercapai!</span> : `${Math.round(pct)}% tercapai`}
                        </span>
                        <Button size="sm" variant="secondary" onClick={() => { setDepositId(g.id); setDepositAmt(""); }} data-testid={`deposit-goal-${g.id}`}>+ Setor</Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

      <Modal open={open} onClose={() => setOpen(false)} title="Tujuan Baru" testid="goal-modal">
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {["🎯", "🛟", "🏝️", "🏠", "📱", "🚗", "💍", "🎓"].map((e) => (
              <button key={e} onClick={() => setForm({ ...form, emoji: e })} className={`text-2xl w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${form.emoji === e ? "bg-brand/20 ring-2 ring-brand" : "bg-elevated"}`}>{e}</button>
            ))}
          </div>
          <Input label="Nama Tujuan" placeholder="cth. Liburan ke Jepang" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="goal-title-input" />
          <Input label="Target (Rp)" prefix="Rp" type="number" placeholder="0" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} data-testid="goal-target-input" />
          <Input label="Deadline (opsional)" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          <Button onClick={save} className="w-full" size="lg" data-testid="goal-save-button">Buat Tujuan</Button>
        </div>
      </Modal>

      <Modal open={!!depositId} onClose={() => setDepositId(null)} title="Setor ke Tujuan" testid="deposit-modal" size="sm">
        <div className="space-y-4">
          <Input label="Jumlah Setoran" prefix="Rp" type="number" placeholder="0" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} data-testid="deposit-amount-input" autoFocus />
          <Button onClick={deposit} className="w-full" size="lg" data-testid="deposit-save-button">Setor Sekarang</Button>
        </div>
      </Modal>
    </div>
  );
}
