import React from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Wallet as WalletIcon,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building2,
  Banknote,
  PiggyBank,
  CheckCircle2,
  Info,
} from "lucide-react";
import { formatRp } from "../lib/format";
import { walletMeta } from "../lib/constants";
import { Modal, Button, Card, Badge } from "./ui";

export default function NetWorthDetailModal({
  open,
  onClose,
  netWorth = 0,
  assets = 0,
  debt = 0,
  wallets = [],
  income = 0,
  expense = 0,
  netCashFlow = 0,
  privacy = false,
}) {
  const navigate = useNavigate();

  if (!open) return null;

  const assetWallets = wallets.filter(
    (w) => !["credit_card", "paylater"].includes(w.type)
  );
  const debtWallets = wallets.filter((w) =>
    ["credit_card", "paylater"].includes(w.type)
  );

  const totalAssetSum = assetWallets.reduce(
    (acc, w) => acc + (Number(w.balance) || 0),
    0
  );
  const totalDebtSum = debtWallets.reduce(
    (acc, w) => acc + (Number(w.balance) || 0),
    0
  );
  const calculatedNetWorth = totalAssetSum - totalDebtSum;

  const displayNetWorth = netWorth ?? calculatedNetWorth;
  const displayAssets = assets ?? totalAssetSum;
  const displayDebt = debt ?? totalDebtSum;

  const monthlyNet = netCashFlow ?? (income - expense);
  const isSurplus = monthlyNet >= 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
            <Scale size={18} />
          </div>
          <div>
            <h3 className="font-head font-bold text-sm sm:text-base text-tprimary">
              Kalkulasi & Rincian Total Net Worth
            </h3>
            <p className="text-xs text-tmuted font-normal">
              Neraca kekayaan bersih: Aset riil dikurangi kewajiban/utang
            </p>
          </div>
        </div>
      }
      testid="net-worth-detail-modal"
      size="lg"
    >
      <div className="space-y-5">
        {/* Big Formula Banner */}
        <div className="p-4 rounded-2xl bg-surface border border-borderc">
          <p className="text-xs font-semibold text-tmuted uppercase tracking-wider mb-2">
            Rumus Standar Akuntansi Tumara:
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-elevated/70 border border-borderc">
            {/* Aset */}
            <div className="text-left">
              <span className="text-[11px] font-semibold text-brand flex items-center gap-1">
                <TrendingUp size={13} /> Total Aset
              </span>
              <p
                className={`text-lg sm:text-xl font-bold font-mono text-brand mt-0.5 ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                {formatRp(displayAssets, privacy)}
              </p>
            </div>

            <span className="text-xl font-bold text-tmuted self-center sm:self-auto hidden sm:inline">
              −
            </span>

            {/* Utang */}
            <div className="text-left">
              <span className="text-[11px] font-semibold text-rose flex items-center gap-1">
                <TrendingDown size={13} /> Total Utang
              </span>
              <p
                className={`text-lg sm:text-xl font-bold font-mono text-rose mt-0.5 ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                {formatRp(displayDebt, privacy)}
              </p>
            </div>

            <span className="text-xl font-bold text-tmuted self-center sm:self-auto hidden sm:inline">
              =
            </span>

            {/* Net Worth */}
            <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-borderc/60">
              <span className="text-[11px] font-semibold text-tprimary flex items-center gap-1 sm:justify-end">
                <Scale size={13} className="text-brand" /> Total Net Worth
              </span>
              <p
                className={`text-xl sm:text-2xl font-extrabold font-mono text-tprimary mt-0.5 ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                {formatRp(displayNetWorth, privacy)}
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown Grid: Assets vs Liabilities */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Komponen Aset */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} /> Komponen Aset ({assetWallets.length})
              </h4>
              <span
                className={`text-xs font-mono font-bold text-brand ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                {formatRp(displayAssets, privacy)}
              </span>
            </div>
            <p className="text-[11px] text-tmuted leading-tight">
              Saldo uang riil pada rekening bank, e-wallet, uang tunai, dan portofolio investasi.
            </p>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {assetWallets.length === 0 ? (
                <div className="p-3 rounded-xl bg-elevated/40 border border-borderc text-center text-xs text-tmuted">
                  Belum ada dompet aset.
                </div>
              ) : (
                assetWallets.map((w) => {
                  const meta = walletMeta(w.type);
                  const IconComp = Icons[meta.icon] || WalletIcon;
                  return (
                    <div
                      key={w.id}
                      className="p-2.5 rounded-xl bg-elevated/60 border border-borderc flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${meta.color}20`,
                            color: meta.color,
                          }}
                        >
                          <IconComp size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-tprimary truncate">
                            {w.name}
                          </p>
                          <p className="text-[10px] text-tmuted capitalize">
                            {meta.label}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono font-semibold text-tprimary shrink-0 ${
                          privacy ? "privacy-blur" : ""
                        }`}
                      >
                        {formatRp(w.balance, privacy)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Komponen Utang */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-rose uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown size={14} /> Komponen Utang ({debtWallets.length})
              </h4>
              <span
                className={`text-xs font-mono font-bold text-rose ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                {formatRp(displayDebt, privacy)}
              </span>
            </div>
            <p className="text-[11px] text-tmuted leading-tight">
              Tagihan berjalan pada kartu kredit, paylater, atau pinjaman yang belum dilunasi.
            </p>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {debtWallets.length === 0 ? (
                <div className="p-3 rounded-xl bg-elevated/40 border border-borderc text-center text-xs text-tmuted flex flex-col items-center justify-center gap-1">
                  <CheckCircle2 size={16} className="text-brand" />
                  <span>Hebat! Tidak ada utang kartu kredit / paylater tercatat.</span>
                </div>
              ) : (
                debtWallets.map((w) => {
                  const meta = walletMeta(w.type);
                  const IconComp = Icons[meta.icon] || CreditCard;
                  return (
                    <div
                      key={w.id}
                      className="p-2.5 rounded-xl bg-elevated/60 border border-borderc flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${meta.color}20`,
                            color: meta.color,
                          }}
                        >
                          <IconComp size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-tprimary truncate">
                            {w.name}
                          </p>
                          <p className="text-[10px] text-rose font-medium capitalize">
                            Tagihan Aktif
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-mono font-bold text-rose ${
                            privacy ? "privacy-blur" : ""
                          }`}
                        >
                          {formatRp(w.balance, privacy)}
                        </span>
                        {w.credit_limit && (
                          <p className="text-[9px] text-tmuted font-mono">
                            Limit: {formatRp(w.credit_limit, privacy)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Education: Net Worth vs Arus Kas Bersih Bulanan */}
        <div className="p-4 rounded-2xl bg-elevated/60 border border-borderc space-y-3">
          <div className="flex items-start gap-2.5">
            <Info size={17} className="text-brand shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs">
              <h5 className="font-semibold text-tprimary">
                Penting: Perbedaan &quot;Total Net Worth&quot; vs &quot;Arus Bersih (Net)&quot;
              </h5>
              <div className="space-y-2 text-tsecondary text-[11px] leading-relaxed">
                <div className="p-2.5 rounded-xl bg-surface border border-borderc">
                  <strong className="text-tprimary block mb-0.5">
                    1. Total Net Worth ({formatRp(displayNetWorth, privacy)}) = Posisi Neraca Riil
                  </strong>
                  Total kepemilikan seluruh aset akumulatifmu setelah dikurangi seluruh utang berjalan. Nilai ini adalah cerminan kekayaan bersihmu saat ini.
                </div>
                <div className="p-2.5 rounded-xl bg-surface border border-borderc">
                  <strong className="text-tprimary block mb-0.5">
                    2. Arus Bersih Bulan Ini ({isSurplus ? "+" : ""}{formatRp(monthlyNet, privacy)}) = Cash Flow Bulanan
                  </strong>
                  Dihitung dari:{" "}
                  <code className="text-tprimary font-mono font-medium">
                    Pemasukan Bulan Ini ({formatRp(income, privacy)}) − Pengeluaran Bulan Ini ({formatRp(expense, privacy)})
                  </code>
                  . Bila bernilai minus ({isSurplus ? "Surplus" : "Defisit"}), artinya belanja bulan ini melampaui pemasukan bulan ini, namun saldo dompet/asetmu tetap menjaga Total Net Worth-mu di angka positif selama tabunganmu mencukupi.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-borderc">
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              navigate("/wallets");
            }}
            className="flex-1"
          >
            <WalletIcon size={15} /> Buka & Kelola Saldo Dompet
          </Button>
          <Button onClick={onClose} className="flex-1">
            Mengerti & Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
}
