import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Shield, Sparkles, CheckCircle2, Server, Heart,
  Zap, Calendar, Lock, Database, ArrowRight, ExternalLink
} from "lucide-react";
import TumaraLogo from "../components/TumaraLogo";
import { Card, Badge, Button } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const CHANGELOG = [
  {
    version: "v2.2.0",
    date: "Oktober 2026",
    status: "Rilis Terbaru (Live)",
    title: "Gamifikasi Jurnal Finansial, FAQ & Model Lisensi Digital",
    highlights: [
      "Gamifikasi Beranda: Mini Kalender Habit Tracker dengan Daily Streak & Monthly Discipline Progress.",
      "Fair Usage Policy (FUP) & Proteksi Kuota AI: Perlindungan anti-abuse bulanan dengan auto-reset tiap tanggal 1.",
      "Mekanisme Lisensi Akses Digital: Dukungan aktivasi kode lisensi unik & upgrade kuota instan.",
      "OCR Engine Presisi Tinggi: Pemindaian struk belanja dengan dukungan timbangan berat desimal (produce/groceries) dan pajak resto PB1.",
      "Halaman Resmi Tentang Tumara & Public Changelog transparansi sistem.",
    ],
  },
  {
    version: "v2.1.0",
    date: "Oktober 2026",
    status: "Rilis Stabil",
    title: "Kalender Tagihan & Kolaborasi Keuangan Keluarga",
    highlights: [
      "Kalender Tagihan (Bills Heatmap): Visualisasi tagihan berulang & peringatan jatuh tempo.",
      "Household Sharing: Pengelolaan keuangan bersama pasangan (suami & istri) dengan Shared Net Worth.",
      "Split Member Spend Tracking: Pemisahan transaksi per anggota dengan privasi terisolasi.",
      "Smart Daily Spend Pulse: Rekomendasi belanja harian aman berbasis sisa hari dalam bulan berjalan.",
    ],
  },
  {
    version: "v2.0.0",
    date: "September 2026",
    status: "Pondasi Arsitektur",
    title: "Peluncuran Mandiri Tumara v2 & AI CFO",
    highlights: [
      "Arsitektur Mandiri: Backend asinkron FastAPI + MongoDB berkecepatan tinggi tanpa ketergantungan proprietary.",
      "Tumara AI Advisor: Konsultasi finansial interaktif berbasis kondisi dompet & cashflow nyata.",
      "PWA Standalone Engine: Instalasi instan di iPhone (iOS Safari) & Android dengan offline caching.",
      "Financial Health Score: Metrik kesehatan finansial 0–100 berbasis 4 pilar fundamental akuntansi.",
    ],
  },
];

