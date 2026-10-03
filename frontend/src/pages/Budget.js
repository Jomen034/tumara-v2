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
} from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatShort } from "../lib/format";
import { catMeta } from "../lib/constants";
import { Card, Button, Input, Progress, Badge, Spinner } from "../components/ui";
import BudgetDetailModal from "../components/BudgetDetailModal";
import AddTransactionModal from "../components/AddTransactionModal";

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
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState("");
  const [mode, setMode] = useState("percentage");
  const [cats, setCats] = useState([]);

  // Detail Modal & Quick Add states
  const [selectedCat, setSelectedCat] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addExpenseCat, setAddExpenseCat] = useState("Makanan & Minuman");

  const load = () => Promise.all([api.get("/budget"), api.get("/dashboard")])
    .then(([b, d]) => { setBudget(b.data); setDash(d.data); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, [version]);

  // auto-start wizard for first-run onboarding
  useEffect(() => {
    if (!loading && onboarding && !budget) startWizard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const skipOnboarding = async () => {
    localStorage.setItem("tumara-skip-onboarding", "1");
    localStorage.setItem("nusa-skip-onboarding", "1");
    try { await api.post("/auth/complete-onboarding"); await checkAuth(); } catch {}
    navigate("/dashboard");
  };

  const startWizard = () => {
    setStep(0);
    setIncome(budget ? String(budget.monthly_income) : "");
    setMode(budget?.mode || "percentage");
    setCats(budget ? budget.categories.map((c) => ({ ...c })) : []);
    setWizard(true);
  };

  const genCats = (inc) => DEFAULT_CATS.map((c) => ({ category: c.category, group: c.group, limit: Math.round(inc * c.pct) }));

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
      await api.post("/budget", { monthly_income: parseFloat(income), mode, categories: cats.map((c) => ({ category: c.category, group: c.group, limit: parseFloat(c.limit) || 0 })) });
      toast.success("Budget tersimpan! 🎯"); setWizard(false); bump();
      if (onboarding) {
        localStorage.setItem("tumara-skip-onboarding", "1");
        localStorage.setItem("nusa-skip-onboarding", "1");
        await checkAuth(); navigate("/dashboard");
      }
      else { load(); }
    } catch { toast.error("Gagal menyimpan budget"); }
  };

  const totalLimit = cats.reduce((a, c) => a + (parseFloat(c.limit) || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={30} className="text-brand" /></div>;

  // ---------- Wizard ----------
  if (wizard) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        {onboarding && (
          <div className="text-center">
            <h1 className="font-head font-extrabold text-2xl">Selamat datang di Tumara 👋</h1>
            <p className="text-sm text-tsecondary mt-1">Yuk atur budget pertamamu — cuma 3 langkah untuk tumbuh dengan arah.</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((s) => <div key={s} className={clsx("h-1.5 flex-1 rounded-full transition-colors", s <= step ? "bg-brand" : "bg-elevated")} />)}
        </div>

        {step === 0 && (
          <Card className="space-y-5">
            <div><h2 className="font-head font-bold text-xl">Berapa penghasilan bulananmu?</h2><p className="text-sm text-tsecondary mt-1">Gaji + pemasukan rutin lainnya.</p></div>
            <Input prefix="Rp" type="number" placeholder="0" value={income} onChange={(e) => setIncome(e.target.value)} data-testid="budget-income-input" autoFocus className="text-lg" />
            <Button onClick={next} className="w-full" size="lg" data-testid="budget-next-button">Lanjut <ArrowRight size={16} /></Button>
            {onboarding && <button onClick={skipOnboarding} data-testid="skip-onboarding-button" className="w-full text-sm text-tmuted hover:text-tsecondary">Lewati dulu, atur nanti</button>}
          </Card>
        )}

        {step === 1 && (
          <Card className="space-y-4">
            <div><h2 className="font-head font-bold text-xl">Pilih metode budgeting</h2><p className="text-sm text-tsecondary mt-1">Bisa diubah nanti.</p></div>
            <button onClick={() => setMode("percentage")} data-testid="budget-mode-percentage"
              className={clsx("w-full text-left p-4 rounded-2xl border transition-colors", mode === "percentage" ? "border-brand bg-brand/10" : "border-borderc hover:bg-elevated")}>
              <div className="flex items-center gap-2 font-semibold"><Percent size={18} className="text-brand" /> Aturan 50/30/20</div>
              <p className="text-sm text-tsecondary mt-1">50% kebutuhan, 30% keinginan, 20% tabungan. Cocok untuk pemula.</p>
            </button>
            <button onClick={() => setMode("fixed")} data-testid="budget-mode-fixed"
              className={clsx("w-full text-left p-4 rounded-2xl border transition-colors", mode === "fixed" ? "border-brand bg-brand/10" : "border-borderc hover:bg-elevated")}>
              <div className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={18} className="text-brand" /> Limit Custom</div>
              <p className="text-sm text-tsecondary mt-1">Tentukan sendiri limit tiap kategori.</p>
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(0)}><ArrowLeft size={16} /></Button>
              <Button onClick={next} className="flex-1" data-testid="budget-next-button-2">Lanjut <ArrowRight size={16} /></Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="space-y-4">
            <div><h2 className="font-head font-bold text-xl">Atur limit per kategori</h2><p className="text-sm text-tsecondary mt-1">Sesuaikan sesuai kebutuhanmu.</p></div>
            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {cats.map((c, i) => (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="flex-1">
                    <span className="text-sm font-medium flex items-center gap-2">{c.category}<Badge color={GROUP_COLOR[c.group]}>{GROUP_LABEL[c.group]}</Badge></span>
                  </div>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tmuted text-xs font-mono">Rp</span>
                    <input type="number" value={c.limit} data-testid={`budget-cat-${i}`}
                      onChange={(e) => { const n = [...cats]; n[i] = { ...n[i], limit: e.target.value }; setCats(n); }}
                      className="w-full bg-elevated border border-borderc rounded-lg pl-8 pr-2 py-2 text-sm font-mono focus:border-brand focus:outline-none" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-borderc">
              <span className="text-sm text-tsecondary">Total budget</span>
              <span className="font-mono font-bold">{formatRp(totalLimit)}</span>
            </div>
            {parseFloat(income) > 0 && totalLimit > parseFloat(income) && (
              <p className="text-xs text-rose flex items-center gap-1"><AlertTriangle size={13} /> Total melebihi penghasilan ({formatRp(parseFloat(income))})</p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}><ArrowLeft size={16} /></Button>
              <Button onClick={save} className="flex-1" data-testid="budget-save-button"><Check size={16} /> Aktifkan Budget</Button>
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

  // Calendar & pacing
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysLeft = Math.max(1, totalDaysInMonth - currentDay + 1);
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Budget</h1>
          <p className="text-tsecondary text-sm mt-1">
            {currentMonthName} {currentYear} · {budget ? (budget.mode === "percentage" ? "Aturan 50/30/20" : "Limit Custom") : "Belum diatur"}
          </p>
        </div>
        {budget && (
          <Button variant="secondary" size="sm" onClick={startWizard} data-testid="edit-budget-button">
            <Pencil size={15} /> Atur Ulang Wizard
          </Button>
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
          <Button onClick={startWizard} className="mt-5" data-testid="budget-wizard-start-button" size="lg">
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
              <span className="text-xs text-tsecondary flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated/70 border border-borderc">
                <Calendar size={13} className="text-brand" />
                <span>{daysLeft} hari tersisa di {currentMonthName}</span>
              </span>
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
                  Rincian Anggaran per Kategori
                </h3>
                <p className="text-xs text-tmuted mt-0.5">
                  Klik kartu kategori untuk melihat rincian transaksi, analisa burn rate, atau ubah limit pos.
                </p>
              </div>
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
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-borderc group-hover:scale-105 transition-transform"
                            style={{
                              backgroundColor: `${meta.color || "var(--brand)"}18`,
                              color: meta.color || "var(--brand)",
                            }}
                          >
                            <IconCat size={19} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-tprimary text-sm sm:text-base group-hover:text-brand transition-colors truncate">
                                {b.category}
                              </span>
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
                            <p className="text-[11px] text-tmuted mt-0.5">
                              {isOver ? (
                                <span className="text-rose font-medium">
                                  Defisit {formatRp(b.spent - b.limit, privacy)}
                                </span>
                              ) : (
                                <span>
                                  Sisa Kuota: <strong className="text-tsecondary font-mono">{formatRp(remaining, privacy)}</strong>
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className={`font-mono text-sm sm:text-base font-bold ${isOver ? "text-rose" : "text-tprimary"} ${privacy ? "privacy-blur" : ""}`}>
                              {formatShort(b.spent, privacy)}{" "}
                              <span className="text-tmuted font-normal text-xs">/ {formatShort(b.limit, privacy)}</span>
                            </div>
                            <span className="text-[11px] text-tmuted font-mono">
                              {pct}%
                            </span>
                          </div>
                          <ChevronRight
                            size={18}
                            className="text-tmuted group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0"
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

