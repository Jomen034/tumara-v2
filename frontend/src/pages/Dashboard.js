import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { TrendingUp, TrendingDown, ScanLine, Plus, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatShort } from "../lib/format";
import { catMeta, walletMeta } from "../lib/constants";
import { Card, Progress, Badge, Spinner, EmptyState, Button } from "../components/ui";

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
  const { version } = useRefresh();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [version]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={30} className="text-brand" /></div>;
  if (!data) return null;

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
              <p className="text-xs text-tmuted font-semibold">Pemasukan (bln)</p>
              <p className={`font-mono font-semibold ${privacy ? "privacy-blur" : ""}`}>{formatRp(data.income, privacy)}</p>
            </div>
            <div>
              <p className="text-xs text-tmuted font-semibold">Pengeluaran (bln)</p>
              <p className={`font-mono font-semibold ${privacy ? "privacy-blur" : ""}`}>{formatRp(data.expense, privacy)}</p>
            </div>
          </div>
        </Card>

        <Card data-testid="health-score-widget" className="flex flex-col items-center justify-center">
          <p className="text-xs font-semibold text-tmuted uppercase tracking-wider mb-3">Financial Health</p>
          <HealthGauge score={data.health_score} />
          <p className="text-xs text-tsecondary mt-3 text-center">Skor berdasarkan net worth, saving rate & budget.</p>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon={Plus} label="Transaksi" onClick={openAdd} testid="quick-add-transaction" />
        <QuickAction icon={ScanLine} label="Scan Struk" onClick={openScan} testid="quick-scan-receipt" />
        <QuickAction icon={Sparkles} label="Tanya Nusa" onClick={() => navigate("/advisor")} testid="quick-ask-ai" />
      </div>

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
                </div>
              );
            })}
          </div>
        )}
      </div>

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
          <Card><EmptyState icon={Icons.Receipt} title="Belum ada transaksi" subtitle="Catat transaksi pertamamu." action={<Button onClick={openAdd} size="sm">Tambah</Button>} /></Card>
        ) : (
          <Card className="divide-y divide-[color:var(--border)] p-0 overflow-hidden">
            {data.recent_transactions.map((t) => <TxnRow key={t.id} t={t} privacy={privacy} />)}
          </Card>
        )}
      </div>
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

function SectionHead({ title, onClick }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-head font-bold text-lg">{title}</h2>
      {onClick && <button onClick={onClick} className="text-xs font-semibold text-brand flex items-center gap-1 hover:gap-2 transition-all">Lihat semua <ArrowRight size={13} /></button>}
    </div>
  );
}

export function TxnRow({ t, privacy, onDelete }) {
  const m = catMeta(t.category);
  const Ic = Icons[m.icon] || Icons.MoreHorizontal;
  const isIncome = t.type === "income";
  const isTransfer = t.type === "transfer";
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color}22` }}>
        <Ic size={18} style={{ color: m.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{t.note || t.category}</p>
        <p className="text-xs text-tmuted">{isTransfer ? "Transfer" : t.category} · {t.date}</p>
      </div>
      <span className={`font-mono text-sm font-semibold ${privacy ? "privacy-blur" : ""} ${isIncome ? "text-brand" : isTransfer ? "text-cyan" : "text-tprimary"}`}>
        {isIncome ? "+" : isTransfer ? "" : "-"}{formatRp(t.amount, privacy)}
      </span>
      {onDelete && (
        <button onClick={() => onDelete(t.id)} data-testid={`delete-txn-${t.id}`} className="p-1.5 rounded-lg hover:bg-elevated text-tmuted hover:text-rose transition-colors">
          <Icons.Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
