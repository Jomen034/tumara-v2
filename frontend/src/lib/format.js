export const formatRp = (n, hidden = false) => {
  if (hidden) return "Rp ••••••";
  const val = Math.round(Number(n) || 0);
  const neg = val < 0;
  const s = "Rp " + Math.abs(val).toLocaleString("id-ID");
  return neg ? "-" + s : s;
};

export const formatShort = (n, hidden = false) => {
  if (hidden) return "Rp •••";
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toFixed(1)}M`;
  if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toFixed(1)}jt`;
  if (abs >= 1e3) return `${sign}Rp ${(abs / 1e3).toFixed(0)}rb`;
  return formatRp(v);
};

export const formatDate = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return d;
  }
};

export const monthLabel = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

export const formatDateGroup = (d) => {
  if (!d || d === "Lainnya") return "Lainnya";
  try {
    const parts = d.split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const dateObj = new Date(year, month, day);

      const today = new Date();
      const isToday =
        dateObj.getDate() === today.getDate() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getFullYear() === today.getFullYear();

      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const isYesterday =
        dateObj.getDate() === yesterday.getDate() &&
        dateObj.getMonth() === yesterday.getMonth() &&
        dateObj.getFullYear() === yesterday.getFullYear();

      const formatted = dateObj.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      if (isToday) return `Hari ini · ${formatted}`;
      if (isYesterday) return `Kemarin · ${formatted}`;
      return formatted;
    }
    return formatDate(d);
  } catch {
    return d;
  }
};

