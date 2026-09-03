import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { Plus, ScanLine } from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";
import { Card, Button, Spinner, EmptyState } from "../components/ui";
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
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = () => api.get("/transactions", { params: { limit: 300 } }).then((r) => setTxns(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [version]);

  const del = async (id) => {
    await api.delete(`/transactions/${id}`); toast.success("Transaksi dihapus"); load(); bump();
  };

  const filtered = filter === "all" ? txns : txns.filter((t) => t.type === filter);

  // group by date
  const groups = {};
  filtered.forEach((t) => { (groups[t.date] = groups[t.date] || []).push(t); });
  const dates = Object.keys(groups).sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Transaksi</h1>
          <p className="text-tsecondary text-sm mt-1">Semua pemasukan & pengeluaranmu.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={openScan} data-testid="txn-scan-button"><ScanLine size={16} /><span className="hidden sm:inline">Scan</span></Button>
          <Button size="sm" onClick={openAdd} data-testid="txn-add-button"><Plus size={16} /> Tambah</Button>
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

      {loading ? <div className="flex justify-center py-16"><Spinner className="text-brand" size={28} /></div> :
        filtered.length === 0 ? (
          <Card><EmptyState icon={Icons.Receipt} title="Belum ada transaksi" subtitle="Mulai catat transaksimu." action={<Button onClick={openAdd} size="sm">Tambah Transaksi</Button>} /></Card>
        ) : (
          <div className="space-y-5" data-testid="transactions-list">
            {dates.map((d) => (
              <div key={d}>
                <p className="text-xs font-semibold text-tmuted uppercase tracking-wider mb-2 px-1">{d}</p>
                <Card className="divide-y divide-[color:var(--border)] p-0 overflow-hidden">
                  {groups[d].map((t) => <TxnRow key={t.id} t={t} privacy={privacy} onDelete={del} />)}
                </Card>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
