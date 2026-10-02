import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp } from "../lib/format";
import { WALLET_TYPES, WALLET_PRESETS, walletMeta } from "../lib/constants";
import {
  Card,
  Button,
  Modal,
  Input,
  Select,
  Badge,
  Spinner,
  EmptyState,
  Progress,
} from "../components/ui";
import WalletDetailModal from "../components/WalletDetailModal";

export default function Wallets() {
  const { privacy } = useTheme();
  const { bump } = useRefresh();
  const outletCtx = useOutletContext();
  const openAdd = outletCtx?.openAdd;

  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [form, setForm] = useState({
    name: "",
    type: "bank",
    balance: "",
    credit_limit: "",
    color: "#00E676",
  });

  const load = () =>
    api
      .get("/wallets")
      .then((r) => setWallets(r.data))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  // Sync selectedWallet if wallets list refreshed
  useEffect(() => {
    if (selectedWallet) {
      const updated = wallets.find((w) => w.id === selectedWallet.id);
      if (updated) setSelectedWallet(updated);
    }
  }, [wallets]);

  const openNew = (preset) => {
    setEditing(null);
    const t = preset?.type || "bank";
    setForm({
      name: preset?.name || "",
      type: t,
      balance: "",
      credit_limit: "",
      color: walletMeta(t).color,
    });
    setOpen(true);
  };

  const openEdit = (w) => {
    setEditing(w);
    setForm({
      name: w.name,
      type: w.type,
      balance: String(w.balance ?? ""),
      credit_limit: w.credit_limit != null ? String(w.credit_limit) : "",
      color: w.color,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama dompet wajib diisi");
    const isDebt = ["credit_card", "paylater"].includes(form.type);
    const parsedLimit = parseFloat(form.credit_limit);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      credit_limit: isDebt && !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : null,
      color: form.color,
      icon: walletMeta(form.type).icon,
    };
    try {
      if (editing) await api.put(`/wallets/${editing.id}`, payload);
      else await api.post("/wallets", payload);
      toast.success(editing ? "Dompet diperbarui" : "Dompet ditambahkan");
      setOpen(false);
      load();
      bump();
    } catch {
      toast.error("Gagal menyimpan");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus dompet ini?")) return;
    try {
      await api.delete(`/wallets/${id}`);
      toast.success("Dompet dihapus");
      if (selectedWallet?.id === id) setSelectedWallet(null);
      load();
      bump();
    } catch {
      toast.error("Gagal menghapus dompet");
    }
  };

  const totalAssets = wallets
    .filter((w) => !["credit_card", "paylater"].includes(w.type))
    .reduce((a, w) => a + w.balance, 0);
  const totalDebt = wallets
    .filter((w) => ["credit_card", "paylater"].includes(w.type))
    .reduce((a, w) => a + w.balance, 0);
  const debtWalletsWithLimit = wallets.filter(
    (w) => ["credit_card", "paylater"].includes(w.type) && (w.credit_limit || 0) > 0
  );
  const totalAvailableCredit = debtWalletsWithLimit.reduce(
    (a, w) => a + Math.max(0, (w.credit_limit || 0) - w.balance),
    0
  );

  const isDebtForm = ["credit_card", "paylater"].includes(form.type);
  const curLimit = parseFloat(form.credit_limit) || 0;
  const curUsed = parseFloat(form.balance) || 0;
  const curAvail = Math.max(0, curLimit - curUsed);
  const curUtilPct =
    curLimit > 0 ? Math.min(100, Math.round((curUsed / curLimit) * 100)) : 0;
  const isOverlimit = curLimit > 0 && curUsed > curLimit;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Dompet</h1>
          <p className="text-tsecondary text-sm mt-1">Kelola semua akun, limit & saldomu.</p>
        </div>
        <Button data-testid="add-wallet-button" onClick={() => openNew()}>
          <Plus size={16} /> Dompet
        </Button>
      </div>

      {/* Liquidity Summary Hero Strip */}
      <div className="rounded-2xl sm:rounded-3xl bg-surface/90 border border-borderc/80 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-borderc/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <h2 className="text-xs font-bold text-tmuted uppercase tracking-wider">
              Ringkasan Likuiditas Finansial
            </h2>
          </div>
          {debtWalletsWithLimit.length > 0 && (
            <span className="text-[11px] text-tmuted hidden sm:inline">
              Sisa Plafon Kredit:{" "}
              <strong className={`text-cyan font-mono font-semibold ${privacy ? "privacy-blur" : ""}`}>
                {formatRp(totalAvailableCredit, privacy)}
              </strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-borderc/40">
          {/* Total Aset */}
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-tmuted font-medium flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" /> Total Aset Kas
            </p>
            <p
              className={`text-lg sm:text-2xl font-head font-bold font-mono text-brand mt-1 truncate ${
                privacy ? "privacy-blur" : ""
              }`}
            >
              {formatRp(totalAssets, privacy)}
            </p>
            <span className="text-[10px] text-tmuted block mt-0.5 truncate">
              Rekening bank, e-wallet & tunai
            </span>
          </div>

          {/* Total Utang */}
          <div className="min-w-0 pt-3 sm:pt-0 sm:pl-6">
            <p className="text-[11px] sm:text-xs text-tmuted font-medium flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-rose shrink-0" /> Total Tagihan & Utang
            </p>
            <p
              className={`text-lg sm:text-2xl font-head font-bold font-mono text-rose mt-1 truncate ${
                privacy ? "privacy-blur" : ""
              }`}
            >
              {formatRp(totalDebt, privacy)}
            </p>
            <span className="text-[10px] text-tmuted block mt-0.5 truncate">
              {debtWalletsWithLimit.length > 0
                ? `Sisa Plafon: ${formatRp(totalAvailableCredit, privacy)}`
                : "Kartu kredit & paylater"}
            </span>
          </div>

          {/* Net Kas Likuid (Aset - Utang) */}
          <div className="col-span-2 sm:col-span-1 min-w-0 pt-3 sm:pt-0 sm:pl-6">
            <p className="text-[11px] sm:text-xs text-tmuted font-medium flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" /> Kas Bersih Likuid
            </p>
            <p
              className={`text-lg sm:text-2xl font-head font-bold font-mono text-tprimary mt-1 truncate ${
                privacy ? "privacy-blur" : ""
              }`}
            >
              {formatRp(totalAssets - totalDebt, privacy)}
            </p>
            <span className="text-[10px] text-tmuted block mt-0.5 truncate">
              Aset likuid dikurangi utang berjalan
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Header for Wallet Cards */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold font-head text-tprimary">
            Daftar Rekening & Dompet ({wallets.length})
          </h2>
          <p className="text-xs text-tmuted">
            Pilih dompet untuk melihat detail mutasi & riwayat transaksi.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-brand" size={28} />
        </div>
      ) : wallets.length === 0 ? (
        <Card>
          <EmptyState
            icon={Icons.Wallet}
            title="Belum ada dompet"
            subtitle="Tambah cepat dari pilihan populer:"
          />
          <div className="flex flex-wrap gap-2 justify-center pb-4">
            {WALLET_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => openNew(p)}
                data-testid={`preset-${p.name.toLowerCase().replace(/\s/g, "-")}`}
                className="px-3.5 py-2 rounded-full bg-elevated text-sm font-medium hover:bg-borderc transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {wallets.map((w, i) => {
            const m = walletMeta(w.type);
            const Ic = Icons[m.icon] || Icons.Wallet;
            const isDebt = ["credit_card", "paylater"].includes(w.type);
            const hasLimit = isDebt && (w.credit_limit || 0) > 0;
            const sisaLimit = hasLimit ? Math.max(0, w.credit_limit - w.balance) : 0;
            const utilPct = hasLimit
              ? Math.min(100, Math.round((w.balance / w.credit_limit) * 100))
              : 0;
            const utilColor =
              utilPct > 70
                ? "var(--rose)"
                : utilPct > 30
                ? "#F59E0B"
                : "var(--brand)";

            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card
                  hover
                  onClick={() => setSelectedWallet(w)}
                  className="p-4 sm:p-5 flex flex-col justify-between gap-3.5 cursor-pointer hover:border-brand/50 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${w.color}22` }}
                      >
                        <Ic size={22} style={{ color: w.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-base truncate text-tprimary group-hover:text-brand transition-colors">
                          {w.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge color={m.color}>{m.label}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(w);
                        }}
                        data-testid={`edit-wallet-${w.id}`}
                        className="p-2 rounded-lg hover:bg-elevated text-tsecondary hover:text-tprimary transition-colors"
                        title="Edit Dompet"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          del(w.id);
                        }}
                        data-testid={`delete-wallet-${w.id}`}
                        className="p-2 rounded-lg hover:bg-elevated text-tmuted hover:text-rose transition-colors"
                        title="Hapus Dompet"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {isDebt ? (
                    <div className="space-y-2 pt-2 border-t border-borderc/40">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider block">
                            Tagihan Terpakai
                          </span>
                          <p
                            className={`font-mono font-bold text-lg sm:text-xl text-rose ${
                              privacy ? "privacy-blur" : ""
                            }`}
                          >
                            {formatRp(w.balance, privacy)}
                          </p>
                        </div>
                        {hasLimit && (
                          <div className="text-right">
                            <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider block">
                              Sisa Limit
                            </span>
                            <p
                              className={`font-mono font-bold text-sm sm:text-base text-cyan ${
                                privacy ? "privacy-blur" : ""
                              }`}
                            >
                              {formatRp(sisaLimit, privacy)}
                            </p>
                          </div>
                        )}
                      </div>

                      {hasLimit ? (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center text-[11px] text-tmuted font-mono">
                            <span>
                              Utilisasi:{" "}
                              <span className="font-bold" style={{ color: utilColor }}>
                                {utilPct}%
                              </span>
                            </span>
                            <span>Plafon {formatRp(w.credit_limit, privacy)}</span>
                          </div>
                          <Progress
                            value={utilPct}
                            color={utilColor}
                            className="h-1.5"
                          />
                        </div>
                      ) : (
                        <div className="pt-1 flex items-center justify-between text-[11px] text-tmuted">
                          <span>Limit plafon belum ditentukan</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(w);
                            }}
                            className="text-brand hover:underline font-medium"
                          >
                            + Atur limit
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-borderc/40">
                      <span className="text-[11px] text-tmuted uppercase font-semibold tracking-wider block">
                        Saldo Saat Ini
                      </span>
                      <p
                        className={`font-mono font-bold text-lg sm:text-xl text-tprimary ${
                          privacy ? "privacy-blur" : ""
                        }`}
                      >
                        {formatRp(w.balance, privacy)}
                      </p>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit / Add Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Dompet" : "Tambah Dompet"}
        testid="wallet-modal"
      >
        <div className="space-y-4">
          <Input
            label="Nama Dompet"
            placeholder="cth. BCA, Kartu Kredit BCA, SPayLater"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-testid="wallet-name-input"
          />

          <Select
            label="Jenis"
            value={form.type}
            onChange={(e) =>
              setForm({
                ...form,
                type: e.target.value,
                color: walletMeta(e.target.value).color,
              })
            }
            data-testid="wallet-type-select"
          >
            {WALLET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>

          {isDebtForm ? (
            <>
              <Input
                label="Plafon / Limit Kredit (Rp)"
                prefix="Rp"
                type="number"
                placeholder="cth. 10000000"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                data-testid="wallet-limit-input"
              />

              <Input
                label="Tagihan Terpakai Saat Ini (Rp)"
                prefix="Rp"
                type="number"
                placeholder="0"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
                data-testid="wallet-balance-input"
              />

              <div className="rounded-xl p-3.5 bg-surface border border-borderc space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-tmuted font-medium">Kalkulasi Otomatis Plafon</span>
                  {curLimit > 0 && (
                    <Badge
                      color={
                        curUtilPct > 70
                          ? "var(--rose)"
                          : curUtilPct > 30
                          ? "#F59E0B"
                          : "var(--brand)"
                      }
                    >
                      {curUtilPct > 70
                        ? "Utilisasi Tinggi (>70%)"
                        : curUtilPct > 30
                        ? "Utilisasi Waspada (30-70%)"
                        : "Utilisasi Sehat (<30%)"}
                    </Badge>
                  )}
                </div>

                {curLimit > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-elevated/60 rounded-lg p-2">
                        <span className="text-tmuted text-[10px] uppercase font-semibold block">
                          Sisa Limit
                        </span>
                        <span className="font-mono font-bold text-sm text-cyan">
                          {formatRp(curAvail)}
                        </span>
                      </div>
                      <div className="bg-elevated/60 rounded-lg p-2">
                        <span className="text-tmuted text-[10px] uppercase font-semibold block">
                          Rasio Terpakai
                        </span>
                        <span className="font-mono font-bold text-sm">
                          {curUtilPct}%
                        </span>
                      </div>
                    </div>

                    <Progress
                      value={curUtilPct}
                      color={
                        curUtilPct > 70
                          ? "var(--rose)"
                          : curUtilPct > 30
                          ? "#F59E0B"
                          : "var(--brand)"
                      }
                      className="h-1.5"
                    />

                    {isOverlimit && (
                      <p className="text-[11px] text-rose font-medium">
                        ⚠️ Tagihan terpakai melebihi plafon limit kredit (overlimit).
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-tmuted">
                    💡 Masukkan limit untuk menghitung sisa plafon dan rasio beban kredit secara otomatis.
                  </p>
                )}
              </div>
            </>
          ) : (
            <Input
              label="Saldo Awal (Rp)"
              prefix="Rp"
              type="number"
              placeholder="0"
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
              data-testid="wallet-balance-input"
            />
          )}

          <Button
            onClick={save}
            className="w-full"
            size="lg"
            data-testid="wallet-save-button"
          >
            {editing ? "Simpan Perubahan" : "Tambah Dompet"}
          </Button>
        </div>
      </Modal>

      {/* Interactive Wallet Detail Modal */}
      <WalletDetailModal
        wallet={selectedWallet}
        open={!!selectedWallet}
        onClose={() => setSelectedWallet(null)}
        onEdit={(w) => openEdit(w)}
        onAddTransaction={(w) => {
          if (openAdd) openAdd("manual");
        }}
      />
    </div>
  );
}
