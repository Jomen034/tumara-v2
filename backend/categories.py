from collections import defaultdict


def _canonical_category(cat: str) -> str:
    if not cat:
        return "Lainnya"
    c_low = cat.strip().lower()
    if any(k in c_low for k in ["admin", "service", "layanan", "fee", "biaya admin", "biaya layanan", "pajak", "ppn", "pb1"]):
        return "Biaya Admin & Layanan"
    if any(k in c_low for k in ["grocer", "supermarket", "kebutuhan rumah", "belanja bulanan"]):
        return "Groceries & Kebutuhan Rumah"
    if any(k in c_low for k in ["makan", "minum", "restoran", "cafe", "f&b", "kopi"]):
        return "Makanan & Minuman"
    if any(k in c_low for k in ["tagihan", "utilitas", "listrik", "air", "internet", "wifi", "pulsa"]):
        return "Tagihan & Utilitas"
    if any(k in c_low for k in ["cicilan", "pinjaman", "kpr", "kkb", "loan", "leasing", "angsuran"]):
        return "Cicilan & Pinjaman"
    if any(k in c_low for k in ["transport", "bensin", "ojol", "parkir", "tol"]):
        return "Transportasi"
    if any(k in c_low for k in ["sehat", "obat", "apotek", "medis", "dokter"]):
        return "Kesehatan"
    if any(k in c_low for k in ["invest", "saham", "reksadana", "bibit", "kripto"]):
        return "Investasi"
    if any(k in c_low for k in ["hibur", "nonton", "game", "bioskop"]):
        return "Hiburan"
    if "belanja" in c_low or "shopping" in c_low or "mall" in c_low:
        return "Belanja"
    if "didik" in c_low or "kursus" in c_low or "sekolah" in c_low:
        return "Pendidikan"
    if "gaji" in c_low:
        return "Gaji"
    if "bonus" in c_low or "thr" in c_low:
        return "Bonus"
    if "transfer" in c_low:
        return "Transfer"
    return cat.strip()


def _distribute_txn_categories(t: dict) -> dict:
    """Distributes an expense transaction's amount across categories based on sub-items if present."""
    items = t.get("items")
    parent_cat = _canonical_category(t.get("category") or "Lainnya")
    total_amount = float(t.get("amount", 0))
    if items and isinstance(items, list) and len(items) > 0:
        dist = defaultdict(float)
        item_total = 0.0
        for it in items:
            if isinstance(it, dict):
                p = float(it.get("price") or 0)
                if p > 0:
                    c = _canonical_category(it.get("category") or parent_cat)
                    dist[c] += p
                    item_total += p
        # If there is a positive remainder (e.g. tax, tip, service charge), credit to parent category
        remainder = total_amount - item_total
        if remainder > 0:
            dist[parent_cat] += remainder
        elif remainder < 0 and item_total > 0:
            scale = total_amount / item_total
            dist = {k: v * scale for k, v in dist.items()}
        if dist:
            return dict(dist)
    return {parent_cat: total_amount}
