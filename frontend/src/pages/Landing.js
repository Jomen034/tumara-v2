import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles, ScanLine, Wallet, Target, ShieldCheck, TrendingUp,
  ArrowRight, Moon, Smartphone, PieChart, Check
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { Spinner, Modal, Input, Button } from "../components/ui";
import { postWithColdStartRetry } from "../lib/api";

const FEATURES = [
  { icon: Wallet, title: "Semua dompet, satu layar", desc: "Bank, e-wallet, kartu kredit & PayLater. Lihat net worth real-time." },
  { icon: Sparkles, title: "Tumara AI — CFO pribadimu", desc: "Tanya apa saja. Jawaban personal berbasis kondisi keuanganmu, bukan generik." },
  { icon: ScanLine, title: "Foto struk, langsung tercatat", desc: "AI baca struk, pisahkan item & kategori otomatis. Tanpa ketik manual." },
  { icon: PieChart, title: "Budget yang bikin disiplin", desc: "Aturan 50/30/20 atau limit custom. Peringatan saat over-budget." },
  { icon: Target, title: "Tujuan dengan deadline", desc: "Dana darurat, liburan, DP rumah. Pantau progres tiap setoran." },
  { icon: TrendingUp, title: "Financial Health Score", desc: "Skor 0–100 + tren pengeluaran & perbandingan bulan ke bulan." },
];

export default function Landing() {
  const { user, loginWithSession, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState("login"); // 'login' | 'register' | 'forgot'
  const [registerType, setRegisterType] = useState("admin"); // 'admin' | 'partner'

  // Form states
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "", email: "", password: "", accessCode: "TUMARA2026", inviteCode: ""
  });
  const [forgotForm, setForgotForm] = useState({ email: "", token: "", newPassword: "" });
  const [forgotStep, setForgotStep] = useState(1); // 1 = request token, 2 = submit new pw

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const navigate = useNavigate();

  // Auto detect invite code from query param or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inv = urlParams.get("invite") || localStorage.getItem("tumara-invite") || localStorage.getItem("nusa-invite");
    if (inv) {
      setRegisterForm(prev => ({ ...prev, inviteCode: inv }));
      setRegisterType("partner");
      setAuthTab("register");
      setAuthModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
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
        navigate("/dashboard", { replace: true });
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
        navigate("/dashboard", { replace: true });
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
      {/* glow bg */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full opacity-20 blur-3xl" style={{ background: "var(--brand)" }} />
        <div className="absolute top-1/3 -right-40 w-[32rem] h-[32rem] rounded-full opacity-10 blur-3xl" style={{ background: "var(--cyan)" }} />
      </div>

      {/* nav */}
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-[var(--glow)]">
            <span className="text-black font-head font-extrabold text-lg">T</span>
          </div>
          <span className="font-head font-extrabold text-xl">Tumara</span>
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
            <button data-testid="hero-register-button" onClick={() => { setAuthTab("register"); setAuthModalOpen(true); }}
              className="inline-flex items-center justify-center gap-3 bg-brand text-black font-semibold px-7 py-3.5 rounded-full hover:brightness-110 transition shadow-lg shadow-[var(--glow)]">
              Mulai Sekarang Gratis <ArrowRight size={18} />
            </button>
            <button data-testid="hero-login-button" onClick={() => { setAuthTab("login"); setAuthModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 bg-elevated text-tprimary font-semibold px-6 py-3.5 rounded-full hover:bg-borderc transition">
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
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
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
                type="password"
                placeholder="••••••••"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
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
                <Input
                  label="Kode Akses Alpha / Beta"
                  type="text"
                  placeholder="TUMARA2026"
                  value={registerForm.accessCode}
                  onChange={(e) => setRegisterForm({ ...registerForm, accessCode: e.target.value.toUpperCase() })}
                  required
                />
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
        <h2 className="text-2xl sm:text-4xl font-head font-bold text-center">Cuma butuh 5 menit. Serius.</h2>
        <div className="grid sm:grid-cols-3 gap-6 mt-12">
          {[
            { n: "1", t: "Masukkan dompetmu", d: "Rekening, e-wallet, kartu kredit sampai PayLater." },
            { n: "2", t: "Tentukan budget", d: "Bagi penghasilan pakai aturan yang cocok buatmu." },
            { n: "3", t: "Catat & lihat polanya", d: "Foto struk atau input manual, AI bantu analisis." },
          ].map((s) => (
            <div key={s.n} className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand text-black font-head font-extrabold text-xl flex items-center justify-center mx-auto mb-4">{s.n}</div>
              <h3 className="font-semibold">{s.t}</h3>
              <p className="text-sm text-tsecondary mt-1">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* cta */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <div className="bg-surface border border-borderc rounded-3xl p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 blur-3xl" style={{ background: "radial-gradient(circle at 50% 0%, var(--brand), transparent 60%)" }} />
          <h2 className="text-2xl sm:text-4xl font-head font-extrabold relative">Dirimu di masa depan akan berterima kasih.</h2>
          <p className="text-tsecondary mt-3 relative">Gratis untuk mulai. Tanpa kartu kredit.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-6 relative text-sm text-tsecondary">
            <span className="flex items-center gap-1.5"><Check size={16} className="text-brand" /> Tanpa iklan</span>
            <span className="flex items-center gap-1.5"><Check size={16} className="text-brand" /> Data tidak dijual</span>
            <span className="flex items-center gap-1.5"><Check size={16} className="text-brand" /> Mode privasi</span>
          </div>
          <button onClick={() => { setAuthTab("register"); setAuthModalOpen(true); }} data-testid="cta-register-button"
            className="mt-8 inline-flex items-center gap-2 bg-brand text-black font-semibold px-8 py-4 rounded-full hover:brightness-110 transition shadow-lg shadow-[var(--glow)] relative">
            Mulai atur keuangan <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 py-10 text-center text-xs text-tmuted">
        Tumara © 2026 — Tumbuh dengan arah.
      </footer>
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
