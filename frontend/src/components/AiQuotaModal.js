import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  KeyRound,
  Users,
  ChevronRight,
  PlusCircle,
  HelpCircle,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { Modal, Button, Input, Progress, Spinner, Badge } from "./ui";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const BOOSTER_PACKS = [
  {
    id: "mini",
    name: "Booster Mini",
    price: "Rp 10.000",
    scans: 15,
    chats: 20,
    desc: "Solusi darurat akhir bulan",
    badge: null,
  },
  {
    id: "populer",
    name: "Booster Populer",
    price: "Rp 20.000",
    scans: 40,
    chats: 60,
    desc: "Paling hemat & paling laris",
    badge: "Best Value",
  },
  {
    id: "jumbo",
    name: "Booster Jumbo",
    price: "Rp 40.000",
    scans: 100,
    chats: 150,
    desc: "Untuk yang sering belanja / UMKM",
    badge: "Paling Banyak",
  },
];

export default function AiQuotaModal({ open, onClose, quotaData, onRedeemed }) {
  const { user, checkAuth } = useAuth();
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("booster"); // "booster" | "upgrade"

  if (!open) return null;

  const currentTier = (quotaData?.tier || user?.tier || "starter").toLowerCase();
  const scansUsed = quotaData?.scans_used || 0;
  const scansLimit = quotaData?.scans_limit || (currentTier === "starter" ? 3 : currentTier === "family" ? 120 : 50);
  const chatsUsed = quotaData?.chats_used || 0;
  const chatsLimit = quotaData?.chats_limit || (currentTier === "starter" ? 5 : currentTier === "family" ? 250 : 100);
  const extraScans = quotaData?.extra_scans || 0;
  const extraChats = quotaData?.extra_chats || 0;
  const resetDate = quotaData?.reset_date || "1 bulan depan";

  const scanPct = Math.min(100, Math.round((scansUsed / Math.max(1, scansLimit)) * 100));

  const handleBuyBooster = (pack) => {
    const email = user?.email || "";
    const text = encodeURIComponent(
      `Halo Admin Tumara, saya ingin membeli Kuota ${pack.name} (${pack.price} dapat +${pack.scans} Scan & +${pack.chats} Teks AI):\nEmail Akun: ${email}\nPaket Akun Saat Ini: ${currentTier.toUpperCase()}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleUpgradeTier = (targetTier, diffPrice) => {
    const email = user?.email || "";
    const text = encodeURIComponent(
      `Halo Admin Tumara, saya ingin UPGRADE Akun Tumara saya dari ${currentTier.toUpperCase()} ke ${targetTier.toUpperCase()} (Cukup bayar selisih ${diffPrice}):\nEmail Akun: ${email}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Masukkan kode lisensi atau voucher booster");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/auth/redeem-code", { code: code.trim() });
      toast.success(res.data?.message || "Kode aktivasi berhasil!");
      if (checkAuth) await checkAuth();
      if (onRedeemed) onRedeemed(res.data);
      setCode("");
      setShowCodeInput(false);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mengaktifkan kode lisensi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Status Kuota & Tambah Akses AI">
      <div className="space-y-4">
        {/* Tier badge & FUP explanation */}
        <div className="bg-amber/10 border border-amber/30 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber/20 text-amber flex items-center justify-center shrink-0 mt-0.5">
            <Zap size={20} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-head font-bold text-sm text-tprimary">
                Fair Usage Policy (FUP) Bulanan
              </h4>
              <Badge variant="brand" className="text-[10px] uppercase font-mono">
                Paket {currentTier}
              </Badge>
            </div>
            <p className="text-xs text-tsecondary mt-1 leading-relaxed">
              Kuota bulananmu otomatis di-reset ke 100% pada <strong>{resetDate}</strong>. Pencatatan manual dan kalkulasi dompet <strong>selamanya 100% gratis tanpa kuota</strong>.
            </p>
          </div>
        </div>

        {/* Quota Progress */}
        <div className="bg-elevated/60 border border-borderc/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-tprimary flex items-center gap-1.5">
              <Sparkles size={14} className="text-brand" /> Scan Struk AI
            </span>
            <span className="font-mono font-bold text-tsecondary">
              {scansUsed} / {scansLimit} scan ({scanPct}%)
            </span>
          </div>
          <Progress value={scanPct} color={scanPct >= 90 ? "var(--rose)" : "var(--brand)"} />

          <div className="flex items-center justify-between text-xs pt-1 border-t border-borderc/40 text-tsecondary">
            <span>Tanya CFO & Teks Cerdas AI:</span>
            <span className="font-mono font-medium">
              {chatsUsed} / {chatsLimit} pesan
            </span>
          </div>

          {/* Extra Booster Balance if any */}
          {(extraScans > 0 || extraChats > 0) && (
            <div className="pt-2 border-t border-borderc/40 flex items-center justify-between text-xs text-brand font-medium">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={13} /> Saldo Booster Cadangan (Aktif Selamanya):
              </span>
              <span className="font-mono font-bold">
                +{extraScans} Scan · +{extraChats} Teks
              </span>
            </div>
          )}
        </div>

        {/* Tab Selection: Beli Booster Instan vs Upgrade Paket */}
        <div className="flex rounded-xl bg-elevated/80 p-1 border border-borderc/60 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("booster")}
            className={clsx(
              "flex-1 py-2 font-semibold rounded-lg transition-all text-center cursor-pointer",
              activeTab === "booster"
                ? "bg-surface text-tprimary shadow-sm border border-borderc"
                : "text-tsecondary hover:text-tprimary"
            )}
          >
            ⚡ Tambah Kuota Booster (Aktif Selamanya)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upgrade")}
            className={clsx(
              "flex-1 py-2 font-semibold rounded-lg transition-all text-center cursor-pointer",
              activeTab === "upgrade"
                ? "bg-surface text-brand shadow-sm border border-brand/40"
                : "text-tsecondary hover:text-tprimary"
            )}
          >
            💎 Upgrade Paket (Bayar Selisih)
          </button>
        </div>

        {/* Tab Content: Booster Instan */}
        {activeTab === "booster" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-tmuted px-1">
              <span>Pilihan Booster Kuota (Tidak ada masa kedaluwarsa):</span>
              <span className="text-brand font-semibold">Aktif Selamanya</span>
            </div>

            <div className="grid gap-2">
              {BOOSTER_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  onClick={() => handleBuyBooster(pack)}
                  className="group bg-surface/70 hover:bg-surface border border-borderc hover:border-brand/60 rounded-2xl p-3.5 flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-head font-bold text-sm text-tprimary group-hover:text-brand transition-colors">
                        {pack.name}
                      </span>
                      {pack.badge && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-brand/15 text-brand px-2 py-0.5 rounded-full font-head">
                          {pack.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-tsecondary">
                      +{pack.scans} Scan Struk AI & +{pack.chats} Teks/Chat AI
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-tprimary block">
                      {pack.price}
                    </span>
                    <span className="text-[11px] text-brand font-semibold flex items-center gap-1 justify-end mt-0.5">
                      Beli <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-[11px] text-tmuted pt-1">
              Pembayaran instan via QRIS / WhatsApp. Saldo booster langsung aktif dan tidak pernah hangus.
            </p>
          </div>
        )}

        {/* Tab Content: Upgrade Tier (Cukup Bayar Selisih) */}
        {activeTab === "upgrade" && (
          <div className="space-y-3">
            {currentTier === "starter" && (
              <div className="bg-surface border-2 border-brand/50 rounded-2xl p-4 space-y-3 shadow-md shadow-[var(--glow)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-brand" />
                    <h5 className="font-head font-bold text-sm text-tprimary">
                      Upgrade ke Paket Pro Tumara AI
                    </h5>
                  </div>
                  <Badge variant="brand">Cukup Bayar Selisih</Badge>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-extrabold text-tprimary">Rp 50.000</span>
                  <span className="text-xs text-tsecondary line-through">Rp 99.000</span>
                  <span className="text-xs text-brand font-semibold">hemat Rp 49.000!</span>
                </div>

                <ul className="text-xs text-tsecondary space-y-1.5 pt-1 border-t border-borderc/40">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-brand" /> 50 Scan Struk AI & 100 Teks AI tiap bulan selamanya
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-brand" /> Konsultasi Finansial Aktif Tumara AI CFO
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-brand" /> Weekly AI Financial Health Recap otomatis
                  </li>
                </ul>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleUpgradeTier("pro", "Rp 50.000")}
                  className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={14} /> Upgrade ke Pro Sekarang (Rp 50.000)
                </Button>
              </div>
            )}

            {(currentTier === "pro" || currentTier === "starter") && (
              <div className="bg-surface border border-borderc hover:border-brand/40 rounded-2xl p-4 space-y-3 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-brand" />
                    <h5 className="font-head font-bold text-sm text-tprimary">
                      Upgrade ke Family Partner (Suami & Istri)
                    </h5>
                  </div>
                  <Badge variant="neutral">
                    {currentTier === "pro" ? "Selisih Rp 70.000" : "Selisih Rp 120.000"}
                  </Badge>
                </div>

                <p className="text-xs text-tsecondary leading-relaxed">
                  Buka fitur kolaborasi rumah tangga: 2–3 akun mandiri, Shared Net Worth, dan kuota 120 Scan Struk / bulan.
                </p>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleUpgradeTier(
                      "family",
                      currentTier === "pro" ? "Rp 70.000" : "Rp 120.000"
                    )
                  }
                  className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Users size={14} /> Upgrade ke Family Partner
                </Button>
              </div>
            )}

            {currentTier === "family" && (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 size={32} className="text-brand mx-auto" />
                <h5 className="font-head font-bold text-sm text-tprimary">
                  Akunmu Sudah di Paket Tertinggi (Family Partner)
                </h5>
                <p className="text-xs text-tsecondary max-w-sm mx-auto">
                  Kamu telah menikmati semua fitur kolaborasi dan kuota maksimal. Jika butuh tambahan scan struk segera, kamu bisa memilih Booster Instan di tab sebelah.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Redeem Code section */}
        <div className="pt-2 border-t border-borderc/60">
          {!showCodeInput ? (
            <button
              type="button"
              onClick={() => setShowCodeInput(true)}
              className="w-full text-center text-xs text-tsecondary hover:text-brand transition-colors py-1 cursor-pointer"
            >
              Sudah memiliki voucher atau kode lisensi?{" "}
              <span className="underline font-semibold text-brand">Aktivasi di sini</span>
            </button>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleRedeem}
              className="space-y-3 bg-surface border border-borderc rounded-2xl p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-tprimary flex items-center gap-1.5 font-head">
                  <KeyRound size={14} className="text-brand" /> Aktivasi Kode Lisensi / Voucher Booster
                </span>
                <button
                  type="button"
                  onClick={() => setShowCodeInput(false)}
                  className="text-xs text-tmuted hover:text-tprimary"
                >
                  Batal
                </button>
              </div>

              <Input
                placeholder="Contoh: TUMARA-PRO-XXXX / BOOST-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoFocus
                className="font-mono uppercase tracking-wider text-xs"
              />

              <Button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-xs font-semibold"
              >
                {submitting ? <Spinner size={14} /> : "Aktifkan Kode Sekarang"}
              </Button>
            </motion.form>
          )}
        </div>
      </div>
    </Modal>
  );
}
