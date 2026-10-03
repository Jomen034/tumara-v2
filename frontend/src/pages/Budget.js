import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Check,
  Percent,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Flame,
  Calendar,
  ChevronRight,
  Plus,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Info,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatShort } from "../lib/format";
import { catMeta, CATEGORIES } from "../lib/constants";
import { Card, Button, Input, Progress, Badge, Spinner, Modal } from "../components/ui";
import BudgetDetailModal from "../components/BudgetDetailModal";
import AddTransactionModal from "../components/AddTransactionModal";
import AddBudgetCategoryModal from "../components/AddBudgetCategoryModal";

const DEFAULT_CATS = [
  { category: "Groceries & Kebutuhan Rumah", group: "needs", pct: 0.2 },
  { category: "Makanan & Minuman", group: "needs", pct: 0.1 },
  { category: "Tagihan & Utilitas", group: "needs", pct: 0.1 },
  { category: "Transportasi", group: "needs", pct: 0.05 },
  { category: "Kesehatan", group: "needs", pct: 0.05 },
  { category: "Belanja", group: "wants", pct: 0.2 },
  { category: "Hiburan", group: "wants", pct: 0.1 },
  { category: "Investasi", group: "savings", pct: 0.2 },
];

const GROUP_LABEL = { needs: "Kebutuhan", wants: "Keinginan", savings: "Tabungan" };
const GROUP_COLOR = { needs: "var(--brand)", wants: "var(--amber)", savings: "var(--cyan)" };

const EXPENSE_CATEGORIES = CATEGORIES.filter(
  (c) => c.name !== "Gaji" && c.name !== "Bonus" && c.name !== "Transfer"
);

