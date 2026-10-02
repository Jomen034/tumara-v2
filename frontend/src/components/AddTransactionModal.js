import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Sparkles,
  Wand2,
  Check,
  X,
  Pencil,
  Camera,
  UploadCloud,
  ScanLine,
  RotateCcw,
} from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { CATEGORIES } from "../lib/constants";
import { formatRp } from "../lib/format";
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

export default function AddTransactionModal({
  open,
  onClose,
  onSaved,
  initialMode = "manual",
  initialCategory,
}) {
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

  // Receipt Scanner state
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [itemized, setItemized] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    resetForm();
    resetScan();
    setAiText("");
    setDraft(null);
    api.get("/wallets").then((r) => {
      setWallets(r.data);
      if (r.data[0]) setWalletId(r.data[0].id);
      if (r.data[1]) setToWalletId(r.data[1].id);
    });
  }, [open, initialMode]);

  const resetForm = () => {
    setType("expense");
    setAmount("");
    setCategory(initialCategory || "Makanan & Minuman");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
  };

  const resetScan = () => {
    setPreview(null);
    setFile(null);
    setScanResult(null);
    setItemized(false);
  };

  const parse = async (text) => {
    const t = (text ?? aiText).trim();
    if (!t) return toast.error("Tulis dulu transaksinya");
    setParsing(true);
    setDraft(null);
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
      setDraft({
        understood: data.understood,
        confidence: data.confidence,
        matched,
        wallet_name: data.wallet_name,
      });
      toast.success("Tumara sudah paham — cek & konfirmasi ya");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memahami teks");
    } finally {
      setParsing(false);
    }
  };

  // Receipt Pick
  const pickReceipt = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(f.type))
      return toast.error("Format harus JPG, PNG, atau WEBP");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setScanResult(null);
  };

  // Receipt Scan
  const scanReceipt = async () => {
    if (!file) return;
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/ai/scan-receipt", fd);
      setScanResult(res.data);
      toast.success("Struk berhasil dipindai!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memindai struk");
    } finally {
      setScanning(false);
    }
  };

  // Transfer scan result into manual form for fine-tuning
  const editScanInManualForm = () => {
    if (!scanResult) return;
    setType("expense");
    setAmount(String(scanResult.total || ""));
    setCategory(scanResult.category || "Lainnya");
    setNote(scanResult.merchant || "Struk");
    if (scanResult.date) setDate(scanResult.date);
    setDraft({
      understood: `Data struk: ${scanResult.merchant || "Pembelian"}`,
      confidence: 1,
      matched: true,
    });
    setMode("manual");
  };

  // Save directly from Scan tab
  const saveScanTxn = async () => {
    if (!walletId) return toast.error("Pilih dompet dulu");
    if (!scanResult) return toast.error("Belum ada data struk");
    setSaving(true);
    try {
      const items = (scanResult.items || []).filter((it) => Number(it.price) > 0);
      if (itemized && items.length > 0) {
        await Promise.all(
          items.map((it) =>
            api.post("/transactions", {
              type: "expense",
              amount: Number(it.price),
              wallet_id: walletId,
              category: it.category || scanResult.category || "Lainnya",
              note: `${it.name}${scanResult.merchant ? " · " + scanResult.merchant : ""}`,
              date: scanResult.date || undefined,
              source: "ai_receipt",
            })
          )
        );
        toast.success(`${items.length} item tersimpan!`);
      } else {
        await api.post("/transactions", {
          type: "expense",
          amount: scanResult.total,
          wallet_id: walletId,
          category: scanResult.category || "Lainnya",
          note: scanResult.merchant || "Struk",
          date: scanResult.date || undefined,
          source: "ai_receipt",
        });
        toast.success("Transaksi struk tersimpan!");
      }
      onSaved?.();
      onClose();
      resetScan();
    } catch {
      toast.error("Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
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
        type,
        amount: amt,
        wallet_id: walletId,
        to_wallet_id: type === "transfer" ? toWalletId : null,
        category:
          type === "income"
            ? ["Gaji", "Bonus", "Investasi", "Lainnya"].includes(category)
              ? category
              : "Gaji"
            : category,
        note,
        date,
        source: draft ? (draft.source || "ai_text") : "manual",
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

  const reject = () => {
    setDraft(null);
    setAmount("");
    setNote("");
    setAiText("");
  };

  const showForm = mode === "manual" || (mode === "ai" && draft);

  return (
    <Modal open={open} onClose={onClose} title="Tambah Transaksi" testid="add-transaction-modal">
      {/* Mode tabs: 3 options */}
      <div className="flex gap-1 bg-elevated rounded-full p-1 mb-5">
        <button
          data-testid="mode-manual-tab"
          onClick={() => setMode("manual")}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors",
            mode === "manual" ? "bg-brand text-black shadow-sm" : "text-tsecondary hover:text-tprimary"
          )}
        >
          <Pencil size={14} /> Manual
        </button>
        <button
          data-testid="mode-ai-tab"
          onClick={() => setMode("ai")}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors",
            mode === "ai" ? "bg-brand text-black shadow-sm" : "text-tsecondary hover:text-tprimary"
          )}
        >
          <Sparkles size={14} /> Teks AI
        </button>
        <button
          data-testid="mode-scan-tab"
          onClick={() => setMode("scan")}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors",
            mode === "scan" ? "bg-brand text-black shadow-sm" : "text-tsecondary hover:text-tprimary"
          )}
        >
          <Camera size={14} /> Foto Struk
        </button>
      </div>

      {/* Tab 2: AI Input */}
      {mode === "ai" && !draft && (
        <div className="space-y-4">
          <div>
            <span className="block text-xs font-semibold text-tsecondary uppercase tracking-wider mb-2">
              Tulis transaksimu sehari-hari
            </span>
            <textarea
              data-testid="ai-text-input"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  parse();
                }
              }}
              rows={3}
              placeholder="cth: isi bensin bp 92 400k pakai debit ocbc"
              className="w-full bg-elevated border border-borderc rounded-xl px-4 py-3 text-tprimary placeholder:text-tmuted focus:border-brand focus:outline-none resize-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setAiText(ex);
                  parse(ex);
                }}
                className="text-xs bg-elevated hover:bg-borderc text-tsecondary px-3 py-1.5 rounded-full transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
          <Button
            data-testid="ai-parse-button"
            onClick={() => parse()}
            disabled={parsing}
            className="w-full"
            size="lg"
          >
            {parsing ? (
              <>
                <Spinner size={16} /> Tumara lagi mikir...
              </>
            ) : (
              <>
                <Wand2 size={16} /> Pahami dengan Tumara
              </>
            )}
          </Button>
        </div>
      )}

      {/* Tab 3: Receipt Scanner */}
      {mode === "scan" && (
        <div className="space-y-4">
          {!preview && (
            <button
              data-testid="receipt-upload-dropzone"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-borderc rounded-2xl py-10 flex flex-col items-center gap-2.5 hover:border-brand transition-colors bg-elevated/40"
            >
              <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center">
                <UploadCloud size={24} className="text-brand" />
              </div>
              <p className="font-semibold text-sm">Ambil foto atau upload struk</p>
              <p className="text-xs text-tmuted">Kamera HP, JPG, PNG, atau WEBP</p>
            </button>
          )}

          <input
            ref={fileRef}
            data-testid="receipt-file-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pickReceipt}
            className="hidden"
          />

          {preview && (
            <div className="rounded-2xl overflow-hidden border border-borderc max-h-60 flex items-center justify-center bg-elevated">
              <img src={preview} alt="struk" className="max-h-60 object-contain" />
            </div>
          )}

          {preview && !scanResult && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={resetScan} className="flex-1">
                <RotateCcw size={16} /> Ganti Foto
              </Button>
              <Button
                data-testid="receipt-scan-button"
                onClick={scanReceipt}
                disabled={scanning}
                className="flex-1"
              >
                {scanning ? (
                  <>
                    <Spinner size={16} /> Memindai...
                  </>
                ) : (
                  <>
                    <ScanLine size={16} /> Pindai Struk
                  </>
                )}
              </Button>
            </div>
          )}

          {scanResult && (
            <div className="space-y-3">
              <div className="bg-elevated rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-tsecondary">Merchant</span>
                  <span className="font-semibold">{scanResult.merchant || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-tsecondary">Total</span>
                  <span className="font-mono font-bold text-brand">{formatRp(scanResult.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-tsecondary">Kategori</span>
                  <span className="font-semibold">{scanResult.category || "Lainnya"}</span>
                </div>
                {scanResult.date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-tsecondary">Tanggal</span>
                    <span>{scanResult.date}</span>
                  </div>
                )}
                {scanResult.items?.length > 0 && (
                  <div className="pt-2 border-t border-borderc space-y-1">
                    {scanResult.items.slice(0, 8).map((it, i) => (
                      <div key={i} className="flex justify-between text-xs text-tsecondary">
                        <span className="truncate mr-2">
                          {it.name}
                          {it.category ? ` · ${it.category}` : ""}
                        </span>
                        <span className="font-mono">{formatRp(it.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {scanResult.items?.filter((it) => Number(it.price) > 0).length > 1 && (
                <button
                  data-testid="itemize-toggle"
                  onClick={() => setItemized((v) => !v)}
                  className="w-full flex items-center justify-between bg-elevated rounded-xl px-4 py-3 text-sm"
                >
                  <span className="text-left">
                    <span className="font-medium">Catat tiap item terpisah</span>
                    <br />
                    <span className="text-xs text-tmuted">
                      Simpan {scanResult.items.filter((it) => Number(it.price) > 0).length} item dengan kategorinya masing-masing
                    </span>
                  </span>
                  <span
                    className={clsx(
                      "w-11 h-6 rounded-full p-0.5 transition-colors",
                      itemized ? "bg-brand" : "bg-borderc"
                    )}
                  >
                    <span
                      className={clsx(
                        "block w-5 h-5 rounded-full bg-white transition-transform",
                        itemized && "translate-x-5"
                      )}
                    />
                  </span>
                </button>
              )}

              <Select
                label="Bayar dari dompet"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                data-testid="receipt-wallet-select"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>

              <div className="flex gap-2">
                {!itemized && (
                  <Button
                    variant="secondary"
                    onClick={editScanInManualForm}
                    className="flex-1"
                  >
                    <Pencil size={15} /> Edit di Form
                  </Button>
                )}
                <Button
                  data-testid="receipt-save-button"
                  onClick={saveScanTxn}
                  disabled={saving}
                  className="flex-1"
                  size="lg"
                >
                  {saving ? (
                    "Menyimpan..."
                  ) : (
                    <>
                      <Check size={18} /> {itemized ? "Simpan Semua Item" : "Simpan Transaksi"}
                    </>
                  )}
                </Button>
              </div>

              <div className="text-center pt-1">
                <button
                  onClick={resetScan}
                  className="text-xs text-tmuted hover:text-tsecondary inline-flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Scan struk lain
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation banner (AI draft) */}
      {mode === "ai" && draft && (
        <div className="mb-4 rounded-xl border border-brand/40 bg-brand/10 p-3.5">
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-brand shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {draft.understood || "Tumara sudah mengekstrak transaksimu."}
              </p>
              <p className="text-xs text-tsecondary mt-1">
                Keyakinan {Math.round((draft.confidence || 0) * 100)}%.
                {!draft.matched && (
                  <span className="text-amber">
                    {" "}
                    Dompet belum yakin{draft.wallet_name ? ` ("${draft.wallet_name}")` : ""} — pilih manual di bawah.
                  </span>
                )}{" "}
                Cek, koreksi bila perlu, lalu setujui.
              </p>
            </div>
            <button
              onClick={reject}
              data-testid="ai-reject-button"
              title="Tolak & ulang"
              className="p-1.5 rounded-lg hover:bg-elevated text-tmuted hover:text-rose"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Shared form (manual, or AI confirmation/correction) */}
      {showForm && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                data-testid={`txn-type-${t.value}`}
                onClick={() => setType(t.value)}
                className={clsx(
                  "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors",
                  type === t.value
                    ? "border-transparent text-black"
                    : "border-borderc text-tsecondary hover:bg-elevated"
                )}
                style={type === t.value ? { backgroundColor: t.color } : undefined}
              >
                <t.icon size={18} /> {t.label}
              </button>
            ))}
          </div>

          {wallets.length === 0 && (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
              <span>Kamu belum punya dompet. Buat dompet dulu yuk!</span>
              <a href="/wallets" className="underline font-semibold shrink-0">
                Buka Dompet
              </a>
            </div>
          )}

          <Input
            data-testid="txn-amount-input"
            label="Jumlah"
            prefix="Rp"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Select
            data-testid="txn-wallet-select"
            label={type === "transfer" ? "Dari Dompet" : "Dompet"}
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className={mode === "ai" && draft && !draft.matched ? "border-amber" : ""}
          >
            {wallets.length === 0 && <option value="">Belum ada dompet</option>}
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>

          {type === "transfer" && (
            <Select
              data-testid="txn-to-wallet-select"
              label="Ke Dompet"
              value={toWalletId}
              onChange={(e) => setToWalletId(e.target.value)}
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          )}

          {type === "expense" && (
            <Select
              data-testid="txn-category-select"
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.filter((c) => !["Gaji", "Bonus"].includes(c.name)).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {type === "income" && (
            <Select
              data-testid="txn-income-category-select"
              label="Sumber"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["Gaji", "Bonus", "Investasi", "Lainnya"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}

          {/* Tanggal: Full-width dedicated row */}
          <Input
            label="Tanggal"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="txn-date-input"
          />

          {/* Catatan: Full-width dedicated row for spacious readability */}
          <Input
            label="Catatan"
            placeholder="cth. Makan siang kantor, bensin, langganan Netflix (opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="txn-note-input"
          />

          <div className="flex gap-2">
            {mode === "ai" && draft && (
              <Button
                variant="secondary"
                onClick={reject}
                data-testid="ai-reject-button-2"
                className="shrink-0"
              >
                <X size={16} /> Tolak
              </Button>
            )}
            <Button
              data-testid="txn-save-button"
              onClick={save}
              disabled={saving}
              className="flex-1"
              size="lg"
            >
              {saving ? (
                "Menyimpan..."
              ) : mode === "ai" && draft ? (
                <>
                  <Check size={18} /> Setujui & Simpan
                </>
              ) : (
                "Simpan Transaksi"
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
