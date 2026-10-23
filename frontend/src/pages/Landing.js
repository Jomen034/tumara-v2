import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ScanLine, Wallet, Target, ShieldCheck, TrendingUp,
  ArrowRight, Moon, Smartphone, PieChart, Check, Eye, EyeOff, AlertTriangle,
  ChevronDown, HelpCircle, Users, Zap, CheckCircle2, Star, Shield
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { Spinner, Modal, Input, Button } from "../components/ui";
import api, { postWithColdStartRetry } from "../lib/api";
import TumaraLogo from "../components/TumaraLogo";
import CheckoutModal from "../components/CheckoutModal";
import clsx from "clsx";

const FEATURES = [
  { icon: Wallet, title: "Multi-Wallet & Real-Time Net Worth", desc: "Pantau rekening bank, e-wallet, kartu kredit, hingga PayLater dalam satu kendali portofolio terpadu." },
  { icon: Sparkles, title: "Personal AI Financial Advisor", desc: "Konsultasi kondisi keuangan kapan saja. Rekomendasi tajam berbasis data riil dompet Anda, bukan saran generik." },
  { icon: ScanLine, title: "Smart OCR Receipt Scanner", desc: "Cukup foto struk belanja fisik Anda. AI otomatis mengekstrak rincian item, kuantitas, harga, diskon, dan kategori." },
  { icon: PieChart, title: "Smart Budgeting 50/30/20", desc: "Alokasikan kebutuhan, keinginan, dan tabungan dengan panduan disiplin dan peringatan saat mendekati batas." },
  { icon: Target, title: "Target Finansial Terukur (Goals)", desc: "Siapkan pos dana darurat, liburan, hingga DP rumah dengan simulasi setoran dan deadline yang jelas." },
  { icon: TrendingUp, title: "Financial Health Score (0–100)", desc: "Evaluasi kesehatan finansial objektif dari 4 pilar akuntansi pasti secara instan dan bebas halusinasi." },
];