export default function Budget() {
  const { privacy } = useTheme();
  const { version, bump } = useRefresh();
  const { user, checkAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const onboarding = location.state?.onboarding || (user && !user.onboarded);

  const [budget, setBudget] = useState(null);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);

  // Wizard states
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState("");
  const [mode, setMode] = useState("percentage");
  const [cats, setCats] = useState([]);
  const [wizardNewCat, setWizardNewCat] = useState("");
  const [wizardNewGroup, setWizardNewGroup] = useState("needs");
  const [showWizardAddRow, setShowWizardAddRow] = useState(false);

  // Detail Modal & Quick Add states
  const [selectedCat, setSelectedCat] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addExpenseCat, setAddExpenseCat] = useState("Makanan & Minuman");

  // New features: Add category & Edit income states
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addCatInitial, setAddCatInitial] = useState("");
  const [editIncomeOpen, setEditIncomeOpen] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [savingIncome, setSavingIncome] = useState(false);
  const [autoBalancing, setAutoBalancing] = useState(false);

  const load = () =>
    Promise.all([api.get("/budget"), api.get("/dashboard")])
      .then(([b, d]) => {
        setBudget(b.data);
        setDash(d.data);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // auto-start wizard for first-run onboarding
  useEffect(() => {
    if (!loading && onboarding && !budget) startWizard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const skipOnboarding = async () => {
    localStorage.setItem("tumara-skip-onboarding", "1");
    localStorage.setItem("nusa-skip-onboarding", "1");
    try {
      await api.post("/auth/complete-onboarding");
      await checkAuth();
    } catch {}
    navigate("/dashboard");
  };

  const startWizard = () => {
    setStep(0);
    setIncome(budget ? String(budget.monthly_income) : "");
    setMode(budget?.mode || "percentage");
    setCats(budget ? budget.categories.map((c) => ({ ...c })) : []);
    setWizard(true);
  };

  const genCats = (inc) =>
    DEFAULT_CATS.map((c) => ({
      category: c.category,
      group: c.group,
      limit: Math.round(inc * c.pct),
    }));

  const next = () => {
    if (step === 0) {
      const inc = parseFloat(income);
      if (!inc || inc <= 0) return toast.error("Masukkan penghasilan bulananmu");
      if (cats.length === 0) setCats(genCats(inc));
      setStep(1);
    } else if (step === 1) {
      if (mode === "percentage") setCats(genCats(parseFloat(income)));
      setStep(2);
    }
  };

  const save = async () => {
    try {
      await api.post("/budget", {
        monthly_income: parseFloat(income),
        mode,
        categories: cats.map((c) => ({
          category: c.category,
          group: c.group,
          limit: parseFloat(c.limit) || 0,
        })),
      });
      toast.success("Budget tersimpan! 🎯");
      setWizard(false);
      bump();
      if (onboarding) {
        localStorage.setItem("tumara-skip-onboarding", "1");
        localStorage.setItem("nusa-skip-onboarding", "1");
        await checkAuth();
        navigate("/dashboard");
      } else {
        load();
      }
    } catch {
      toast.error("Gagal menyimpan budget");
    }
  };

  const handleSaveIncome = async () => {
    const val = parseFloat(incomeInput);
    if (isNaN(val) || val <= 0) {
      return toast.error("Masukkan nominal penghasilan yang valid");
    }
    setSavingIncome(true);
    try {
      await api.put("/budget/income", { monthly_income: val });
      toast.success("Penghasilan bulanan berhasil diperbarui! 🎯");
      setEditIncomeOpen(false);
      load();
      bump();
    } catch {
      toast.error("Gagal memperbarui penghasilan");
    } finally {
      setSavingIncome(false);
    }
  };

  const handleAutoBalance = async () => {
    if (!budget || !budget.categories || budget.categories.length === 0) return;
    const inc = budget.monthly_income || 0;
    if (inc <= 0) return toast.error("Penghasilan bulanan belum diset");

    setAutoBalancing(true);
    try {
      const activeCats = [...budget.categories];
      const needs = activeCats.filter((c) => (c.group || "needs") === "needs");
      const wants = activeCats.filter((c) => c.group === "wants");
      const savings = activeCats.filter((c) => c.group === "savings");

      const needsPool = inc * 0.5;
      const wantsPool = inc * 0.3;
      const savingsPool = inc * 0.2;

      const balancedCats = activeCats.map((c) => {
        const grp = c.group || "needs";
        if (grp === "needs") {
          if (c.category === "Groceries & Kebutuhan Rumah") return { ...c, limit: Math.round(inc * 0.2) };
          if (c.category === "Makanan & Minuman") return { ...c, limit: Math.round(inc * 0.1) };
          if (c.category === "Tagihan & Utilitas") return { ...c, limit: Math.round(inc * 0.1) };
          if (c.category === "Transportasi") return { ...c, limit: Math.round(inc * 0.05) };
          if (c.category === "Kesehatan") return { ...c, limit: Math.round(inc * 0.05) };
          return { ...c, limit: Math.round(needsPool / Math.max(1, needs.length)) };
        }
        if (grp === "wants") {
          if (c.category === "Belanja") return { ...c, limit: Math.round(inc * 0.2) };
          if (c.category === "Hiburan") return { ...c, limit: Math.round(inc * 0.1) };
          return { ...c, limit: Math.round(wantsPool / Math.max(1, wants.length)) };
        }
        if (grp === "savings") {
          if (c.category === "Investasi") return { ...c, limit: Math.round(inc * 0.2) };
          return { ...c, limit: Math.round(savingsPool / Math.max(1, savings.length)) };
        }
        return c;
      });

      await api.post("/budget", {
        monthly_income: inc,
        mode: "percentage",
        categories: balancedCats,
      });

      toast.success("Anggaran diseimbangkan secara proporsional sesuai kaidah 50/30/20! 🎯");
      load();
      bump();
    } catch {
      toast.error("Gagal menyeimbangkan anggaran");
    } finally {
      setAutoBalancing(false);
    }
  };

  const totalLimit = cats.reduce((a, c) => a + (parseFloat(c.limit) || 0), 0);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Spinner size={30} className="text-brand" />
      </div>
    );

  // ---------- Wizard ----------
  if (wizard) {
    const incNum = parseFloat(income) || 0;
    const existingWizardCatNames = new Set(cats.map((c) => c.category));
    const availableWizardPresets = EXPENSE_CATEGORIES.filter(
      (c) => !existingWizardCatNames.has(c.name)
    );

    return (
      <div className="max-w-lg mx-auto space-y-6">
        {onboarding && (
          <div className="text-center">
            <h1 className="font-head font-extrabold text-2xl">Selamat datang di Tumara 👋</h1>
            <p className="text-sm text-tsecondary mt-1">
              Yuk atur budget pertamamu — cuma 3 langkah untuk tumbuh dengan arah.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={clsx(
                "h-1.5 flex-1 rounded-full transition-colors",
                s <= step ? "bg-brand" : "bg-elevated"
              )}
            />
          ))}
        </div>

        {step === 0 && (
          <Card className="space-y-5">
            <div>
              <h2 className="font-head font-bold text-xl">Berapa penghasilan bulananmu?</h2>
              <p className="text-sm text-tsecondary mt-1">Gaji + pemasukan rutin lainnya.</p>
            </div>
            <Input
              prefix="Rp"
              type="number"
              placeholder="0"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              data-testid="budget-income-input"
              autoFocus
              className="text-lg"
            />
            <Button onClick={next} className="w-full" size="lg" data-testid="budget-next-button">
              Lanjut <ArrowRight size={16} />
            </Button>
            {onboarding && (
              <button
                onClick={skipOnboarding}
                data-testid="skip-onboarding-button"
                className="w-full text-sm text-tmuted hover:text-tsecondary"
              >
                Lewati dulu, atur nanti
              </button>
            )}
          </Card>
        )}

        {step === 1 && (
          <Card className="space-y-4">
            <div>
              <h2 className="font-head font-bold text-xl">Pilih metode budgeting</h2>
              <p className="text-sm text-tsecondary mt-1">Bisa diubah nanti.</p>
            </div>
            <button
              onClick={() => setMode("percentage")}
              data-testid="budget-mode-percentage"
              className={clsx(
                "w-full text-left p-4 rounded-2xl border transition-colors",
                mode === "percentage" ? "border-brand bg-brand/10" : "border-borderc hover:bg-elevated"
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Percent size={18} className="text-brand" /> Aturan 50/30/20
              </div>
              <p className="text-sm text-tsecondary mt-1">
                50% kebutuhan, 30% keinginan, 20% tabungan. Cocok untuk pemula.
              </p>
            </button>
            <button
              onClick={() => setMode("fixed")}
              data-testid="budget-mode-fixed"
              className={clsx(
                "w-full text-left p-4 rounded-2xl border transition-colors",
                mode === "fixed" ? "border-brand bg-brand/10" : "border-borderc hover:bg-elevated"
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                <SlidersHorizontal size={18} className="text-brand" /> Limit Custom
              </div>
              <p className="text-sm text-tsecondary mt-1">Tentukan sendiri limit tiap kategori.</p>
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(0)}>
                <ArrowLeft size={16} />
              </Button>
              <Button onClick={next} className="flex-1" data-testid="budget-next-button-2">
                Lanjut <ArrowRight size={16} />
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-head font-bold text-xl">Atur limit per kategori</h2>
                <p className="text-sm text-tsecondary mt-0.5">
                  Tambah, kurangi, atau sesuaikan limit tiap pos.
                </p>
              </div>
              <Badge color="var(--brand)">{cats.length} Pos</Badge>
            </div>

            <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
              {cats.map((c, i) => (
                <div
                  key={c.category}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-elevated/40 border border-borderc"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium flex items-center gap-1.5 truncate">
                      <span className="truncate">{c.category}</span>
                      <Badge color={GROUP_COLOR[c.group] || "var(--brand)"}>
                        {GROUP_LABEL[c.group] || "Kebutuhan"}
                      </Badge>
                    </span>
                  </div>
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tmuted text-xs font-mono">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={c.limit}
                      data-testid={`budget-cat-${i}`}
                      onChange={(e) => {
                        const n = [...cats];
                        n[i] = { ...n[i], limit: e.target.value };
                        setCats(n);
                      }}
                      className="w-full bg-surface border border-borderc rounded-lg pl-7 pr-2 py-1.5 text-xs font-mono focus:border-brand focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCats(cats.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-tmuted hover:text-rose hover:bg-rose/10 rounded-lg transition-colors shrink-0"
                    title="Hapus pos ini dari anggaran"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Add in Wizard Step 2 */}
            {!showWizardAddRow ? (
              <button
                type="button"
                onClick={() => setShowWizardAddRow(true)}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-borderc hover:border-brand text-xs font-semibold text-tsecondary hover:text-brand flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus size={14} /> Tambah Pos Kategori Lain
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-elevated border border-borderc space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-tprimary">Tambah Pos Kategori:</span>
                  <button
                    type="button"
                    onClick={() => setShowWizardAddRow(false)}
                    className="text-tmuted hover:text-tsecondary"
                  >
                    Batal
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={wizardNewCat}
                    onChange={(e) => setWizardNewCat(e.target.value)}
                    className="bg-surface border border-borderc rounded-lg px-2 py-1.5 text-xs text-tprimary"
                  >
                    <option value="">Pilih Kategori...</option>
                    {availableWizardPresets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={wizardNewGroup}
                    onChange={(e) => setWizardNewGroup(e.target.value)}
                    className="bg-surface border border-borderc rounded-lg px-2 py-1.5 text-xs text-tprimary"
                  >
                    <option value="needs">Kebutuhan (50%)</option>
                    <option value="wants">Keinginan (30%)</option>
                    <option value="savings">Tabungan (20%)</option>
                  </select>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!wizardNewCat) return toast.error("Pilih kategori");
                    setCats([
                      ...cats,
                      {
                        category: wizardNewCat,
                        group: wizardNewGroup,
                        limit: Math.round((incNum || 1000000) * 0.05),
                      },
                    ]);
                    setWizardNewCat("");
                    setShowWizardAddRow(false);
                  }}
                  className="w-full"
                >
                  <Plus size={13} /> Tambahkan ke Daftar
                </Button>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-borderc">
              <span className="text-sm text-tsecondary">Total Anggaran:</span>
              <span className="font-mono font-bold">{formatRp(totalLimit)}</span>
            </div>

            {incNum > 0 && totalLimit > incNum && (
              <div className="p-2.5 rounded-xl bg-rose/10 border border-rose/30 text-rose text-xs flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  Total anggaran ({formatRp(totalLimit)}) melebihi penghasilan ({formatRp(incNum)}).
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={16} />
              </Button>
              <Button onClick={save} className="flex-1" data-testid="budget-save-button">
                <Check size={16} /> Aktifkan Budget
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ---------- Overview ----------
  const status = dash?.budget_status || [];
  const totalSpent = status.reduce((a, b) => a + b.spent, 0);
  const totalBudget = status.reduce((a, b) => a + b.limit, 0);
  const totalRemaining = Math.max(0, totalBudget - totalSpent);
  const isTotalOver = totalSpent > totalBudget && totalBudget > 0;
  const totalOverAmount = Math.max(0, totalSpent - totalBudget);
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const monthlyIncome = budget?.monthly_income || 0;

  // Calendar & pacing
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysLeft = Math.max(1, totalDaysInMonth - currentDay + 1);
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const currentMonthName = monthNames[currentMonth];
  const safeDailyTotal = daysLeft > 0 ? Math.round(totalRemaining / daysLeft) : 0;

  // 50/30/20 Group Aggregates
  const groupStats = {
    needs: { label: "Kebutuhan", targetPct: "50%", color: "var(--brand)", spent: 0, limit: 0, icon: ShieldCheck },
    wants: { label: "Keinginan", targetPct: "30%", color: "var(--amber)", spent: 0, limit: 0, icon: Sparkles },
    savings: { label: "Tabungan", targetPct: "20%", color: "var(--cyan)", spent: 0, limit: 0, icon: TrendingUp },
  };
  status.forEach((b) => {
    const g = b.group || "needs";
    if (groupStats[g]) {
      groupStats[g].spent += b.spent || 0;
      groupStats[g].limit += b.limit || 0;
    }
  });

  // Guardrail calculations relative to Income
  const needsPct = monthlyIncome > 0 ? Math.round((groupStats.needs.limit / monthlyIncome) * 100) : 0;
  const wantsPct = monthlyIncome > 0 ? Math.round((groupStats.wants.limit / monthlyIncome) * 100) : 0;
  const savingsPct = monthlyIncome > 0 ? Math.round((groupStats.savings.limit / monthlyIncome) * 100) : 0;
  const allocatedPct = monthlyIncome > 0 ? Math.round((totalBudget / monthlyIncome) * 100) : 0;
  const unallocated = Math.max(0, monthlyIncome - totalBudget);
  const isOverAllocated = totalBudget > monthlyIncome && monthlyIncome > 0;
  const overAllocatedAmount = Math.max(0, totalBudget - monthlyIncome);

  // Unbudgeted spending detection from transactions
  const budgetedCategories = new Set(status.map((s) => s.category));
  const unbudgetedTransactions = (dash?.category_breakdown || []).filter(
    (c) => c.amount > 0 && !budgetedCategories.has(c.category)
  );

  return (
    <div className="space-y-6">
      {/* Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Budget</h1>
          <p className="text-tsecondary text-sm mt-1">
            {currentMonthName} {currentYear} ·{" "}
            {budget ? (budget.mode === "percentage" ? "Aturan 50/30/20" : "Limit Custom") : "Belum diatur"}
          </p>
        </div>
        {budget && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => {
                setAddCatInitial("");
                setAddCatOpen(true);
              }}
              data-testid="add-budget-pos-button"
            >
              <Plus size={15} /> Tambah Pos
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIncomeInput(String(monthlyIncome));
                setEditIncomeOpen(true);
              }}
              data-testid="edit-income-button"
            >
              <Wallet size={15} /> Edit Gaji
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={startWizard}
              data-testid="edit-budget-button"
            >
              <Pencil size={15} /> Wizard
            </Button>
          </div>
        )}
      </div>

      {!budget ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mx-auto mb-4">
            <Percent size={28} className="text-brand" />
          </div>
          <h3 className="font-head font-bold text-lg">Belum ada budget</h3>
          <p className="text-sm text-tsecondary mt-1 max-w-xs mx-auto">
            Buat budget dalam 3 langkah cepat & mulai disiplin finansial keluarga.
          </p>
          <Button
            onClick={startWizard}
            className="mt-5"
            data-testid="budget-wizard-start-button"
            size="lg"
          >
            Mulai Setup Budget
          </Button>
        </Card>
      ) : (
        <>
          {/* Enhanced Hero Summary Card */}
          <Card className="relative overflow-hidden space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-tmuted font-semibold uppercase tracking-wider">
                Total Anggaran Bulan Ini
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIncomeInput(String(monthlyIncome));
                    setEditIncomeOpen(true);
                  }}
                  className="text-xs text-tsecondary hover:text-brand flex items-center gap-1 px-2.5 py-1 rounded-full bg-elevated/70 border border-borderc hover:border-brand/40 transition-colors"
                >
                  <Wallet size={13} className="text-brand" />
                  <span>Penghasilan: <strong className="font-mono">{formatShort(monthlyIncome, privacy)}</strong></span>
                  <Pencil size={11} className="text-tmuted" />
                </button>
                <span className="text-xs text-tsecondary flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated/70 border border-borderc">
                  <Calendar size={13} className="text-brand" />
                  <span>{daysLeft} hari tersisa di {currentMonthName}</span>
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl sm:text-4xl font-head font-extrabold font-mono ${privacy ? "privacy-blur" : ""}`}>
                  {formatRp(totalSpent, privacy)}
                </span>
                <span className={`text-tmuted font-mono text-base sm:text-lg ${privacy ? "privacy-blur" : ""}`}>
                  / {formatShort(totalBudget, privacy)}
                </span>
                <span className={clsx("text-xs font-mono font-bold ml-auto px-2 py-0.5 rounded-full", isTotalOver ? "bg-rose/10 text-rose" : totalPct >= 80 ? "bg-amber/10 text-amber" : "bg-brand/10 text-brand")}>
                  {totalPct}%
                </span>
              </div>
              <Progress
                className="mt-3 h-3"
                value={totalPct}
                color={isTotalOver ? "var(--rose)" : totalPct >= 80 ? "var(--amber)" : "var(--brand)"}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-borderc text-xs">
              <div className="flex items-center gap-2">
                {isTotalOver ? (
                  <span className="text-rose font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={15} /> Defisit: <span className="font-mono">{formatRp(totalOverAmount, privacy)}</span>
                  </span>
                ) : (
                  <span className="text-tsecondary flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-brand" /> Sisa Kuota:{" "}
                    <span className="font-mono font-semibold text-brand">{formatRp(totalRemaining, privacy)}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center sm:justify-end gap-2">
                {!isTotalOver && totalRemaining > 0 ? (
                  <span className="text-tsecondary flex items-center gap-1.5">
                    <Flame size={15} className="text-amber" /> Batas belanja harian:{" "}
                    <strong className="text-tprimary font-mono">{formatRp(safeDailyTotal, privacy)}/hari</strong>
                  </span>
                ) : (
                  <span className="text-rose text-xs flex items-center gap-1">
                    <AlertTriangle size={13} /> Tahan belanja non-primer sisa bulan ini
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Smart Financial Health Guardrails & Advisor */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-borderc space-y-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="font-head font-bold text-sm text-tprimary">
                    Diagnosa Kesehatan & Keseimbangan Anggaran
                  </h3>
                  <p className="text-[11px] text-tmuted">
                    Audit real-time alokasi pos pengeluaran terhadap kaidah finansial sehat.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoBalance}
                  disabled={autoBalancing}
                  className="text-xs"
                  title="Meratakan alokasi pos aktif secara proporsional sesuai kaidah 50/30/20"
                >
                  {autoBalancing ? <Spinner size={13} /> : <RefreshCw size={13} />}
                  <span>Seimbangkan 50/30/20</span>
                </Button>
              </div>
            </div>

            {/* Assessment Status Banner */}
            {isOverAllocated ? (
              <div className="p-3 rounded-xl bg-rose/10 border border-rose/30 text-rose text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle size={15} /> Peringatan Defisit Alokasi: Melebihi Penghasilan
                </div>
                <p className="leading-relaxed">
                  Total anggaran (<strong>{formatRp(totalBudget)}</strong>) melebihi penghasilan bulananmu (
                  <strong>{formatRp(monthlyIncome)}</strong>) sebesar{" "}
                  <span className="font-mono font-bold">{formatRp(overAllocatedAmount)}</span>. Segera kurangi limit pos sekunder atau klik <em>Seimbangkan 50/30/20</em> agar tidak terjadi defisit.
                </p>
              </div>
            ) : wantsPct > 35 ? (
              <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-amber text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle size={15} /> Peringatan Pos Keinginan & Belanja ({wantsPct}%)
                </div>
                <p className="leading-relaxed">
                  Alokasi pos Keinginan mencapai <strong>{wantsPct}%</strong> dari penghasilan (di atas rekomendasi maksimal 30%). Waspada risiko bocor halus pada pengeluaran gaya hidup & hiburan.
                </p>
              </div>
            ) : savingsPct < 15 ? (
              <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-amber text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle size={15} /> Alokasi Tabungan Perlu Ditambah ({savingsPct}%)
                </div>
                <p className="leading-relaxed">
                  Alokasi Tabungan & Investasimu saat ini <strong>{savingsPct}%</strong> (di bawah rekomendasi minimal 20%). Tambahkan pos tabungan untuk memperkuat jaring pengaman masa depan.
                </p>
              </div>
            ) : unallocated > 0 ? (
              <div className="p-3 rounded-xl bg-cyan/10 border border-cyan/30 text-cyan text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info size={15} /> Ada Dana Belum Teralokasi ({formatShort(unallocated)})
                </div>
                <p className="leading-relaxed">
                  Masih ada <strong>{formatRp(unallocated)}</strong> ({100 - allocatedPct}%) dari penghasilan yang belum dianggarkan. Terapkan prinsip <em>Zero-Based Budgeting</em> dengan memasukkannya ke pos Tabungan atau Dana Darurat!
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-brand/10 border border-brand/30 text-brand text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 size={15} /> Struktur Anggaran Sangat Sehat (100% Zero-Based)
                </div>
                <p className="leading-relaxed">
                  Semua pos teralokasi dengan disiplin selaras dengan penghasilan bulananmu (Kebutuhan: {needsPct}%, Keinginan: {wantsPct}%, Tabungan: {savingsPct}%). Pertahankan!
                </p>
              </div>
            )}
          </div>

          {/* Unbudgeted Transactions Detector Alert (If Any) */}
          {unbudgetedTransactions.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber/10 border border-amber/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber flex items-center gap-1.5">
                  <AlertCircle size={15} /> Terdeteksi Pengeluaran di Luar Daftar Anggaran
                </span>
                <span className="text-[11px] text-tmuted font-mono">
                  {unbudgetedTransactions.length} pos aktif
                </span>
              </div>
              <p className="text-xs text-tsecondary">
                Ada transaksi bulan ini di kategori yang belum memiliki target limit bulanan. Masukkan ke anggaran agar pengeluaran tetap terkontrol:
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {unbudgetedTransactions.map((ub) => (
                  <button
                    key={ub.category}
                    type="button"
                    onClick={() => {
                      setAddCatInitial(ub.category);
                      setAddCatOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-borderc hover:border-brand text-xs font-medium text-tprimary hover:text-brand transition-all shadow-sm"
                  >
                    <span>{ub.category}</span>
                    <span className="font-mono text-tmuted font-normal">({formatShort(ub.amount, privacy)})</span>
                    <Plus size={13} className="text-brand" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 50/30/20 Visual Allocation Breakdown */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-tsecondary uppercase tracking-wider">
              Alokasi Aturan Finansial (50 / 30 / 20)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(groupStats).map(([key, g]) => {
                const IconG = g.icon;
                const gPct = g.limit > 0 ? Math.round((g.spent / g.limit) * 100) : 0;
                const gOver = g.spent > g.limit && g.limit > 0;
                return (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-surface border border-borderc space-y-2.5 transition-all hover:border-brand/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${g.color}20`, color: g.color }}
                        >
                          <IconG size={15} />
                        </div>
                        <span className="font-semibold text-sm text-tprimary">{g.label}</span>
                      </div>
                      <Badge color={g.color}>{g.targetPct}</Badge>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className={`font-mono font-bold ${gOver ? "text-rose" : "text-tprimary"} ${privacy ? "privacy-blur" : ""}`}>
                        {formatShort(g.spent, privacy)}
                      </span>
                      <span className={`text-tmuted font-mono ${privacy ? "privacy-blur" : ""}`}>
                        / {formatShort(g.limit, privacy)}
                      </span>
                    </div>

                    <Progress
                      value={gPct}
                      color={gOver ? "var(--rose)" : gPct >= 80 ? "var(--amber)" : g.color}
                      className="h-2"
                    />

                    <div className="flex justify-between items-center text-[11px] text-tmuted pt-0.5">
                      <span>{gPct}% terpakai</span>
                      <span className={gOver ? "text-rose font-medium" : "text-tsecondary"}>
                        {gOver ? "Overbudget" : `Sisa ${formatShort(Math.max(0, g.limit - g.spent), privacy)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Budget Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-tsecondary uppercase tracking-wider">
                  Rincian Anggaran per Kategori ({status.length} Pos)
                </h3>
                <p className="text-xs text-tmuted mt-0.5">
                  Klik kartu untuk melihat rincian transaksi, analisa burn rate, ubah limit, atau hapus pos.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddCatInitial("");
                  setAddCatOpen(true);
                }}
                className="shrink-0 text-xs"
              >
                <Plus size={14} /> Tambah Pos
              </Button>
            </div>

            <div className="space-y-3">
              {status.map((b, i) => {
                const pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
                const meta = catMeta(b.category);
                const IconCat = (meta?.icon && Icons[meta.icon]) || Icons.Tag;
                const remaining = Math.max(0, b.limit - b.spent);
                const isOver = b.over || (b.spent > b.limit && b.limit > 0);

                return (
                  <motion.div
                    key={b.category}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card
                      onClick={() => {
                        setSelectedCat(b);
                        setDetailOpen(true);
                      }}
                      className="py-4 cursor-pointer hover:border-brand/60 hover:shadow-md transition-all active:scale-[0.995] group"
                    >
                      <div className="flex items-center justify-between gap-2.5 sm:gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-borderc group-hover:scale-105 transition-transform"
                            style={{
                              backgroundColor: `${meta.color || "var(--brand)"}18`,
                              color: meta.color || "var(--brand)",
                            }}
                          >
                            <IconCat size={19} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-tprimary text-sm sm:text-base group-hover:text-brand transition-colors truncate">
                              {b.category}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge color={GROUP_COLOR[b.group] || "var(--brand)"}>
                                {GROUP_LABEL[b.group] || "Kategori"}
                              </Badge>
                              {isOver ? (
                                <Badge color="var(--rose)">
                                  <AlertTriangle size={11} /> Over
                                </Badge>
                              ) : pct >= 80 ? (
                                <Badge color="var(--amber)">
                                  <AlertCircle size={11} /> Waspada
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-tmuted mt-0.5 truncate">
                              {isOver ? (
                                <span className="text-rose font-medium">
                                  Defisit {formatRp(b.spent - b.limit, privacy)}
                                </span>
                              ) : (
                                <span>
                                  Sisa Kuota:{" "}
                                  <strong className="text-tsecondary font-mono">
                                    {formatRp(remaining, privacy)}
                                  </strong>
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 shrink-0 pl-1">
                          <div className="text-right">
                            <div
                              className={`font-mono text-xs sm:text-base font-bold ${
                                isOver ? "text-rose" : "text-tprimary"
                              } ${privacy ? "privacy-blur" : ""}`}
                            >
                              {formatShort(b.spent, privacy)}{" "}
                              <span className="text-tmuted font-normal text-[11px] sm:text-xs">
                                / {formatShort(b.limit, privacy)}
                              </span>
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-tmuted font-mono">
                              {pct}%
                            </span>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-tmuted group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0 hidden sm:block"
                          />
                        </div>
                      </div>

                      <Progress
                        value={pct}
                        color={isOver ? "var(--rose)" : pct >= 80 ? "var(--amber)" : "var(--brand)"}
                        className="h-2"
                      />
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Add Budget Category Modal */}
      <AddBudgetCategoryModal
        open={addCatOpen}
        onClose={() => setAddCatOpen(false)}
        existingCategories={budget?.categories || []}
        monthlyIncome={monthlyIncome}
        initialCategory={addCatInitial}
        onAdded={() => {
          load();
          bump();
        }}
      />

      {/* Edit Monthly Income Modal */}
      <Modal
        open={editIncomeOpen}
        onClose={() => setEditIncomeOpen(false)}
        title="Ubah Penghasilan Bulanan"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-tsecondary">
            Sesuaikan total pemasukan bulanan untuk mengkalibrasi patokan aturan budgeting 50/30/20.
          </p>
          <Input
            label="Penghasilan Bulanan (Gaji Rutin)"
            prefix="Rp"
            type="number"
            value={incomeInput}
            onChange={(e) => setIncomeInput(e.target.value)}
            placeholder="0"
            autoFocus
            className="font-mono text-base font-bold"
          />
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setEditIncomeOpen(false)}
              className="flex-1"
              disabled={savingIncome}
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveIncome}
              className="flex-1"
              disabled={savingIncome || !incomeInput}
            >
              {savingIncome ? <Spinner size={14} /> : <Check size={14} />} Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Category Budget Detail Modal */}
      <BudgetDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        category={selectedCat?.category}
        initialGroup={selectedCat?.group}
        initialLimit={selectedCat?.limit}
        onUpdated={() => {
          load();
          bump();
        }}
        onAddExpense={(catName) => {
          setDetailOpen(false);
          setAddExpenseCat(catName);
          setAddExpenseOpen(true);
        }}
      />

      {/* Add Transaction Modal triggered from category detail */}
      <AddTransactionModal
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        onSaved={() => {
          load();
          bump();
        }}
        initialCategory={addExpenseCat}
        initialMode="manual"
      />
    </div>
  );
}
