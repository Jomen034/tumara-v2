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
    """
    amount = int(round(txn.amount * sign))
    if txn.type == "income":
        await apply_movement(hid, txn.wallet_id, amount)
    elif txn.type == "expense":
        await apply_movement(hid, txn.wallet_id, -amount)
    elif txn.type == "transfer" and txn.to_wallet_id:
        await apply_movement(hid, txn.wallet_id, -amount)
        await apply_movement(hid, txn.to_wallet_id, amount)


async def snapshot_networth(hid: str) -> None:
    from datetime import datetime, timezone
    wallets = await db.wallets.find({"household_id": hid}, {"_id": 0}).to_list(500)
    assets = sum(w["balance"] for w in wallets if not is_debt_wallet(w))
    debt = sum(w["balance"] for w in wallets if is_debt_wallet(w))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.networth_snapshots.update_one(
        {"household_id": hid, "date": today},
        {"$set": {"household_id": hid, "date": today, "assets": assets,
                  "debt": debt, "net_worth": assets - debt, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
