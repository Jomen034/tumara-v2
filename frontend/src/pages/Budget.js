import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Check, Percent, SlidersHorizontal, ArrowRight, ArrowLeft, Pencil } from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatShort } from "../lib/format";
import { Card, Button, Input, Progress, Badge, Spinner } from "../components/ui";

const DEFAULT_CATS = [
  { category: "Makanan & Minuman", group: "needs", pct: 0.25 },
  { category: "Transportasi", group: "needs", pct: 0.1 },
  { category: "Tagihan & Utilitas", group: "needs", pct: 0.15 },
  { category: "Belanja", group: "wants", pct: 0.15 },
  { category: "Hiburan", group: "wants", pct: 0.1 },
  { category: "Kesehatan", group: "wants", pct: 0.05 },
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

  const load = () => Promise.all([api.get("/budget"), api.get("/dashboard")])
    .then(([b, d]) => { setBudget(b.data); setDash(d.data); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, [version]);

  // auto-start wizard for first-run onboarding
  useEffect(() => {
    if (!loading && onboarding && !budget) startWizard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const skipOnboarding = async () => {
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
      if (onboarding) { localStorage.setItem("nusa-skip-onboarding", "1"); await checkAuth(); navigate("/dashboard"); }
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
            <h1 className="font-head font-extrabold text-2xl">Selamat datang di Nusa 👋</h1>
            <p className="text-sm text-tsecondary mt-1">Yuk atur budget pertamamu — cuma 3 langkah.</p>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Budget</h1>
          <p className="text-tsecondary text-sm mt-1">Bulan ini · {budget ? (budget.mode === "percentage" ? "50/30/20" : "Custom") : "Belum diatur"}</p>
        </div>
        {budget && <Button variant="secondary" size="sm" onClick={startWizard} data-testid="edit-budget-button"><Pencil size={15} /> Ubah</Button>}
      </div>

      {!budget ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mx-auto mb-4"><Percent size={28} className="text-brand" /></div>
          <h3 className="font-head font-bold text-lg">Belum ada budget</h3>
          <p className="text-sm text-tsecondary mt-1 max-w-xs mx-auto">Buat budget dalam 3 langkah cepat & mulai disiplin finansial.</p>
          <Button onClick={startWizard} className="mt-5" data-testid="budget-wizard-start-button" size="lg">Mulai Setup Budget</Button>
        </Card>
      ) : (
        <>
          <Card className="relative overflow-hidden">
            <p className="text-xs text-tmuted font-semibold uppercase">Terpakai bulan ini</p>
            <div className="flex items-end gap-2 mt-1">
              <span className={`text-3xl font-head font-extrabold font-mono ${privacy ? "privacy-blur" : ""}`}>{formatRp(totalSpent, privacy)}</span>
              <span className={`text-tmuted font-mono mb-1 ${privacy ? "privacy-blur" : ""}`}>/ {formatShort(totalBudget, privacy)}</span>
            </div>
            <Progress className="mt-3 h-3" value={totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0} color={totalSpent > totalBudget ? "var(--rose)" : "var(--brand)"} />
            <p className="text-xs text-tsecondary mt-2">Sisa: <span className="font-mono font-semibold text-brand">{formatRp(Math.max(0, totalBudget - totalSpent), privacy)}</span></p>
          </Card>

          <div className="space-y-3">
            {status.map((b, i) => {
              const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
              return (
                <motion.div key={b.category} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card className="py-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium flex items-center gap-2">{b.category}<Badge color={GROUP_COLOR[b.group]}>{GROUP_LABEL[b.group]}</Badge>{b.over && <Badge color="var(--rose)"><AlertTriangle size={11} /> Over</Badge>}</span>
                      <span className={`font-mono text-sm ${privacy ? "privacy-blur" : ""}`}>{formatShort(b.spent, privacy)} / {formatShort(b.limit, privacy)}</span>
                    </div>
                    <Progress value={pct} color={b.over ? "var(--rose)" : pct > 80 ? "var(--amber)" : "var(--brand)"} />
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
