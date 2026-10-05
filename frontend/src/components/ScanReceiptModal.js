import React, { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  UploadCloud,
  ScanLine,
  Check,
  RotateCcw,
  Tag,
  Camera,
  Image as ImageIcon,
  X,
} from "lucide-react";
import api from "../lib/api";
import { formatRp } from "../lib/format";
import { CATEGORIES, catMeta } from "../lib/constants";
import { Modal, Button, Select, Spinner, Badge } from "./ui";

export default function ScanReceiptModal({ open, onClose, onSaved }) {
  const cameraInputRef = useRef();
  const galleryInputRef = useRef();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamStarting, setWebcamStarting] = useState(false);

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

  const isMobile = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
    );
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
    setWebcamStarting(false);
  };

  const startWebcam = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      toast.error("Browser Anda tidak mendukung kamera langsung. Silakan pilih file.");
      galleryInputRef.current?.click();
      return;
    }
    setWebcamStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setWebcamActive(true);
    } catch (err) {
      console.error("Webcam error:", err);
      toast.error("Tidak dapat mengakses kamera. Silakan pilih dari galeri atau file.");
      galleryInputRef.current?.click();
    } finally {
      setWebcamStarting(false);
    }
  };

  const captureWebcam = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return toast.error("Gagal mengambil foto dari kamera");
        const f = new File([blob], `struk_${Date.now()}.jpg`, { type: "image/jpeg" });
        stopWebcam();
        processFile(f);
        toast.success("Foto struk berhasil diambil!");
      },
      "image/jpeg",
      0.92
    );
  };

  useEffect(() => {
    if (!open) {
      stopWebcam();
    }
  }, [open]);

  useEffect(() => {
    return () => stopWebcam();
  }, []);

  const reset = () => {
    stopWebcam();
    setPreview(null);
    setFile(null);
    setResult(null);
    setItemized(false);
    setScannedItems([]);
    setReceiptDate(todayStr);
    setRawScannedDate("");
  };

  const processFile = (f) => {
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

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    if (e.target) e.target.value = "";
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
      setReceiptDate(rawDate || todayStr);

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
        {!preview && webcamActive && (
          <div className="relative rounded-2xl overflow-hidden border border-borderc bg-black flex flex-col items-center justify-center min-h-[260px]">
            <video
              ref={(el) => {
                videoRef.current = el;
                if (el && streamRef.current && el.srcObject !== streamRef.current) {
                  el.srcObject = streamRef.current;
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full max-h-72 object-contain bg-black"
            />
            <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-[11px] text-white/80 bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-sm shadow">
                Posisikan struk belanja di dalam kotak
              </span>
            </div>
            <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2.5 px-3">
              <button
                type="button"
                onClick={stopWebcam}
                className="px-3.5 py-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-medium border border-white/20 transition-all flex items-center gap-1.5 backdrop-blur-sm"
              >
                <X size={14} /> Batal
              </button>
              <button
                type="button"
                onClick={captureWebcam}
                className="px-4 py-2 rounded-full bg-brand hover:bg-brand/90 text-surface font-bold text-xs shadow-lg transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Camera size={15} /> Jepret Foto Struk
              </button>
            </div>
          </div>
        )}

        {!preview && !webcamActive && (
          <div className="space-y-3">
            <div
              data-testid="receipt-upload-dropzone"
              onClick={() => galleryInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                if (f) processFile(f);
              }}
              className="w-full border-2 border-dashed border-borderc rounded-2xl py-8 px-4 flex flex-col items-center text-center gap-2.5 hover:border-brand transition-colors bg-elevated/40 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                <UploadCloud size={24} className="text-brand" />
              </div>
              <div>
                <p className="font-semibold text-sm text-tprimary">Pilih atau Tarik Foto Struk ke Sini</p>
                <p className="text-xs text-tmuted mt-0.5">Mendukung format JPG, PNG, atau WEBP</p>
              </div>
              <span className="text-[11px] text-brand font-medium">
                {isMobile() ? "Ketuk untuk memilih dari Galeri atau File" : "Klik untuk memilih file dari komputer"}
              </span>
            </div>

            {/* Tombol aksi eksplisit: Kamera vs Galeri */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (isMobile()) {
                    cameraInputRef.current?.click();
                  } else {
                    startWebcam();
                  }
                }}
                disabled={webcamStarting}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-surface border border-borderc hover:border-brand hover:text-brand text-xs font-semibold text-tprimary transition-all shadow-sm active:scale-98"
              >
                {webcamStarting ? <Spinner size={14} /> : <Camera size={16} className="text-brand" />}
                <span>{isMobile() ? "Ambil Foto (Kamera)" : "Buka Kamera Webcam"}</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-surface border border-borderc hover:border-brand hover:text-brand text-xs font-semibold text-tprimary transition-all shadow-sm active:scale-98"
              >
                <ImageIcon size={16} className="text-cyan" />
                <span>Pilih dari Galeri</span>
              </button>
            </div>
          </div>
        )}

        <input
          ref={galleryInputRef}
          data-testid="receipt-file-input"
          type="file"
          accept="image/*"
          onChange={pick}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
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
              {Number(result.tax_included) > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand bg-brand/10 border border-brand/25 rounded-xl px-2.5 py-1.5 font-medium">
                  <span>✓</span>
                  <span>{result.tax_label || "Harga sudah termasuk Pajak/PB1"} {formatRp(result.tax_included)} (tidak digandakan ke total)</span>
                </div>
              )}
              {Number(result.discount_total) > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber bg-amber/10 border border-amber/25 rounded-xl px-2.5 py-1.5 font-medium">
                  <span>🏷️</span>
                  <span>Diskon terdeteksi: {formatRp(result.discount_total)} (total sudah neto)</span>
                </div>
              )}
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
                <div className="text-[11px] bg-elevated border border-borderc text-tsecondary rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between font-medium text-tprimary">
                    <span>🧾 Tanggal struk fisik:</span>
                    <span className="font-mono font-bold text-brand">{rawScannedDate}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Transaksi dicatat sesuai tanggal asli ke buku kas <strong>{rawScannedDate.slice(0, 7)}</strong>. Anda tetap bisa mengalihkannya ke hari ini bila diinginkan.
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setReceiptDate(rawScannedDate)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                        receiptDate === rawScannedDate
                          ? "bg-brand text-black font-semibold border-brand shadow-sm"
                          : "bg-surface hover:bg-elevated border-borderc text-tsecondary"
                      }`}
                    >
                      ✓ Tanggal Struk Asli ({rawScannedDate})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptDate(todayStr)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                        receiptDate === todayStr
                          ? "bg-amber text-black font-semibold border-amber shadow-sm"
                          : "bg-surface hover:bg-elevated border-borderc text-tsecondary"
                      }`}
                    >
                      Ganti ke Hari Ini ({todayStr})
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
