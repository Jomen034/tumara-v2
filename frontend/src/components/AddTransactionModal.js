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
  Image as ImageIcon,
  UploadCloud,
  ScanLine,
  RotateCcw,
  Target,
  Receipt,
} from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { CATEGORIES, catMeta } from "../lib/constants";
import { formatRp, formatShort } from "../lib/format";
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
  const [goals, setGoals] = useState([]);
  const [goalId, setGoalId] = useState("");
  const [mode, setMode] = useState(initialMode);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [category, setCategory] = useState("Groceries & Kebutuhan Rumah");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [adminFee, setAdminFee] = useState("0");
  const [adminFeeOption, setAdminFeeOption] = useState("0"); // 0 | 2500 | 6500 | custom

  // AI free-text state
  const [aiText, setAiText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft] = useState(null); // { understood, confidence, wallet_matched }

  // Receipt Scanner & Camera/Gallery state
  const cameraInputRef = useRef();
  const galleryInputRef = useRef();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamStarting, setWebcamStarting] = useState(false);
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayDateStr.slice(0, 7);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanDate, setScanDate] = useState(todayDateStr);
  const [rawScanDate, setRawScanDate] = useState("");
  const [itemized, setItemized] = useState(false);
  const [scanCategory, setScanCategory] = useState("Groceries & Kebutuhan Rumah");
  const [scanItems, setScanItems] = useState([]);
  const [subItemsDraft, setSubItemsDraft] = useState(null);

  const scanCategoryDistribution = scanItems.reduce((acc, it) => {
    const p = Number(it.price) || 0;
    if (p > 0) {
      const c = it.category || scanCategory || "Lainnya";
      acc[c] = (acc[c] || 0) + p;
    }
    return acc;
  }, {});

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    resetForm();
    resetScan();
    setAiText("");
    setDraft(null);
    Promise.all([api.get("/wallets"), api.get("/goals")])
      .then(([rw, rg]) => {
        setWallets(rw.data || []);
        setGoals(rg.data || []);
        if (rw.data?.[0]) setWalletId(rw.data[0].id);
        if (rw.data?.[1]) setToWalletId(rw.data[1].id);
      })
      .catch(() => {});
  }, [open, initialMode]);

  const resetForm = () => {
    setType("expense");
    setAmount("");
    setCategory(initialCategory || "Groceries & Kebutuhan Rumah");
    setGoalId("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setSubItemsDraft(null);
    setAdminFee("0");
    setAdminFeeOption("0");
  };

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
      toast.error("Browser tidak mendukung kamera langsung. Silakan pilih file.");
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
      console.error("Camera error:", err);
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
        processReceiptFile(f);
        toast.success("Foto struk berhasil diambil!");
      },
      "image/jpeg",
      0.92
    );
  };

  useEffect(() => {
    if (!open || mode !== "scan") {
      stopWebcam();
    }
  }, [open, mode]);

  useEffect(() => {
    return () => stopWebcam();
  }, []);

  const resetScan = () => {
    stopWebcam();
    setPreview(null);
    setFile(null);
    setScanResult(null);
    setItemized(false);
    setScanCategory("Groceries & Kebutuhan Rumah");
    setScanItems([]);
    setSubItemsDraft(null);
    setScanDate(todayDateStr);
    setRawScanDate("");
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
  const processReceiptFile = (f) => {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(f.type))
      return toast.error("Format harus JPG, PNG, atau WEBP");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setScanResult(null);
    setScanDate(todayDateStr);
    setRawScanDate("");
  };

  const pickReceipt = (e) => {
    const f = e.target.files?.[0];
    if (f) processReceiptFile(f);
    if (e.target) e.target.value = "";
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
      const cat = res.data.category || "Groceries & Kebutuhan Rumah";
      setScanCategory(cat);
      setScanItems(
        (res.data.items || []).map((it) => ({
          ...it,
          category: it.category || cat,
        }))
      );

      const rawDate = res.data.date;
      setRawScanDate(rawDate || "");
      const finalScanDate = rawDate || todayDateStr;
      setScanDate(finalScanDate);
      setDate(finalScanDate);

      toast.success("Struk berhasil dipindai!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memindai struk");
    } finally {
      setScanning(false);
    }
  };

  const applyScanCategoryToAll = (cat) => {
    setScanCategory(cat);
    setScanItems((prev) => prev.map((it) => ({ ...it, category: cat })));
    toast.success(`Semua item diubah ke "${cat}"`);
  };

  const updateScanItemCategory = (index, newCat) => {
    setScanItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, category: newCat } : it))
    );
  };

  // Transfer scan result into manual form for fine-tuning
  const editScanInManualForm = () => {
    if (!scanResult) return;
    setType("expense");
    setAmount(String(scanResult.total || ""));
    setCategory(scanCategory || "Groceries & Kebutuhan Rumah");
    setNote(scanResult.merchant || "Struk Belanja");
    setDate(scanDate || todayDateStr);
    const validItems = scanItems.filter((it) => Number(it.price) > 0);
    if (validItems.length > 0) {
      setSubItemsDraft(
        validItems.map((it) => ({
          name: it.name,
          price: Number(it.price),
          category: it.category || scanCategory || "Groceries & Kebutuhan Rumah",
          quantity: Number(it.qty || it.quantity || 1),
        }))
      );
    }
    setDraft({
      understood: `Data struk: ${scanResult.merchant || "Pembelian"}${validItems.length > 0 ? ` (${validItems.length} item)` : ""}`,
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
      const items = scanItems.filter((it) => Number(it.price) > 0);
      const chosenDate = scanDate || date || todayDateStr;
      if (itemized && items.length > 0) {
        await Promise.all(
          items.map((it) =>
            api.post("/transactions", {
              type: "expense",
              amount: Number(it.price),
              wallet_id: walletId,
              category: it.category || scanCategory || "Groceries & Kebutuhan Rumah",
              note: `${it.name}${scanResult.merchant ? " · " + scanResult.merchant : ""}`,
              date: chosenDate,
              source: "ai_receipt",
            })
          )
        );
        toast.success(`${items.length} item tersimpan sesuai kategori!`);
      } else {
        await api.post("/transactions", {
          type: "expense",
          amount: scanResult.total,
          wallet_id: walletId,
          category: scanCategory || "Groceries & Kebutuhan Rumah",
          note: scanResult.merchant || "Struk Belanja",
          date: chosenDate,
          source: "ai_receipt",
          items: items.length > 0 ? items.map((it) => ({
            name: it.name,
            price: Number(it.price),
            category: it.category || scanCategory || "Groceries & Kebutuhan Rumah",
            quantity: Number(it.qty || it.quantity || 1),
          })) : undefined,
        });
        toast.success(
          items.length > 0
            ? `Tersimpan 1 transaksi terpadu dengan ${items.length} rincian item!`
            : "Transaksi struk tersimpan!"
        );
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
    const feeNum = type === "transfer" ? (parseFloat(adminFee) || 0) : 0;
    setSaving(true);
    try {
      await api.post("/transactions", {
        type,
        amount: amt,
        wallet_id: walletId,
        to_wallet_id: type === "transfer" ? toWalletId : null,
        category:
          type === "transfer"
            ? "Transfer"
            : type === "income"
            ? ["Gaji", "Bonus", "Investasi", "Lainnya"].includes(category)
              ? category
              : "Gaji"
            : category,
        note,
        date,
        source: draft ? (draft.source || "ai_text") : "manual",
        goal_id: (type === "expense" || type === "transfer") && goalId ? goalId : undefined,
        items: subItemsDraft && subItemsDraft.length > 0 ? subItemsDraft : undefined,
      });

      if (type === "transfer" && feeNum > 0) {
        const fromWallet = wallets.find((w) => w.id === walletId)?.name || "Dompet Asal";
        const toWallet = wallets.find((w) => w.id === toWalletId)?.name || "Dompet Tujuan";
        await api.post("/transactions", {
          type: "expense",
          amount: feeNum,
          wallet_id: walletId,
          category: "Biaya Admin & Layanan",
          note: `Biaya transfer (${fromWallet} ➔ ${toWallet})${note ? ` · ${note}` : ""}`,
          date,
          source: "transfer_admin_fee",
        });
      }

      toast.success(
        type === "transfer" && feeNum > 0
          ? `Transfer ${formatRp(amt)} + Biaya Admin ${formatRp(feeNum)} berhasil dicatat!`
          : goalId
          ? "Transaksi tersimpan & progres tabungan bertambah! 🎯"
          : "Transaksi tersimpan!"
      );
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
                  if (f) processReceiptFile(f);
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
            onChange={pickReceipt}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
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
            <div className="space-y-3.5">
              <div className="bg-elevated rounded-2xl p-4 space-y-2.5 border border-borderc">
                <div className="flex justify-between text-sm">
                  <span className="text-tsecondary">Merchant</span>
                  <span className="font-semibold text-tprimary">{scanResult.merchant || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-tsecondary">Total Belanja</span>
                  <span className="font-mono font-bold text-brand">{formatRp(scanResult.total)}</span>
                </div>
                {Number(scanResult.tax_included) > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-brand bg-brand/10 border border-brand/25 rounded-xl px-2.5 py-1.5 font-medium">
                    <span>✓</span>
                    <span>{scanResult.tax_label || "Harga sudah termasuk Pajak/PB1"} {formatRp(scanResult.tax_included)} (tidak digandakan ke total)</span>
                  </div>
                )}
                {Number(scanResult.discount_total) > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber bg-amber/10 border border-amber/25 rounded-xl px-2.5 py-1.5 font-medium">
                    <span>🏷️</span>
                    <span>Diskon terdeteksi: {formatRp(scanResult.discount_total)} (total sudah neto)</span>
                  </div>
                )}
                {/* Editable Transaction Date */}
                <div className="pt-2 border-t border-borderc/60 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-tsecondary whitespace-nowrap">
                    Tanggal Transaksi:
                  </span>
                  <input
                    type="date"
                    value={scanDate}
                    onChange={(e) => {
                      setScanDate(e.target.value);
                      setDate(e.target.value);
                    }}
                    className="bg-surface border border-borderc rounded-xl px-2.5 py-1.5 text-xs text-tprimary font-mono focus:border-brand focus:outline-none"
                  />
                </div>

                {rawScanDate && rawScanDate.slice(0, 7) !== currentMonthStr && (
                  <div className="text-[11px] bg-elevated border border-borderc text-tsecondary rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between font-medium text-tprimary">
                      <span>🧾 Tanggal struk fisik:</span>
                      <span className="font-mono font-bold text-brand">{rawScanDate}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Transaksi dicatat sesuai tanggal asli ke buku kas <strong>{rawScanDate.slice(0, 7)}</strong>. Anda tetap bisa mengalihkannya ke hari ini bila diinginkan.
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setScanDate(rawScanDate);
                          setDate(rawScanDate);
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                          scanDate === rawScanDate
                            ? "bg-brand text-black font-semibold border-brand shadow-sm"
                            : "bg-surface hover:bg-elevated border-borderc text-tsecondary"
                        }`}
                      >
                        ✓ Tanggal Struk Asli ({rawScanDate})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScanDate(todayDateStr);
                          setDate(todayDateStr);
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                          scanDate === todayDateStr
                            ? "bg-amber text-black font-semibold border-amber shadow-sm"
                            : "bg-surface hover:bg-elevated border-borderc text-tsecondary"
                        }`}
                      >
                        Ganti ke Hari Ini ({todayDateStr})
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
                    value={scanCategory}
                    onChange={(e) => applyScanCategoryToAll(e.target.value)}
                    className="bg-surface border border-borderc rounded-xl px-2.5 py-1.5 text-xs text-tprimary font-medium focus:border-brand focus:outline-none"
                  >
                    {CATEGORIES.filter((c) => !["Gaji", "Bonus", "Transfer"].includes(c.name)).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Category Distribution Preview */}
              {Object.keys(scanCategoryDistribution).length > 0 && (
                <div className="bg-elevated/70 rounded-2xl p-3 border border-borderc space-y-1.5" data-testid="receipt-distribution-preview">
                  <div className="flex items-center justify-between text-xs font-semibold text-tsecondary">
                    <span>Distribusi Anggaran Belanja:</span>
                    <span className="text-[11px] font-normal text-tmuted">
                      {Object.keys(scanCategoryDistribution).length} kategori
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Object.entries(scanCategoryDistribution).map(([catName, amt]) => {
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
              {scanItems.filter((it) => Number(it.price) > 0).length > 1 && (
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
                        ? `Menyimpan ${scanItems.filter((it) => Number(it.price) > 0).length} transaksi mandiri terpisah di feed riwayat`
                        : `1 mutasi bersih di dompet, rincian ${scanItems.filter((it) => Number(it.price) > 0).length} barang tersimpan, budget dihitung per kategori`}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0",
                      itemized ? "bg-amber-500" : "bg-brand"
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

              {/* Scrollable item list showing ALL items */}
              {scanItems.length > 0 && (
                <div className="bg-surface rounded-2xl border border-borderc p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-tmuted px-1">
                    <span>Daftar Item ({scanItems.length})</span>
                    <span>Sesuaikan Kategori Per Item</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-borderc/30">
                    {scanItems.map((it, i) => (
                      <div
                        key={i}
                        className="pt-1.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-tprimary truncate">{it.name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={it.category || scanCategory}
                            onChange={(e) => updateScanItemCategory(i, e.target.value)}
                            className="bg-elevated border border-borderc rounded-lg px-2 py-0.5 text-[11px] text-tprimary focus:border-brand focus:outline-none max-w-[150px]"
                          >
                            {CATEGORIES.filter((c) => !["Gaji", "Bonus", "Transfer"].includes(c.name)).map((c) => (
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
                      <Check size={18} />{" "}
                      {itemized
                        ? `Simpan ${scanItems.filter((it) => Number(it.price) > 0).length} Item Terpisah`
                        : `Simpan 1 Transaksi Terpadu (${scanItems.filter((it) => Number(it.price) > 0).length} Item)`}
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
            <>
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

              {/* Biaya Admin Transfer */}
              <div className="space-y-2 p-3 rounded-2xl bg-surface border border-borderc">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-tprimary flex items-center gap-1.5">
                    <Receipt size={14} className="text-brand" />
                    Biaya Admin Transfer
                    <span className="text-[10px] text-tmuted font-normal">(Opsional)</span>
                  </label>
                  {parseFloat(adminFee) > 0 && (
                    <span className="text-xs font-mono font-bold text-brand">
                      +{formatRp(parseFloat(adminFee))}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                  {[
                    { label: "Gratis", value: "0" },
                    { label: "BI-Fast (2.5k)", value: "2500" },
                    { label: "Online (6.5k)", value: "6500" },
                    { label: "Kustom", value: "custom" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setAdminFeeOption(opt.value);
                        if (opt.value !== "custom") setAdminFee(opt.value);
                      }}
                      className={clsx(
                        "py-1.5 px-1 rounded-xl text-[11px] font-medium border text-center transition-all truncate",
                        adminFeeOption === opt.value
                          ? "bg-brand/15 border-brand text-brand font-semibold shadow-sm"
                          : "bg-elevated/60 border-borderc/80 text-tsecondary hover:bg-elevated"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {adminFeeOption === "custom" && (
                  <div className="pt-1">
                    <Input
                      prefix="Rp"
                      type="number"
                      inputMode="numeric"
                      placeholder="Biaya admin (cth. 1000)"
                      value={adminFee}
                      onChange={(e) => setAdminFee(e.target.value)}
                    />
                  </div>
                )}
                {parseFloat(adminFee) > 0 && (
                  <p className="text-[11px] text-tmuted pt-0.5 leading-tight">
                    💡 Biaya admin dicatat otomatis di kategori <strong className="text-tprimary">Biaya Admin & Layanan</strong> agar mutasi rekening asal pas.
                  </p>
                )}
              </div>
            </>
          )}

          {type === "expense" && (
            <Select
              data-testid="txn-category-select"
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.filter((c) => !["Gaji", "Bonus", "Transfer"].includes(c.name)).map((c) => (
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

          {/* Tautkan ke Tujuan Finansial (Opsional) */}
          {goals.length > 0 && (type === "expense" || type === "transfer") && (
            <div className="space-y-1.5 p-3 rounded-2xl bg-surface border border-borderc">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-tprimary flex items-center gap-1.5">
                  <Target size={14} className="text-brand" />
                  Alokasikan ke Tujuan Finansial
                  <span className="text-[10px] text-tmuted font-normal">(Opsional)</span>
                </label>
                {goalId && (
                  <button
                    type="button"
                    onClick={() => setGoalId("")}
                    className="text-[11px] text-rose font-medium hover:underline"
                  >
                    Batal tautkan
                  </button>
                )}
              </div>
              <Select
                value={goalId}
                onChange={(e) => {
                  const gid = e.target.value;
                  setGoalId(gid);
                  if (gid) {
                    const matchedGoal = goals.find((g) => g.id === gid);
                    if (type === "expense" && category === "Groceries & Kebutuhan Rumah") {
                      setCategory("Investasi");
                    }
                    if (!note.trim() && matchedGoal) {
                      setNote(`Nabung: ${matchedGoal.title}`);
                    }
                  }
                }}
                className={goalId ? "border-brand/60 bg-brand/5" : ""}
                data-testid="txn-goal-select"
              >
                <option value="">— Tidak ditautkan ke tujuan —</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.emoji || "🎯"} {g.title} (Target: {formatShort(g.target_amount)})
                  </option>
                ))}
              </Select>
              {goalId && (
                <p className="text-[11px] text-brand flex items-center gap-1 pt-0.5">
                  <Check size={12} className="shrink-0" />
                  Progres target tujuan ini akan otomatis bertambah sebesar nominal transaksi.
                </p>
              )}
            </div>
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
