export const CATEGORIES = [
  { name: "Groceries & Kebutuhan Rumah", icon: "ShoppingCart", emoji: "🛒", color: "#10B981" },
  { name: "Makanan & Minuman", icon: "UtensilsCrossed", emoji: "🍜", color: "#FF7A45" },
  { name: "Transportasi", icon: "Car", emoji: "🚗", color: "#38BDF8" },
  { name: "Belanja", icon: "ShoppingBag", emoji: "🛍️", color: "#E879F9" },
  { name: "Tagihan & Utilitas", icon: "ReceiptText", emoji: "⚡", color: "#FBBF24" },
  { name: "Cicilan & Pinjaman", icon: "Landmark", emoji: "🏛️", color: "#EC4899" },
  { name: "Biaya Admin & Layanan", icon: "Receipt", emoji: "🏷️", color: "#6366F1" },
  { name: "Hiburan", icon: "Gamepad2", emoji: "🎮", color: "#A78BFA" },
  { name: "Kesehatan", icon: "HeartPulse", emoji: "💊", color: "#FB7185" },
  { name: "Pendidikan", icon: "GraduationCap", emoji: "🎓", color: "#34D399" },
  { name: "Investasi", icon: "TrendingUp", emoji: "📈", color: "#00E676" },
  { name: "Gaji", icon: "Wallet", emoji: "💰", color: "#22D3EE" },
  { name: "Bonus", icon: "Gift", emoji: "🎁", color: "#F472B6" },
  { name: "Transfer", icon: "ArrowLeftRight", emoji: "🔄", color: "#00F0FF" },
  { name: "Lainnya", icon: "MoreHorizontal", emoji: "📦", color: "#94A3B8" },
];

export const TRANSACTION_TYPES = [
  { value: "expense", label: "Pengeluaran", emoji: "💸", color: "var(--rose)", sign: "-" },
  { value: "income", label: "Pemasukan", emoji: "💰", color: "var(--brand)", sign: "+" },
  { value: "transfer", label: "Transfer", emoji: "🔄", color: "var(--cyan)", sign: "➔" },
];

export const BUDGET_GROUPS = [
  { key: "needs", label: "Kebutuhan", emoji: "🛡️", target: "50%", color: "var(--brand)" },
  { key: "wants", label: "Keinginan", emoji: "✨", target: "30%", color: "var(--amber)" },
  { key: "savings", label: "Tabungan", emoji: "📈", target: "20%", color: "var(--cyan)" },
];

export const catMeta = (name, type) => {
  if (type === "transfer" || name === "Transfer") {
    return (
      CATEGORIES.find((c) => c.name === "Transfer") || {
        name: "Transfer",
        icon: "ArrowLeftRight",
        emoji: "🔄",
        color: "#00F0FF",
      }
    );
  }
  if (!name) return CATEGORIES[CATEGORIES.length - 1];
  const exact = CATEGORIES.find((c) => c.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  if (
    lower.includes("transfer") ||
    lower.includes("top up") ||
    lower.includes("topup") ||
    lower.includes("pindah dana")
  ) {
    return (
      CATEGORIES.find((c) => c.name === "Transfer") || {
        name: "Transfer",
        icon: "ArrowLeftRight",
        emoji: "🔄",
        color: "#00F0FF",
      }
    );
  }
  if (
    lower.includes("admin") ||
    lower.includes("layanan") ||
    lower.includes("service") ||
    lower.includes("pajak") ||
    lower.includes("ppn") ||
    lower.includes("pb1") ||
    lower.includes("fee")
  ) {
    return (
      CATEGORIES.find((c) => c.name === "Biaya Admin & Layanan") || {
        name: "Biaya Admin & Layanan",
        icon: "Receipt",
        emoji: "🏷️",
        color: "#6366F1",
      }
    );
  }
  if (
    lower.includes("cicilan") ||
    lower.includes("pinjaman") ||
    lower.includes("kpr") ||
    lower.includes("kkb") ||
    lower.includes("loan") ||
    lower.includes("leasing") ||
    lower.includes("angsuran") ||
    lower.includes("car loan")
  ) {
    return (
      CATEGORIES.find((c) => c.name === "Cicilan & Pinjaman") || {
        name: "Cicilan & Pinjaman",
        icon: "Landmark",
        emoji: "🏛️",
        color: "#EC4899",
      }
    );
  }
  if (
    lower.includes("grocer") ||
    lower.includes("dapur") ||
    lower.includes("rumah tangga") ||
    lower.includes("sembako") ||
    lower.includes("supermarket") ||
    lower.includes("pasar")
  ) {
    return CATEGORIES[0];
  }
  if (
    lower.includes("makan") ||
    lower.includes("minum") ||
    lower.includes("resto") ||
    lower.includes("cafe") ||
    lower.includes("kopi")
  ) {
    return CATEGORIES[1];
  }
  return CATEGORIES[CATEGORIES.length - 1];
};

export const getCategoryEmoji = (name, type) => {
  const meta = catMeta(name, type);
  return meta?.emoji || "📦";
};

export const getTypeEmoji = (type) => {
  const t = TRANSACTION_TYPES.find((item) => item.value === type);
  return t?.emoji || "💸";
};

export const getGroupEmoji = (group) => {
  const g = BUDGET_GROUPS.find((item) => item.key === group);
  return g?.emoji || "🛡️";
};

export const WALLET_TYPES = [
  { value: "bank", label: "Rekening Bank", icon: "Landmark", emoji: "🏦", color: "#00E676" },
  { value: "ewallet", label: "E-Wallet", icon: "Smartphone", emoji: "📱", color: "#00F0FF" },
  { value: "credit_card", label: "Kartu Kredit", icon: "CreditCard", emoji: "💳", color: "#FF4D4D" },
  { value: "paylater", label: "PayLater", icon: "Clock", emoji: "⏳", color: "#FFB800" },
  { value: "cash", label: "Tunai", icon: "Banknote", emoji: "💵", color: "#34D399" },
  { value: "investment", label: "Investasi", icon: "LineChart", emoji: "📊", color: "#A78BFA" },
];

export const walletMeta = (type) =>
  WALLET_TYPES.find((w) => w.value === type) || WALLET_TYPES[0];

export const WALLET_PRESETS = [
  { name: "BCA", type: "bank" }, { name: "Mandiri", type: "bank" },
  { name: "BNI", type: "bank" }, { name: "BRI", type: "bank" },
  { name: "GoPay", type: "ewallet" }, { name: "OVO", type: "ewallet" },
  { name: "DANA", type: "ewallet" }, { name: "ShopeePay", type: "ewallet" },
  { name: "Kartu Kredit BCA", type: "credit_card" }, { name: "SPayLater", type: "paylater" },
  { name: "Tunai", type: "cash" },
];
