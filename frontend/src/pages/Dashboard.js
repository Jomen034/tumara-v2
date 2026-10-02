import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import {
  TrendingUp,
  TrendingDown,
  ScanLine,
  Plus,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Wand2,
  RefreshCw,
  CheckCircle2,
  Flame,
  Compass,
  Scale,
  Target,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatShort } from "../lib/format";
import { catMeta, walletMeta } from "../lib/constants";
import { Card, Progress, Badge, Spinner, EmptyState, Button } from "../components/ui";
import FinancialHealthModal from "../components/FinancialHealthModal";
import TransactionDetailModal from "../components/TransactionDetailModal";
import EditTransactionModal from "../components/EditTransactionModal";

function HealthGauge({ score }) {
  const r = 52, c = 2 * Math.PI * r;
  const color = score >= 70 ? "var(--brand)" : score >= 40 ? "var(--amber)" : "var(--rose)";
  const label = score >= 70 ? "Sehat" : score >= 40 ? "Cukup" : "Waspada";
  return (
    <div className="relative w-32 h-32">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--elevated)" strokeWidth="10" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (score / 100) * c }} transition={{ duration: 1, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-head font-extrabold font-mono">{score}</span>
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { openAdd, openScan } = useOutletContext();
  const { privacy } = useTheme();
  const { version, bump } = useRefresh();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const [payingBillId, setPayingBillId] = useState(null);
  const navigate = useNavigate();

  const handleHealthAction = (rec) => {
    setHealthModalOpen(false);
    if (rec.target === "open_add_income") {
      openAdd("manual");
    } else if (rec.target) {
      navigate(rec.target);
    }
  };

  const handlePayBill = async (b) => {
    if (payingBillId) return;
    setPayingBillId(b.id);
    try {
      const res = await api.post(`/bills/${b.id}/pay`);
      if (res.data.is_completed) {
        toast.success(`🎉 Selamat! "${b.name}" telah lunas sepenuhnya!`);
      } else {
        toast.success(`Tagihan "${b.name}" berhasil dibayar!`);
      }
      fetchDashboard();
      bump();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mencatat pembayaran");
    } finally {
      setPayingBillId(null);
    }
  };

  const handleDeleteTxn = async (id) => {
    if (!window.confirm("Hapus transaksi ini?")) return;
    try {
      await api.delete(`/transactions/${id}`);
      toast.success("Transaksi dihapus");
      if (selectedTxn?.id === id) setSelectedTxn(null);
      fetchDashboard();
      bump();
    } catch {
      toast.error("Gagal menghapus transaksi");
    }
  };

  const [error, setError] = useState(false);

  const fetchDashboard = () => {
    setLoading(true);
    setError(false);
    api.get("/dashboard")
      .then((r) => { setData(r.data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [version]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={30} className="text-brand" /></div>;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertTriangle size={36} className="text-amber" />
        <h2 className="font-head font-bold text-lg">Gagal memuat data beranda</h2>
        <p className="text-sm text-tsecondary max-w-sm">Terjadi kendala koneksi atau sesi. Silakan coba muat ulang.</p>
        <Button onClick={fetchDashboard}>Coba Lagi</Button>
      </div>
    );
  }

  const empty = data.wallet_count === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-head font-extrabold tracking-tight">Beranda</h1>
        <p className="text-tsecondary text-sm mt-1">Ringkasan keuanganmu bulan ini.</p>
      </div>

      {empty && (
        <Card data-testid="onboarding-card" className="border-brand/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <h3 className="font-head font-bold text-lg">Ayo mulai! 🚀</h3>
              <p className="text-sm text-tsecondary mt-1">Tambahkan dompet pertamamu untuk melihat net worth & mulai tracking.</p>
            </div>
            <Button onClick={() => navigate("/wallets")} data-testid="onboarding-add-wallet">Tambah Dompet <ArrowRight size={16} /></Button>
          </div>
        </Card>
      )}

      {/* Net worth + health */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card data-testid="net-worth-card" className="lg:col-span-2 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-10 blur-2xl" style={{ background: "var(--brand)" }} />
          <p className="text-xs font-semibold text-tmuted uppercase tracking-wider">Total Net Worth</p>
          <p className={`text-4xl sm:text-5xl font-head font-extrabold font-mono mt-2 ${privacy ? "privacy-blur" : ""}`}>
            {formatRp(data.net_worth, privacy)}
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-6">
            <div>
              <p className="text-xs text-tmuted font-semibold flex items-center gap-1"><TrendingUp size={13} className="text-brand" /> Aset</p>
              <p className={`font-mono font-semibold text-brand ${privacy ? "privacy-blur" : ""}`}>{formatRp(data.assets, privacy)}</p>
            </div>
            <div>
              <p className="text-xs text-tmuted font-semibold flex items-center gap-1"><TrendingDown size={13} className="text-rose" /> Utang</p>
              <p className={`font-mono font-semibold text-rose ${privacy ? "privacy-blur" : ""}`}>{formatRp(data.debt, privacy)}</p>
            </div>
            <div>
              <p className="text-xs text-tmuted font-semibold flex items-center gap-1"><TrendingUp size={13} className="text-brand" /> Pemasukan (bln)</p>
              <p className={`font-mono font-semibold text-brand ${privacy ? "privacy-blur" : ""}`}>{formatRp(data.income, privacy)}</p>
            </div>
            <div>
              <p className="text-xs text-tmuted font-semibold flex items-center gap-1"><TrendingDown size={13} className="text-rose" /> Pengeluaran (bln)</p>
              <p className={`font-mono font-semibold text-rose ${privacy ? "privacy-blur" : ""}`}>{formatRp(data.expense, privacy)}</p>
            </div>
            <div>
              <p className="text-xs text-tmuted font-semibold flex items-center gap-1">
                <Scale size={13} className={(data.net_cash_flow ?? (data.income - data.expense)) >= 0 ? "text-brand" : "text-rose"} /> Arus Bersih (Net)
              </p>
              <div className="flex items-center gap-1.5">
                <p className={`font-mono font-semibold ${(data.net_cash_flow ?? (data.income - data.expense)) >= 0 ? "text-brand" : "text-rose"} ${privacy ? "privacy-blur" : ""}`}>
                  {(data.net_cash_flow ?? (data.income - data.expense)) >= 0 ? "+" : ""}{formatRp(data.net_cash_flow ?? (data.income - data.expense), privacy)}
                </p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded leading-none ${(data.net_cash_flow ?? (data.income - data.expense)) >= 0 ? "bg-brand/15 text-brand" : "bg-rose/15 text-rose"}`}>
                  {(data.net_cash_flow ?? (data.income - data.expense)) >= 0 ? "Surplus" : "Defisit"}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          data-testid="health-score-widget"
          onClick={() => setHealthModalOpen(true)}
          className="flex flex-col items-center justify-center cursor-pointer transition-all hover:border-brand/60 active:scale-[0.99] group relative overflow-hidden"
        >
          <div className="absolute top-3 right-3 text-tmuted group-hover:text-brand transition-colors" title="Ketuk untuk detail">
            <Icons.Info size={15} />
          </div>
          <p className="text-xs font-semibold text-tmuted uppercase tracking-wider mb-2">Financial Health</p>
          <HealthGauge score={data.health_score} />
          <p className="text-xs text-tsecondary mt-2 text-center">Skor berdasarkan net worth, saving rate & budget.</p>
          <span className="text-[11px] font-semibold text-brand flex items-center gap-1 mt-2.5 group-hover:gap-1.5 transition-all">
            Lihat Analisis & Rekomendasi <ArrowRight size={12} />
          </span>
        </Card>
      </div>

      {/* Smart Daily Spend Pulse Widget */}
      {data.budget_summary ? (
        <Card className="p-4 sm:p-5 border-borderc relative overflow-hidden bg-gradient-to-r from-surface to-elevated/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={clsx(
                  "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                  data.budget_summary.is_overbudget
                    ? "bg-rose/15 text-rose border border-rose/30"
                    : data.budget_summary.total_limit === 0
                    ? "bg-elevated text-tsecondary border border-borderc"
                    : "bg-brand/15 text-brand border border-brand/30"
                )}
              >
                {data.budget_summary.is_overbudget ? (
                  <AlertTriangle size={22} />
                ) : data.budget_summary.total_limit === 0 ? (
                  <Compass size={22} />
                ) : (
                  <Flame size={22} />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-tmuted uppercase tracking-wider">
                    {data.budget_summary.total_limit === 0
                      ? "Anggaran Bulanan"
                      : "Batas Belanja Aman Hari Ini"}
                  </span>
                  {data.budget_summary.total_limit > 0 && (
                    <span
                      className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full font-mono",
                        data.budget_summary.is_overbudget
                          ? "bg-rose/20 text-rose"
                          : data.budget_summary.spent_pct > 80
                          ? "bg-amber/20 text-amber"
                          : "bg-brand/20 text-brand"
                      )}
                    >
                      {data.budget_summary.is_overbudget
                        ? "Overbudget"
                        : `Sisa ${data.budget_summary.days_left} hari`}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <p
                    className={clsx(
                      "text-2xl sm:text-3xl font-head font-extrabold font-mono",
                      data.budget_summary.is_overbudget
                        ? "text-rose"
                        : "text-tprimary",
                      privacy && "privacy-blur"
                    )}
                  >
                    {data.budget_summary.total_limit === 0
                      ? "Belum Ada Budget"
                      : data.budget_summary.is_overbudget
                      ? `Defisit ${formatRp(data.budget_summary.over_amount, privacy)}`
                      : `${formatRp(data.budget_summary.safe_daily_spend, privacy)}`}
                  </p>
                  {data.budget_summary.total_limit > 0 && !data.budget_summary.is_overbudget && (
                    <span className="text-xs text-tmuted font-medium">/ hari</span>
                  )}
                </div>

                <p className="text-xs text-tsecondary mt-1 leading-relaxed">
                  {data.budget_summary.total_limit === 0 ? (
                    "Buat limit anggaran bulanan untuk mengendalikan pengeluaran harianmu dan mencegah bocor halus."
                  ) : data.budget_summary.is_overbudget ? (
                    <>
                      Pengeluaran telah melampaui limit anggaran. Disarankan menahan belanja untuk{" "}
                      <strong>{data.budget_summary.days_left} hari ke depan</strong> agar kas tetap seimbang.
                    </>
                  ) : (
                    <>
                      Tersisa <strong className="text-tprimary font-mono">{formatRp(data.budget_summary.remaining, privacy)}</strong> dari total limit{" "}
                      <span className="font-mono">{formatRp(data.budget_summary.total_limit, privacy)}</span> ({data.budget_summary.spent_pct}% terpakai).
                    </>
                  )}
                </p>
              </div>
            </div>

            <Button
              variant={data.budget_summary.total_limit === 0 ? "primary" : "secondary"}
              size="sm"
              onClick={() => navigate("/budget")}
              className="shrink-0 self-end sm:self-center"
            >
              {data.budget_summary.total_limit === 0 ? "Atur Budget Sekarang" : "Detail Budget"} <ArrowRight size={14} />
            </Button>
          </div>

          {data.budget_summary.total_limit > 0 && (
            <div className="mt-3.5 pt-2.5 border-t border-borderc/40">
              <Progress
                value={Math.min(100, data.budget_summary.spent_pct || 0)}
                color={
                  data.budget_summary.is_overbudget
                    ? "var(--rose)"
                    : data.budget_summary.spent_pct > 80
                    ? "var(--amber)"
                    : "var(--brand)"
                }
                className="h-1.5"
              />
            </div>
          )}
        </Card>
      ) : null}

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction icon={Wand2} label="Teks AI" onClick={() => openAdd("ai")} testid="quick-add-ai-text" />
        <QuickAction icon={Plus} label="Transaksi" onClick={() => openAdd("manual")} testid="quick-add-transaction" />
        <QuickAction icon={ScanLine} label="Scan Struk" onClick={openScan} testid="quick-scan-receipt" />
        <QuickAction icon={Sparkles} label="Tanya Tumara" onClick={() => navigate("/advisor")} testid="quick-ask-ai" />
      </div>

      <WeeklyRecap />

      {data.upcoming_bills?.length > 0 && (
        <Card data-testid="upcoming-bills-card" className="border-amber/40 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-head font-bold text-base sm:text-lg flex items-center gap-2">
              <CalendarClock size={19} className="text-amber" /> Tagihan Jatuh Tempo ({data.upcoming_bills.length})
            </h2>
            <button onClick={() => navigate("/bills")} className="text-xs font-semibold text-brand flex items-center gap-1 hover:underline">
              Buka Kalender <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2.5">
            {data.upcoming_bills.slice(0, 4).map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 bg-elevated/70 border border-borderc/50 rounded-xl p-3 sm:px-4 sm:py-3 transition-colors hover:border-brand/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-tprimary truncate">{b.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs">
                    <span
                      style={{ color: b.days_until < 0 ? "var(--rose)" : b.days_until <= 3 ? "var(--amber)" : "var(--brand)" }}
                      className="font-medium"
                    >
                      {b.days_until < 0
                        ? `⚠️ Telat ${Math.abs(b.days_until)} hari`
                        : b.days_until === 0
                        ? "⚡ Hari ini"
                        : `⏳ ${b.days_until} hari lagi`}
                    </span>
                    <span className="text-tmuted">· Tempo {b.next_due_date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono text-sm sm:text-base font-bold text-tprimary ${privacy ? "privacy-blur" : ""}`}>
                    {formatRp(b.amount, privacy)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handlePayBill(b)}
                    disabled={payingBillId === b.id}
                    className="text-xs px-3 py-1.5"
                    data-testid={`quick-pay-bill-${b.id}`}
                  >
                    <CheckCircle2 size={13} />
                    {payingBillId === b.id ? "..." : "Bayar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.is_shared && data.member_breakdown?.length > 0 && (
        <Card data-testid="member-breakdown-card">
          <h2 className="font-head font-bold flex items-center gap-2 mb-3"><Icons.Users size={18} className="text-cyan" /> Pengeluaran per Anggota</h2>
          <div className="space-y-3">
            {data.member_breakdown.map((m, i) => {
              const total = data.member_breakdown.reduce((a, x) => a + x.amount, 0);
              const pct = total > 0 ? (m.amount / total) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <img src={m.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${m.name}`} alt="" className="w-6 h-6 rounded-full" />
                    <span className="text-sm font-medium flex-1">{m.name}</span>
                    <span className={`font-mono text-sm ${privacy ? "privacy-blur" : ""}`}>{formatRp(m.amount, privacy)}</span>
                  </div>
                  <Progress value={pct} color={i === 0 ? "var(--cyan)" : "var(--brand)"} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Wallets */}
      <div>
        <SectionHead title="Dompet" onClick={() => navigate("/wallets")} />
        {data.wallets.length === 0 ? (
          <Card><EmptyState icon={Icons.Wallet} title="Belum ada dompet" subtitle="Tambahkan rekening atau e-wallet." action={<Button onClick={() => navigate("/wallets")} size="sm">Tambah</Button>} /></Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {data.wallets.map((w) => {
              const m = walletMeta(w.type);
              const Ic = Icons[m.icon] || Icons.Wallet;
              return (
                <div key={w.id} data-testid={`wallet-card-${w.name.toLowerCase().replace(/\s/g, "-")}`}
                  className="min-w-[180px] rounded-2xl p-4 border border-borderc bg-surface">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${w.color}22` }}>
                      <Ic size={18} style={{ color: w.color }} />
                    </div>
                    <Badge color={m.color}>{m.label}</Badge>
                  </div>
                  <p className="text-sm font-semibold mt-3 truncate">{w.name}</p>
                  <p className={`font-mono font-bold ${w.type === "credit_card" || w.type === "paylater" ? "text-rose" : ""} ${privacy ? "privacy-blur" : ""}`}>
                    {formatRp(w.balance, privacy)}
                  </p>
                  {(w.type === "credit_card" || w.type === "paylater") && w.credit_limit > 0 && (
                    <p className={`text-[11px] text-tmuted truncate mt-0.5 ${privacy ? "privacy-blur" : ""}`}>
                      Sisa: <span className="text-cyan font-mono font-medium">{formatRp(Math.max(0, w.credit_limit - w.balance), privacy)}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Financial Goals Spotlight */}
      {data.goals?.length > 0 && (
        <div>
          <SectionHead title={`Tujuan Finansial (${data.goals.length})`} onClick={() => navigate("/goals")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.goals.slice(0, 2).map((g) => {
              const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100)) : 0;
              return (
                <Card
                  key={g.id}
                  hover
                  onClick={() => navigate("/goals")}
                  className="p-4 cursor-pointer space-y-2.5 transition-all group border-borderc hover:border-brand/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-tprimary truncate group-hover:text-brand transition-colors flex items-center gap-1.5">
                        <Target size={15} className="text-brand shrink-0" />
                        {g.name}
                      </p>
                      <p className="text-xs text-tmuted mt-0.5">
                        Target: <span className={`font-mono ${privacy ? "privacy-blur" : ""}`}>{formatRp(g.target_amount, privacy)}</span>
                      </p>
                    </div>
                    <span className="text-xs font-bold font-mono text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full shrink-0">
                      {pct}%
                    </span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-mono text-tmuted">
                      <span>Terkumpul: <strong className={`text-tprimary ${privacy ? "privacy-blur" : ""}`}>{formatRp(g.saved_amount, privacy)}</strong></span>
                      <span>Sisa: <strong className={privacy ? "privacy-blur" : ""}>{formatRp(Math.max(0, g.target_amount - g.saved_amount), privacy)}</strong></span>
                    </div>
                    <Progress value={pct} color="var(--brand)" className="h-1.5" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget status */}
      {data.budget_status.length > 0 && (
        <div>
          <SectionHead title="Progress Budget" onClick={() => navigate("/budget")} />
          <Card className="space-y-4">
            {data.budget_status.slice(0, 5).map((b) => {
              const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
              return (
                <div key={b.category}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium flex items-center gap-2">
                      {b.category}
                      {b.over && <Badge color="var(--rose)"><AlertTriangle size={11} /> Over</Badge>}
                    </span>
                    <span className={`font-mono text-xs ${privacy ? "privacy-blur" : ""}`}>{formatShort(b.spent, privacy)} / {formatShort(b.limit, privacy)}</span>
                  </div>
                  <Progress value={pct} color={b.over ? "var(--rose)" : pct > 80 ? "var(--amber)" : "var(--brand)"} />
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* Recent transactions */}
      <div>
        <SectionHead title="Transaksi Terbaru" onClick={() => navigate("/transactions")} />
        {data.recent_transactions.length === 0 ? (
          <Card><EmptyState icon={Icons.Receipt} title="Belum ada transaksi" subtitle="Catat transaksi pertamamu." action={<Button onClick={() => openAdd("manual")} size="sm">Tambah</Button>} /></Card>
        ) : (
          <Card className="divide-y divide-[color:var(--border)] p-0 overflow-hidden">
            {data.recent_transactions.map((t) => (
              <TxnRow
                key={t.id}
                t={t}
                privacy={privacy}
                memberMap={Object.fromEntries((data.members || []).map((m) => [m.user_id, m]))}
                walletMap={Object.fromEntries((data.wallets || []).map((w) => [w.id, w]))}
                onSelect={(txn) => setSelectedTxn(txn)}
                onEdit={(txn) => setEditingTxn(txn)}
                onDelete={(id) => handleDeleteTxn(id)}
              />
            ))}
          </Card>
        )}
      </div>

      {/* Financial Health Diagnostic Modal */}
      <FinancialHealthModal
        open={healthModalOpen}
        onClose={() => setHealthModalOpen(false)}
        data={data.health_detail}
        onAction={handleHealthAction}
      />

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        open={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        transaction={selectedTxn}
        wallets={data.wallets || []}
        memberMap={Object.fromEntries((data.members || []).map((m) => [m.user_id, m]))}
        privacy={privacy}
        onEdit={(txn) => {
          setSelectedTxn(null);
          setEditingTxn(txn);
        }}
        onDelete={(id) => handleDeleteTxn(id)}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        open={!!editingTxn}
        onClose={() => setEditingTxn(null)}
        transaction={editingTxn}
        wallets={data.wallets || []}
        onSaved={() => {
          fetchDashboard();
          bump();
        }}
      />
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, testid }) {
  return (
    <button data-testid={testid} onClick={onClick}
      className="flex flex-col items-center gap-2 bg-surface border border-borderc rounded-2xl py-4 hover:border-brand transition-colors">
      <div className="w-10 h-10 rounded-xl bg-elevated flex items-center justify-center"><Icon size={20} className="text-brand" /></div>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function WeeklyRecap() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchRecap = async (refresh = false) => {
    setLoading(true);
    try {
      const { data } = await api.get("/ai/weekly-recap", { params: refresh ? { refresh: true } : {} });
      setContent(data.content);
    } catch { setContent("Belum bisa membuat rangkuman. Coba lagi nanti."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecap(false); }, []);

  return (
    <Card data-testid="weekly-recap-card" className="relative overflow-hidden border-brand/30">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: "var(--brand)" }} />
      <div className="flex items-center justify-between mb-2 relative">
        <h2 className="font-head font-bold flex items-center gap-2"><Sparkles size={18} className="text-brand" /> Rangkuman Mingguan</h2>
        <button onClick={() => fetchRecap(true)} disabled={loading} data-testid="recap-refresh-button"
          className="p-2 rounded-lg hover:bg-elevated text-tsecondary disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {loading && !content ? (
        <div className="flex items-center gap-2 text-sm text-tsecondary py-2"><Spinner size={16} className="text-brand" /> Tumara lagi merangkum minggumu...</div>
      ) : (
        <p className="text-sm text-tsecondary leading-relaxed whitespace-pre-wrap relative">{content}</p>
      )}
    </Card>
  );
}

function SectionHead({ title, onClick }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-head font-bold text-lg">{title}</h2>
      {onClick && <button onClick={onClick} className="text-xs font-semibold text-brand flex items-center gap-1 hover:gap-2 transition-all">Lihat semua <ArrowRight size={13} /></button>}
    </div>
  );
}

export function TxnRow({ t, privacy, onDelete, onEdit, onSelect, memberMap, walletMap }) {
  const m = catMeta(t.category);
  const Ic = Icons[m.icon] || Icons.MoreHorizontal;
  const isIncome = t.type === "income";
  const isTransfer = t.type === "transfer";
  const mem = memberMap?.[t.member_id];

  const fromWallet = walletMap?.[t.wallet_id];
  const toWallet = walletMap?.[t.to_wallet_id];
  const walletLabel = isTransfer
    ? (fromWallet && toWallet ? `${fromWallet.name} ➔ ${toWallet.name}` : fromWallet?.name || "Transfer")
    : fromWallet?.name || "";

  return (
    <div
      onClick={() => onSelect?.(t)}
      className={clsx(
        "flex items-center gap-3 px-5 py-3.5 transition-colors group",
        onSelect && "cursor-pointer hover:bg-elevated/60"
      )}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color}22` }}>
        <Ic size={18} style={{ color: m.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{t.note || t.category}</p>
          {t.goal_id && (
            <span className="text-[10px] font-semibold bg-brand/15 text-brand px-1.5 py-0.5 rounded-full shrink-0">
              🎯 Nabung
            </span>
          )}
        </div>
        <p className="text-xs text-tmuted flex items-center gap-1.5 truncate mt-0.5">
          {mem && <img src={mem.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${mem.name}`} alt="" title={mem.name} className="w-4 h-4 rounded-full object-cover inline-block shrink-0" />}
          {walletLabel && <span className="font-semibold text-tsecondary">{walletLabel} ·</span>}
          <span>{isTransfer ? "Transfer" : t.category}</span>
          <span>· {t.date}</span>
        </p>
      </div>
      <span className={`font-mono text-sm font-semibold shrink-0 ${privacy ? "privacy-blur" : ""} ${isIncome ? "text-brand" : isTransfer ? "text-cyan" : "text-rose"}`}>
        {isIncome ? "+" : isTransfer ? "" : "-"}{formatRp(t.amount, privacy)}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(t); }}
            data-testid={`edit-txn-${t.id}`}
            className="p-1.5 rounded-lg hover:bg-elevated text-tmuted hover:text-brand transition-colors"
            title="Edit transaksi"
          >
            <Icons.Pencil size={15} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
            data-testid={`delete-txn-${t.id}`}
            className="p-1.5 rounded-lg hover:bg-elevated text-tmuted hover:text-rose transition-colors"
            title="Hapus transaksi"
          >
            <Icons.Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
