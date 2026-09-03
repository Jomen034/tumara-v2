import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles, ScanLine, Wallet, Target, ShieldCheck, TrendingUp,
  ArrowRight, Moon, Smartphone, PieChart, Check,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/ui";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const login = () => {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

const FEATURES = [
  { icon: Wallet, title: "Semua dompet, satu layar", desc: "Bank, e-wallet, kartu kredit & PayLater. Lihat net worth real-time." },
  { icon: Sparkles, title: "Nusa AI — CFO pribadimu", desc: "Tanya apa saja. Jawaban personal berbasis kondisi keuanganmu, bukan generik." },
  { icon: ScanLine, title: "Foto struk, langsung tercatat", desc: "AI baca struk, pisahkan item & kategori otomatis. Tanpa ketik manual." },
  { icon: PieChart, title: "Budget yang bikin disiplin", desc: "Aturan 50/30/20 atau limit custom. Peringatan saat over-budget." },
  { icon: Target, title: "Tujuan dengan deadline", desc: "Dana darurat, liburan, DP rumah. Pantau progres tiap setoran." },
  { icon: TrendingUp, title: "Financial Health Score", desc: "Skor 0–100 + tren pengeluaran & perbandingan bulan ke bulan." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg"><Spinner size={30} className="text-brand" /></div>;

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
            <span className="text-black font-head font-extrabold text-lg">N</span>
          </div>
          <span className="font-head font-extrabold text-xl">Nusa</span>
        </div>
        <button data-testid="nav-login-button" onClick={login}
          className="text-sm font-semibold px-5 py-2.5 rounded-full bg-elevated hover:bg-borderc transition-colors">
          Masuk
        </button>
      </header>

      {/* hero */}
      <section className="max-w-6xl mx-auto px-5 pt-10 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-elevated px-3.5 py-1.5 rounded-full mb-6 text-brand">
            <Sparkles size={14} /> CFO pribadi bertenaga AI
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-head font-extrabold tracking-tight leading-[1.05]">
            Berhenti hidup <span className="brand-gradient-text">dari gaji ke gaji.</span>
          </h1>
          <p className="text-tsecondary text-lg mt-5 max-w-md leading-relaxed">
            Nusa bantu kamu lacak semua dompet, atur budget, dan capai tujuan keuangan —
            dipandu asisten AI yang paham kondisimu.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button data-testid="google-login-button" onClick={login}
              className="inline-flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3.5 rounded-full hover:brightness-95 transition shadow-lg">
              <GoogleIcon /> Mulai dengan Google
            </button>
            <button onClick={login}
              className="inline-flex items-center justify-center gap-2 bg-brand text-black font-semibold px-6 py-3.5 rounded-full hover:brightness-110 transition shadow-lg shadow-[var(--glow)]">
              Atur keuanganku <ArrowRight size={18} />
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
          <button onClick={login} data-testid="cta-login-button"
            className="mt-8 inline-flex items-center gap-2 bg-brand text-black font-semibold px-8 py-4 rounded-full hover:brightness-110 transition shadow-lg shadow-[var(--glow)] relative">
            Mulai atur keuangan <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 py-10 text-center text-xs text-tmuted">
        Nusa © 2026 — Dibuat untuk kamu yang mau bebas finansial.
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
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
              <p className="text-xl font-head font-bold font-mono">Rp 2,1jt</p>
            </div>
          </div>
          <div className="rounded-xl bg-elevated p-3 space-y-2">
            {[["GoFood", "Rp 85.000"], ["Gojek", "Rp 24.000"], ["Indomaret", "Rp 42.500"]].map(([a, b]) => (
              <div key={a} className="flex justify-between text-xs">
                <span className="text-tsecondary">{a}</span><span className="font-mono text-rose">-{b}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-3 flex items-center gap-2 border border-brand/30">
            <Sparkles size={16} className="text-brand shrink-0" />
            <p className="text-[11px] text-tsecondary">"GoFood kamu naik 30% minggu ini. Coba masak 2x seminggu buat hemat Rp 240rb."</p>
          </div>
        </div>
      </div>
    </div>
  );
}
