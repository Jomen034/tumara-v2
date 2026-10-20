import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, CheckCircle2, ArrowRight, ShieldCheck, Zap, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Modal, Button, Input, Progress, Spinner } from "./ui";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function AiQuotaModal({ open, onClose, quotaData, onRedeemed }) {
  const { user, checkAuth } = useAuth();
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const scansUsed = quotaData?.scans_used || 0;
  const scansLimit = quotaData?.scans_limit || 50;
  const chatsUsed = quotaData?.chats_used || 0;
  const chatsLimit = quotaData?.chats_limit || 100;
  const resetDate = quotaData?.reset_date || "1 bulan depan";
  const tier = (quotaData?.tier || user?.tier || "pro").toUpperCase();

  const scanPct = Math.min(100, Math.round((scansUsed / Math.max(1, scansLimit)) * 100));

  const handleBuyOrContact = () => {
    const email = user?.email || "";
    const text = encodeURIComponent(
      `Halo Admin Tumara, saya ingin tambah kuota AI / upgrade lisensi untuk akun Tumara saya:\nEmail: ${email}\nPaket saat ini: ${tier}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Masukkan kode lisensi atau voucher");
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
    <Modal open={open} onClose={onClose} title="Status & Tambah Kuota AI">
      <div className="space-y-5">
        {/* Header callout */}
        <div className="bg-amber/10 border border-amber/30 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber/20 text-amber flex items-center justify-center shrink-0 mt-0.5">
            <Zap size={20} />
          </div>
          <div>
            <h4 className="font-head font-bold text-sm text-tprimary">
              Fair Usage Policy (FUP) Bulanan
            </h4>
            <p className="text-xs text-tsecondary mt-1 leading-relaxed">
              Kuota standarmu akan <strong>otomatis terisi kembali 100% pada {resetDate}</strong>. Pencatatan manual dan pengelolaan dompet tetap 100% gratis tanpa batas.
            </p>
          </div>
        </div>

        {/* Quota Progress */}
        <div className="bg-elevated/60 border border-borderc/60 rounded-2xl p-4 space-y-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-tprimary flex items-center gap-1.5">
              <Sparkles size={14} className="text-brand" /> Scan Struk AI
            </span>
            <span className="font-mono font-bold text-tsecondary">
              {scansUsed} / {scansLimit} scan ({scanPct}%)
            </span>
          </div>
          <Progress value={scanPct} color={scanPct >= 90 ? "var(--rose)" : "var(--brand)"} />

          <div className="flex items-center justify-between text-xs pt-1 border-t border-borderc/40">
            <span className="text-tsecondary">Tanya Tumara AI:</span>
            <span className="font-mono font-medium text-tsecondary">
              {chatsUsed} / {chatsLimit} pesan
            </span>
          </div>
        </div>

        {/* Action button */}
        <div className="space-y-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={handleBuyOrContact}
            className="w-full py-3.5 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-[var(--glow)]"
          >
            <Sparkles size={16} /> Tambah Kuota Instan (+50 Scan) <ArrowRight size={15} />
          </Button>

          <p className="text-center text-[11px] text-tmuted">
            Aktivasi instan via WhatsApp / Toko Digital Resmi Tumara
          </p>
        </div>

        {/* Collapsible Redeem Code section */}
        <div className="pt-2 border-t border-borderc/60">
          {!showCodeInput ? (
            <button
              type="button"
              onClick={() => setShowCodeInput(true)}
              className="w-full text-center text-xs text-tsecondary hover:text-brand transition-colors py-1 cursor-pointer"
            >
              Sudah melakukan pembayaran? <span className="underline font-semibold text-brand">Klik di sini untuk aktivasi kode</span>
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
                  <KeyRound size={14} className="text-brand" /> Aktivasi Kode Lisensi
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
                placeholder="Contoh: TUMARA-PRO-XXXX"
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
                {submitting ? <Spinner size={14} /> : "Aktifkan Sekarang"}
              </Button>
            </motion.form>
          )}
        </div>
      </div>
    </Modal>
  );
}
