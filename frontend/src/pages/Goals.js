import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  PiggyBank,
  PartyPopper,
  History,
  Pencil,
  Calendar,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatDate } from "../lib/format";
import {
  Card,
  Button,
  Modal,
  Input,
  Select,
  Progress,
  Spinner,
  EmptyState,
  Badge,
} from "../components/ui";
import GoalDetailModal from "../components/GoalDetailModal";

const PRESETS = [
  { title: "Dana Darurat 6 Bulan", emoji: "🛟", color: "#00E676" },
  { title: "Liburan ke Bali", emoji: "🏝️", color: "#00F0FF" },
  { title: "DP Rumah", emoji: "🏠", color: "#FFB800" },
  { title: "Gadget Baru", emoji: "📱", color: "#A78BFA" },
];

const EMOJIS = [
  "🎯", "🛟", "🏝️", "🏠", "📱", "🚗",
  "💍", "🎓", "👶", "✈️", "💻", "🏥"
];

export default function Goals() {
  const { privacy } = useTheme();
  const { bump } = useRefresh();
  const [goals, setGoals] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);

  const [form, setForm] = useState({
    title: "",
    target_amount: "",
    saved_amount: "",
    deadline: "",
    emoji: "🎯",
    color: "#00F0FF",
  });

  // Deposit state
  const [depositGoal, setDepositGoal] = useState(null);
  const [depositId, setDepositId] = useState(null);
  const [depositAmt, setDepositAmt] = useState("");
  const [depositWalletId, setDepositWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [recordDepositTransaction, setRecordDepositTransaction] = useState(true);

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

  // Sync selectedGoal if goals list refreshes
  useEffect(() => {
    if (selectedGoal) {
      const updated = goals.find((g) => g.id === selectedGoal.id);
      if (updated) setSelectedGoal(updated);
    }
  }, [goals]);

  const openNew = (preset) => {
    setEditingGoal(null);
    setForm({
      title: preset?.title || "",
      target_amount: "",
      saved_amount: "",
      deadline: "",
      emoji: preset?.emoji || "🎯",
      color: preset?.color || "#00F0FF",
    });
    setOpen(true);
  };

  const openEdit = (g) => {
    setEditingGoal(g);
    setForm({
      title: g.title,
      target_amount: String(g.target_amount || ""),
      saved_amount: g.saved_amount != null ? String(g.saved_amount) : "",
      deadline: g.deadline || "",
      emoji: g.emoji || "🎯",
      color: g.color || "#00F0FF",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Nama tujuan wajib diisi");
    const target = parseFloat(form.target_amount);
    if (!target || target <= 0) return toast.error("Target harus lebih dari 0");
    const saved = parseFloat(form.saved_amount) || 0;
    const payload = {
      title: form.title.trim(),
      target_amount: target,
      saved_amount: saved,
      deadline: form.deadline || null,
      emoji: form.emoji,
      color: form.color,
    };
    try {
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, payload);
        toast.success("Tujuan diperbarui!");
      } else {
        await api.post("/goals", payload);
        toast.success("Tujuan dibuat!");
      }
      setOpen(false);
      load();
      bump();
    } catch {
      toast.error("Gagal menyimpan tujuan");
    }
  };

  const openDeposit = (g) => {
    setDepositGoal(g);
    setDepositId(g.id);
    setDepositAmt("");
    setDepositWalletId(wallets[0]?.id || "");
    setToWalletId("");
    setDepositNote(`Nabung ke: ${g.title}`);
    setRecordDepositTransaction(true);
  };

  const deposit = async () => {
    const amt = parseFloat(depositAmt);
    if (!amt || amt <= 0) return toast.error("Jumlah setoran harus lebih dari 0");
    if (recordDepositTransaction && !depositWalletId && wallets.length > 0) {
      return toast.error("Pilih dompet sumber dana");
    }

    const selectedWallet = wallets.find((w) => w.id === depositWalletId);
    if (
      recordDepositTransaction &&
      selectedWallet &&
      selectedWallet.balance < amt &&
      !["credit_card", "paylater"].includes(selectedWallet.type)
    ) {
      toast.warning(
        `Peringatan: Saldo ${selectedWallet.name} (Rp ${selectedWallet.balance?.toLocaleString("id-ID")}) kurang dari jumlah setoran.`
      );
    }

    try {
      await api.post(`/goals/${depositId}/deposit`, {
        amount: amt,
        wallet_id: recordDepositTransaction ? (depositWalletId || undefined) : undefined,
        to_wallet_id: (recordDepositTransaction && toWalletId) ? toWalletId : undefined,
        note: depositNote.trim() || `Nabung ke: ${depositGoal?.title || "Tujuan"}`,
      });
      toast.success(
        recordDepositTransaction
          ? "Setoran berhasil & transaksi mutasi tercatat! 🎉"
          : "Progres tabungan berhasil ditambah! 🎉"
      );
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
    try {
      await api.delete(`/goals/${id}`);
      toast.success("Tujuan dihapus");
      if (selectedGoal?.id === id) setSelectedGoal(null);
      load();
      bump();
    } catch {
      toast.error("Gagal menghapus tujuan");
    }
  };

  // Aggregation metrics
  const totalSaved = goals.reduce((a, g) => a + (g.saved_amount || 0), 0);
  const totalTarget = goals.reduce((a, g) => a + (g.target_amount || 0), 0);
  const totalRemaining = Math.max(0, totalTarget - totalSaved);
  const overallPct =
    totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  // Live Recommendation for modal
  const numTarget = parseFloat(form.target_amount) || 0;
  const numSaved = parseFloat(form.saved_amount) || 0;
  const numRemaining = Math.max(0, numTarget - numSaved);
  let monthsLeft = null;
  let monthlyRec = null;
  if (form.deadline && numRemaining > 0) {
    try {
      const today = new Date();
      const dDate = new Date(form.deadline);
      const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        monthsLeft = Math.max(1, Math.round(diffDays / 30.4));
        monthlyRec = Math.round(numRemaining / monthsLeft);
      }
    } catch (e) {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Tujuan</h1>
          <p className="text-tsecondary text-sm mt-1">Nabung dengan target & impian yang jelas.</p>
        </div>
        <Button onClick={() => openNew()} data-testid="add-goal-button">
          <Plus size={16} /> Tujuan
        </Button>
      </div>

      {/* Savings Goals Hero Summary Banner */}
      <div className="rounded-2xl sm:rounded-3xl bg-surface/90 border border-borderc/80 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-borderc/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
            <h2 className="text-xs font-bold text-tmuted uppercase tracking-wider">
              Akumulasi Tabungan Impian
            </h2>
          </div>
          <span className="text-xs font-semibold text-cyan font-mono">
            {overallPct}% Tercapai
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-borderc/40">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-tmuted font-medium flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" /> Total Terkumpul
            </p>
            <p
              className={`text-lg sm:text-2xl font-head font-bold font-mono text-brand mt-1 truncate ${
                privacy ? "privacy-blur" : ""
              }`}
            >
              {formatRp(totalSaved, privacy)}
            </p>
            <span className="text-[10px] text-tmuted block mt-0.5 truncate">
              Dari {goals.length} target impian
            </span>
          </div>

          <div className="min-w-0 pt-3 sm:pt-0 sm:pl-6">
            <p className="text-[11px] sm:text-xs text-tmuted font-medium flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" /> Target Keseluruhan
            </p>
            <p
              className={`text-lg sm:text-2xl font-head font-bold font-mono text-tprimary mt-1 truncate ${
                privacy ? "privacy-blur" : ""
              }`}
            >
              {formatRp(totalTarget, privacy)}
            </p>
            <span className="text-[10px] text-tmuted block mt-0.5 truncate">
              Total komitmen tabungan
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 min-w-0 pt-3 sm:pt-0 sm:pl-6">
            <p className="text-[11px] sm:text-xs text-tmuted font-medium flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-rose shrink-0" /> Sisa Dana Dibutuhkan
            </p>
            <p
              className={`text-lg sm:text-2xl font-head font-bold font-mono text-rose mt-1 truncate ${
                privacy ? "privacy-blur" : ""
              }`}
            >
              {formatRp(totalRemaining, privacy)}
            </p>
            <span className="text-[10px] text-tmuted block mt-0.5 truncate">
              Kekurangan dana sisa
            </span>
          </div>
        </div>

        <Progress value={overallPct} color="var(--cyan)" className="h-2" />
      </div>

      {/* Sub-Header for Goals List */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold font-head text-tprimary">
            Daftar Target & Impian ({goals.length})
          </h2>
          <p className="text-xs text-tmuted">
            Pilih tujuan untuk melihat rincian kalkulasi, estimasi bulanan & riwayat setoran.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-brand" size={28} />
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title="Belum ada tujuan"
            subtitle="Mulai dari ide populer ini:"
          />
          <div className="flex flex-wrap gap-2 justify-center pb-4">
            {PRESETS.map((p) => (
              <button
                key={p.title}
                onClick={() => openNew(p)}
                className="px-3.5 py-2 rounded-full bg-elevated text-sm font-medium hover:bg-borderc transition-colors"
              >
                {p.emoji} {p.title}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {goals.map((g, i) => {
            const pct =
              g.target_amount > 0 ? (g.saved_amount / g.target_amount) * 100 : 0;
            const done = pct >= 100;
            const remaining = Math.max(0, g.target_amount - g.saved_amount);

            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  hover
                  data-testid={`goal-card-${g.id}`}
                  onClick={() => setSelectedGoal(g)}
                  className="p-4 sm:p-5 flex flex-col justify-between gap-4 cursor-pointer hover:border-brand/50 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-3xl p-1.5 rounded-xl bg-elevated shrink-0">
                        {g.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-base text-tprimary group-hover:text-brand transition-colors truncate">
                          {g.title}
                        </p>
                        {g.deadline && (
                          <p className="text-xs text-tmuted flex items-center gap-1 mt-0.5 truncate">
                            <Calendar size={12} /> Target: {formatDate(g.deadline)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(g);
                        }}
                        data-testid={`edit-goal-${g.id}`}
                        className="p-2 rounded-lg hover:bg-elevated text-tsecondary hover:text-tprimary transition-colors"
                        title="Edit Tujuan"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          del(g.id);
                        }}
                        data-testid={`delete-goal-${g.id}`}
                        className="p-2 rounded-lg hover:bg-elevated text-tmuted hover:text-rose transition-colors"
                        title="Hapus Tujuan"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-borderc/40">
                    <div className="flex justify-between items-baseline text-sm">
                      <span
                        className={`font-mono font-bold text-base ${
                          privacy ? "privacy-blur" : ""
                        }`}
                      >
                        {formatRp(g.saved_amount, privacy)}
                      </span>
                      <span
                        className={`font-mono text-tmuted text-xs ${
                          privacy ? "privacy-blur" : ""
                        }`}
                      >
                        / {formatRp(g.target_amount, privacy)}
                      </span>
                    </div>

                    <Progress
                      value={pct}
                      color={done ? "var(--brand)" : g.color || "var(--cyan)"}
                      className="h-2"
                    />

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span
                        className="font-semibold"
                        style={{ color: done ? "var(--brand)" : g.color || "var(--cyan)" }}
                      >
                        {done ? (
                          <span className="flex items-center gap-1">
                            <PartyPopper size={13} /> Tercapai!
                          </span>
                        ) : (
                          `${Math.round(pct)}% terkumpul · Sisa ${formatRp(remaining, privacy)}`
                        )}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeposit(g);
                          }}
                          data-testid={`deposit-goal-${g.id}`}
                        >
                          + Setor
                        </Button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openHistory(g);
                          }}
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

      {/* Create / Edit Goal Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingGoal ? "Edit Tujuan" : "Tujuan Baru"}
        testid="goal-modal"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-tsecondary uppercase tracking-wider block mb-2">
              Pilih Ikon / Emoji
            </label>
            <div className="flex gap-2 flex-wrap">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm({ ...form, emoji: e })}
                  className={`text-2xl w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    form.emoji === e
                      ? "bg-brand/20 ring-2 ring-brand"
                      : "bg-elevated hover:bg-borderc"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Nama Tujuan"
            placeholder="cth. Liburan ke Jepang, Dana Pendidikan"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            data-testid="goal-title-input"
          />

          <Input
            label="Target Dana (Rp)"
            prefix="Rp"
            type="number"
            placeholder="0"
            value={form.target_amount}
            onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
            data-testid="goal-target-input"
          />

          <Input
            label="Sudah Terkumpul Saat Ini (Rp) — Opsional"
            prefix="Rp"
            type="number"
            placeholder="0 (isi jika tabungan sudah berjalan sebelumnya)"
            value={form.saved_amount}
            onChange={(e) => setForm({ ...form, saved_amount: e.target.value })}
            data-testid="goal-saved-input"
          />

          <Input
            label="Target Tanggal / Deadline (opsional)"
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />

          {/* Live Recommendation Box */}
          {monthlyRec && (
            <div className="rounded-xl bg-cyan/10 border border-cyan/25 p-3.5 text-xs space-y-1">
              <span className="font-bold text-cyan flex items-center gap-1.5">
                <Sparkles size={13} /> Estimasi Target Bulanan
              </span>
              <p className="text-tprimary leading-relaxed">
                Nabung rutin{" "}
                <strong className="text-cyan font-mono font-bold">
                  ~{formatRp(monthlyRec)} / bulan
                </strong>{" "}
                selama {monthsLeft} bulan ke depan agar target tercapai tepat waktu.
              </p>
            </div>
          )}

          <Button
            onClick={save}
            className="w-full"
            size="lg"
            data-testid="goal-save-button"
          >
            {editingGoal ? "Simpan Perubahan" : "Buat Tujuan"}
          </Button>
        </div>
      </Modal>

      {/* Enhanced Setor Modal */}
      <Modal
        open={!!depositId}
        onClose={() => setDepositId(null)}
        title={`Setor: ${depositGoal?.title || "Tujuan"}`}
        testid="deposit-modal"
        size="md"
      >
        <div className="space-y-4">
          {wallets.length === 0 ? (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
              <span>Kamu belum memiliki dompet untuk dipotong saldonya.</span>
              <a href="/wallets" className="underline font-semibold shrink-0">
                Buat Dompet
              </a>
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

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-borderc">
                <div className="pr-2">
                  <label htmlFor="goal-record-trx-toggle" className="text-xs font-semibold text-tprimary cursor-pointer block">
                    Potong Saldo Dompet & Catat Transaksi
                  </label>
                  <p className="text-[11px] text-tmuted mt-0.5">
                    Otomatis mengurangi saldo dompet dan mencatat riwayat transaksi tabungan
                  </p>
                </div>
                <input
                  id="goal-record-trx-toggle"
                  type="checkbox"
                  checked={recordDepositTransaction}
                  onChange={(e) => setRecordDepositTransaction(e.target.checked)}
                  className="w-4 h-4 text-brand bg-elevated border-borderc rounded focus:ring-brand accent-brand cursor-pointer shrink-0"
                />
              </div>

              {recordDepositTransaction ? (
                <>
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
                      <option value="">
                        Tetap di dompet sumber (sebagai pos komitmen nabung)
                      </option>
                      {wallets
                        .filter((w) => w.id !== depositWalletId)
                        .map((w) => (
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
                </>
              ) : (
                <div className="rounded-xl bg-amber/10 border border-amber/30 p-3 text-xs text-amber">
                  ℹ️ Progres tabungan akan bertambah tanpa memotong saldo dompet atau membuat transaksi baru.
                </div>
              )}

              <Button
                onClick={deposit}
                className="w-full"
                size="lg"
                data-testid="deposit-save-button"
              >
                Setor Sekarang
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Goal Deposit History Modal */}
      <Modal
        open={!!historyGoal}
        onClose={() => setHistoryGoal(null)}
        title={`Riwayat Setoran: ${historyGoal?.title || ""}`}
        testid="goal-history-modal"
        size="md"
      >
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Spinner size={24} className="text-brand" />
            </div>
          ) : goalTxns.length === 0 ? (
            <div className="text-center py-8 text-tmuted text-sm">
              <p>Belum ada riwayat transaksi setoran untuk tujuan ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-borderc/40 max-h-80 overflow-y-auto">
              {goalTxns.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-tprimary">
                      {tx.note || "Setoran Nabung"}
                    </p>
                    <p className="text-xs text-tmuted">
                      {formatDate(tx.date || tx.created_at)}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-brand">
                    +{formatRp(tx.amount, privacy)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => setHistoryGoal(null)}
            className="w-full"
          >
            Tutup
          </Button>
        </div>
      </Modal>

      {/* Interactive Goal Detail Modal */}
      <GoalDetailModal
        goal={selectedGoal}
        open={!!selectedGoal}
        onClose={() => setSelectedGoal(null)}
        onEdit={(g) => openEdit(g)}
        onDeposit={(g) => openDeposit(g)}
      />
    </div>
  );
}