const PRICING_TIERS = [
  {
    id: "starter",
    name: "Starter Personal",
    price: "Rp 49.000",
    period: "sekali bayar · selamanya",
    desc: "Cocok untuk individu yang ingin mulai rapi mencatat dan bebas dari bocor halus.",
    badge: null,
    features: [
      "1 Akun Personal Seumur Hidup",
      "Pencatatan Manual, Dompet & Kategori Unlimited",
      "Budgeting 50/30/20 & Daily Spend Pulse",
      "Kalender Tagihan & Mini Habit Tracker Disiplin",
      "Financial Health Score (0–100)",
      "10 Scan Struk AI & 20 Smart Text AI / bulan",
      "Reset Otomatis Kuota Tiap Tanggal 1",
      "Ekspor Data Lengkap (CSV)",
      "100% Bebas Iklan & Pelacak Komersial",
    ],
    buttonText: "Pilih Starter",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro Tumara AI",
    price: "Rp 99.000",
    period: "sekali bayar · selamanya",
    desc: "Solusi lengkap dengan asisten CFO AI pribadi untuk keputusan finansial yang matang dan terarah.",
    badge: "Paling Populer · Best Value",
    features: [
      "Semua fitur di Paket Starter",
      "60 Scan Struk AI & 150 Smart Text AI / bulan",
      "Reset Otomatis Kuota Tiap Tanggal 1",
      "AI Financial Advisor Interaktif (Personal CFO)",
      "Weekly AI Financial Health Recap Otomatis",
      "Smart Itemized Receipt Scan (Ekstraksi Otomatis per Item Belanja & Diskon)",
      "Cadangan Database JSON & Ekspor CSV",
      "Mode Privasi Blur Seketika",
      "Prioritas Akses Fitur Terbaru",
    ],
    buttonText: "Beli Pro AI",
    highlight: true,
  },
  {
    id: "family",
    name: "Family Partner",
    price: "Rp 169.000",
    period: "sekali bayar · selamanya",
    desc: "Untuk pasangan suami-istri atau keluarga yang ingin menyatukan visi keuangan rumah tangga.",
    badge: "Hemat Berdua",
    features: [
      "Akses untuk 2–3 Akun (Suami, Istri & Partner)",
      "Shared Net Worth & Portofolio Bersama",
      "Split Member Spend Tracking per Anggota",
      "Kalender Tagihan Bersama Real-Time",
      "150 Scan Struk AI & 300 Smart Text AI / bulan (Shared Pool)",
      "Reset Otomatis Kuota Tiap Tanggal 1",
      "Kontrol Dompet Pribadi vs Dompet Bersama",
      "Dukungan WhatsApp Priority",
    ],
    buttonText: "Pilih Family Partner",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "Kenapa memilih Tumara dibanding spreadsheet manual atau aplikasi gratisan?",
    a: "Spreadsheet dan template gratis sering kali terbengkalai karena melelahkan mengetik angka manual satu per satu. Di sisi lain, aplikasi gratisan di toko aplikasi kerap memonetisasi data finansial pengguna ke broker iklan pihak ketiga. Tumara menghadirkan Smart OCR Scanner (cukup foto struk belanja), privasi 100% bebas pelacak komersial, serta sinkronisasi rumah tangga real-time yang aman dan teruji.",
    tag: "Privasi & Kemudahan",
  },
  {
    q: "Dengan maraknya tren membuat aplikasi dengan AI (vibe coding), apa pembeda arsitektur Tumara?",
    a: "Membuat tampilan visual sederhana dengan bantuan AI memang cepat, tetapi aplikasi finansial sungguhan menuntut integritas data dan akurasi akuntansi ganda yang presisi. Tumara dibangun dengan engine akuntansi teruji: menangani receipt scanning kompleks (rincian item beruntun, potongan diskon promo, hingga subtotal toko), isolasi data multi-user rumah tangga yang aman, aturan pelunasan kartu kredit/PayLater, hingga automatic balance rollback saat transaksi diedit atau dihapus. Tanpa arsitektur akuntansi yang matang, aplikasi rentan salah hitung saldo dan membocorkan privasi finansial Anda.",
    tag: "Arsitektur & Akurasi",
  },
  {
    q: "Apakah saya bisa mulai dari paket Starter dulu lalu upgrade nanti?",
    a: "Bisa banget! Tumara menerapkan sistem Upgrade Cukup Bayar Selisih. Jika kamu membeli Starter (Rp 49.000) dan ingin upgrade ke Pro (Rp 99.000), kamu hanya perlu membayar selisihnya sebesar Rp 50.000 saja. Investasi awalmu tidak akan pernah hangus.",
    tag: "Jaminan Upgrade",
  },
  {
    q: "Bagaimana jika kuota AI saya habis sebelum tanggal 1?",
    a: "Kamu tetap bisa mencatat transaksi manual tanpa batas! Jika butuh scan struk tambahan segera, kamu bisa membeli Kuota Booster Instan mulai Rp 10.000 (+15 scan). Kuota booster ini AKTIF SELAMANYA SAMPAI HABIS tanpa batas kedaluwarsa, tidak akan hangus di akhir bulan.",
    tag: "Jaminan Kuota Instan",
  },
  {
    q: "Apakah fitur Financial Health Score dan Daily Spend Pulse menggunakan kuota AI?",
    a: "Tidak! Financial Health Score (0–100) dan Daily Spend Pulse 100% dihitung menggunakan rumus matematika akuntansi pasti secara instan di perangkatmu. Fitur ini unlimited dan bebas digunakan di semua paket tanpa memotong kuota AI sedikit pun.",
    tag: "Transparansi Fitur",
  },
  {
    q: "Apakah ada biaya langganan bulanan tersembunyi yang mendebit kartu saya?",
    a: "Sama sekali tidak ada. Tumara menganut prinsip Sekali Bayar untuk Akses Seumur Hidup (Lifetime License). Anda tidak perlu mendaftarkan kartu kredit, bebas dari auto-debit yang menjebak, dan akun Anda dapat digunakan selamanya.",
    tag: "Transparansi Biaya",
  },
  {
    q: "Apakah pasangan saya harus membayar lagi jika ingin mengelola keuangan bersama?",
    a: "Tidak perlu jika Anda memilih Paket Family Partner. 1 Lisensi Family langsung berlaku untuk 2–3 akun pengguna (suami & istri / partner) dengan kalender tagihan bersama, split tracking transaksi per anggota, dan gabungan net worth real-time.",
    tag: "Kolaborasi Keluarga",
  },
];

