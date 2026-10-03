export const CATEGORIES = [
  { name: "Groceries & Kebutuhan Rumah", icon: "ShoppingCart", color: "#10B981" },
  { name: "Makanan & Minuman", icon: "UtensilsCrossed", color: "#FF7A45" },
  { name: "Transportasi", icon: "Car", color: "#38BDF8" },
  { name: "Belanja", icon: "ShoppingBag", color: "#E879F9" },
  { name: "Tagihan & Utilitas", icon: "ReceiptText", color: "#FBBF24" },
  { name: "Hiburan", icon: "Gamepad2", color: "#A78BFA" },
  { name: "Kesehatan", icon: "HeartPulse", color: "#FB7185" },
  { name: "Pendidikan", icon: "GraduationCap", color: "#34D399" },
  { name: "Investasi", icon: "TrendingUp", color: "#00E676" },
  { name: "Gaji", icon: "Wallet", color: "#22D3EE" },
  { name: "Bonus", icon: "Gift", color: "#F472B6" },
  { name: "Lainnya", icon: "MoreHorizontal", color: "#94A3B8" },
];

export const catMeta = (name) => {
  if (!name) return CATEGORIES[CATEGORIES.length - 1];
  const exact = CATEGORIES.find((c) => c.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
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

export const WALLET_TYPES = [
  { value: "bank", label: "Rekening Bank", icon: "Landmark", color: "#00E676" },
  { value: "ewallet", label: "E-Wallet", icon: "Smartphone", color: "#00F0FF" },
  { value: "credit_card", label: "Kartu Kredit", icon: "CreditCard", color: "#FF4D4D" },
  { value: "paylater", label: "PayLater", icon: "Clock", color: "#FFB800" },
  { value: "cash", label: "Tunai", icon: "Banknote", color: "#34D399" },
  { value: "investment", label: "Investasi", icon: "LineChart", color: "#A78BFA" },
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
