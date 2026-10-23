import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, CheckCircle2, Copy, Check, QrCode, CreditCard, ArrowRight,
  Lock, ShieldCheck, Eye, EyeOff, Clock, Zap, RefreshCw, AlertCircle,
  ArrowLeft, Users, Wallet
} from "lucide-react";
import { toast } from "sonner";
import { Modal, Button, Input, Spinner } from "./ui";
import { useAuth } from "../context/AuthContext";
import api, { postWithColdStartRetry } from "../lib/api";
import TumaraLogo from "./TumaraLogo";
import clsx from "clsx";

const TIER_DATA = {
  starter: {
    id: "starter",
    name: "Starter Personal",
    price: 49000,
    priceFormatted: "Rp 49.000",
    badge: null,
    desc: "Cocok untuk individu yang ingin mulai rapi mencatat dan bebas dari bocor halus.",
    features: [
      "1 Akun Personal Seumur Hidup",
      "Pencatatan Manual, Dompet & Kategori Unlimited",
      "Smart Budgeting 50/30/20 & Daily Spend Pulse",
      "Kalender Tagihan & Habit Tracker Disiplin",
      "10 Scan Struk AI & 20 Smart Text AI / bulan",
      "100% Bebas Iklan & Pelacak Komersial",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro Tumara AI",
    price: 99000,
    priceFormatted: "Rp 99.000",
    badge: "Paling Populer · Best Value",
    desc: "Solusi lengkap dengan asisten CFO AI pribadi untuk keputusan finansial yang matang dan terarah.",
    features: [
      "Semua fitur di Paket Starter",
      "60 Scan Struk AI & 150 Smart Text AI / bulan",
      "AI Financial Advisor Interaktif (Personal CFO)",
      "Weekly AI Financial Health Recap Otomatis",
      "Smart Itemized Receipt Scan (Rincian Produk, Diskon & Subtotal)",
      "Cadangan Database JSON & Ekspor CSV",
    ],
  },
  family: {
    id: "family",
    name: "Family Partner",
    price: 169000,
    priceFormatted: "Rp 169.000",
    badge: "Hemat Berdua",
    desc: "Untuk pasangan suami-istri atau keluarga yang ingin menyatukan visi keuangan rumah tangga.",
    features: [
      "Akses untuk 2–3 Akun (Suami, Istri & Partner)",
      "Shared Net Worth & Portofolio Bersama",
      "Split Member Spend Tracking per Anggota",
      "Kalender Tagihan Bersama Real-Time",
      "150 Scan Struk AI & 300 Smart Text AI / bulan (Shared Pool)",
      "Prioritas Dukungan via WhatsApp",
    ],
  },
};

export default function CheckoutModal({ open, onClose, initialTier = "pro" }) {
  const { loginWithSession } = useAuth();
  const navigate = useNavigate();

  // Funnel steps: 'form' (1-Page Checkout) | 'payment' (QRIS / Midtrans / Sim) | 'success' (Code + Auto Login)
  const [step, setStep] = useState("form");
  const [selectedTier, setSelectedTier] = useState(initialTier);
  const [showPassword, setShowPassword] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("qris"); // 'qris' | 'va'

  // Form inputs
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(86400); // 24 hours timer

  // Update selectedTier whenever initialTier prop changes
  useEffect(() => {
    if (initialTier && TIER_DATA[initialTier]) {
      setSelectedTier(initialTier);
    }
  }, [initialTier]);

  // Reset state on modal open/close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("form");
        setOrderResult(null);
        setPaymentSuccessData(null);
        setCopiedCode(false);
      }, 300);
    }
  }, [open]);

  // Countdown timer for pending payment screen
  useEffect(() => {
    if (step === "payment" && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Submit checkout order
  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nama lengkap wajib diisi");
      return;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      toast.error("Alamat email tidak valid");
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      toast.error("Password akun minimal 6 karakter");
      return;
    }

    setLoading(true);
    try {
      const res = await postWithColdStartRetry("/orders/checkout", {
        tier: selectedTier,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        whatsapp: formData.whatsapp.trim(),
        password: formData.password,
        payment_method: paymentMethod,
      });

      if (res?.data?.order_id) {
        setOrderResult(res.data);
        
        // If Midtrans Snap is active and returned a token, open Midtrans Snap
        if (res.data.mode === "midtrans" && res.data.snap_token && window.snap) {
          window.snap.pay(res.data.snap_token, {
            onSuccess: async () => {
              toast.success("Pembayaran terverifikasi!");
              await checkStatus(res.data.order_id);
            },
            onPending: () => {
              setStep("payment");
            },
            onError: () => {
              toast.error("Pembayaran dibatalkan atau gagal");
            },
            onClose: () => {
              setStep("payment");
            }
          });
        } else {
          // Simulation / Sandbox Mode
          setStep("payment");
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Gagal memproses pesanan";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Simulate payment confirmation (Instant Demo Sandbox)
  const handleSimulatePayment = async () => {
    if (!orderResult?.order_id) return;
    setSimulating(true);
    try {
      const res = await postWithColdStartRetry("/orders/simulate-pay", {
        order_id: orderResult.order_id,
      });

      if (res?.data?.status === "paid") {
        setPaymentSuccessData(res.data);
        setStep("success");
        toast.success("Pembayaran berhasil dikonfirmasi!");

        // If auto login data is returned, immediately establish the user session
        if (res.data.auto_login && res.data.user && res.data.session_token) {
          loginWithSession(res.data.user, res.data.session_token);
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Gagal mensimulasikan pembayaran";
      toast.error(msg);
    } finally {
      setSimulating(false);
    }
  };

  // Helper to check order status
  const checkStatus = async (orderId) => {
    try {
      const res = await api.get(`/orders/${orderId}/status`);
      if (res.data?.status === "paid") {
        setPaymentSuccessData(res.data);
        setStep("success");
      }
    } catch (e) {
      console.warn("Check status error:", e);
    }
  };

  const handleCopyCode = () => {
    if (paymentSuccessData?.access_code) {
      navigator.clipboard.writeText(paymentSuccessData.access_code);
      setCopiedCode(true);
      toast.success("Kode lisensi berhasil disalin!");
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleLaunchDashboard = () => {
    onClose();
    if (paymentSuccessData?.user?.onboarded) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/onboarding", { replace: true });
    }
  };

  const currentTier = TIER_DATA[selectedTier] || TIER_DATA.pro;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        step === "form" ? "Checkout Lisensi Tumara" :
        step === "payment" ? "Selesaikan Pembayaran" :
        "Aktivasi Lisensi Sukses"
      }
    >
      <div className="py-1">
        {/* ========================================================================= */}
        {/* STEP 1: 1-PAGE CHECKOUT FORM (ALA BUDGGT / FUNDY)                         */}
        {/* ========================================================================= */}
        {step === "form" && (
          <div className="space-y-4">
            {/* Urgency & Benefit Badge */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-brand/10 border border-brand/20 text-xs">
              <span className="font-semibold text-brand flex items-center gap-1.5">
                <Sparkles size={14} /> Sekali Bayar · Akses Seumur Hidup
              </span>
              <span className="font-mono font-bold text-tprimary text-[11px] bg-surface px-2 py-0.5 rounded border border-borderc">
                100% Bebas Auto-Debit
              </span>
            </div>

            {/* Plan Switcher Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-elevated rounded-2xl border border-borderc">
              {Object.values(TIER_DATA).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTier(t.id)}
                  className={clsx(
                    "flex flex-col items-center py-2 px-1 rounded-xl transition-all text-center relative",
                    selectedTier === t.id
                      ? "bg-surface text-tprimary shadow-md border border-brand/40 font-bold"
                      : "text-tsecondary hover:text-tprimary font-medium"
                  )}
                >
                  {t.id === "pro" && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-brand text-black tracking-wider">
                      Populer
                    </span>
                  )}
                  <span className="text-[11px] sm:text-xs leading-tight">{t.name.split(" ")[0]}</span>
                  <span className="text-xs sm:text-sm font-mono font-extrabold text-brand mt-0.5">
                    {t.priceFormatted.replace("Rp ", "")}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Plan Summary Box */}
            <div className="p-4 rounded-2xl bg-surface border border-borderc/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-head font-bold text-sm text-tprimary">{currentTier.name}</h4>
                  <p className="text-[11px] text-tsecondary mt-0.5">{currentTier.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-head font-extrabold text-lg text-tprimary font-mono block">
                    {currentTier.priceFormatted}
                  </span>
                  <span className="text-[10px] text-brand font-medium">1x Bayar Selamanya</span>
                </div>
              </div>

              <div className="pt-2 border-t border-borderc/50 grid grid-cols-2 gap-1.5 text-[11px] text-tsecondary">
                {currentTier.features.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 size={13} className="text-brand shrink-0" />
                    <span className="truncate">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer & Account Form */}
            <form onSubmit={handleProceedToPayment} className="space-y-3 pt-1">
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Input
                  label="Nama Lengkap"
                  type="text"
                  placeholder="cth. Budi Santoso"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  label="Email Penerima Lisensi"
                  type="email"
                  placeholder="nama@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <Input
                  label="Nomor WhatsApp (Opsional)"
                  type="tel"
                  placeholder="081234567890"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                />
                <div>
                  <Input
                    label="Password Akun Baru"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimal 6 karakter"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-tmuted hover:text-tprimary p-1"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />
                </div>
              </div>
              <p className="text-[10px] text-tmuted px-1">
                💡 Password di atas akan otomatis menjadi password akun Tumara Anda begitu pembayaran selesai.
              </p>

              {/* Payment Method Selector */}
              <div className="pt-2">
                <label className="text-xs font-semibold text-tprimary mb-1.5 block">
                  Pilih Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("qris")}
                    className={clsx(
                      "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all",
                      paymentMethod === "qris"
                        ? "bg-brand/10 border-brand text-tprimary font-semibold shadow-sm"
                        : "bg-surface border-borderc text-tsecondary hover:border-borderc/80"
                    )}
                  >
                    <QrCode size={18} className="text-brand shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">QRIS Instan</span>
                      <span className="text-[10px] text-tmuted">GoPay, OVO, Shopee, BCA</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("va")}
                    className={clsx(
                      "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all",
                      paymentMethod === "va"
                        ? "bg-brand/10 border-brand text-tprimary font-semibold shadow-sm"
                        : "bg-surface border-borderc text-tsecondary hover:border-borderc/80"
                    )}
                  >
                    <CreditCard size={18} className="text-cyan shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Virtual Account</span>
                      <span className="text-[10px] text-tmuted">BCA, Mandiri, BRI, BNI</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full mt-3 py-3 font-bold text-sm" disabled={loading}>
                {loading ? <Spinner size={16} /> : `Lanjut ke Pembayaran (${currentTier.priceFormatted}) ➔`}
              </Button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: PAYMENT SCREEN / SIMULATION (DUAL-MODE GATEWAY)                   */}
        {/* ========================================================================= */}
        {step === "payment" && orderResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderc/50">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="text-xs text-tsecondary hover:text-tprimary flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Ubah Pesanan
              </button>
              <div className="flex items-center gap-1 text-[11px] text-tmuted font-mono">
                <Clock size={13} className="text-brand" />
                <span>Batas Waktu: {formatTimer(timeLeft)}</span>
              </div>
            </div>

            {/* Total to pay */}
            <div className="text-center py-2">
              <span className="text-xs text-tsecondary">Total Tagihan Sekali Bayar</span>
              <h3 className="text-3xl font-head font-extrabold text-tprimary font-mono mt-0.5">
                Rp {orderResult.amount.toLocaleString("id-ID")}
              </h3>
              <p className="text-xs text-brand font-medium mt-0.5">
                Order ID: <span className="font-mono font-bold">{orderResult.order_id}</span>
              </p>
            </div>

            {/* Simulated Payment Container */}
            <div className="p-4 rounded-2xl bg-surface border-2 border-dashed border-borderc text-center space-y-3">
              {paymentMethod === "qris" ? (
                <div>
                  <div className="inline-block p-4 bg-white rounded-2xl shadow-md border border-neutral-200 mb-2">
                    {/* Visual QR Code Mock */}
                    <div className="w-40 h-40 bg-neutral-900 rounded-lg p-2 flex flex-col justify-between items-center relative overflow-hidden">
                      <div className="absolute inset-2 border-4 border-white rounded flex items-center justify-center">
                        <QrCode size={90} className="text-white" />
                      </div>
                      <span className="text-[9px] font-bold text-white bg-neutral-800 px-2 py-0.5 rounded z-10">
                        QRIS STANDAR
                      </span>
                      <span className="text-[8px] text-neutral-300 font-mono z-10">
                        TUMARA CFO INDONESIA
                      </span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-tprimary">Scan dengan aplikasi e-Wallet atau m-Banking</p>
                  <p className="text-[11px] text-tmuted">BCA Mobile, Livin by Mandiri, GoPay, OVO, ShopeePay, DANA</p>
                </div>
              ) : (
                <div className="py-3 space-y-2">
                  <span className="text-xs text-tsecondary">Nomor Virtual Account (Simulasi)</span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono font-extrabold text-xl text-tprimary px-3 py-1 bg-elevated rounded-lg border border-borderc">
                      {orderResult.simulation?.va_number || "8870812345678"}
                    </span>
                  </div>
                  <p className="text-[11px] text-tmuted">
                    {orderResult.simulation?.va_bank || "BCA / Mandiri / BRI Virtual Account"}
                  </p>
                </div>
              )}

              {/* Status Indicator */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                Menunggu Pembayaran...
              </div>
            </div>

            {/* DUAL MODE SIMULATION ACTION */}
            <div className="p-3.5 rounded-2xl bg-brand/10 border border-brand/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-brand">
                <Zap size={15} /> Mode Sandbox / Simulasi Aktif
              </div>
              <p className="text-[11px] text-tsecondary leading-relaxed">
                Anda dapat menguji alur pembayaran secara penuh tanpa biaya sungguhan. Klik tombol di bawah untuk mengonfirmasi pembayaran lunas secara otomatis:
              </p>
              <button
                type="button"
                onClick={handleSimulatePayment}
                disabled={simulating}
                className="w-full py-2.5 px-4 rounded-xl bg-brand text-black font-head font-bold text-xs hover:brightness-110 shadow-md transition-all flex items-center justify-center gap-2"
              >
                {simulating ? <Spinner size={16} /> : (
                  <>
                    <CheckCircle2 size={16} /> Simulasikan Pembayaran Sukses Sekarang
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: SUCCESS & ACTIVATION SCREEN (INSTANT CODE + AUTO LOGIN)           */}
        {/* ========================================================================= */}
        {step === "success" && paymentSuccessData && (
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-brand/15 border-2 border-brand flex items-center justify-center mx-auto shadow-xl shadow-[var(--glow)]">
              <CheckCircle2 size={36} className="text-brand" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand font-head">
                Aktivasi Berhasil
              </span>
              <h3 className="text-2xl font-head font-extrabold text-tprimary mt-0.5">
                Pembayaran Dikonfirmasi! 🎉
              </h3>
              <p className="text-xs text-tsecondary mt-1.5 max-w-sm mx-auto leading-relaxed">
                Selamat! Lisensi seumur hidup Anda telah aktif. Berikut adalah kode lisensi unik Anda:
              </p>
            </div>

            {/* Unique Generated Access Code Card */}
            <div className="p-4 rounded-2xl bg-surface border-2 border-brand/60 shadow-lg space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-tmuted font-head block">
                Kode Akses / Lisensi Digital Seumur Hidup
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-xl sm:text-2xl font-head font-extrabold font-mono tracking-wider text-brand px-4 py-1.5 bg-elevated rounded-xl border border-brand/40">
                  {paymentSuccessData.access_code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2.5 rounded-xl bg-elevated hover:bg-borderc text-tprimary transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  title="Salin Kode"
                >
                  {copiedCode ? <Check size={16} className="text-brand" /> : <Copy size={16} />}
                  <span className="hidden sm:inline">{copiedCode ? "Tersalin!" : "Salin"}</span>
                </button>
              </div>
              <span className="text-[10px] text-tmuted block">
                Paket: <strong className="text-tprimary">{paymentSuccessData.tier_name}</strong> · Sekali bayar, milik Anda selamanya.
              </span>
            </div>

            {/* Auto-Registration Status Message */}
            <div className="p-3 rounded-xl bg-elevated border border-borderc text-xs text-tsecondary text-left space-y-1">
              <div className="flex items-center gap-1.5 text-brand font-semibold">
                <ShieldCheck size={15} /> Akun Otomatis Terdaftar & Aktif
              </div>
              <p className="text-[11px] leading-relaxed">
                Akun Anda telah otomatis terdaftar dengan email <strong className="text-tprimary">{formData.email}</strong> dan paket <strong className="text-brand">{paymentSuccessData.tier_name}</strong>. Anda dapat langsung masuk tanpa perlu mengisi ulang form.
              </p>
            </div>

            {/* Launch Dashboard Button */}
            <Button
              type="button"
              onClick={handleLaunchDashboard}
              className="w-full py-3.5 font-bold text-sm shadow-xl shadow-[var(--glow)]"
            >
              Masuk ke Dashboard Tumara Sekarang ➔
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