export default function Landing() {
  const { user, loginWithSession, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState("login"); // 'login' | 'register' | 'forgot'
  const [registerType, setRegisterType] = useState("admin"); // 'admin' | 'partner'

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [dbDegraded, setDbDegraded] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "", email: "", password: "", accessCode: "TUMARA2026", inviteCode: ""
  });
  const [forgotForm, setForgotForm] = useState({ email: "", token: "", newPassword: "" });
  const [forgotStep, setForgotStep] = useState(1); // 1 = request token, 2 = submit new pw

  // Checkout modal states
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState("pro");

  const openCheckout = (tierId = "pro") => {
    setCheckoutTier(tierId);
    setCheckoutModalOpen(true);
  };

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const navigate = useNavigate();

  // Check database persistence health on mount
  useEffect(() => {
    api.get("/health")
      .then((res) => {
        if (res.data?.storage === "in-memory-mock") {
          setDbDegraded(true);
        }
      })
      .catch(() => {});
  }, []);

  // Auto detect invite code from query param or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inv = urlParams.get("invite") || localStorage.getItem("tumara-invite");
    if (inv) {
      setRegisterForm(prev => ({ ...prev, inviteCode: inv }));
      setRegisterType("partner");
      setAuthTab("register");
      setAuthModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      if (!user.onboarded) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast.error("Email dan password wajib diisi");
      return;
    }
    setSubmitting(true);
    setStatusMessage("Memverifikasi kredensial...");
    try {
      const res = await postWithColdStartRetry(
        "/auth/login",
        loginForm,
        (msg) => setStatusMessage(msg),
        3
      );
      if (res?.data?.user) {
        loginWithSession(res.data.user, res.data.session_token);
        toast.success("Berhasil masuk!");
        if (!res.data.user.onboarded) {
          navigate("/onboarding", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Email atau password salah";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      toast.error("Semua field wajib diisi");
      return;
    }
    if (registerForm.password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }

    const payload = {
      name: registerForm.name.trim(),
      email: registerForm.email.trim(),
      password: registerForm.password,
    };

    if (registerType === "partner") {
      if (!registerForm.inviteCode.trim()) {
        toast.error("Kode undangan keluarga wajib diisi");
        return;
      }
      payload.invite_code = registerForm.inviteCode.trim();
    } else {
      if (!registerForm.accessCode.trim()) {
        toast.error("Kode akses pendaftaran wajib diisi");
        return;
      }
      payload.access_code = registerForm.accessCode.trim().toUpperCase();
    }

    setSubmitting(true);
    setStatusMessage("Mendaftarkan akun baru...");
    try {
      const res = await postWithColdStartRetry(
        "/auth/register",
        payload,
        (msg) => setStatusMessage(msg),
        3
      );
      if (res?.data?.user) {
        loginWithSession(res.data.user, res.data.session_token);
        toast.success("Pendaftaran berhasil! Selamat datang di Tumara.");
        navigate("/onboarding", { replace: true });
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Gagal melakukan pendaftaran";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotForm.email) {
      toast.error("Masukkan email terdaftar");
      return;
    }
    setSubmitting(true);
    try {
      const res = await postWithColdStartRetry("/auth/forgot-password", { email: forgotForm.email });
      if (res?.data?.reset_token) {
        setForgotForm(prev => ({ ...prev, token: res.data.reset_token }));
        setForgotStep(2);
        toast.success("Kode pemulihan berhasil dibuat! Silakan buat password baru.");
      } else {
        toast.info(res?.data?.message || "Permintaan pemulihan diproses.");
        setForgotStep(2);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal memproses pemulihan password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotForm.token || !forgotForm.newPassword) {
      toast.error("Token dan password baru wajib diisi");
      return;
    }
    if (forgotForm.newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    setSubmitting(true);
    try {
      const res = await postWithColdStartRetry("/auth/reset-password", {
        token: forgotForm.token.trim(),
        new_password: forgotForm.newPassword
      });
      toast.success(res?.data?.message || "Password berhasil diubah!");
      setAuthTab("login");
      setForgotStep(1);
      setForgotForm({ email: "", token: "", newPassword: "" });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mengubah password");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-4 text-center">
        <Spinner size={32} className="text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-tprimary overflow-x-hidden">
      {dbDegraded && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2.5 text-xs text-center flex items-center justify-center gap-2">
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <span>
            <strong>Peringatan Mode Memori:</strong> Backend berjalan di database sementara. Hubungkan <code>MONGO_URL</code> (MongoDB Atlas) di Render agar data tidak hilang saat server restart.
          </span>
        </div>
      )}

      {/* glow bg */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full opacity-20 blur-3xl" style={{ background: "var(--brand)" }} />
        <div className="absolute top-1/3 -right-40 w-[32rem] h-[32rem] rounded-full opacity-10 blur-3xl" style={{ background: "var(--cyan)" }} />
      </div>

      {/* nav */}
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <TumaraLogo size={36} withText={true} />
        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-tsecondary">
          <a href="#pricing" className="hover:text-tprimary transition-colors">Paket & Harga</a>
          <a href="#faq" className="hover:text-tprimary transition-colors">Tanya Jawab</a>
          <Link to="/about" className="hover:text-brand transition-colors flex items-center gap-1.5">
            Tentang Tumara <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand font-mono font-bold">v2.2</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="nav-login-button" onClick={() => { setAuthTab("login"); setAuthModalOpen(true); }}
            className="text-sm font-semibold px-5 py-2.5 rounded-full bg-elevated hover:bg-borderc transition-colors">
            Masuk
          </button>
          <button data-testid="nav-register-button" onClick={() => { setAuthTab("register"); setAuthModalOpen(true); }}
            className="text-sm font-semibold px-5 py-2.5 rounded-full bg-brand text-black hover:brightness-110 shadow-lg shadow-[var(--glow)] transition-all">
            Daftar Akun
          </button>
        </div>
      </header>

      {/* hero */}
      <section className="max-w-6xl mx-auto px-5 pt-10 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-elevated px-3.5 py-1.5 rounded-full mb-6 text-brand">
            <Sparkles size={14} /> Tumbuh dengan arah · CFO pribadi bertenaga AI
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-head font-extrabold tracking-tight leading-[1.05]">
            Tumbuh dengan arah. <span className="brand-gradient-text">Pegang kendali penuh.</span>
          </h1>
          <p className="text-tsecondary text-lg mt-5 max-w-md leading-relaxed">
            Tumara bantu kamu lacak semua dompet, atur budget, dan capai tujuan keuangan —
            dipandu asisten AI yang memberi arah jelas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button data-testid="hero-register-button" onClick={() => openCheckout("pro")}
              className="inline-flex items-center justify-center gap-3 bg-brand text-black font-semibold px-7 py-3.5 rounded-full hover:brightness-110 transition shadow-lg shadow-[var(--glow)] cursor-pointer">
              Mulai Sekarang <ArrowRight size={18} />
            </button>
            <button data-testid="hero-login-button" onClick={() => { setAuthTab("login"); setAuthModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 bg-elevated text-tprimary font-semibold px-6 py-3.5 rounded-full hover:bg-borderc transition cursor-pointer">
              Sudah punya akun? Masuk
            </button>
          </div>
          <div className="flex items-center gap-5 mt-8 text-xs text-tmuted">
            <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand" /> Data terenkripsi</span>
            <span className="flex items-center gap-1.5"><Smartphone size={15} className="text-brand" /> Install di HP</span>
            <span className="flex items-center gap-1.5"><Moon size={15} className="text-brand" /> Mode gelap</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }}
          className="relative">
          <PhoneMockup />
        </motion.div>
      </section>

      {/* Unified Auth Modal */}
      <Modal open={authModalOpen} onClose={() => setAuthModalOpen(false)} title={authTab === "forgot" ? "Pemulihan Password" : "Akses Akun Tumara"}>
        <div className="space-y-4 py-2">
          {authTab !== "forgot" && (
            <div className="flex bg-elevated rounded-xl p-1 border border-borderc">
              <button
                type="button"
                onClick={() => setAuthTab("login")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  authTab === "login" ? "bg-brand text-black shadow" : "text-tsecondary hover:text-tprimary"
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("register")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  authTab === "register" ? "bg-brand text-black shadow" : "text-tsecondary hover:text-tprimary"
                }`}
              >
                Daftar Baru
              </button>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {authTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <Input
                label="Email"
                type="email"
                placeholder="nama@email.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
              />
              <div>
                <Input
                  label="Password"
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="text-tmuted hover:text-tprimary p-1 focus:outline-none transition-colors"
                      tabIndex={-1}
                      title={showLoginPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  required
                />
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setAuthTab("forgot"); setForgotStep(1); }}
                    className="text-xs text-brand hover:underline"
                  >
                    Lupa password?
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size={16} /> {statusMessage || "Memproses..."}
                  </span>
                ) : (
                  "Masuk ke Akun"
                )}
              </Button>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {authTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <Input
                label="Nama Lengkap"
                type="text"
                placeholder="mis. Budi Santoso"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="nama@email.com"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                required
              />
              <Input
                label="Password (min. 6 karakter)"
                type={showRegisterPassword ? "text" : "password"}
                placeholder="••••••••"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="text-tmuted hover:text-tprimary p-1 focus:outline-none transition-colors"
                    tabIndex={-1}
                    title={showRegisterPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                required
              />

              {/* Registration Type Selector */}
              <div className="space-y-1.5 pt-1">
                <span className="block text-xs font-semibold text-tsecondary uppercase tracking-wider">Tipe Pendaftaran</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRegisterType("admin")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      registerType === "admin"
                        ? "border-brand bg-elevated text-tprimary font-semibold"
                        : "border-borderc bg-bg text-tsecondary hover:bg-elevated"
                    }`}
                  >
                    👑 Rumah Tangga Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterType("partner")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      registerType === "partner"
                        ? "border-brand bg-elevated text-tprimary font-semibold"
                        : "border-borderc bg-bg text-tsecondary hover:bg-elevated"
                    }`}
                  >
                    🤝 Gabung Pasangan
                  </button>
                </div>
              </div>

              {registerType === "admin" ? (
                <div>
                  <Input
                    label="Kode Akses Pendaftaran (Default: TUMARA2026)"
                    type="text"
                    placeholder="TUMARA2026"
                    value={registerForm.accessCode}
                    onChange={(e) => setRegisterForm({ ...registerForm, accessCode: e.target.value.toUpperCase() })}
                    required
                  />
                  <div className="mt-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthModalOpen(false);
                        openCheckout("pro");
                      }}
                      className="text-[11px] text-brand hover:underline font-medium cursor-pointer"
                    >
                      Belum punya kode akses? Beli paket lisensi sekarang ➔
                    </button>
                  </div>
                </div>
              ) : (
                <Input
                  label="Kode Undangan Keluarga"
                  type="text"
                  placeholder="mis. inv_abc123"
                  value={registerForm.inviteCode}
                  onChange={(e) => setRegisterForm({ ...registerForm, inviteCode: e.target.value })}
                  required
                />
              )}

              <Button type="submit" className="w-full mt-2" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size={16} /> {statusMessage || "Mendaftarkan..."}
                  </span>
                ) : (
                  "Daftar Sekarang"
                )}
              </Button>
            </form>
          )}

          {/* 3. FORGOT / RESET PASSWORD FORM */}
          {authTab === "forgot" && (
            <div className="space-y-3.5">
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotPassword} className="space-y-3.5">
                  <p className="text-xs text-tsecondary">
                    Masukkan email akun Anda untuk membuat kode pemulihan password secara instan.
                  </p>
                  <Input
                    label="Email Terdaftar"
                    type="email"
                    placeholder="nama@email.com"
                    value={forgotForm.email}
                    onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Spinner size={16} /> : "Dapatkan Kode Pemulihan"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <p className="text-xs text-brand">
                    Kode pemulihan telah disiapkan. Masukkan password baru Anda di bawah.
                  </p>
                  <Input
                    label="Token Pemulihan"
                    type="text"
                    placeholder="rst_..."
                    value={forgotForm.token}
                    onChange={(e) => setForgotForm({ ...forgotForm, token: e.target.value })}
                    required
                  />
                  <Input
                    label="Password Baru"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={forgotForm.newPassword}
                    onChange={(e) => setForgotForm({ ...forgotForm, newPassword: e.target.value })}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Spinner size={16} /> : "Simpan Password Baru"}
                  </Button>
                </form>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthTab("login"); setForgotStep(1); }}
                  className="text-xs text-tsecondary hover:text-tprimary underline"
                >
                  Kembali ke Halaman Masuk
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* features */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="text-2xl sm:text-4xl font-head font-bold tracking-tight max-w-xl">
          Semua yang kamu butuh untuk akhirnya <span className="brand-gradient-text">pegang kendali.</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="bg-surface border border-borderc rounded-2xl p-6 hover:border-brand transition-colors">
              <div className="w-11 h-11 rounded-xl bg-elevated flex items-center justify-center mb-4">
                <f.icon size={22} className="text-brand" />
              </div>
              <h3 className="font-head font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-tsecondary mt-1.5 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* steps */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="text-2xl sm:text-4xl font-head font-bold text-center">
          Mulai Rapi dalam <span className="brand-gradient-text">3 Langkah Mudah.</span>
        </h2>
        <p className="text-center text-sm text-tsecondary mt-2 max-w-md mx-auto">
          Setup cepat dalam hitungan menit untuk kendali finansial jangka panjang.
        </p>
        <div className="grid sm:grid-cols-3 gap-6 mt-12">
          {[
            { n: "1", t: "Daftarkan Dompet", d: "Rekening bank, e-wallet, kartu kredit, hingga saldo PayLater." },
            { n: "2", t: "Tentukan Alokasi", d: "Gunakan panduan 50/30/20 atau sesuaikan limit pos anggaranmu." },
            { n: "3", t: "Catat & Evaluasi", d: "Foto struk belanja atau ketik santai, AI dan dashboard otomatis merapikannya." },
          ].map((s) => (
            <div key={s.n} className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand text-black font-head font-extrabold text-xl flex items-center justify-center mx-auto mb-4">{s.n}</div>
              <h3 className="font-semibold text-tprimary">{s.t}</h3>
              <p className="text-sm text-tsecondary mt-1 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-5 py-20 border-t border-borderc/40">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-brand font-head">
            Investasi Finansial Sekali Bayar
          </span>
          <h2 className="text-2xl sm:text-4xl font-head font-extrabold mt-2 tracking-tight">
            Pilih paket yang paling <span className="brand-gradient-text">pas untukmu.</span>
          </h2>
          <p className="text-tsecondary text-sm sm:text-base mt-3 leading-relaxed">
            Tanpa langganan auto-debit yang membebani. Beli sekali, nikmati akses dan pembaruan selamanya.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mt-14 items-stretch">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={clsx(
                "relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300",
                tier.highlight
                  ? "bg-surface border-2 border-brand shadow-2xl shadow-[var(--glow)] lg:-translate-y-2"
                  : "bg-surface/70 border border-borderc hover:border-brand/50"
              )}
            >
              {tier.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand text-black font-head font-bold text-xs uppercase tracking-wider py-1 px-4 rounded-full shadow-md">
                  {tier.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-head font-bold text-xl text-tprimary">{tier.name}</h3>
                  {tier.id === "family" && <Users size={18} className="text-brand" />}
                  {tier.id === "pro" && <Sparkles size={18} className="text-brand" />}
                  {tier.id === "starter" && <Wallet size={18} className="text-tsecondary" />}
                </div>
                <p className="text-xs text-tsecondary mt-2 leading-relaxed min-h-[36px]">
                  {tier.desc}
                </p>

                <div className="mt-5 pb-5 border-b border-borderc/60">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-head font-extrabold font-mono text-tprimary">
                      {tier.price}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-brand mt-1 block">
                    ✓ {tier.period}
                  </span>
                </div>

                <ul className="space-y-3 my-6">
                  {tier.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-tsecondary">
                      <CheckCircle2 size={16} className="text-brand shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openCheckout(tier.id)}
                className={clsx(
                  "w-full py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer",
                  tier.highlight
                    ? "bg-brand text-black hover:brightness-110 shadow-lg shadow-[var(--glow)]"
                    : "bg-elevated text-tprimary hover:bg-elevated/80 border border-borderc"
                )}
              >
                {tier.buttonText} <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-8 max-w-4xl mx-auto">
          <div className="bg-surface/80 border border-brand/30 rounded-2xl p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="font-head font-bold text-sm text-tprimary">
                Upgrade Paket: Cukup Bayar Selisih!
              </h4>
              <p className="text-xs text-tsecondary mt-1 leading-relaxed">
                Mulai dari Starter dulu? Jangan khawatir. Kamu bisa upgrade ke paket <strong>Pro (cukup tambah Rp 50.000)</strong> atau ke <strong>Family (cukup tambah Rp 70.000 dari Pro)</strong> kapan saja. Uang pembelian pertamamu tidak akan hangus.
              </p>
            </div>
          </div>

          <div className="bg-surface/80 border border-amber/30 rounded-2xl p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber/10 text-amber flex items-center justify-center shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <h4 className="font-head font-bold text-sm text-tprimary">
                Jaminan Kuota Instan: Aktif Selamanya Sampai Habis
              </h4>
              <p className="text-xs text-tsecondary mt-1 leading-relaxed">
                Butuh kuota AI tambahan tanpa ganti paket? Beli <strong>Booster Instan (mulai Rp 10.000)</strong>. Saldo booster <strong>tidak memiliki masa kedaluwarsa</strong> dan tidak akan hangus di akhir bulan!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-tmuted flex flex-wrap items-center justify-center gap-4">
          <span className="flex items-center gap-1.5"><Shield size={14} className="text-brand" /> Garansi Bebas Iklan Selamanya</span>
          <span>•</span>
          <span>Tersedia pembayaran QRIS, Transfer Bank, & E-Wallet</span>
          <span>•</span>
          <span>Aktivasi Kode Lisensi Instan</span>
        </div>
      </section>

      {/* AI Transparency Section */}
      <section className="max-w-5xl mx-auto px-5 py-16 border-t border-borderc/40">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-brand font-head">
            Prinsip Kejujuran & Transparansi
          </span>
          <h2 className="text-2xl sm:text-3xl font-head font-extrabold mt-1 text-tprimary">
            Untuk apa saja AI Tumara <span className="brand-gradient-text">digunakan?</span>
          </h2>
          <p className="text-tsecondary text-xs sm:text-sm mt-2 leading-relaxed">
            Kami tidak menjual ilusi atau jargon kosong. Kami memisahkan secara tegas antara kemampuan <strong>Kecerdasan Buatan (Cloud AI)</strong> dengan <strong>Algoritma Akuntansi Pasti</strong> demi akurasi finansial yang 100% dapat diandalkan.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Cloud AI column */}
          <div className="bg-surface border border-brand/30 rounded-3xl p-6 sm:p-7 relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-4 text-brand">
              <Sparkles size={20} />
              <h3 className="font-head font-bold text-base text-tprimary">
                Didukung Cloud AI Modern
              </h3>
            </div>
            <p className="text-xs text-tsecondary mb-5 leading-relaxed">
              Membutuhkan komputasi server tinggi sehingga diatur dengan kuota bulanan Fair Usage Policy (FUP) yang adil:
            </p>
            <ul className="space-y-3.5 text-xs text-tsecondary">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-brand shrink-0 mt-0.5" />
                <div>
                  <strong className="text-tprimary block">Smart OCR Receipt Scanner</strong>
                  Cukup foto struk belanja fisik Anda. Cloud AI secara otomatis membaca nama item, kuantitas, harga satuan, potongan diskon, hingga total akhir secara presisi.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-brand shrink-0 mt-0.5" />
                <div>
                  <strong className="text-tprimary block">AI Financial Advisor (Personal CFO)</strong>
                  Konsultasi interaktif untuk evaluasi cash flow bulanan, deteksi pos kebocoran anggaran (*bocor halus*), dan rekomendasi finansial berbasis data riil portofolio Anda.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-brand shrink-0 mt-0.5" />
                <div>
                  <strong className="text-tprimary block">Natural Language Quick Input</strong>
                  Cukup ketik santai seperti <em>&quot;makan siang soto 35rb pake gopay&quot;</em> atau <em>&quot;beli bensin 50rb bca&quot;</em>, AI langsung memetakan nominal, kategori, dan dompet yang tepat.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-brand shrink-0 mt-0.5" />
                <div>
                  <strong className="text-tprimary block">Weekly AI Health Recap (Pro & Family)</strong>
                  Rangkuman naratif mingguan otomatis yang mengevaluasi ritme belanja, tren tabungan, dan progres target finansial keluarga Anda.
                </div>
              </li>
            </ul>
          </div>

          {/* Pure Accounting column */}
          <div className="bg-surface border border-borderc rounded-3xl p-6 sm:p-7 relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-4 text-cyan">
              <ShieldCheck size={20} />
              <h3 className="font-head font-bold text-base text-tprimary">
                100% Algoritma Matematika Akuntansi Pasti
              </h3>
            </div>
            <p className="text-xs text-tsecondary mb-5 leading-relaxed">
              Dijalankan langsung di perangkatmu tanpa token AI — <strong>100% Bebas Kuota & Unlimited di Semua Paket:</strong>
            </p>
            <ul className="space-y-3.5 text-xs text-tsecondary">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-cyan shrink-0 mt-0.5" />
                <div>
                  <strong className="text-tprimary block">Financial Health Score (0–100)</strong>
                  Dihitung transparan dari 4 pilar fundamental (Solvabilitas, Rasio Tabungan, Disiplin 50/30/20, & Goals). Rumus objektif bebas halusinasi.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-cyan shrink-0 mt-0.5" />
                <div>
                  <strong className="text-tprimary block">Smart Daily Spend Pulse</strong>
                  Kalkulator pembagi anggaran aman harian berbasis sisa hari dalam bulan berjalan agar uang tidak habis sebelum akhir bulan.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-cyan shrink-0 mt-0.5" />
                <div>
                  <strong className="text-tprimary block">Kalender Tagihan & Mini Habit Tracker</strong>
                  Visualisasi kedisiplinan pencatatan harian dan peringatan jatuh tempo tagihan berulang.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-cyan shrink-0 mt-0.5" />
                <div>
                  <strong className="text-tprimary block">Pencatatan Manual, Dompet & Kategori Unlimited</strong>
                  Catat transaksi manual sebanyak apa pun tanpa pernah dibatasi kuota seumur hidup.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="max-w-4xl mx-auto px-5 py-20 border-t border-borderc/40">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-brand font-head">
            Tanya Jawab & Transparansi
          </span>
          <h2 className="text-2xl sm:text-4xl font-head font-extrabold mt-2 tracking-tight">
            Pertanyaan yang sering <span className="brand-gradient-text">diajukan.</span>
          </h2>
          <p className="text-tsecondary text-sm mt-2">
            Kami percaya pada transparansi arsitektur, keamanan data, dan nilai nyata.
          </p>
        </div>

        <div className="space-y-3.5">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className={clsx(
                  "border rounded-2xl transition-all duration-200 overflow-hidden",
                  isOpen ? "bg-surface border-brand/50 shadow-md" : "bg-surface/60 border-borderc hover:border-borderc/80"
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer"
                >
                  <div className="flex-1">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-elevated text-brand font-head mb-2">
                      {faq.tag}
                    </span>
                    <h3 className="font-head font-semibold text-base sm:text-lg text-tprimary leading-snug">
                      {faq.q}
                    </h3>
                  </div>
                  <div className={clsx("w-8 h-8 rounded-full bg-elevated flex items-center justify-center shrink-0 text-tsecondary transition-transform duration-200", isOpen && "rotate-180 text-brand")}>
                    <ChevronDown size={18} />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <div className="px-5 pb-6 sm:px-6 sm:pb-6 text-sm text-tsecondary leading-relaxed border-t border-borderc/30 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* cta */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <div className="bg-surface border border-borderc rounded-3xl p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 blur-3xl" style={{ background: "radial-gradient(circle at 50% 0%, var(--brand), transparent 60%)" }} />
          <h2 className="text-2xl sm:text-4xl font-head font-extrabold relative">
            Investasi Terbaik untuk <span className="brand-gradient-text">Ketenangan Finansial Anda.</span>
          </h2>
          <p className="text-tsecondary mt-3 relative max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
            Pegang kendali penuh atas uang, tabungan, dan masa depan finansial keluarga Anda hari ini. Sekali bayar, akses selamanya.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-6 relative text-xs sm:text-sm text-tsecondary">
            <span className="flex items-center gap-1.5"><Check size={16} className="text-brand" /> 100% Bebas Iklan</span>
            <span className="flex items-center gap-1.5"><Check size={16} className="text-brand" /> Privasi Terenkripsi</span>
            <span className="flex items-center gap-1.5"><Check size={16} className="text-brand" /> Lifetime License</span>
          </div>
          <button onClick={() => openCheckout("pro")} data-testid="cta-register-button"
            className="mt-8 inline-flex items-center gap-2 bg-brand text-black font-semibold px-8 py-4 rounded-full hover:brightness-110 transition shadow-lg shadow-[var(--glow)] relative cursor-pointer">
            Mulai Sekarang <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 py-12 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-borderc/40 text-xs text-tmuted">
        <div>
          <p className="font-medium text-tsecondary">Tumara © 2026 — Tumbuh dengan arah.</p>
          <p className="mt-0.5">Platform Manajemen Finansial Pribadi & Pasangan Berbasis AI.</p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Link to="/about" className="hover:text-brand transition-colors font-medium">
            Tentang Tumara & Pembaruan (What&apos;s New)
          </Link>
          <button
            onClick={() => { setAuthTab("login"); setAuthModalOpen(true); }}
            className="hover:text-brand transition-colors font-medium cursor-pointer"
          >
            Masuk ke Akun
          </button>
        </div>
      </footer>

      {/* Checkout & Payment Modal (Dual-Mode: Midtrans Snap / Sandbox Simulation) */}
      <CheckoutModal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        initialTier={checkoutTier}
      />
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="mx-auto w-[280px] sm:w-[320px] animate-float">
      <div className="relative rounded-[2.5rem] border-4 border-borderc bg-surface p-4 shadow-2xl">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-bg rounded-full" />
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl p-4 text-black" style={{ background: "linear-gradient(135deg, var(--brand), var(--mint))" }}>
            <p className="text-xs opacity-80 font-semibold">Total Net Worth</p>
            <p className="text-2xl font-head font-extrabold font-mono">Rp 48.250.000</p>
            <div className="flex items-center gap-1 text-xs mt-1 font-semibold"><TrendingUp size={13} /> +12.4% bulan ini</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-elevated p-3">
              <p className="text-[10px] text-tmuted font-semibold">Health Score</p>
              <p className="text-xl font-head font-bold text-brand">82</p>
            </div>
            <div className="rounded-xl bg-elevated p-3">
              <p className="text-[10px] text-tmuted font-semibold">Sisa Budget</p>
              <p className="text-xl font-head font-bold">Rp 2,1jt</p>
            </div>
          </div>
          <div className="rounded-xl bg-elevated p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-tsecondary">GoFood</span>
              <span className="text-rose font-mono font-semibold">-Rp 85.000</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tsecondary">Gojek</span>
              <span className="text-rose font-mono font-semibold">-Rp 24.000</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tsecondary">Indomaret</span>
              <span className="text-rose font-mono font-semibold">-Rp 42.500</span>
            </div>
          </div>
          <div className="rounded-xl p-3 bg-brand/10 border border-brand/20 text-xs">
            <div className="flex items-center gap-1.5 text-brand font-semibold mb-1">
              <Sparkles size={13} /> Tumara AI
            </div>
            <p className="text-tsecondary text-[11px] leading-relaxed">
              &quot;Pengeluaran makan kamu minggu ini naik 30%. Coba masak 2x seminggu buat hemat Rp 240rb.&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
