"""Engine saldo dompet (ledger).

Aturan saldo:
  - Dompet aset (bank, ewallet, cash, investment): balance = saldo uang.
  - Dompet utang (credit_card, paylater): balance = TOTAL TAGIHAN (positif = utang).
    Lihat frontend/src/pages/Wallets.js — label field-nya "Total Tagihan".

Karena itu, ketika uang MASUK ke dompet utang, saldo (utang) justru BERKURANG,
dan ketika uang KELUAR dari dompet utang, saldo (utang) bertambah.
"""
from db import db

DEBT_WALLET_TYPES = ("credit_card", "paylater")


def is_debt_wallet(wallet) -> bool:
    return (wallet or {}).get("type") in DEBT_WALLET_TYPES


def parse_financial_number(v) -> float:
    """Konversi input nominal (angka, string berformat IDR/US, dsb) secara presisi tanpa merusak titik desimal."""
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        clean = str(v).replace("Rp", "").replace("IDR", "").replace(" ", "").strip()
        if not clean:
            return 0.0
        # Format gabungan titik dan koma (misal 1.500.000,50 atau 1,500,000.50)
        if "." in clean and "," in clean:
            last_dot = clean.rfind(".")
            last_comma = clean.rfind(",")
            if last_comma > last_dot:
                clean = clean.replace(".", "").replace(",", ".")
            else:
                clean = clean.replace(",", "")
            return float(clean)
        # Format koma saja
        if "," in clean:
            parts = clean.split(",")
            if len(parts) == 2 and len(parts[1]) != 3:
                clean = clean.replace(",", ".")
            else:
                clean = clean.replace(",", "")
            return float(clean)
        # Format titik saja
        if "." in clean:
            parts = clean.split(".")
            if len(parts) > 2:
                # Titik ribuan berulang (misal 2.134.000)
                clean = clean.replace(".", "")
            elif len(parts) == 2:
                # Titik tunggal: jika 3 digit di belakang titik (misal 213.400), itu pemisah ribuan IDR
                # Jika bukan 3 digit (misal 213400.0 atau 213400.5), itu titik desimal float murni
                if len(parts[1]) == 3:
                    clean = parts[0] + parts[1]
                else:
                    pass
            return float(clean)
        return float(clean)
    except Exception:
        return 0.0


async def get_wallet(hid: str, wallet_id: str):
    return await db.wallets.find_one({"id": wallet_id, "household_id": hid}, {"_id": 0})


async def apply_movement(hid: str, wallet_id: str, signed_amount: float) -> bool:
    """Terapkan satu perpindahan uang.

    signed_amount > 0 berarti uang masuk ke dompet, < 0 berarti keluar.
    Untuk dompet utang arahnya dibalik otomatis.
    """
    w = await get_wallet(hid, wallet_id)
    if not w:
        return False
    delta = int(round(-signed_amount if is_debt_wallet(w) else signed_amount))
    await db.wallets.update_one(
        {"id": wallet_id, "household_id": hid}, {"$inc": {"balance": delta}}
    )
    return True


async def apply_transaction(hid: str, txn, sign: int = 1) -> None:
    """Terapkan dampak sebuah transaksi ke dompet-dompet terkait.

    sign = +1 saat transaksi dibuat, -1 saat transaksi dihapus (reversal).
    Mendukung baik Pydantic Transaction object maupun dictionary dari MongoDB.
    """
    if isinstance(txn, dict):
        amount_val = parse_financial_number(txn.get("amount", 0))
        ttype = txn.get("type", "expense")
        wallet_id = txn.get("wallet_id")
        to_wallet_id = txn.get("to_wallet_id")
    else:
        amount_val = parse_financial_number(getattr(txn, "amount", 0))
        ttype = getattr(txn, "type", "expense")
        wallet_id = getattr(txn, "wallet_id", None)
        to_wallet_id = getattr(txn, "to_wallet_id", None)

    amount = int(round(amount_val * sign))
    if ttype == "income" and wallet_id:
        await apply_movement(hid, wallet_id, amount)
    elif ttype == "expense" and wallet_id:
        await apply_movement(hid, wallet_id, -amount)
    elif ttype == "transfer" and wallet_id and to_wallet_id:
        await apply_movement(hid, wallet_id, -amount)
        await apply_movement(hid, to_wallet_id, amount)


async def snapshot_networth(hid: str) -> None:
    from datetime import datetime, timezone
    wallets = await db.wallets.find({"household_id": hid}, {"_id": 0}).to_list(500)
    for w in wallets:
        if is_debt_wallet(w) and w.get("balance", 0) < 0:
            fixed = abs(w["balance"])
            w["balance"] = fixed
            await db.wallets.update_one({"id": w["id"], "household_id": hid}, {"$set": {"balance": fixed}})
    assets = sum(w["balance"] for w in wallets if not is_debt_wallet(w))
    debt = sum(abs(w["balance"]) for w in wallets if is_debt_wallet(w))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.networth_snapshots.update_one(
        {"household_id": hid, "date": today},
        {"$set": {"household_id": hid, "date": today, "assets": assets,
                  "debt": debt, "net_worth": assets - debt, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
