import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Sparkles, Wand2, Check, X, Pencil } from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { CATEGORIES } from "../lib/constants";
import { Modal, Button, Input, Select, Spinner } from "./ui";

const TYPES = [
  { value: "expense", label: "Pengeluaran", icon: ArrowUpRight, color: "var(--rose)" },
  { value: "income", label: "Pemasukan", icon: ArrowDownLeft, color: "var(--brand)" },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "var(--cyan)" },
];

const EXAMPLES = [
  "isi bensin bp 92 400k pakai debit ocbc",
  "makan siang padang 35rb gopay",
  "gaji masuk 8jt ke bca",
];

export default function AddTransactionModal({ open, onClose, onSaved, initialMode = "manual" }) {
  const [wallets, setWallets] = useState([]);
  const [mode, setMode] = useState(initialMode);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [category, setCategory] = useState("Makanan & Minuman");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  // AI free-text state
  const [aiText, setAiText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft] = useState(null); // { understood, confidence, wallet_matched }

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    resetForm();
    setAiText(""); setDraft(null);
    api.get("/wallets").then((r) => {
      setWallets(r.data);
      if (r.data[0]) setWalletId(r.data[0].id);
      if (r.data[1]) setToWalletId(r.data[1].id);
    });
  }, [open, initialMode]);

  const resetForm = () => {
    setType("expense"); setAmount(""); setCategory("Makanan & Minuman"); setNote("");
    setDate(new Date().toISOString().slice(0, 10));
  };

  const parse = async (text) => {
    const t = (text ?? aiText).trim();
    if (!t) return toast.error("Tulis dulu transaksinya");
    setParsing(true); setDraft(null);
    try {
      const { data } = await api.post("/ai/parse-transaction", { text: t });
      setType(data.type || "expense");
      setAmount(String(data.amount || ""));
      setCategory(data.category || "Lainnya");
      setNote(data.note || "");
      setDate(data.date || new Date().toISOString().slice(0, 10));
      const matched = data.wallet_id && wallets.some((w) => w.id === data.wallet_id);
      if (matched) setWalletId(data.wallet_id);
      else if (wallets[0]) setWalletId(wallets[0].id);
      setDraft({ understood: data.understood, confidence: data.confidence, matched, wallet_name: data.wallet_name });
      toast.success("Nusa sudah paham — cek & konfirmasi ya");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memahami teks");
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Masukkan jumlah yang valid");
    if (!walletId) return toast.error("Pilih dompet dulu");
    if (type === "transfer" && (!toWalletId || toWalletId === walletId))
      return toast.error("Pilih dompet tujuan yang berbeda");
    setSaving(true);
    try {
      await api.post("/transactions", {
        type, amount: amt, wallet_id: walletId,
        to_wallet_id: type === "transfer" ? toWalletId : null,
        category: type === "income" ? (["Gaji", "Bonus", "Investasi", "Lainnya"].includes(category) ? category : "Gaji") : category,
        note, date, source: draft ? "ai_text" : "manual",
      });
      toast.success("Transaksi tersimpan!");
      onSaved?.();
      onClose();
    } catch {
      toast.error("Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  };

  const reject = () => { setDraft(null); setAmount(""); setNote(""); setAiText(""); };

  const showForm = mode === "manual" || (mode === "ai" && draft);

  return (
    <Modal open={open} onClose={onClose} title="Tambah Transaksi" testid="add-transaction-modal">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-elevated rounded-full p-1 mb-5">
        <button data-testid="mode-ai-tab" onClick={() => setMode("ai")}
          className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-colors",
            mode === "ai" ? "bg-brand text-black" : "text-tsecondary")}>
          <Sparkles size={15} /> Teks AI
        </button>
        <button data-testid="mode-manual-tab" onClick={() => setMode("manual")}
          className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-colors",
            mode === "manual" ? "bg-brand text-black" : "text-tsecondary")}>
          <Pencil size={15} /> Manual
        </button>
      </div>

      {/* AI input */}
      {mode === "ai" && !draft && (
        <div className="space-y-4">
          <div>
            <span className="block text-xs font-semibold text-tsecondary uppercase tracking-wider mb-2">Tulis transaksimu sehari-hari</span>
            <textarea data-testid="ai-text-input" value={aiText} onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); parse(); } }}
              rows={3} placeholder="cth: isi bensin bp 92 400k pakai debit ocbc"
              className="w-full bg-elevated border border-borderc rounded-xl px-4 py-3 text-tprimary placeholder:text-tmuted focus:border-brand focus:outline-none resize-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => { setAiText(ex); parse(ex); }}
                className="text-xs bg-elevated hover:bg-borderc text-tsecondary px-3 py-1.5 rounded-full transition-colors">{ex}</button>
            ))}
          </div>
          <Button data-testid="ai-parse-button" onClick={() => parse()} disabled={parsing} className="w-full" size="lg">
            {parsing ? <><Spinner size={16} /> Nusa lagi mikir...</> : <><Wand2 size={16} /> Pahami dengan Nusa</>}
          </Button>
        </div>
      )}

      {/* Confirmation banner (AI draft) */}
      {mode === "ai" && draft && (
        <div className="mb-4 rounded-xl border border-brand/40 bg-brand/10 p-3.5">
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-brand shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{draft.understood || "Nusa sudah mengekstrak transaksimu."}</p>
              <p className="text-xs text-tsecondary mt-1">
                Keyakinan {Math.round((draft.confidence || 0) * 100)}%.
                {!draft.matched && <span className="text-amber"> Dompet belum yakin{draft.wallet_name ? ` ("${draft.wallet_name}")` : ""} — pilih manual di bawah.</span>}
                {" "}Cek, koreksi bila perlu, lalu setujui.
              </p>
            </div>
            <button onClick={reject} data-testid="ai-reject-button" title="Tolak & ulang"
              className="p-1.5 rounded-lg hover:bg-elevated text-tmuted hover:text-rose"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Shared form (manual, or AI confirmation/correction) */}
      {showForm && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button key={t.value} data-testid={`txn-type-${t.value}`} onClick={() => setType(t.value)}
                className={clsx("flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors",
                  type === t.value ? "border-transparent text-black" : "border-borderc text-tsecondary hover:bg-elevated")}
                style={type === t.value ? { backgroundColor: t.color } : undefined}>
                <t.icon size={18} /> {t.label}
              </button>
            ))}
          </div>

          <Input data-testid="txn-amount-input" label="Jumlah" prefix="Rp" type="number" inputMode="numeric"
            placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />

          <Select data-testid="txn-wallet-select" label={type === "transfer" ? "Dari Dompet" : "Dompet"}
            value={walletId} onChange={(e) => setWalletId(e.target.value)}
            className={mode === "ai" && draft && !draft.matched ? "border-amber" : ""}>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>

          {type === "transfer" && (
            <Select data-testid="txn-to-wallet-select" label="Ke Dompet" value={toWalletId} onChange={(e) => setToWalletId(e.target.value)}>
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          )}

          {type === "expense" && (
            <Select data-testid="txn-category-select" label="Kategori" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.filter((c) => !["Gaji", "Bonus"].includes(c.name)).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </Select>
          )}
          {type === "income" && (
            <Select data-testid="txn-income-category-select" label="Sumber" value={category} onChange={(e) => setCategory(e.target.value)}>
              {["Gaji", "Bonus", "Investasi", "Lainnya"].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Catatan" placeholder="opsional" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex gap-2">
            {mode === "ai" && draft && (
              <Button variant="secondary" onClick={reject} data-testid="ai-reject-button-2" className="shrink-0"><X size={16} /> Tolak</Button>
            )}
            <Button data-testid="txn-save-button" onClick={save} disabled={saving} className="flex-1" size="lg">
              {saving ? "Menyimpan..." : (mode === "ai" && draft ? <><Check size={18} /> Setujui & Simpan</> : "Simpan Transaksi")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
