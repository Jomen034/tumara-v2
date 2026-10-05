import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import {
  Plus,
  Download,
  Upload,
  Users,
  Search,
  X,
  Calendar,
  CreditCard,
  Tag,
  ChevronDown,
  RotateCcw,
  Filter,
  SearchX,
  Receipt,
} from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatDateGroup } from "../lib/format";
import { CATEGORIES } from "../lib/constants";
import { Card, Button, Spinner, EmptyState, Modal } from "../components/ui";
import { TxnRow } from "./Dashboard";
import TransactionDetailModal from "../components/TransactionDetailModal";
import EditTransactionModal from "../components/EditTransactionModal";
import { getUserAvatar } from "../lib/avatars";

const FILTERS = [
  { value: "all", label: "Semua" },
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
  { value: "transfer", label: "Transfer" },
];

export default function Transactions() {
  const { openAdd } = useOutletContext();
  const { privacy } = useTheme();
  const { version, bump } = useRefresh();
  const fileRef = useRef();
  const [txns, setTxns] = useState([]);
  const [members, setMembers] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [walletFilter, setWalletFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);

  const load = () =>
    Promise.all([
      api.get("/transactions", { params: { limit: 1000 } }),
      api.get("/household"),
      api.get("/wallets"),
    ])
      .then(([t, h, w]) => {
        setTxns(t.data);
        setMembers(h.data.members || []);
        setWallets(w.data || []);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, [version]);

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w]));

  const del = async (id) => {
    if (!window.confirm("Hapus transaksi ini?")) return;
    await api.delete(`/transactions/${id}`);
    toast.success("Transaksi dihapus");
    load();
    bump();
  };

  const exportCsv = async () => {
    try {
      const res = await api.get("/transactions/export", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toLocaleDateString("sv-SE");
      a.href = url;
      a.download = `tumara-transaksi-${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV transaksi berhasil diunduh! 📊");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mengunduh CSV transaksi");
    }
  };

  const importCsv = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/transactions/import", fd);
      setImportResult(data);
      toast.success(`${data.imported} transaksi diimpor!`);
      load();
      bump();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal impor CSV");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Collect all unique categories
  const allCategories = Array.from(
    new Set([
      ...CATEGORIES.map((c) => c.name),
      ...txns.map((t) => t.category).filter(Boolean),
    ])
  ).sort();

  // Date calculation boundaries
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const thisMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthPrefix = `${prevMonthDate.getFullYear()}-${String(
    prevMonthDate.getMonth() + 1
  ).padStart(2, "0")}`;

  const d30 = new Date();
  d30.setDate(d30.getDate() - 30);
  const last30DaysStart = d30.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  // Filtering pipeline
  let filtered = txns;

  if (filter !== "all") {
    filtered = filtered.filter((t) => t.type === filter);
  }
  if (memberFilter !== "all") {
    filtered = filtered.filter((t) => t.member_id === memberFilter);
  }
  if (walletFilter !== "all") {
    filtered = filtered.filter(
      (t) => t.wallet_id === walletFilter || t.to_wallet_id === walletFilter
    );
  }
  if (categoryFilter !== "all") {
    filtered = filtered.filter(
      (t) =>
        t.category === categoryFilter ||
        (t.items && t.items.some((it) => (it.category || t.category) === categoryFilter))
    );
  }
  if (period === "this_month") {
    filtered = filtered.filter((t) => (t.date || "").startsWith(thisMonthPrefix));
  } else if (period === "last_month") {
    filtered = filtered.filter((t) => (t.date || "").startsWith(lastMonthPrefix));
  } else if (period === "last_30_days") {
    filtered = filtered.filter(
      (t) => (t.date || "") >= last30DaysStart && (t.date || "") <= todayStr
    );
  } else if (period === "custom") {
    if (customStart) filtered = filtered.filter((t) => (t.date || "") >= customStart);
    if (customEnd) filtered = filtered.filter((t) => (t.date || "") <= customEnd);
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((t) => {
      const noteMatch = (t.note || "").toLowerCase().includes(q);
      const catMatch = (t.category || "").toLowerCase().includes(q);
      const wFrom = (walletMap[t.wallet_id]?.name || "").toLowerCase().includes(q);
      const wTo = (walletMap[t.to_wallet_id]?.name || "").toLowerCase().includes(q);
      const amtMatch = String(t.amount || "").includes(q);
      const itemMatch =
        t.items &&
        t.items.some(
          (it) =>
            (it.name || "").toLowerCase().includes(q) ||
            (it.category || "").toLowerCase().includes(q)
        );
      return noteMatch || catMatch || wFrom || wTo || amtMatch || itemMatch;
    });
  }

  const hasActiveFilters =
    filter !== "all" ||
    period !== "all" ||
    walletFilter !== "all" ||
    categoryFilter !== "all" ||
    memberFilter !== "all" ||
    search.trim() !== "" ||
    customStart !== "" ||
    customEnd !== "";

  const resetFilters = () => {
    setFilter("all");
    setPeriod("all");
    setWalletFilter("all");
    setCategoryFilter("all");
    setMemberFilter("all");
    setSearch("");
    setCustomStart("");
    setCustomEnd("");
  };

  // Sort filtered strictly from newest to oldest by transaction date, with created_at as tie-breaker
  const sortedFiltered = [...filtered].sort((a, b) => {
    const dateA = a.date || (a.created_at ? a.created_at.slice(0, 10) : "");
    const dateB = b.date || (b.created_at ? b.created_at.slice(0, 10) : "");
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA); // newest date first
    }
    const timeA = a.created_at || "";
    const timeB = b.created_at || "";
    return timeB.localeCompare(timeA); // newest created_at first within same date
  });

  // Group by normalized date key (YYYY-MM-DD)
  const groups = {};
  sortedFiltered.forEach((t) => {
    const dKey = t.date
      ? t.date.slice(0, 10)
      : t.created_at
      ? t.created_at.slice(0, 10)
      : "Lainnya";
    (groups[dKey] = groups[dKey] || []).push(t);
  });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const isShared = members.length > 1;

  // Filtered sums
  const filteredExpense = filtered
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + (t.amount || 0), 0);
  const filteredIncome = filtered
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + (t.amount || 0), 0);
  const filteredNet = filteredIncome - filteredExpense;

  return (
    <div className="space-y-6">
      {/* Header bar: Export, Import, Tambah (Scan removed) */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Transaksi</h1>
          <p className="text-tsecondary text-sm mt-1">
            Semua pemasukan & pengeluaran{isShared ? " rumah tangga" : ""}.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={exportCsv}
            data-testid="export-csv-button"
            title="Ekspor daftar transaksi format CSV untuk Excel / Spreadsheet"
          >
            <Download size={16} /> Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileRef.current?.click()}
            data-testid="import-csv-button"
            title="Impor riwayat transaksi dari format CSV"
          >
            <Upload size={16} /> Import CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={importCsv}
            className="hidden"
            data-testid="import-csv-input"
          />
          <Button size="sm" onClick={() => openAdd("manual")}>
            <Plus size={16} /> Tambah
          </Button>
        </div>
      </div>

      {/* Advanced Filter Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-borderc space-y-3.5 shadow-sm">
        {/* Row 1: Search + Period + Wallet + Category Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tmuted pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari catatan / merchant..."
              className="w-full bg-elevated border border-borderc rounded-xl pl-9 pr-8 py-2 text-sm text-tprimary placeholder:text-tmuted focus:border-brand focus:outline-none transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tmuted hover:text-tsecondary"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Period Dropdown */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tmuted pointer-events-none">
              <Calendar size={15} />
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full bg-elevated border border-borderc rounded-xl pl-9 pr-8 py-2 text-sm text-tprimary focus:border-brand focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">Periode: Semua Waktu</option>
              <option value="this_month">Periode: Bulan Ini</option>
              <option value="last_month">Periode: Bulan Lalu</option>
              <option value="last_30_days">Periode: 30 Hari Terakhir</option>
              <option value="custom">Periode: Kustom Tanggal...</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-tmuted">
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Wallet Dropdown */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tmuted pointer-events-none">
              <CreditCard size={15} />
            </span>
            <select
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              className="w-full bg-elevated border border-borderc rounded-xl pl-9 pr-8 py-2 text-sm text-tprimary focus:border-brand focus:outline-none appearance-none cursor-pointer truncate"
            >
              <option value="all">Semua Dompet / Rekening</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-tmuted">
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tmuted pointer-events-none">
              <Tag size={15} />
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-elevated border border-borderc rounded-xl pl-9 pr-8 py-2 text-sm text-tprimary focus:border-brand focus:outline-none appearance-none cursor-pointer truncate"
            >
              <option value="all">Semua Kategori</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-tmuted">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker (shown when period === "custom") */}
        {period === "custom" && (
          <div className="p-3 rounded-xl bg-elevated/40 border border-borderc flex items-center gap-3 flex-wrap text-xs">
            <span className="font-semibold text-tsecondary">Rentang Tanggal:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-surface border border-borderc rounded-lg px-2.5 py-1 text-xs text-tprimary focus:border-brand focus:outline-none"
              />
              <span className="text-tmuted">sampai</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-surface border border-borderc rounded-lg px-2.5 py-1 text-xs text-tprimary focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Row 2: Type Pills + Reset Button */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-borderc">
          <div className="flex gap-1.5 overflow-x-auto py-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                data-testid={`filter-${f.value}`}
                className={clsx(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors",
                  filter === f.value
                    ? "bg-brand text-black shadow-sm"
                    : "bg-elevated text-tsecondary hover:text-tprimary"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose hover:underline px-2.5 py-1 rounded-lg hover:bg-rose/10 transition-colors ml-auto"
            >
              <RotateCcw size={12} /> Reset Filter
            </button>
          )}
        </div>

        {/* Row 3: Family Member Filter if shared */}
        {isShared && (
          <div className="flex gap-2 overflow-x-auto items-center pt-2 border-t border-borderc">
            <Users size={14} className="text-tmuted shrink-0" />
            <button
              onClick={() => setMemberFilter("all")}
              data-testid="member-filter-all"
              className={clsx(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                memberFilter === "all" ? "bg-cyan text-black" : "bg-elevated text-tsecondary"
              )}
            >
              Semua anggota
            </button>
            {members.map((m) => (
              <button
                key={m.user_id}
                onClick={() => setMemberFilter(m.user_id)}
                data-testid={`member-filter-${m.user_id}`}
                className={clsx(
                  "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5",
                  memberFilter === m.user_id ? "bg-cyan text-black" : "bg-elevated text-tsecondary"
                )}
              >
                <img
                  src={getUserAvatar(m)}
                  alt=""
                  className="w-3.5 h-3.5 rounded-full"
                />
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Aggregated Summary Strip */}
      <div className="flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-elevated/40 border border-borderc flex-wrap text-xs">
        <div className="flex items-center gap-2 text-tsecondary">
          <Filter size={14} className="text-brand shrink-0" />
          <span>
            Menampilkan <strong className="text-tprimary font-mono">{filtered.length}</strong> transaksi
            {hasActiveFilters ? " (terfilter)" : ""}
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 flex-wrap ml-auto font-mono">
          {filteredExpense > 0 && (
            <span className="text-rose font-semibold flex items-center gap-1">
              Keluar: <span className={privacy ? "privacy-blur" : ""}>-{formatRp(filteredExpense, privacy)}</span>
            </span>
          )}
          {filteredIncome > 0 && (
            <span className="text-brand font-semibold flex items-center gap-1">
              Masuk: <span className={privacy ? "privacy-blur" : ""}>+{formatRp(filteredIncome, privacy)}</span>
            </span>
          )}
          {(filteredExpense > 0 || filteredIncome > 0) && (
            <span className="text-tmuted border-l border-borderc pl-3">
              Net:{" "}
              <strong
                className={clsx(
                  filteredNet >= 0 ? "text-brand" : "text-rose",
                  privacy && "privacy-blur"
                )}
              >
                {formatRp(filteredNet, privacy)}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Transactions List or Empty State */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-brand" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          {hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="Tidak ada transaksi yang cocok"
              subtitle="Coba ubah kata kunci pencarian, rentang tanggal, atau filter dompet & kategori."
              action={
                <Button onClick={resetFilters} variant="secondary" size="sm">
                  <RotateCcw size={14} /> Reset Filter
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Receipt}
              title="Belum ada transaksi"
              subtitle="Mulai catat atau impor dari CSV."
              action={
                <Button onClick={() => openAdd("manual")} size="sm">
                  Tambah Transaksi
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <div className="space-y-5" data-testid="transactions-list">
          {dates.map((d) => {
            const isDifferentYear = d.length >= 4 && d.slice(0, 4) !== String(currentYear);
            return (
              <div key={d}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <p className="text-xs font-semibold text-tmuted tracking-wide">
                    {formatDateGroup(d)}
                  </p>
                  {isDifferentYear && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber/15 text-amber border border-amber/30">
                      Tahun {d.slice(0, 4)}
                    </span>
                  )}
                </div>
                <Card className="divide-y divide-[color:var(--border)] p-0 overflow-hidden">
                  {groups[d].map((t) => (
                    <TxnRow
                      key={t.id}
                      t={t}
                      privacy={privacy}
                      onDelete={del}
                      onEdit={(txn) => setEditingTxn(txn)}
                      onSelect={(txn) => setSelectedTxn(txn)}
                      memberMap={memberMap}
                      walletMap={walletMap}
                    />
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={importing || !!importResult} onClose={() => { setImportResult(null); }} title="Impor CSV" testid="import-result-modal" size="sm">
        {importing ? (
          <div className="flex items-center gap-2 text-sm text-tsecondary py-4"><Spinner size={18} className="text-brand" /> Mengimpor transaksi...</div>
        ) : importResult && (
          <div className="space-y-3">
            <p className="text-sm"><span className="font-bold text-brand text-lg">{importResult.imported}</span> transaksi berhasil diimpor.</p>
            {importResult.error_count > 0 && (
              <div className="text-xs text-rose bg-rose/10 rounded-xl p-3">
                <p className="font-semibold mb-1">{importResult.error_count} baris gagal:</p>
                {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <p className="text-xs text-tmuted">Kolom yang didukung: date, type, amount, category, wallet, note.</p>
            <Button onClick={() => setImportResult(null)} className="w-full">Selesai</Button>
          </div>
        )}
      </Modal>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        open={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        transaction={selectedTxn}
        wallets={wallets}
        memberMap={memberMap}
        privacy={privacy}
        onEdit={(txn) => {
          setSelectedTxn(null);
          setEditingTxn(txn);
        }}
        onDelete={del}
      />

      {/* Transaction Edit Modal */}
      <EditTransactionModal
        open={!!editingTxn}
        onClose={() => setEditingTxn(null)}
        transaction={editingTxn}
        wallets={wallets}
        onSaved={() => {
          load();
          bump();
        }}
      />
    </div>
  );
}
