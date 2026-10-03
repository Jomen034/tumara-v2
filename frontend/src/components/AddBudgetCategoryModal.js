import React, { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import {
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Info,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import api from "../lib/api";
import { formatRp, formatShort } from "../lib/format";
import { CATEGORIES, catMeta } from "../lib/constants";
import { Modal, Button, Input, Badge, Spinner } from "./ui";

const EXPENSE_CATEGORIES = CATEGORIES.filter(
  (c) => c.name !== "Gaji" && c.name !== "Bonus" && c.name !== "Transfer"
);

const GROUP_OPTIONS = [
  {
    key: "needs",
    label: "Kebutuhan Pokok (Needs)",
    target: "Maksimal 50%",
    color: "var(--brand)",
    bg: "rgba(0, 230, 118, 0.12)",
    icon: ShieldCheck,
    desc: "Bahan mentah dapur, sembako, tagihan listrik/air, kontrakan, transportasi kerja, kesehatan, atau sekolah.",
  },
  {
    key: "wants",
    label: "Keinginan & Lifestyle (Wants)",
    target: "Maksimal 30%",
    color: "var(--amber)",
    bg: "rgba(255, 184, 0, 0.12)",
    icon: Sparkles,
    desc: "Belanja fashion, nongkrong cafe, makan resto, hiburan, hobi, streaming, liburan, dan jajan santai.",
  },
  {
    key: "savings",
    label: "Tabungan & Investasi (Savings)",
    target: "Minimal 20%",
    color: "var(--cyan)",
    bg: "rgba(0, 240, 255, 0.12)",
    icon: TrendingUp,
    desc: "Dana darurat, tabungan masa depan, reksadana, emas, portofolio investasi, atau proteksi finansial.",
  },
];

const AUTO_GROUP_MAP = {
  "Groceries & Kebutuhan Rumah": "needs",
  "Makanan & Minuman": "needs",
  "Transportasi": "needs",
  "Tagihan & Utilitas": "needs",
  "Kesehatan": "needs",
  "Pendidikan": "needs",
  "Belanja": "wants",
  "Hiburan": "wants",
  "Investasi": "savings",
};

export default function AddBudgetCategoryModal({
  open,
  onClose,
  existingCategories = [],
  monthlyIncome = 0,
  initialCategory = "",
  onAdded,
}) {
  const existingNames = new Set(existingCategories.map((c) => c.category));
  const availablePresets = EXPENSE_CATEGORIES.filter((c) => !existingNames.has(c.name));

  const [selectedType, setSelectedType] = useState("preset"); // preset | custom
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customName, setCustomName] = useState("");
  const [group, setGroup] = useState("needs");
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (open) {
      if (initialCategory && !existingNames.has(initialCategory)) {
        const isPreset = EXPENSE_CATEGORIES.some((c) => c.name === initialCategory);
        if (isPreset) {
          setSelectedType("preset");
          setSelectedCategory(initialCategory);
          setGroup(AUTO_GROUP_MAP[initialCategory] || "needs");
        } else {
          setSelectedType("custom");
          setCustomName(initialCategory);
          setGroup("needs");
        }
      } else if (availablePresets.length > 0) {
        setSelectedType("preset");
        const defaultCat = availablePresets[0].name;
        setSelectedCategory(defaultCat);
        setGroup(AUTO_GROUP_MAP[defaultCat] || "needs");
      } else {
        setSelectedType("custom");
        setSelectedCategory("");
        setGroup("needs");
      }
      setCustomName("");
      setLimit("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCategory]);

  const handleCategoryChange = (catName) => {
    setSelectedCategory(catName);
    if (AUTO_GROUP_MAP[catName]) {
      setGroup(AUTO_GROUP_MAP[catName]);
    }
  };

  const finalName =
    selectedType === "preset" ? selectedCategory : customName.trim();

  // Financial calculations & live guardrails
  const parsedLimit = parseFloat(limit) || 0;
  const currentTotal = existingCategories.reduce((acc, c) => acc + (parseFloat(c.limit) || 0), 0);
  const newTotal = currentTotal + parsedLimit;
  const inc = parseFloat(monthlyIncome) || 0;

  // Group aggregates
  const currentNeeds = existingCategories
    .filter((c) => (c.group || "needs") === "needs")
    .reduce((acc, c) => acc + (parseFloat(c.limit) || 0), 0);
  const currentWants = existingCategories
    .filter((c) => c.group === "wants")
    .reduce((acc, c) => acc + (parseFloat(c.limit) || 0), 0);
  const currentSavings = existingCategories
    .filter((c) => c.group === "savings")
    .reduce((acc, c) => acc + (parseFloat(c.limit) || 0), 0);

  const newNeeds = currentNeeds + (group === "needs" ? parsedLimit : 0);
  const newWants = currentWants + (group === "wants" ? parsedLimit : 0);
  const newSavings = currentSavings + (group === "savings" ? parsedLimit : 0);

  const newNeedsPct = inc > 0 ? Math.round((newNeeds / inc) * 100) : 0;
  const newWantsPct = inc > 0 ? Math.round((newWants / inc) * 100) : 0;
  const newSavingsPct = inc > 0 ? Math.round((newSavings / inc) * 100) : 0;

  const isOverAllocated = inc > 0 && newTotal > inc;
  const overAmount = Math.max(0, newTotal - inc);
  const remainingIncome = inc > 0 ? Math.max(0, inc - newTotal) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!finalName) {
      return toast.error("Pilih atau masukkan nama kategori");
    }
    if (existingNames.has(finalName)) {
      return toast.error(`Kategori "${finalName}" sudah ada di dalam anggaran`);
    }
    if (parsedLimit <= 0) {
      return toast.error("Masukkan nominal limit anggaran yang valid");
    }

    setLoading(true);
    try {
      await api.put(`/budget/category/${encodeURIComponent(finalName)}`, {
        limit: parsedLimit,
        group,
      });
      toast.success(`Pos ${finalName} berhasil ditambahkan ke anggaran! 🎯`);
      if (onAdded) onAdded();
      onClose();
    } catch {
      toast.error("Gagal menambahkan pos anggaran");
    } finally {
      setLoading(false);
    }
  };

  const quickPillAmounts = [
    { label: "5%", val: inc > 0 ? Math.round(inc * 0.05) : 250000 },
    { label: "10%", val: inc > 0 ? Math.round(inc * 0.1) : 500000 },
    { label: "15%", val: inc > 0 ? Math.round(inc * 0.15) : 750000 },
    { label: "20%", val: inc > 0 ? Math.round(inc * 0.2) : 1000000 },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Pos Anggaran"
      testid="add-budget-category-modal"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Category Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-tsecondary uppercase tracking-wider">
            1. Pilih Kategori Pos Pengeluaran
          </label>

          <div className="flex gap-2 p-1 bg-elevated rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedType("preset")}
              className={clsx(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                selectedType === "preset"
                  ? "bg-surface text-tprimary shadow-sm"
                  : "text-tmuted hover:text-tsecondary"
              )}
            >
              Kategori Rekomendasi
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("custom")}
              className={clsx(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                selectedType === "custom"
                  ? "bg-surface text-tprimary shadow-sm"
                  : "text-tmuted hover:text-tsecondary"
              )}
            >
              Kategori Kustom
            </button>
          </div>

          {selectedType === "preset" ? (
            availablePresets.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                {availablePresets.map((c) => {
                  const IconC = (c.icon && Icons[c.icon]) || Tag;
                  const isSelected = selectedCategory === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleCategoryChange(c.name)}
                      className={clsx(
                        "p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all text-xs",
                        isSelected
                          ? "border-brand bg-brand/10 text-tprimary font-bold shadow-sm"
                          : "border-borderc bg-surface hover:bg-elevated text-tsecondary"
                      )}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${c.color}20`, color: c.color }}
                      >
                        <IconC size={15} />
                      </div>
                      <span className="truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-tmuted p-3 rounded-xl bg-elevated text-center">
                Semua kategori standar sudah ada di anggaranmu. Gunakan tab Kategori Kustom untuk menambah pos baru!
              </p>
            )
          ) : (
            <Input
              placeholder="Contoh: Perawatan Mobil, Uang Saku Anak, Donasi..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              autoFocus
              className="text-sm"
            />
          )}
        </div>

        {/* Step 2: 50/30/20 Group Classification */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-tsecondary uppercase tracking-wider">
            2. Kelompokkan Sesuai Kaidah Finansial Sehat
          </label>
          <div className="space-y-2">
            {GROUP_OPTIONS.map((opt) => {
              const IconOpt = opt.icon;
              const isSelected = group === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={() => setGroup(opt.key)}
                  className={clsx(
                    "p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3",
                    isSelected
                      ? "border-brand bg-elevated/90 shadow-sm ring-1 ring-brand/30"
                      : "border-borderc bg-surface/60 hover:bg-elevated/40"
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: opt.bg, color: opt.color }}
                  >
                    <IconOpt size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-tprimary">{opt.label}</span>
                      <Badge color={opt.color}>{opt.target}</Badge>
                    </div>
                    <p className="text-[11px] text-tmuted mt-0.5 leading-snug">{opt.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Limit Amount Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-tsecondary uppercase tracking-wider">
            3. Tentukan Kuota Limit Bulanan
          </label>
          <Input
            prefix="Rp"
            type="number"
            placeholder="0"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="font-mono text-base font-bold"
          />

          {/* Quick percentage pill suggestions */}
          {inc > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-tmuted mr-1">Rekomendasi cepat:</span>
              {quickPillAmounts.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setLimit(String(q.val))}
                  className="px-2.5 py-1 rounded-full bg-elevated text-xs font-mono text-tsecondary hover:bg-brand/15 hover:text-brand transition-colors"
                >
                  {q.label} ({formatShort(q.val)})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 4: Live Guardrails & Financial Advisor */}
        <div className="rounded-2xl border border-borderc bg-surface p-3.5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-tsecondary">
            <span className="flex items-center gap-1.5">
              <Info size={13} className="text-brand" /> Dampak Terhadap Anggaran Bulanan
            </span>
            <span className="font-mono text-tprimary">
              Penghasilan: {formatShort(inc)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-elevated/50">
              <span className="text-[11px] text-tmuted block">Total Anggaran Baru</span>
              <span
                className={clsx(
                  "font-mono font-bold block mt-0.5",
                  isOverAllocated ? "text-rose" : "text-tprimary"
                )}
              >
                {formatRp(newTotal)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-elevated/50">
              <span className="text-[11px] text-tmuted block">
                {isOverAllocated ? "Defisit Alokasi" : "Sisa Belum Teralokasi"}
              </span>
              <span
                className={clsx(
                  "font-mono font-bold block mt-0.5",
                  isOverAllocated ? "text-rose" : "text-brand"
                )}
              >
                {isOverAllocated ? `-${formatRp(overAmount)}` : formatRp(remainingIncome)}
              </span>
            </div>
          </div>

          {/* Dynamic Health Guardrail Warnings */}
          {isOverAllocated ? (
            <div className="p-2.5 rounded-xl bg-rose/10 border border-rose/30 text-rose text-xs flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                <strong>Peringatan Defisit:</strong> Total anggaran melebihi penghasilanmu sebesar{" "}
                <span className="font-mono font-bold">{formatRp(overAmount)}</span>. Menambah pos ini tanpa memotong pos lain berisiko memicu defisit pengeluaran.
              </span>
            </div>
          ) : group === "wants" && newWantsPct > 35 ? (
            <div className="p-2.5 rounded-xl bg-amber/10 border border-amber/30 text-amber text-xs flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                <strong>Perhatian Keinginan:</strong> Alokasi pos Keinginan akan mencapai{" "}
                <strong>{newWantsPct}%</strong> (di atas rekomendasi 30%). Waspada potensi bocor halus!
              </span>
            </div>
          ) : group === "needs" && newNeedsPct > 60 ? (
            <div className="p-2.5 rounded-xl bg-amber/10 border border-amber/30 text-amber text-xs flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                <strong>Kebutuhan Dominan:</strong> Alokasi Kebutuhan Pokok mencapai{" "}
                <strong>{newNeedsPct}%</strong> (di atas patokan 50%). Pastikan menekan pos gaya hidup.
              </span>
            </div>
          ) : parsedLimit > 0 ? (
            <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/30 text-brand text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>
                <strong>Alokasi Sehat:</strong> Pos ini terencana dengan baik dalam batas finansial bulananmu.
              </span>
            </div>
          ) : null}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={loading || !finalName || parsedLimit <= 0}
            data-testid="submit-add-budget-category"
          >
            {loading ? <Spinner size={16} /> : <Plus size={16} />} Tambahkan ke Anggaran
          </Button>
        </div>
      </form>
    </Modal>
  );
}
