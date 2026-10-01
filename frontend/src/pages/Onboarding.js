import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Wallet, PieChart, Sparkles, ArrowRight, ArrowLeft, ShieldCheck
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatRp } from "../lib/format";
import { WALLET_PRESETS, walletMeta } from "../lib/constants";
import { Card, Button, Input, Spinner } from "../components/ui";

const DEFAULT_CATS = [
  { category: "Makanan & Minuman", group: "needs", pct: 0.25 },
  { category: "Transportasi", group: "needs", pct: 0.1 },
  { category: "Tagihan & Utilitas", group: "needs", pct: 0.15 },
  { category: "Belanja", group: "wants", pct: 0.15 },
  { category: "Hiburan", group: "wants", pct: 0.1 },
  { category: "Kesehatan", group: "wants", pct: 0.05 },
  { category: "Investasi", group: "savings", pct: 0.2 },
];

export default function Onboarding() {
  const { checkAuth } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = Wallet, 2 = Budget, 3 = Finish
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Wallet state
  const [walletName, setWalletName] = useState("BCA");
  const [walletType, setWalletType] = useState("bank");
  const [walletBalance, setWalletBalance] = useState("");
  const [createdWallet, setCreatedWallet] = useState(null);

  // Step 2: Budget state
  const [income, setIncome] = useState("");

  const parsedIncome = parseFloat(income) || 0;
  const needsAmount = Math.round(parsedIncome * 0.5);
  const wantsAmount = Math.round(parsedIncome * 0.3);
  const savingsAmount = Math.round(parsedIncome * 0.2);

  const selectPreset = (preset) => {
    setWalletName(preset.name);
    setWalletType(preset.type);
  };

  const handleSaveWallet = async (e) => {
    e.preventDefault();
    if (!walletName.trim()) {
      toast.error("Nama dompet wajib diisi");
      return;
    }
    const meta = walletMeta(walletType);
    const balanceNum = parseFloat(walletBalance) || 0;

    setSubmitting(true);
    try {
      const res = await api.post("/wallets", {
        name: walletName.trim(),
        type: walletType,
        balance: balanceNum,
        color: meta.color,
        icon: meta.icon,
      });
      setCreatedWallet(res.data);
      toast.success(`Dompet ${walletName} berhasil dibuat! 👛`);
      setStep(2);
    } catch {
      toast.error("Gagal membuat dompet. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!parsedIncome || parsedIncome <= 0) {
      toast.error("Masukkan estimasi penghasilan bulananmu");
      return;
    }

    const categories = DEFAULT_CATS.map((c) => ({
      category: c.category,
      group: c.group,
      limit: Math.round(parsedIncome * c.pct),
    }));

    setSubmitting(true);
    try {
      await api.post("/budget", {
        monthly_income: parsedIncome,
        mode: "percentage",
        categories,
      });
      toast.success("Rencana budget 50/30/20 berhasil diatur! 🎯");
      setStep(3);
    } catch {
      toast.error("Gagal menyimpan budget. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishOnboarding = async () => {
    setSubmitting(true);
    try {
      localStorage.setItem("tumara-skip-onboarding", "1");
      localStorage.setItem("nusa-skip-onboarding", "1");
      await api.post("/auth/complete-onboarding");
      await checkAuth();
      toast.success("Selamat datang di Tumara! 🎉");
      navigate("/dashboard", { replace: true });
    } catch {
      // Fallback redirect even if network hiccups
      navigate("/dashboard", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    localStorage.setItem("tumara-skip-onboarding", "1");
    localStorage.setItem("nusa-skip-onboarding", "1");
    try {
      await api.post("/auth/complete-onboarding");
      await checkAuth();
    } catch {}
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg text-tprimary flex flex-col justify-between p-4 sm:p-6 overflow-x-hidden">
      {/* Background glow decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 left-1/4 w-[32rem] h-[32rem] rounded-full opacity-15 blur-3xl" style={{ background: "var(--brand)" }} />
        <div className="absolute -bottom-20 right-1/4 w-[28rem] h-[28rem] rounded-full opacity-10 blur-3xl" style={{ background: "var(--cyan)" }} />
      </div>

      {/* Top Header */}
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-[var(--glow)]">
            <span className="text-black font-head font-extrabold text-base">T</span>
          </div>
          <span className="font-head font-extrabold text-lg tracking-tight">Tumara</span>
        </div>

        {step < 3 && (
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-tmuted hover:text-tsecondary transition-colors"
          >
            Lewati dulu, atur nanti →
          </button>
        )}
      </header>

      {/* Main Wizard Content */}
      <main className="max-w-xl w-full mx-auto my-auto py-6">
        {/* Stepper Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-tsecondary mb-2.5">
            <span className={step >= 1 ? "text-brand" : "text-tmuted"}>1. Dompet Utama</span>
            <span className={step >= 2 ? "text-brand" : "text-tmuted"}>2. Rencana Budget</span>
            <span className={step >= 3 ? "text-brand" : "text-tmuted"}>3. Selesai</span>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? "bg-brand shadow-sm shadow-[var(--glow)]" : "bg-elevated"
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: WALLET SETUP */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-brand/15 text-brand mb-3">
                    <Wallet size={14} /> Langkah 1 dari 2
                  </div>
                  <h1 className="font-head font-extrabold text-2xl tracking-tight">
                    Kenalkan dompet pertamamu 👛
                  </h1>
                  <p className="text-sm text-tsecondary mt-1.5 leading-relaxed">
                    Setiap transaksi butuh wadah uang. Pilih akun bank, e-wallet, atau uang tunai yang paling sering kamu pakai sehari-hari.
                  </p>
                </div>

                {/* Preset Chips */}
                <div>
                  <span className="block text-xs font-semibold text-tsecondary uppercase tracking-wider mb-2.5">
                    Pilihan Cepat
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {WALLET_PRESETS.map((p) => {
                      const isSelected = walletName === p.name && walletType === p.type;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => selectPreset(p)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            isSelected
                              ? "bg-brand text-black border-brand shadow-md shadow-[var(--glow)]"
                              : "bg-elevated text-tsecondary border-borderc hover:border-brand/40"
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleSaveWallet} className="space-y-4">
                  <Input
                    label="Nama Dompet / Akun"
                    placeholder="mis. BCA Utama, GoPay, Tunai Dompet"
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    required
                  />

                  <div>
                    <Input
                      label="Saldo Saat Ini (Estimasi)"
                      prefix="Rp"
                      type="number"
                      placeholder="0"
                      value={walletBalance}
                      onChange={(e) => setWalletBalance(e.target.value)}
                      className="text-base"
                    />
                    <p className="text-xs text-tmuted mt-1.5">
                      {walletBalance && parseFloat(walletBalance) > 0
                        ? `Saldo awal: ${formatRp(parseFloat(walletBalance))}`
                        : "Boleh diisi 0 jika ingin mulai dari nol."}
                    </p>
                  </div>

                  <Button type="submit" className="w-full mt-2" size="lg" disabled={submitting}>
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Spinner size={16} /> Menyimpan...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Lanjut ke Atur Budget <ArrowRight size={16} />
                      </span>
                    )}
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {/* STEP 2: BUDGET SETUP */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-brand/15 text-brand mb-3">
                    <PieChart size={14} /> Langkah 2 dari 2
                  </div>
                  <h1 className="font-head font-extrabold text-2xl tracking-tight">
                    Tentukan arah uangmu 🎯
                  </h1>
                  <p className="text-sm text-tsecondary mt-1.5 leading-relaxed">
                    Berapa perkiraan total penghasilan bulananmu? Tumara akan otomatis menghitung alokasi anggaran ideal dengan metode 50/30/20.
                  </p>
                </div>

                <form onSubmit={handleSaveBudget} className="space-y-5">
                  <div>
                    <Input
                      label="Penghasilan Bulanan (Gaji + Pemasukan Lain)"
                      prefix="Rp"
                      type="number"
                      placeholder="mis. 6000000"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      required
                      autoFocus
                      className="text-lg font-semibold"
                    />
                    {parsedIncome > 0 && (
                      <p className="text-xs text-brand font-medium mt-1.5">
                        Total: {formatRp(parsedIncome)} per bulan
                      </p>
                    )}
                  </div>

                  {/* 50/30/20 Live Preview Breakdown */}
                  {parsedIncome > 0 && (
                    <div className="bg-elevated/70 border border-borderc rounded-2xl p-4 space-y-3">
                      <span className="block text-xs font-semibold text-tsecondary uppercase tracking-wider">
                        Rekomendasi Alokasi Sehat (50/30/20)
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-surface p-2.5 rounded-xl border border-borderc">
                          <span className="block text-brand font-head font-bold text-sm">50%</span>
                          <span className="block text-tsecondary text-[11px] mt-0.5">Kebutuhan</span>
                          <span className="block font-semibold mt-1">{formatRp(needsAmount)}</span>
                        </div>
                        <div className="bg-surface p-2.5 rounded-xl border border-borderc">
                          <span className="block text-amber font-head font-bold text-sm">30%</span>
                          <span className="block text-tsecondary text-[11px] mt-0.5">Keinginan</span>
                          <span className="block font-semibold mt-1">{formatRp(wantsAmount)}</span>
                        </div>
                        <div className="bg-surface p-2.5 rounded-xl border border-borderc">
                          <span className="block text-cyan font-head font-bold text-sm">20%</span>
                          <span className="block text-tsecondary text-[11px] mt-0.5">Tabungan</span>
                          <span className="block font-semibold mt-1">{formatRp(savingsAmount)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setStep(1)}
                      disabled={submitting}
                    >
                      <ArrowLeft size={16} /> Kembali
                    </Button>
                    <Button type="submit" className="flex-1" size="lg" disabled={submitting}>
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <Spinner size={16} /> Menyimpan...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Simpan & Selesai <ArrowRight size={16} />
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}

          {/* STEP 3: CELEBRATION & READY TO GO */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="text-center py-8 px-6 space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-brand/20 border border-brand/40 text-brand flex items-center justify-center mx-auto shadow-xl shadow-[var(--glow)]">
                  <Sparkles size={32} />
                </div>

                <div className="space-y-2">
                  <h1 className="font-head font-extrabold text-2xl sm:text-3xl tracking-tight">
                    Kamu Siap Tumbuh dengan Arah! 🎉
                  </h1>
                  <p className="text-sm text-tsecondary max-w-sm mx-auto leading-relaxed">
                    Setup dasarmu selesai. Dompet dan anggaranmu sudah siap untuk mencatat transaksi dan dipandu asisten AI Tumara.
                  </p>
                </div>

                {/* Summary Box */}
                <div className="bg-elevated border border-borderc rounded-2xl p-4 max-w-md mx-auto text-left space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-tsecondary flex items-center gap-1.5">
                      <Wallet size={14} className="text-brand" /> Dompet Utama
                    </span>
                    <span className="font-semibold text-tprimary">
                      {createdWallet?.name || walletName} ({formatRp(parseFloat(walletBalance) || 0)})
                    </span>
                  </div>
                  <div className="h-px bg-borderc" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-tsecondary flex items-center gap-1.5">
                      <PieChart size={14} className="text-cyan" /> Budget Bulanan
                    </span>
                    <span className="font-semibold text-tprimary">
                      {formatRp(parsedIncome)} / bulan (50/30/20)
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleFinishOnboarding}
                  className="w-full max-w-md mx-auto"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Spinner size={16} /> Membuka Dashboard...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Masuk ke Dashboard Sekarang 🚀
                    </span>
                  )}
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Note */}
      <footer className="max-w-2xl w-full mx-auto text-center py-4 text-xs text-tmuted flex items-center justify-center gap-2">
        <ShieldCheck size={14} className="text-brand" />
        <span>Data keuanganmu terenkripsi dan tersimpan aman di cloud.</span>
      </footer>
    </div>
  );
}
