import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, PiggyBank, PartyPopper, History } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatDate } from "../lib/format";
import { Card, Button, Modal, Input, Select, Progress, Spinner, EmptyState } from "../components/ui";

const PRESETS = [
  { title: "Dana Darurat 6 Bulan", emoji: "🛟", color: "#00E676" },
  { title: "Liburan ke Bali", emoji: "🏝️", color: "#00F0FF" },
  { title: "DP Rumah", emoji: "🏠", color: "#FFB800" },
  { title: "Gadget Baru", emoji: "📱", color: "#A78BFA" },
];

export default function Goals() {
  const { privacy } = useTheme();
  const { bump } = useRefresh();
  const [goals, setGoals] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", target_amount: "", deadline: "", emoji: "🎯", color: "#00F0FF" });
  
  // Deposit state
  const [depositGoal, setDepositGoal] = useState(null);
  const [depositId, setDepositId] = useState(null);
  const [depositAmt, setDepositAmt] = useState("");
  const [depositWalletId, setDepositWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [depositNote, setDepositNote] = useState("");

  // History state
  const [historyGoal, setHistoryGoal] = useState(null);
  const [goalTxns, setGoalTxns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const load = () =>
    Promise.all([api.get("/goals"), api.get("/wallets")])
      .then(([g, w]) => {
        setGoals(g.data);
        setWallets(w.data || []);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openNew = (preset) => {
    setForm({
      title: preset?.title || "",
      target_amount: "",
      deadline: "",
      emoji: preset?.emoji || "🎯",
      color: preset?.color || "#00F0FF",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Nama tujuan wajib diisi");
    const target = parseFloat(form.target_amount);
    if (!target || target <= 0) return toast.error("Target harus lebih dari 0");
    try {
      await api.post("/goals", {
        title: form.title.trim(),
        target_amount: target,
        deadline: form.deadline || null,
        emoji: form.emoji,
        color: form.color,
      });
      toast.success("Tujuan dibuat!");
      setOpen(false);
      load();
    } catch {
      toast.error("Gagal menyimpan");
    }
  };

  const openDeposit = (g) => {
    setDepositGoal(g);
    setDepositId(g.id);
    setDepositAmt("");
    setDepositWalletId(wallets[0]?.id || "");
    setToWalletId("");
    setDepositNote(`Nabung ke: ${g.title}`);
  };

  const deposit = async () => {
    const amt = parseFloat(depositAmt);
    if (!amt || amt <= 0) return toast.error("Jumlah setoran harus lebih dari 0");
    if (!depositWalletId && wallets.length > 0) return toast.error("Pilih dompet sumber dana");

    const selectedWallet = wallets.find((w) => w.id === depositWalletId);
    if (selectedWallet && selectedWallet.balance < amt && !["credit_card", "paylater"].includes(selectedWallet.type)) {
      toast.warning(
        `Peringatan: Saldo ${selectedWallet.name} (Rp ${selectedWallet.balance?.toLocaleString("id-ID")}) kurang dari jumlah setoran.`
      );
    }

    try {
      await api.post(`/goals/${depositId}/deposit`, {
        amount: amt,
        wallet_id: depositWalletId || undefined,
        to_wallet_id: toWalletId || undefined,
        note: depositNote.trim() || `Nabung ke: ${depositGoal?.title || "Tujuan"}`,
      });
      toast.success("Setoran berhasil & transaksi mutasi tercatat! 🎉");
      setDepositId(null);
      setDepositGoal(null);
      setDepositAmt("");
      setDepositNote("");
      load();
      bump();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menyetor");
    }
  };

  const openHistory = async (g) => {
    setHistoryGoal(g);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/goals/${g.id}/transactions`);
      setGoalTxns(res.data);
    } catch {
      toast.error("Gagal memuat riwayat setoran");
    } finally {
      setLoadingHistory(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus tujuan ini?")) return;
    await api.delete(`/goals/${id}`);
    load();
    bump();
  };

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
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => openDeposit(g)} data-testid={`deposit-goal-${g.id}`}>+ Setor</Button>
                          <button
                            type="button"
                            onClick={() => openHistory(g)}
                            className="p-1.5 rounded-lg hover:bg-elevated text-tmuted hover:text-brand transition-colors"
                            title="Riwayat Setoran"
                            data-testid={`history-goal-${g.id}`}
                          >
                            <History size={16} />
                          </button>
                        </div>
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

      {/* Enhanced Setor Modal */}
      <Modal open={!!depositId} onClose={() => setDepositId(null)} title={`Setor: ${depositGoal?.title || "Tujuan"}`} testid="deposit-modal" size="md">
        <div className="space-y-4">
          {wallets.length === 0 ? (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
              <span>Kamu belum memiliki dompet untuk dipotong saldonya.</span>
              <a href="/wallets" className="underline font-semibold shrink-0">Buat Dompet</a>
            </div>
          ) : (
            <>
              <Input
                label="Jumlah Setoran"
                prefix="Rp"
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={depositAmt}
                onChange={(e) => setDepositAmt(e.target.value)}
                data-testid="deposit-amount-input"
                autoFocus
              />

              <Select
                label="Sumber Dana (Dari Dompet)"
                value={depositWalletId}
                onChange={(e) => setDepositWalletId(e.target.value)}
                data-testid="deposit-wallet-select"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} (Saldo: Rp {w.balance?.toLocaleString("id-ID")})
                  </option>
                ))}
              </Select>

              {wallets.length > 1 && (
                <Select
                  label="Pindahkan ke Dompet Lain? (Opsional)"
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  data-testid="deposit-to-wallet-select"
                >
                  <option value="">Tetap di dompet sumber (sebagai pos komitmen nabung)</option>
                  {wallets.filter((w) => w.id !== depositWalletId).map((w) => (
                    <option key={w.id} value={w.id}>
                      Pindah ke: {w.name} (Saldo: Rp {w.balance?.toLocaleString("id-ID")})
                    </option>
                  ))}
                </Select>
              )}

              <Input
                label="Catatan Transaksi"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                placeholder="cth. Nabung gaji ke tujuan"
                data-testid="deposit-note-input"
              />

              <div className="rounded-xl bg-brand/10 border border-brand/30 p-3 text-xs text-tsecondary">
                💡 Setoran ini akan memotong saldo dompet dan dicatat sebagai transaksi di menu Transaksi.
              </div>

              <Button onClick={deposit} className="w-full" size="lg" data-testid="deposit-save-button">
                Setor Sekarang
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Goal Deposit History Modal */}
      <Modal open={!!historyGoal} onClose={() => setHistoryGoal(null)} title={`Riwayat Setoran: ${historyGoal?.title || ""}`} testid="goal-history-modal" size="md">
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Spinner size={24} className="text-brand" /></div>
          ) : goalTxns.length === 0 ? (
            <div className="text-center py-8 text-tmuted text-sm">
              <p>Belum ada riwayat transaksi setoran untuk tujuan ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-borderc/40 max-h-80 overflow-y-auto">
              {goalTxns.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-tprimary">{tx.note || "Setoran Nabung"}</p>
                    <p className="text-xs text-tmuted">{formatDate(tx.date || tx.created_at)}</p>
                  </div>
                  <span className="font-mono font-bold text-brand">
                    +{formatRp(tx.amount, privacy)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Button variant="secondary" onClick={() => setHistoryGoal(null)} className="w-full">
            Tutup
          </Button>
        </div>
      </Modal>
    </div>
  );
}