export default function About() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [healthStatus, setHealthStatus] = useState({ online: true, version: "v2.2.0", storage: "mongodb" });

  useEffect(() => {
    api.get("/health")
      .then((res) => {
        if (res.data) {
          setHealthStatus({
            online: res.data.status === "ok",
            version: "v2.2.0",
            storage: res.data.storage || "mongodb",
          });
        }
      })
      .catch(() => {
        setHealthStatus({ online: false, version: "v2.2.0", storage: "offline" });
      });
  }, []);

  return (
    <div className="min-h-screen bg-bg text-tprimary flex flex-col">
      {/* Top Navigation */}
      <header className="max-w-6xl mx-auto w-full px-5 py-6 flex items-center justify-between border-b border-borderc/40">
        <Link to="/" className="inline-block">
          <TumaraLogo size={34} withText={true} />
        </Link>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(user ? "/dashboard" : "/")}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft size={14} /> {user ? "Kembali ke Dashboard" : "Beranda"}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-5 py-12 sm:py-16 flex-1 w-full space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-elevated border border-borderc text-xs font-semibold text-brand font-head">
            <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
            <span>Versi {healthStatus.version}</span>
            <span className="text-tmuted">•</span>
            <span className="text-tsecondary">{healthStatus.online ? "Sistem Aktif & Normal" : "Terhubung"}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-head font-extrabold tracking-tight">
            Tumbuh dengan <span className="brand-gradient-text">arah.</span>
          </h1>

          <p className="text-base sm:text-lg text-tsecondary max-w-2xl mx-auto leading-relaxed">
            Tumara diciptakan untuk menyelesaikan satu masalah mendasar: <strong>stres finansial akibat ketidaktahuan ke mana uang mengalir setiap hari.</strong>
          </p>
        </div>

        {/* Brand Story & Philosophy */}
        <Card className="p-6 sm:p-10 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-80 h-80 opacity-10 pointer-events-none rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, var(--brand), transparent 70%)" }}
          />

          <div className="max-w-3xl space-y-6 relative">
            <div className="flex items-center gap-3 text-brand">
              <Sparkles size={22} />
              <h2 className="font-head font-bold text-xl sm:text-2xl text-tprimary">
                Filosofi di Balik Nama & Simbol Tumara
              </h2>
            </div>

            <p className="text-sm sm:text-base text-tsecondary leading-relaxed">
              Nama <strong>Tumara</strong> merupakan paduan dua kata: <em>Tumbuh</em> dan <em>Arah</em>.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-elevated/60 border border-borderc/60 rounded-2xl p-4 sm:p-5">
                <div className="w-10 h-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center font-head font-extrabold text-base mb-3">
                  🌱
                </div>
                <h3 className="font-head font-bold text-base text-tprimary">Tumbuh (Growth)</h3>
                <p className="text-xs sm:text-sm text-tsecondary mt-1.5 leading-relaxed">
                  Menyimpan uang bukan tentang hidup tersiksa dalam penghematan ekstrem, melainkan menumbuhkan aset secara sadar dan berkelanjutan (*sustainable wealth building*).
                </p>
              </div>

              <div className="bg-elevated/60 border border-borderc/60 rounded-2xl p-4 sm:p-5">
                <div className="w-10 h-10 rounded-xl bg-cyan/15 text-cyan flex items-center justify-center font-head font-extrabold text-base mb-3">
                  🧭
                </div>
                <h3 className="font-head font-bold text-base text-tprimary">Arah (Direction)</h3>
                <p className="text-xs sm:text-sm text-tsecondary mt-1.5 leading-relaxed">
                  Data tanpa arah hanyalah angka mati. Tumara AI hadir sebagai kompas cerdas yang memberi tahu tindakan nyata: kapan boleh belanja, kapan harus menahan diri, dan pos mana yang bocor halus.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Guarantees & Privacy Commitment */}
        <div className="space-y-6">
          <div className="text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-brand font-head">
              Standar Integritas & Keamanan
            </span>
            <h2 className="text-2xl sm:text-3xl font-head font-bold text-tprimary mt-1">
              Komitmen Privasi & Kredibilitas
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                <Shield size={20} />
              </div>
              <h3 className="font-head font-bold text-base">Zero-Ads & Bebas Pelacak</h3>
              <p className="text-xs text-tsecondary leading-relaxed">
                Kami tidak memonetisasi perhatian Anda. Aplikasi ini 100% bersih dari banner iklan, pixel Facebook, dan pelacak komersial.
              </p>
            </Card>

            <Card className="p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber/10 text-amber flex items-center justify-center">
                <Lock size={20} />
              </div>
              <h3 className="font-head font-bold text-base">Data Tidak Dijual</h3>
              <p className="text-xs text-tsecondary leading-relaxed">
                Data keuangan adalah rahasia pribadi yang suci. Data Anda tidak pernah dibagikan ke lembaga pembiayaan, pinjol, atau pihak ketiga.
              </p>
            </Card>

            <Card className="p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-cyan/10 text-cyan flex items-center justify-center">
                <Database size={20} />
              </div>
              <h3 className="font-head font-bold text-base">Portabilitas Penuh</h3>
              <p className="text-xs text-tsecondary leading-relaxed">
                Seluruh catatan keuangan Anda adalah hak milik Anda. Unduh kapan saja dalam format CSV atau full JSON backup dengan 1 klik.
              </p>
            </Card>
          </div>
        </div>

        {/* Public Changelog Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand font-head">
                Catatan Pembaruan Sistem
              </span>
              <h2 className="text-2xl sm:text-3xl font-head font-bold text-tprimary mt-1">
                Public Changelog (What&apos;s New)
              </h2>
            </div>
            <div className="text-xs font-mono text-tmuted">
              Production Build: <code>tumara-v2.2-stable</code>
            </div>
          </div>

          <div className="space-y-6">
            {CHANGELOG.map((item, index) => (
              <div
                key={item.version}
                className="bg-surface border border-borderc rounded-2xl p-6 sm:p-7 relative transition-all hover:border-brand/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-head font-bold text-lg text-tprimary">
                      {item.version}
                    </span>
                    <Badge variant={index === 0 ? "brand" : "neutral"} className="text-xs">
                      {item.status}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-tmuted">{item.date}</span>
                </div>

                <h3 className="font-semibold text-base text-tprimary mb-3">
                  {item.title}
                </h3>

                <ul className="space-y-2">
                  {item.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-tsecondary">
                      <CheckCircle2 size={15} className="text-brand shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-surface border border-borderc rounded-3xl p-8 sm:p-10 text-center relative overflow-hidden">
          <h2 className="text-xl sm:text-3xl font-head font-bold text-tprimary">
            Siap mengambil kendali masa depan finansialmu?
          </h2>
          <p className="text-sm text-tsecondary mt-2 max-w-md mx-auto leading-relaxed">
            Bergabunglah bersama ratusan pengguna yang telah mengarahkan keuangannya secara bijak.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(user ? "/dashboard" : "/")}
              className="px-6 py-3"
            >
              {user ? "Masuk ke Dashboard" : "Mulai Gunakan Tumara"} <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full px-5 py-8 border-t border-borderc/40 text-center text-xs text-tmuted">
        Tumara © 2026 — Tumbuh dengan arah. Seluruh hak cipta dilindungi.
      </footer>
    </div>
  );
}
