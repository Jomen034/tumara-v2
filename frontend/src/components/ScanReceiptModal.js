import React, { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { UploadCloud, ScanLine, Check, RotateCcw, Tag } from "lucide-react";
import api from "../lib/api";
import { formatRp } from "../lib/format";
import { CATEGORIES, catMeta } from "../lib/constants";
import { Modal, Button, Select, Spinner, Badge } from "./ui";

export default function ScanReceiptModal({ open, onClose, onSaved }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);
  const [receiptDate, setReceiptDate] = useState(todayStr);
  const [rawScannedDate, setRawScannedDate] = useState("");
  const [wallets, setWallets] = useState([]);
  const [walletId, setWalletId] = useState("");
  const [saving, setSaving] = useState(false);
  const [itemized, setItemized] = useState(false);
  const [receiptCategory, setReceiptCategory] = useState("Groceries & Kebutuhan Rumah");
  const [scannedItems, setScannedItems] = useState([]);

  const reset = () => {
    setPreview(null);
    setFile(null);
    setResult(null);
    setItemized(false);
    setScannedItems([]);
    setReceiptDate(todayStr);
    setRawScannedDate("");
  };

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(f.type))
      return toast.error("Format harus JPG, PNG, atau WEBP");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setScannedItems([]);
    setReceiptDate(todayStr);
    setRawScannedDate("");
  };

  const scan = async () => {
    if (!file) return;
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const [res, w] = await Promise.all([
        api.post("/ai/scan-receipt", fd),
        api.get("/wallets"),
      ]);
      setResult(res.data);
      const cat = res.data.category || "Groceries & Kebutuhan Rumah";
      setReceiptCategory(cat);
      setScannedItems(
        (res.data.items || []).map((it) => ({
          ...it,
          category: it.category || cat,
        }))
      );
      setWallets(w.data);
      if (w.data[0]) setWalletId(w.data[0].id);

      const rawDate = res.data.date;
      setRawScannedDate(rawDate || "");
      if (rawDate) {
        const rawMonth = rawDate.slice(0, 7);
        if (rawMonth !== currentMonthStr) {
          setReceiptDate(todayStr);
        } else {
          setReceiptDate(rawDate);
        }
      } else {
        setReceiptDate(todayStr);
      }

      toast.success("Struk berhasil dipindai!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memindai struk");
    } finally {
      setScanning(false);
    }
  };

  const updateItemCategory = (index, newCat) => {
    setScannedItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, category: newCat } : it))
    );
  };

  const applyCategoryToAll = (cat) => {
    setReceiptCategory(cat);
    setScannedItems((prev) => prev.map((it) => ({ ...it, category: cat })));
    toast.success(`Semua item diubah ke "${cat}"`);
  };

  const categoryDistribution = scannedItems.reduce((acc, it) => {
    const p = Number(it.price) || 0;
    if (p > 0) {
      const c = it.category || receiptCategory || "Lainnya";
      acc[c] = (acc[c] || 0) + p;
    }
    return acc;
  }, {});

  const saveTxn = async () => {
    if (!walletId) return toast.error("Pilih dompet");
    setSaving(true);
    try {
      const validItems = scannedItems.filter((it) => Number(it.price) > 0);
      if (itemized && validItems.length > 0) {
        await Promise.all(
          validItems.map((it) =>
            api.post("/transactions", {
              type: "expense",
              amount: Number(it.price),
              wallet_id: walletId,
              category: it.category || receiptCategory || "Groceries & Kebutuhan Rumah",
              note: `${it.name}${result.merchant ? " · " + result.merchant : ""}`,
              date: receiptDate || todayStr,
              source: "ai_receipt",
            })
          )
        );
        toast.success(`${validItems.length} item tersimpan sesuai kategori!`);
      } else {
        await api.post("/transactions", {
          type: "expense",
          amount: result.total,
          wallet_id: walletId,
          category: receiptCategory || "Groceries & Kebutuhan Rumah",
          note: result.merchant || "Struk Belanja",
          date: receiptDate || todayStr,
          source: "ai_receipt",
          items: validItems.length > 0 ? validItems.map((it) => ({
            name: it.name,
            price: Number(it.price),
            category: it.category || receiptCategory || "Groceries & Kebutuhan Rumah",
            quantity: Number(it.qty || it.quantity || 1),
          })) : undefined,
        });
        toast.success(
          validItems.length > 0
            ? `Tersimpan 1 transaksi terpadu dengan ${validItems.length} rincian item!`
            : "Tersimpan sebagai transaksi!"
        );
      }
      onSaved?.();
      onClose();
      reset();
    } catch {
      toast.error("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const expenseCategories = CATEGORIES.filter(
    (c) => !["Gaji", "Bonus", "Transfer"].includes(c.name)
  );

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Scan Struk dengan AI"
      testid="scan-receipt-modal"
      size="md"
    >
      <div className="space-y-4">
        {!preview && (
          <button
            data-testid="receipt-upload-dropzone"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-borderc rounded-2xl py-12 flex flex-col items-center gap-3 hover:border-brand transition-colors bg-elevated/40"
          >
            <div className="w-14 h-14 rounded-2xl bg-elevated flex items-center justify-center">
              <UploadCloud size={26} className="text-brand" />
            </div>
            <p className="font-semibold text-sm">Ambil foto atau upload struk</p>
            <p className="text-xs text-tmuted">JPG, PNG, atau WEBP</p>
          </button>
        )}
        <input
          ref={fileRef}
          data-testid="receipt-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pick}
          className="hidden"
        />

        {preview && (
          <div className="rounded-2xl overflow-hidden border border-borderc max-h-56 flex items-center justify-center bg-elevated">
            <img src={preview} alt="struk" className="max-h-56 object-contain" />
          </div>
        )}

        {preview && !result && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} className="flex-1">
              <RotateCcw size={16} /> Ganti
            </Button>
            <Button
              data-testid="receipt-scan-button"
              onClick={scan}
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

        {result && (
          <div className="space-y-3.5">
            {/* Summary card */}
            <div className="bg-elevated rounded-2xl p-4 space-y-2.5 border border-borderc">
              <div className="flex justify-between text-sm">
                <span className="text-tsecondary">Merchant</span>
                <span className="font-semibold text-tprimary">{result.merchant || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-tsecondary">Total Belanja</span>
                <span className="font-mono font-bold text-brand">{formatRp(result.total)}</span>
              </div>
              {/* Editable Transaction Date */}
              <div className="pt-2 border-t border-borderc/60 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-tsecondary whitespace-nowrap">
                  Tanggal Transaksi:
                </span>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="bg-surface border border-borderc rounded-xl px-2.5 py-1.5 text-xs text-tprimary font-mono focus:border-brand focus:outline-none"
                />
              </div>

              {rawScannedDate && rawScannedDate.slice(0, 7) !== currentMonthStr && (
                <div className="text-[11px] bg-amber/10 border border-amber/25 text-amber rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between font-medium">
                    <span>⚠️ Struk fisik tertera tanggal:</span>
                    <span className="font-mono font-bold">{rawScannedDate}</span>
                  </div>
                  <p className="text-tsecondary text-[11px] leading-relaxed">
                    Tumara mengarahkan ke tanggal <strong className="text-tprimary font-mono">{receiptDate}</strong> agar transaksi ini otomatis dihitung ke anggaran bulan berjalan ({currentMonthStr}).
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setReceiptDate(todayStr)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                        receiptDate === todayStr
                          ? "bg-brand text-black font-semibold border-brand shadow-sm"
                          : "bg-surface hover:bg-elevated border-borderc text-tsecondary"
                      }`}
                    >
                      ✓ Pakai Hari Ini ({todayStr})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptDate(rawScannedDate)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                        receiptDate === rawScannedDate
                          ? "bg-amber text-black font-semibold border-amber shadow-sm"
                          : "bg-surface hover:bg-elevated border-borderc text-tsecondary"
                      }`}
                    >
                      Pakai Tanggal Struk Asli ({rawScannedDate})
                    </button>
                  </div>
                </div>
              )}

              {/* Editable overall category */}
              <div className="pt-2 border-t border-borderc/60 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-tsecondary whitespace-nowrap">
                  Kategori Struk:
                </span>
                <select
                  value={receiptCategory}
                  onChange={(e) => applyCategoryToAll(e.target.value)}
                  className="bg-surface border border-borderc rounded-xl px-2.5 py-1.5 text-xs text-tprimary font-medium focus:border-brand focus:outline-none"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Category Distribution Preview */}
            {Object.keys(categoryDistribution).length > 0 && (
              <div className="bg-elevated/70 rounded-2xl p-3 border border-borderc space-y-1.5" data-testid="receipt-distribution-preview">
                <div className="flex items-center justify-between text-xs font-semibold text-tsecondary">
                  <span>Distribusi Anggaran Belanja:</span>
                  <span className="text-[11px] font-normal text-tmuted">
                    {Object.keys(categoryDistribution).length} kategori
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {Object.entries(categoryDistribution).map(([catName, amt]) => {
                    const meta = catMeta(catName);
                    return (
                      <span
                        key={catName}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-surface border border-borderc/80 text-tprimary"
                      >
                        <span>{meta.emoji}</span>
                        <span className="text-tsecondary">{catName}:</span>
                        <strong className="font-mono text-brand font-semibold">{formatRp(amt)}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Storage Mode Toggle */}
            {scannedItems.filter((it) => Number(it.price) > 0).length > 1 && (
              <button
                data-testid="itemize-toggle"
                onClick={() => setItemized((v) => !v)}
                className="w-full flex items-center justify-between bg-elevated rounded-xl px-4 py-3 text-sm border border-borderc/60 hover:bg-elevated/80 transition-colors text-left"
              >
                <div className="pr-3">
                  <span className="font-medium text-tprimary flex items-center gap-1.5">
                    {itemized ? "✂️ Mode: Pecah Jadi Banyak Transaksi Terpisah" : "🧾 Mode: 1 Transaksi Terpadu + Sub-Items (Rekomendasi)"}
                  </span>
                  <p className="text-xs text-tmuted mt-0.5">
                    {itemized
                      ? `Menyimpan ${scannedItems.filter((it) => Number(it.price) > 0).length} transaksi mandiri terpisah di feed riwayat`
                      : `1 mutasi bersih di dompet, rincian ${scannedItems.filter((it) => Number(it.price) > 0).length} barang tersimpan, budget dihitung per kategori`}
                  </p>
                </div>
                <span
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                    itemized ? "bg-amber-500" : "bg-brand"
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      itemized ? "translate-x-5" : ""
                    }`}
                  />
                </span>
              </button>
            )}

            {/* Scrollable item list showing ALL items */}
            {scannedItems.length > 0 && (
              <div className="bg-surface rounded-2xl border border-borderc p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-tmuted px-1">
                  <span>Daftar Item ({scannedItems.length})</span>
                  <span>Sesuaikan Kategori Per Item</span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-borderc/30">
                  {scannedItems.map((it, i) => (
                    <div
                      key={i}
                      className="pt-1.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-tprimary truncate">{it.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={it.category || receiptCategory}
                          onChange={(e) => updateItemCategory(i, e.target.value)}
                          className="bg-elevated border border-borderc rounded-lg px-2 py-0.5 text-[11px] text-tprimary focus:border-brand focus:outline-none max-w-[150px]"
                        >
                          {expenseCategories.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono font-semibold text-tprimary">
                          {formatRp(it.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

            <Button
              data-testid="receipt-save-button"
              onClick={saveTxn}
              disabled={saving}
              className="w-full"
              size="lg"
            >
              {saving ? (
                "Menyimpan..."
              ) : (
                <>
                  <Check size={18} />{" "}
                  {itemized
                    ? `Simpan ${scannedItems.filter((it) => Number(it.price) > 0).length} Item Terpisah`
                    : `Simpan 1 Transaksi Terpadu (${scannedItems.filter((it) => Number(it.price) > 0).length} Item)`}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
