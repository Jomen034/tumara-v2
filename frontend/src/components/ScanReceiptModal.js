import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, ScanLine, Check, RotateCcw } from "lucide-react";
import api from "../lib/api";
import { formatRp } from "../lib/format";
import { Modal, Button, Select, Spinner } from "./ui";

export default function ScanReceiptModal({ open, onClose, onSaved }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [walletId, setWalletId] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setPreview(null); setFile(null); setResult(null); };

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(f.type))
      return toast.error("Format harus JPG, PNG, atau WEBP");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const scan = async () => {
    if (!file) return;
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const [res, w] = await Promise.all([
        api.post("/ai/scan-receipt", fd, { headers: { "Content-Type": "multipart/form-data" } }),
        api.get("/wallets"),
      ]);
      setResult(res.data);
      setWallets(w.data);
      if (w.data[0]) setWalletId(w.data[0].id);
      toast.success("Struk berhasil dipindai!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memindai struk");
    } finally {
      setScanning(false);
    }
  };

  const saveTxn = async () => {
    if (!walletId) return toast.error("Pilih dompet");
    setSaving(true);
    try {
      await api.post("/transactions", {
        type: "expense", amount: result.total, wallet_id: walletId,
        category: result.category || "Lainnya", note: result.merchant || "Struk",
        date: result.date || undefined, source: "ai_receipt",
      });
      toast.success("Tersimpan sebagai transaksi!");
      onSaved?.();
      onClose(); reset();
    } catch {
      toast.error("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Scan Struk dengan AI" testid="scan-receipt-modal">
      <div className="space-y-4">
        {!preview && (
          <button data-testid="receipt-upload-dropzone" onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-borderc rounded-2xl py-12 flex flex-col items-center gap-3 hover:border-brand transition-colors">
            <div className="w-14 h-14 rounded-2xl bg-elevated flex items-center justify-center">
              <UploadCloud size={26} className="text-brand" />
            </div>
            <p className="font-semibold text-sm">Ambil foto atau upload struk</p>
            <p className="text-xs text-tmuted">JPG, PNG, atau WEBP</p>
          </button>
        )}
        <input ref={fileRef} data-testid="receipt-file-input" type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />

        {preview && (
          <div className="rounded-2xl overflow-hidden border border-borderc max-h-64 flex items-center justify-center bg-elevated">
            <img src={preview} alt="struk" className="max-h-64 object-contain" />
          </div>
        )}

        {preview && !result && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} className="flex-1"><RotateCcw size={16} /> Ganti</Button>
            <Button data-testid="receipt-scan-button" onClick={scan} disabled={scanning} className="flex-1">
              {scanning ? <><Spinner size={16} /> Memindai...</> : <><ScanLine size={16} /> Pindai Struk</>}
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="bg-elevated rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-tsecondary">Merchant</span><span className="font-semibold">{result.merchant || "-"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-tsecondary">Total</span><span className="font-mono font-bold text-brand">{formatRp(result.total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-tsecondary">Kategori</span><span className="font-semibold">{result.category}</span></div>
              {result.date && <div className="flex justify-between text-sm"><span className="text-tsecondary">Tanggal</span><span>{result.date}</span></div>}
              {result.items?.length > 0 && (
                <div className="pt-2 border-t border-borderc space-y-1">
                  {result.items.slice(0, 6).map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-tsecondary">
                      <span className="truncate mr-2">{it.name}</span><span className="font-mono">{formatRp(it.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Select label="Bayar dari dompet" value={walletId} onChange={(e) => setWalletId(e.target.value)} data-testid="receipt-wallet-select">
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
            <Button data-testid="receipt-save-button" onClick={saveTxn} disabled={saving} className="w-full" size="lg">
              {saving ? "Menyimpan..." : <><Check size={18} /> Simpan Transaksi</>}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
