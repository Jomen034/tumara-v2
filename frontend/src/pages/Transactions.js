import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { Plus, ScanLine, Download, Upload, Users } from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { Card, Button, Spinner, EmptyState, Modal } from "../components/ui";
import { TxnRow } from "./Dashboard";

const FILTERS = [
  { value: "all", label: "Semua" },
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
  { value: "transfer", label: "Transfer" },
];

export default function Transactions() {
  const { openAdd, openScan } = useOutletContext();
  const { privacy } = useTheme();
  const { version, bump } = useRefresh();
  const fileRef = useRef();
  const [txns, setTxns] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const load = () => Promise.all([
    api.get("/transactions", { params: { limit: 500 } }),
    api.get("/household"),
  ]).then(([t, h]) => { setTxns(t.data); setMembers(h.data.members || []); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, [version]);

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const del = async (id) => { await api.delete(`/transactions/${id}`); toast.success("Transaksi dihapus"); load(); bump(); };

  const exportCsv = async () => {
    try {
      const res = await api.get("/transactions/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "nusa-transaksi.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV diunduh!");
    } catch { toast.error("Gagal export"); }
  };

  const importCsv = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true); setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/transactions/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImportResult(data);
      toast.success(`${data.imported} transaksi diimpor!`);
      load(); bump();
    } catch (err) { toast.error(err?.response?.data?.detail || "Gagal impor CSV"); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  let filtered = filter === "all" ? txns : txns.filter((t) => t.type === filter);
  if (memberFilter !== "all") filtered = filtered.filter((t) => t.member_id === memberFilter);

  const groups = {};
  filtered.forEach((t) => { (groups[t.date] = groups[t.date] || []).push(t); });
  const dates = Object.keys(groups).sort().reverse();
  const isShared = members.length > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Transaksi</h1>
          <p className="text-tsecondary text-sm mt-1">Semua pemasukan & pengeluaran{isShared ? " rumah tangga" : ""}.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={exportCsv} data-testid="export-csv-button"><Download size={16} /> Export</Button>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} data-testid="import-csv-button"><Upload size={16} /> Import</Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={importCsv} className="hidden" data-testid="import-csv-input" />
          <Button variant="secondary" size="sm" onClick={openScan}><ScanLine size={16} /><span className="hidden sm:inline">Scan</span></Button>
          <Button size="sm" onClick={() => openAdd("manual")}><Plus size={16} /> Tambah</Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} data-testid={`filter-${f.value}`}
            className={clsx("px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              filter === f.value ? "bg-brand text-black" : "bg-elevated text-tsecondary hover:text-tprimary")}>
            {f.label}
          </button>
        ))}
      </div>

      {isShared && (
        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
          <Users size={15} className="text-tmuted shrink-0" />
          <button onClick={() => setMemberFilter("all")} data-testid="member-filter-all"
            className={clsx("px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap", memberFilter === "all" ? "bg-cyan text-black" : "bg-elevated text-tsecondary")}>Semua anggota</button>
          {members.map((m) => (
            <button key={m.user_id} onClick={() => setMemberFilter(m.user_id)} data-testid={`member-filter-${m.user_id}`}
              className={clsx("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5", memberFilter === m.user_id ? "bg-cyan text-black" : "bg-elevated text-tsecondary")}>
              <img src={m.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${m.name}`} alt="" className="w-4 h-4 rounded-full" /> {m.name}
            </button>
          ))}
        </div>
      )}

      {loading ? <div className="flex justify-center py-16"><Spinner className="text-brand" size={28} /></div> :
        filtered.length === 0 ? (
          <Card><EmptyState icon={Icons.Receipt} title="Belum ada transaksi" subtitle="Mulai catat atau impor dari CSV." action={<Button onClick={() => openAdd("manual")} size="sm">Tambah Transaksi</Button>} /></Card>
        ) : (
          <div className="space-y-5" data-testid="transactions-list">
            {dates.map((d) => (
              <div key={d}>
                <p className="text-xs font-semibold text-tmuted uppercase tracking-wider mb-2 px-1">{d}</p>
                <Card className="divide-y divide-[color:var(--border)] p-0 overflow-hidden">
                  {groups[d].map((t) => <TxnRow key={t.id} t={t} privacy={privacy} onDelete={del} memberMap={memberMap} />)}
                </Card>
              </div>
            ))}
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
    </div>
  );
}
