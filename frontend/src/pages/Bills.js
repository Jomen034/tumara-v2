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
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp } from "../lib/format";
import { CATEGORIES, walletMeta } from "../lib/constants";
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
import PayBillModal from "../components/PayBillModal";
import PayCreditCardModal from "../components/PayCreditCardModal";
import BillCalendar from "../components/BillCalendar";

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
  const [selectedDate, setSelectedDate] = useState(null);
  const [payingBill, setPayingBill] = useState(null);
  const [payingCard, setPayingCard] = useState(null);
  const [quickDueDayWallet, setQuickDueDayWallet] = useState(null);
  const [quickDueDayValue, setQuickDueDayValue] = useState("");

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

  const [sortBy, setSortBy] = useState("alpha"); // "alpha" (A-Z default), "due" (Jatuh Tempo), "status" (Belum Bayar)

  const todayMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const debtWallets = useMemo(
    () => wallets.filter((w) => ["credit_card", "paylater"].includes(w.type)),
    [wallets]
  );

  const isPaidThisMonth = (b) => {
    if (b.is_completed) return true;
    if (b.last_paid_date && b.last_paid_date.startsWith(todayMonth)) return true;
    if (b.recurrence === "monthly" && b.next_due_date && b.next_due_date.slice(0, 7) > todayMonth && b.last_paid_date) return true;
    return false;
  };

  const walletMap = useMemo(() => {
    return Object.fromEntries(wallets.map((w) => [w.id, w]));
  }, [wallets]);

  // Helper due date calculation
  const getDueStatus = (dueDay, balance) => {
    if (!dueDay || dueDay < 1 || dueDay > 31) {
      return {
        hasDueDay: false,
        label: "Tempo belum diatur",
        color: "var(--tmuted)",
        daysUntil: null,
      };
    }

    const now = new Date();
    const todayDate = now.getDate();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth();

    const isOverdue = balance > 0 && todayDate > dueDay;

    let actualTargetMonth = targetMonth;
    let actualTargetYear = targetYear;
    if (todayDate > dueDay && balance <= 0) {
      actualTargetMonth += 1;
      if (actualTargetMonth > 11) {
        actualTargetMonth = 0;
        actualTargetYear += 1;
      }
    }

    const daysInMonth = new Date(actualTargetYear, actualTargetMonth + 1, 0).getDate();
    const actualDay = Math.min(dueDay, daysInMonth);
    const target = new Date(actualTargetYear, actualTargetMonth, actualDay);
    target.setHours(0, 0, 0, 0);

    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((target - todayZero) / (1000 * 60 * 60 * 24));

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];
    const formattedDate = `${actualDay} ${monthNames[actualTargetMonth]}`;

    if (balance <= 0) {
      return {
        hasDueDay: true,
        label: `Tempo tgl ${actualDay} tiap bln`,
        color: "var(--brand)",
        daysUntil: diffDays,
        formattedDate,
        isLunas: true,
      };
    }

    if (isOverdue) {
      const lateDays = todayDate - dueDay;
      return {
        hasDueDay: true,
        label: `⚠️ Lewat tempo ${lateDays} hari (${actualDay} ${monthNames[targetMonth]})`,
        color: "var(--rose)",
        daysUntil: -lateDays,
        formattedDate,
        isOverdue: true,
      };
    }

    if (diffDays === 0) {
      return {
        hasDueDay: true,
        label: "⚡ Jatuh tempo hari ini!",
        color: "var(--rose)",
        daysUntil: 0,
        formattedDate,
        isUrgent: true,
      };
    }

    if (diffDays <= 3) {
      return {
        hasDueDay: true,
        label: `⏳ ${diffDays} hari lagi (${formattedDate})`,
        color: "var(--amber)",
        daysUntil: diffDays,
        formattedDate,
        isUrgent: true,
      };
    }

    return {
      hasDueDay: true,
      label: `Tempo ${formattedDate} (${diffDays} hari lagi)`,
      color: "var(--brand)",
      daysUntil: diffDays,
      formattedDate,
    };
  };

  // Synthesize credit card & paylater bills into calendar
  const calendarBills = useMemo(() => {
    const list = [...bills];
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    const curMonthPrefix = `${curYear}-${String(curMonth).padStart(2, "0")}`;
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    debtWallets.forEach((w) => {
      if (w.due_day && w.due_day >= 1 && w.due_day <= 31) {
        const dueDayStr = String(w.due_day).padStart(2, "0");
        const dueDate = `${curMonthPrefix}-${dueDayStr}`;
        const bal = Math.max(0, Number(w.balance) || 0);
        const targetDate = new Date(curYear, curMonth - 1, w.due_day);
        const daysUntil = Math.round((targetDate - todayZero) / (1000 * 60 * 60 * 24));

        list.push({
          id: `cc_wallet_${w.id}`,
          name: `Tagihan ${w.name}`,
          amount: bal,
          category: "Tagihan & Utilitas",
          recurrence: "monthly",
          next_due_date: dueDate,
          wallet_id: w.id,
          bill_type: "credit_card",
          is_credit_card: true,
          credit_card_wallet: w,
          days_until: daysUntil,
          is_completed: false,
          is_paid_current_cycle: bal <= 0,
        });
      }
    });
    return list;
  }, [bills, debtWallets]);

  // Debt wallets filtered by selected date
  const displayedDebtWallets = useMemo(() => {
    if (!selectedDate) return debtWallets;
    const selDay = parseInt(selectedDate.slice(8, 10), 10);
    return debtWallets.filter((w) => w.due_day === selDay);
  }, [debtWallets, selectedDate]);

  const displayedBills = useMemo(() => {
    let list = bills;
    if (selectedDate) {
      list = bills.filter((b) => {
        if (b.next_due_date === selectedDate) return true;
        if (b.last_paid_date === selectedDate) return true;
        if (b.recurrence === "monthly" && b.next_due_date) {
          const selDay = parseInt(selectedDate.slice(8, 10), 10);
          const billDay = parseInt(b.next_due_date.slice(8, 10), 10);
          return selDay === billDay;
        }
        return false;
      });
    }

    const sorted = [...list];
    if (sortBy === "alpha") {
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" }));
    } else if (sortBy === "due") {
      sorted.sort((a, b) => (a.next_due_date || "").localeCompare(b.next_due_date || ""));
    } else if (sortBy === "status") {
      sorted.sort((a, b) => {
        const pa = isPaidThisMonth(a) ? 1 : 0;
        const pb = isPaidThisMonth(b) ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" });
      });
    }
    return sorted;
  }, [bills, selectedDate, sortBy, todayMonth]);

  const handleSaveQuickDueDay = async () => {
    if (!quickDueDayWallet) return;
    const day = parseInt(quickDueDayValue, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      return toast.error("Masukkan tanggal antara 1 sampai 31");
    }
    try {
      await api.patch(`/wallets/${quickDueDayWallet.id}/due-day`, { due_day: day });
      toast.success(`Jatuh tempo ${quickDueDayWallet.name} berhasil diatur ke tanggal ${day} tiap bulan!`);
      setQuickDueDayWallet(null);
      load();
      bump();
    } catch {
      toast.error("Gagal menyimpan tanggal jatuh tempo");
    }
  };

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

  const dueColor = (d, isComp, isPaidCycle) => {
    if (isComp || isPaidCycle) return "var(--brand)";
    return d < 0 ? "var(--rose)" : d <= 3 ? "var(--amber)" : "var(--brand)";
  };

  const dueLabel = (d, isComp, isPaidCycle) => {
    if (isComp) return "Lunas";
    if (isPaidCycle) return "Lunas Siklus Ini";
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
      ) : bills.length === 0 && debtWallets.length === 0 ? (
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
        <div className="space-y-6">
          {/* Interactive Bill Calendar */}
          <BillCalendar
            bills={calendarBills}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            privacy={privacy}
            walletMap={walletMap}
          />

          {/* Credit Card & PayLater Bills Section */}
          {debtWallets.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h3 className="font-head font-bold text-base sm:text-lg text-tprimary flex items-center gap-2">
                    <CreditCard size={18} className="text-cyan" />
                    Tagihan Kartu Kredit & PayLater ({debtWallets.length})
                  </h3>
                  <p className="text-xs text-tmuted">
                    Tagihan otomatis tersinkronisasi dari saldo kartu kredit & paylater Anda. Bayar tagihan dicatat sebagai transfer antar-dompet.
                  </p>
                </div>
              </div>

              {selectedDate && displayedDebtWallets.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-elevated/40 border border-borderc/60 text-xs text-tmuted flex items-center justify-between">
                  <span>Tidak ada tagihan kartu kredit yang jatuh tempo pada tanggal {selectedDate}.</span>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-brand font-semibold hover:underline ml-2"
                  >
                    Tampilkan Semua Kartu
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {displayedDebtWallets.map((w) => {
                    const m = walletMeta(w.type);
                    const Ic = Icons[m.icon] || CreditCard;
                    const curDebt = Math.max(0, Number(w.balance) || 0);
                    const due = getDueStatus(w.due_day, curDebt);
                    const hasLimit = (Number(w.credit_limit) || 0) > 0;
                    const sisaLimit = hasLimit ? Math.max(0, w.credit_limit - curDebt) : 0;
                    const utilPct = hasLimit
                      ? Math.min(100, Math.round((curDebt / w.credit_limit) * 100))
                      : 0;
                    const utilColor =
                      utilPct > 70 ? "var(--rose)" : utilPct > 30 ? "#F59E0B" : "var(--brand)";

                    return (
                      <Card
                        key={w.id}
                        className="p-4 sm:p-5 flex flex-col justify-between space-y-3.5 transition-all hover:border-brand/40 bg-card border-borderc"
                      >
                        {/* Header: Icon, Name, Type, Due Date */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${w.color}22` }}
                            >
                              <Ic size={20} style={{ color: w.color }} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm sm:text-base text-tprimary truncate">
                                {w.name}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge color={w.color}>{m.label}</Badge>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setQuickDueDayWallet(w);
                              setQuickDueDayValue(w.due_day ? String(w.due_day) : "");
                            }}
                            className="shrink-0 text-left"
                            title="Klik untuk mengubah tanggal jatuh tempo"
                          >
                            <Badge color={due.color} className="cursor-pointer hover:opacity-85">
                              {due.isOverdue && <AlertTriangle size={11} />}
                              {due.isUrgent && <AlertTriangle size={11} />}
                              {due.isLunas && <CheckCircle2 size={11} />}
                              {due.label}
                            </Badge>
                          </button>
                        </div>

                        {/* Balance & Utilization */}
                        <div className="space-y-1.5 pt-1 border-t border-borderc/40">
                          <div className="flex items-baseline justify-between gap-2">
                            <div>
                              <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider block">
                                Tagihan Terpakai
                              </span>
                              <p
                                className={`font-mono font-bold text-lg sm:text-xl ${
                                  curDebt > 0 ? "text-rose" : "text-brand"
                                } ${privacy ? "privacy-blur" : ""}`}
                              >
                                {curDebt > 0 ? formatRp(curDebt, privacy) : "LUNAS (Rp 0)"}
                              </p>
                            </div>

                            {hasLimit && (
                              <div className="text-right">
                                <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider block">
                                  Sisa Limit
                                </span>
                                <p
                                  className={`font-mono font-bold text-xs sm:text-sm text-cyan ${
                                    privacy ? "privacy-blur" : ""
                                  }`}
                                >
                                  {formatRp(sisaLimit, privacy)}
                                </p>
                              </div>
                            )}
                          </div>

                          {hasLimit && curDebt > 0 && (
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between items-center text-[10px] text-tmuted font-mono">
                                <span>
                                  Utilisasi:{" "}
                                  <span className="font-bold" style={{ color: utilColor }}>
                                    {utilPct}%
                                  </span>
                                </span>
                                <span>Plafon {formatRp(w.credit_limit, privacy)}</span>
                              </div>
                              <Progress
                                value={utilPct}
                                color={utilColor}
                                className="h-1"
                              />
                            </div>
                          )}
                        </div>

                        {/* Footer / Actions */}
                        <div className="pt-2 border-t border-borderc/40 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickDueDayWallet(w);
                              setQuickDueDayValue(w.due_day ? String(w.due_day) : "");
                            }}
                            className="text-[11px] text-tmuted hover:text-brand transition-colors flex items-center gap-1 font-medium"
                          >
                            <CalendarClock size={12} />
                            {w.due_day ? `Tempo tgl ${w.due_day}` : "Atur tgl tempo"}
                          </button>

                          {curDebt > 0 ? (
                            <Button
                              size="sm"
                              onClick={() => setPayingCard(w)}
                              data-testid={`pay-cc-btn-${w.id}`}
                              className="text-xs px-3 py-1.5"
                            >
                              <CheckCircle2 size={13} />
                              Bayar Tagihan
                            </Button>
                          ) : (
                            <span className="text-xs text-brand font-semibold flex items-center gap-1 bg-brand/10 px-2.5 py-1 rounded-full">
                              <CheckCircle2 size={12} /> Lunas
                            </span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section Header & Sorting Controls for Regular Bills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-borderc/40">
            <h3 className="font-head font-bold text-base sm:text-lg text-tprimary flex items-center gap-2">
              <ReceiptText size={18} className="text-brand" />
              {selectedDate ? (
                <>Tagihan Terfilter ({displayedBills.length})</>
              ) : (
                <>Daftar Tagihan Rutin & Cicilan ({bills.length})</>
              )}
            </h3>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Sort pills */}
              <div className="flex items-center bg-elevated border border-borderc rounded-xl p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSortBy("alpha")}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors",
                    sortBy === "alpha"
                      ? "bg-surface text-brand font-bold shadow-xs"
                      : "text-tmuted hover:text-tprimary"
                  )}
                  title="Urutkan berdasarkan abjad A-Z"
                >
                  Abjad (A–Z)
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("due")}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors",
                    sortBy === "due"
                      ? "bg-surface text-brand font-bold shadow-xs"
                      : "text-tmuted hover:text-tprimary"
                  )}
                  title="Urutkan berdasarkan tanggal jatuh tempo terdekat"
                >
                  Jatuh Tempo
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("status")}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors",
                    sortBy === "status"
                      ? "bg-surface text-brand font-bold shadow-xs"
                      : "text-tmuted hover:text-tprimary"
                  )}
                  title="Prioritaskan tagihan yang belum dibayar di atas"
                >
                  Belum Lunas
                </button>
              </div>

              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-xs text-brand font-semibold hover:underline bg-brand/10 hover:bg-brand/20 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {displayedBills.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <EmptyState
                icon={CalendarClock}
                title={selectedDate ? "Tidak ada tagihan di tanggal ini" : "Belum ada tagihan rutin non-kartu"}
                subtitle={
                  selectedDate
                    ? `Tidak ada jadwal pembayaran tagihan yang jatuh tempo pada tanggal ${selectedDate}.`
                    : "Tambahkan tagihan bulanan keluarga seperti listrik PLN, WiFi, air PAM, BPJS, atau cicilan kendaraan di sini."
                }
                action={
                  selectedDate ? (
                    <Button onClick={() => setSelectedDate(null)} size="sm" variant="secondary">
                      Tampilkan Semua Tagihan
                    </Button>
                  ) : (
                    <Button onClick={openNew} size="sm">
                      <Plus size={14} /> Tambah Tagihan
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="space-y-3" data-testid="bills-list">
              {displayedBills.map((b, i) => {
                const isInstallment = b.bill_type === "installment";
                const isComp = b.is_completed;
                const isPaidCycle = isPaidThisMonth(b);
                const cardColor = dueColor(b.days_until, isComp, isPaidCycle);

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
                                {!isComp && !isPaidCycle && b.days_until <= 3 && <AlertTriangle size={11} />}
                                {isPaidCycle && !isComp && <CheckCircle2 size={11} />}
                                {dueLabel(b.days_until, isComp, isPaidCycle)}
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
                              b.days_until < 0 && !isComp && !isPaidCycle ? "text-rose" : "text-tprimary"
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
                          <span>
                            · {isPaidCycle && !isComp ? `Jatuh tempo berikutnya ${b.next_due_date}` : `Tempo ${b.next_due_date}`}
                          </span>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isComp && !isPaidCycle && (
                            <Button
                              size="sm"
                              onClick={() => setPayingBill(b)}
                              data-testid={`pay-bill-${b.id}`}
                            >
                              <CheckCircle2 size={14} /> Bayar
                            </Button>
                          )}
                          {!isComp && isPaidCycle && (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 text-xs text-brand font-semibold px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20">
                                <CheckCircle2 size={13} /> Lunas
                              </span>
                              <button
                                type="button"
                                onClick={() => setPayingBill(b)}
                                className="text-[11px] text-tmuted hover:text-brand hover:underline px-1 py-1 transition-colors"
                                title="Bayar lagi untuk siklus berikutnya lebih awal"
                              >
                                Bayar Lagi
                              </button>
                            </div>
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
        </div>
      )}

      {/* Bill Detail Modal */}
      <BillDetailModal
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        bill={selectedBill}
        wallets={wallets}
        privacy={privacy}
        onPay={(b) => setPayingBill(b)}
        onEdit={(b) => {
          setSelectedBill(null);
          openEdit(b);
        }}
        onDelete={(id) => del(id)}
      />

      {/* Pay Bill Confirmation Modal */}
      <PayBillModal
        open={!!payingBill}
        onClose={() => setPayingBill(null)}
        bill={payingBill}
        wallets={wallets}
        onSuccess={async (updated) => {
          await load();
          bump();
          if (selectedBill?.id === updated.id) {
            setSelectedBill(updated);
          }
        }}
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
            {CATEGORIES.filter((c) => !["Gaji", "Bonus", "Transfer"].includes(c.name)).map((c) => (
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

      {/* Pay Credit Card Modal */}
      <PayCreditCardModal
        open={!!payingCard}
        creditCard={payingCard}
        wallets={wallets}
        onClose={() => setPayingCard(null)}
        onSuccess={() => {
          load();
          bump();
        }}
      />

      {/* Quick Edit Due Day Modal */}
      <Modal
        open={!!quickDueDayWallet}
        onClose={() => setQuickDueDayWallet(null)}
        title={`Atur Jatuh Tempo ${quickDueDayWallet?.name || ""}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-tmuted leading-relaxed">
            Pilih tanggal jatuh tempo bulanan (1–31). Tumara akan otomatis mengingatkan pembayaran tagihan kartu ini di kalender setiap bulan.
          </p>

          <Input
            label="Tanggal Jatuh Tempo Tiap Bulan"
            type="number"
            min="1"
            max="31"
            placeholder="cth. 5 (tiap tgl 5)"
            value={quickDueDayValue}
            onChange={(e) => setQuickDueDayValue(e.target.value)}
            autoFocus
          />

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => setQuickDueDayWallet(null)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveQuickDueDay}
              className="flex-1"
            >
              Simpan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
