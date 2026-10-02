import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import {
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  ReceiptText,
  Wallet,
  Sparkles,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp } from "../lib/format";
import { CATEGORIES } from "../lib/constants";
import {
  Card,
  Button,
  Modal,
  Input,
  Select,
  Spinner,
  EmptyState,
  Badge,
  Progress,
} from "../components/ui";
import BillDetailModal from "../components/BillDetailModal";

const RECUR = {
  monthly: "Bulanan",
  weekly: "Mingguan",
  yearly: "Tahunan",
  once: "Sekali",
};

export default function Bills() {
  const { privacy } = useTheme();
  const { bump } = useRefresh();
  const [bills, setBills] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);

  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "Tagihan & Utilitas",
    recurrence: "monthly",
    next_due_date: "",
    wallet_id: "",
    bill_type: "recurring",
    total_tenor: "",
    paid_tenor: "0",
    note: "",
  });

  const walletMap = useMemo(() => {
    return Object.fromEntries(wallets.map((w) => [w.id, w]));
  }, [wallets]);

  const load = () =>
    Promise.all([api.get("/bills"), api.get("/wallets")])
      .then(([b, w]) => {
        setBills(b.data);
        setWallets(w.data);
        if (selectedBill) {
          const updated = b.data.find((item) => item.id === selectedBill.id);
          setSelectedBill(updated || null);
        }
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      amount: "",
      category: "Tagihan & Utilitas",
      recurrence: "monthly",
      next_due_date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
      wallet_id: wallets[0]?.id || "",
      bill_type: "recurring",
      total_tenor: "",
      paid_tenor: "0",
      note: "",
    });
    setOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({
      name: b.name,
      amount: String(b.amount),
      category: b.category,
      recurrence: b.recurrence,
      next_due_date: b.next_due_date,
      wallet_id: b.wallet_id || "",
      bill_type: b.bill_type || "recurring",
      total_tenor: b.total_tenor ? String(b.total_tenor) : "",
      paid_tenor: String(b.paid_tenor || 0),
      note: b.note || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama tagihan wajib diisi");
    if (!form.next_due_date) return toast.error("Pilih tanggal jatuh tempo");
    const payload = {
      ...form,
      amount: parseFloat(form.amount) || 0,
      wallet_id: form.wallet_id || null,
      total_tenor:
        form.bill_type === "installment" ? parseInt(form.total_tenor) || null : null,
      paid_tenor:
        form.bill_type === "installment" ? parseInt(form.paid_tenor) || 0 : 0,
    };
    try {
      if (editing) await api.put(`/bills/${editing.id}`, payload);
      else await api.post("/bills", payload);
      toast.success(editing ? "Tagihan diperbarui" : "Tagihan ditambahkan");
      setOpen(false);
      load();
      bump();
    } catch {
      toast.error("Gagal menyimpan");
    }
  };

  const [payingId, setPayingId] = useState(null);
  const pay = async (b) => {
    if (payingId) return;
    setPayingId(b.id);
    try {
      const res = await api.post(`/bills/${b.id}/pay`);
      const updated = res.data;
      if (updated.is_completed) {
        toast.success(`🎉 Selamat! "${b.name}" telah lunas sepenuhnya!`);
      } else {
        toast.success(`"${b.name}" ditandai lunas${b.wallet_id ? " + saldo tercatat" : ""}!`);
      }
      await load();
      bump();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mencatat pembayaran");
    } finally {
      setPayingId(null);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus tagihan ini?")) return;
    try {
      await api.delete(`/bills/${id}`);
      if (selectedBill?.id === id) setSelectedBill(null);
      load();
      bump();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const dueColor = (d, isComp) => {
    if (isComp) return "var(--brand)";
    return d < 0 ? "var(--rose)" : d <= 3 ? "var(--amber)" : "var(--brand)";
  };

  const dueLabel = (d, isComp) => {
    if (isComp) return "Lunas";
    return d < 0 ? `Telat ${Math.abs(d)} hari` : d === 0 ? "Hari ini" : `${d} hari lagi`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Tagihan</h1>
          <p className="text-tsecondary text-sm mt-1">Jangan sampai telat bayar lagi.</p>
        </div>
        <Button onClick={openNew} data-testid="add-bill-button">
          <Plus size={16} /> Tagihan
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-brand" size={28} />
        </div>
      ) : bills.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Belum ada tagihan"
            subtitle="Tambahkan tagihan rutin seperti listrik, internet, atau cicilan kendaraan."
            action={
              <Button onClick={openNew} size="sm">
                Tambah Tagihan
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3" data-testid="bills-list">
          {bills.map((b, i) => {
            const isInstallment = b.bill_type === "installment";
            const isComp = b.is_completed;
            const cardColor = dueColor(b.days_until, isComp);

            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card
                  hover
                  onClick={() => setSelectedBill(b)}
                  className="p-4 sm:p-5 cursor-pointer transition-all hover:border-brand/50 group space-y-3"
                >
                  {/* Top Row: Icon, Title, Badges, & Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${cardColor}22` }}
                      >
                        <ReceiptText size={20} style={{ color: cardColor }} />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-sm sm:text-base text-tprimary truncate group-hover:text-brand transition-colors">
                          {b.name}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <Badge color={cardColor}>
                            {!isComp && b.days_until <= 3 && <AlertTriangle size={11} />}
                            {dueLabel(b.days_until, isComp)}
                          </Badge>

                          {isInstallment ? (
                            <Badge color="var(--cyan)">
                              {b.total_tenor
                                ? `Cicilan ${(b.paid_tenor || 0) + 1}/${b.total_tenor}`
                                : "Cicilan Ber-tenor"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-tmuted font-medium">
                              {RECUR[b.recurrence]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount on the right */}
                    <div className="text-right shrink-0">
                      <p
                        className={`font-mono font-bold text-base sm:text-lg ${
                          b.days_until < 0 && !isComp ? "text-rose" : "text-tprimary"
                        } ${privacy ? "privacy-blur" : ""}`}
                      >
                        {formatRp(b.amount, privacy)}
                      </p>
                      <span className="text-[11px] text-tmuted block">
                        /{RECUR[b.recurrence]?.toLowerCase() || "bln"}
                      </span>
                    </div>
                  </div>

                  {/* Installment Progress Bar (If loan/installment) */}
                  {isInstallment && b.total_tenor > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-borderc/40">
                      <div className="flex justify-between text-[11px] text-tmuted font-mono">
                        <span>
                          Progress: {b.paid_tenor || 0}/{b.total_tenor} angsuran
                        </span>
                        <span className="text-cyan font-bold">{b.progress_pct || 0}%</span>
                      </div>
                      <Progress
                        value={b.progress_pct || 0}
                        color={isComp ? "var(--brand)" : "var(--cyan)"}
                        className="h-1.5"
                      />
                    </div>
                  )}

                  {/* Bottom Row: Metadata info & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-borderc/40 text-xs">
                    <div className="text-tmuted truncate flex items-center gap-1.5">
                      {b.wallet_id ? (
                        <span className="text-tsecondary font-medium truncate flex items-center gap-1">
                          <Wallet size={12} className="text-brand" />
                          {walletMap[b.wallet_id]?.name || "Dompet"}
                        </span>
                      ) : (
                        <span className="text-tmuted">Manual</span>
                      )}
                      <span>· Tempo {b.next_due_date}</span>
                    </div>

                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!isComp && (
                        <Button
                          size="sm"
                          onClick={() => pay(b)}
                          disabled={payingId === b.id}
                          data-testid={`pay-bill-${b.id}`}
                        >
                          <CheckCircle2 size={14} /> {payingId === b.id ? "..." : "Bayar"}
                        </Button>
                      )}
                      <button
                        onClick={() => openEdit(b)}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-elevated text-tsecondary transition-colors"
                        title="Edit tagihan"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => del(b.id)}
                        data-testid={`delete-bill-${b.id}`}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-elevated text-tmuted hover:text-rose transition-colors"
                        title="Hapus tagihan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Bill Detail Modal */}
      <BillDetailModal
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        bill={selectedBill}
        wallets={wallets}
        privacy={privacy}
        paying={payingId === selectedBill?.id}
        onPay={(b) => pay(b)}
        onEdit={(b) => {
          setSelectedBill(null);
          openEdit(b);
        }}
        onDelete={(id) => del(id)}
      />

      {/* Add / Edit Bill Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Tagihan" : "Tagihan Baru"}
        testid="bill-modal"
      >
        <div className="space-y-4">
          {/* Bill Type Selector: Rutin vs Cicilan Ber-tenor */}
          <div>
            <span className="block text-xs font-semibold text-tsecondary uppercase tracking-wider mb-2">
              Jenis Tagihan
            </span>
            <div className="grid grid-cols-2 gap-2 bg-elevated p-1 rounded-xl border border-borderc">
              <button
                type="button"
                onClick={() => setForm({ ...form, bill_type: "recurring" })}
                className={clsx(
                  "py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors",
                  form.bill_type === "recurring"
                    ? "bg-brand text-black shadow"
                    : "text-tsecondary hover:text-tprimary"
                )}
              >
                <ReceiptText size={14} /> Tagihan Rutin
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, bill_type: "installment" })}
                className={clsx(
                  "py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors",
                  form.bill_type === "installment"
                    ? "bg-cyan text-black shadow"
                    : "text-tsecondary hover:text-tprimary"
                )}
              >
                <Sparkles size={14} /> Cicilan / Pinjaman
              </button>
            </div>
          </div>

          <Input
            label="Nama Tagihan"
            placeholder={
              form.bill_type === "installment"
                ? "cth. Cicilan Mobil, KPR Rumah"
                : "cth. Listrik PLN, WiFi Indihome, Netflix"
            }
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-testid="bill-name-input"
          />

          <Input
            label={form.bill_type === "installment" ? "Nominal Angsuran per Periode" : "Jumlah"}
            prefix="Rp"
            type="number"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            data-testid="bill-amount-input"
          />

          {/* If installment: show Total Tenor and Already Paid Tenor */}
          {form.bill_type === "installment" && (
            <div className="p-3.5 bg-cyan/5 border border-cyan/20 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan">
                <Sparkles size={14} /> Pengaturan Tenor Cicilan
              </div>

              <div className="grid grid-cols-2 gap-3 min-w-0">
                <Input
                  label="Total Tenor (kali/bln)"
                  type="number"
                  placeholder="cth. 36"
                  value={form.total_tenor}
                  onChange={(e) => setForm({ ...form, total_tenor: e.target.value })}
                />
                <Input
                  label="Sudah Terbayar"
                  type="number"
                  placeholder="cth. 14"
                  value={form.paid_tenor}
                  onChange={(e) => setForm({ ...form, paid_tenor: e.target.value })}
                />
              </div>

              <p className="text-[11px] text-tmuted leading-relaxed">
                * Isi 0 jika cicilan baru dimulai. Jika cicilan sudah berjalan sebelum memakai Tumara, isi berapa kali angsuran yang telah lunas.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <Input
              label="Jatuh Tempo"
              type="date"
              value={form.next_due_date}
              onChange={(e) => setForm({ ...form, next_due_date: e.target.value })}
              data-testid="bill-date-input"
            />
            <Select
              label="Perulangan"
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
            >
              {Object.entries(RECUR).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>

          <Select
            label="Kategori"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.filter((c) => !["Gaji", "Bonus"].includes(c.name)).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            label="Bayar otomatis dari (opsional)"
            value={form.wallet_id}
            onChange={(e) => setForm({ ...form, wallet_id: e.target.value })}
          >
            <option value="">— Tidak otomatis catat —</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>

          <Input
            label="Catatan (opsional)"
            placeholder="cth. No kontrak / virtual account"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />

          <Button
            onClick={save}
            className="w-full"
            size="lg"
            data-testid="bill-save-button"
          >
            {editing ? "Simpan Perubahan" : "Tambah Tagihan"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
