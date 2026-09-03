import io
import csv
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from db import db
from models import (
    Wallet, WalletCreate, Transaction, TransactionCreate,
    Budget, BudgetCreate, Goal, GoalCreate, GoalDeposit,
)
from deps import get_ctx, Ctx, household_members

router = APIRouter(tags=["finance"])


def _month():
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def _snapshot_networth(hid: str):
    wallets = await db.wallets.find({"household_id": hid}, {"_id": 0}).to_list(500)
    assets = sum(w["balance"] for w in wallets if w["type"] not in ("credit_card", "paylater"))
    debt = sum(w["balance"] for w in wallets if w["type"] in ("credit_card", "paylater"))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.networth_snapshots.update_one(
        {"household_id": hid, "date": today},
        {"$set": {"household_id": hid, "date": today, "assets": assets,
                  "debt": debt, "net_worth": assets - debt, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


# ---------------- Wallets ----------------
@router.get("/wallets")
async def list_wallets(ctx: Ctx = Depends(get_ctx)):
    return await db.wallets.find({"household_id": ctx.hid}, {"_id": 0}).to_list(500)


@router.post("/wallets")
async def create_wallet(body: WalletCreate, ctx: Ctx = Depends(get_ctx)):
    w = Wallet(user_id=ctx.user.user_id, **body.model_dump())
    doc = w.model_dump()
    doc["household_id"] = ctx.hid
    await db.wallets.insert_one(doc)
    doc.pop("_id", None)
    await _snapshot_networth(ctx.hid)
    return doc


@router.put("/wallets/{wallet_id}")
async def update_wallet(wallet_id: str, body: WalletCreate, ctx: Ctx = Depends(get_ctx)):
    res = await db.wallets.update_one(
        {"id": wallet_id, "household_id": ctx.hid}, {"$set": body.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Wallet not found")
    await _snapshot_networth(ctx.hid)
    return await db.wallets.find_one({"id": wallet_id}, {"_id": 0})


@router.delete("/wallets/{wallet_id}")
async def delete_wallet(wallet_id: str, ctx: Ctx = Depends(get_ctx)):
    await db.wallets.delete_one({"id": wallet_id, "household_id": ctx.hid})
    await _snapshot_networth(ctx.hid)
    return {"ok": True}


# ---------------- Transactions ----------------
async def _apply_txn(hid: str, t: Transaction, sign: int):
    if t.type == "income":
        await db.wallets.update_one({"id": t.wallet_id, "household_id": hid}, {"$inc": {"balance": sign * t.amount}})
    elif t.type == "expense":
        await db.wallets.update_one({"id": t.wallet_id, "household_id": hid}, {"$inc": {"balance": -sign * t.amount}})
    elif t.type == "transfer" and t.to_wallet_id:
        await db.wallets.update_one({"id": t.wallet_id, "household_id": hid}, {"$inc": {"balance": -sign * t.amount}})
        await db.wallets.update_one({"id": t.to_wallet_id, "household_id": hid}, {"$inc": {"balance": sign * t.amount}})


@router.get("/transactions")
async def list_transactions(limit: int = 100, member_id: str = None, ctx: Ctx = Depends(get_ctx)):
    q = {"household_id": ctx.hid}
    if member_id:
        q["member_id"] = member_id
    return await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)


async def _new_txn(ctx: Ctx, data: dict) -> Transaction:
    if not data.get("date"):
        data["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    t = Transaction(user_id=ctx.user.user_id, **data)
    doc = t.model_dump()
    doc["household_id"] = ctx.hid
    doc["member_id"] = ctx.user.user_id
    await db.transactions.insert_one(doc)
    await _apply_txn(ctx.hid, t, +1)
    return t


@router.post("/transactions")
async def create_transaction(body: TransactionCreate, ctx: Ctx = Depends(get_ctx)):
    t = await _new_txn(ctx, body.model_dump())
    await _snapshot_networth(ctx.hid)
    out = t.model_dump()
    out["household_id"] = ctx.hid
    out["member_id"] = ctx.user.user_id
    return out


@router.delete("/transactions/{txn_id}")
async def delete_transaction(txn_id: str, ctx: Ctx = Depends(get_ctx)):
    doc = await db.transactions.find_one({"id": txn_id, "household_id": ctx.hid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    await _apply_txn(ctx.hid, Transaction(**doc), -1)
    await db.transactions.delete_one({"id": txn_id})
    await _snapshot_networth(ctx.hid)
    return {"ok": True}


# ---------------- CSV Export / Import ----------------
@router.get("/transactions/export")
async def export_transactions(ctx: Ctx = Depends(get_ctx)):
    txns = await db.transactions.find({"household_id": ctx.hid}, {"_id": 0}).sort("date", -1).to_list(5000)
    wallets = {w["id"]: w["name"] for w in await db.wallets.find({"household_id": ctx.hid}, {"_id": 0}).to_list(500)}
    members = {m["user_id"]: m["name"] for m in await household_members(ctx.hid)}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "type", "amount", "category", "wallet", "to_wallet", "note", "member"])
    for t in txns:
        w.writerow([t.get("date", ""), t["type"], t["amount"], t.get("category", ""),
                    wallets.get(t.get("wallet_id"), ""), wallets.get(t.get("to_wallet_id"), ""),
                    t.get("note", ""), members.get(t.get("member_id"), "")])
    buf.seek(0)
    fname = f"nusa-transaksi-{_month()}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})


TYPE_ALIASES = {
    "expense": "expense", "pengeluaran": "expense", "keluar": "expense", "debit": "expense",
    "income": "income", "pemasukan": "income", "masuk": "income", "kredit": "income",
    "transfer": "transfer", "pindah": "transfer",
}


def _parse_amount(s):
    s = str(s or "").strip().replace("Rp", "").replace(" ", "")
    s = s.replace(".", "").replace(",", "") if s.count(",") <= 1 else s
    s = "".join(ch for ch in s if ch.isdigit() or ch == "-")
    return float(s) if s else 0.0


def _parse_date(s):
    s = str(s or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except Exception:
            continue
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@router.post("/transactions/import")
async def import_transactions(file: UploadFile = File(...), ctx: Ctx = Depends(get_ctx)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(400, "File harus berformat .csv")
    raw = (await file.read()).decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        raise HTTPException(400, "CSV kosong atau tidak ada header")
    norm = {f: (f or "").strip().lower() for f in reader.fieldnames}

    def col(row, *names):
        for f, low in norm.items():
            if low in names:
                return row.get(f)
        return None

    wallets = await db.wallets.find({"household_id": ctx.hid}, {"_id": 0}).to_list(500)
    wmap = {w["name"].strip().lower(): w["id"] for w in wallets}

    async def resolve_wallet(name):
        if not name:
            return None
        key = str(name).strip().lower()
        if key in wmap:
            return wmap[key]
        w = Wallet(user_id=ctx.user.user_id, name=str(name).strip(), type="cash", balance=0)
        doc = w.model_dump()
        doc["household_id"] = ctx.hid
        await db.wallets.insert_one(doc)
        wmap[key] = w.id
        return w.id

    imported, errors = 0, []
    for i, row in enumerate(reader, start=2):
        try:
            amount = _parse_amount(col(row, "amount", "jumlah", "nominal"))
            if amount <= 0:
                continue
            ttype = TYPE_ALIASES.get(str(col(row, "type", "tipe", "jenis") or "expense").strip().lower(), "expense")
            wname = col(row, "wallet", "dompet", "akun", "account", "source", "wallet_from")
            wid = await resolve_wallet(wname) or (wallets[0]["id"] if wallets else await resolve_wallet("Tunai"))
            data = {
                "type": ttype, "amount": amount, "wallet_id": wid,
                "category": (col(row, "category", "kategori") or "Lainnya").strip(),
                "note": (col(row, "note", "catatan", "keterangan", "description") or "").strip(),
                "date": _parse_date(col(row, "date", "tanggal", "tgl")),
                "source": "csv_import",
            }
            if ttype == "transfer":
                data["to_wallet_id"] = await resolve_wallet(col(row, "to_wallet", "tujuan", "wallet_to"))
            await _new_txn(ctx, data)
            imported += 1
        except Exception as e:
            errors.append(f"Baris {i}: {str(e)[:60]}")
    await _snapshot_networth(ctx.hid)
    return {"imported": imported, "errors": errors[:10], "error_count": len(errors)}


# ---------------- Budget ----------------
@router.get("/budget")
async def get_budget(ctx: Ctx = Depends(get_ctx)):
    return await db.budgets.find_one({"household_id": ctx.hid, "month": _month()}, {"_id": 0})


@router.post("/budget")
async def set_budget(body: BudgetCreate, ctx: Ctx = Depends(get_ctx)):
    b = Budget(user_id=ctx.user.user_id, month=_month(), **body.model_dump())
    doc = b.model_dump()
    doc["household_id"] = ctx.hid
    await db.budgets.update_one(
        {"household_id": ctx.hid, "month": _month()}, {"$set": doc}, upsert=True,
    )
    await db.users.update_one({"user_id": ctx.user.user_id}, {"$set": {"onboarded": True}})
    return doc


# ---------------- Goals ----------------
@router.get("/goals")
async def list_goals(ctx: Ctx = Depends(get_ctx)):
    return await db.goals.find({"household_id": ctx.hid}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/goals")
async def create_goal(body: GoalCreate, ctx: Ctx = Depends(get_ctx)):
    g = Goal(user_id=ctx.user.user_id, **body.model_dump())
    doc = g.model_dump()
    doc["household_id"] = ctx.hid
    await db.goals.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/goals/{goal_id}/deposit")
async def deposit_goal(goal_id: str, body: GoalDeposit, ctx: Ctx = Depends(get_ctx)):
    res = await db.goals.update_one(
        {"id": goal_id, "household_id": ctx.hid}, {"$inc": {"saved_amount": body.amount}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Goal not found")
    return await db.goals.find_one({"id": goal_id}, {"_id": 0})


@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, ctx: Ctx = Depends(get_ctx)):
    await db.goals.delete_one({"id": goal_id, "household_id": ctx.hid})
    return {"ok": True}


# ---------------- Dashboard / Analytics ----------------
@router.get("/dashboard")
async def dashboard(ctx: Ctx = Depends(get_ctx)):
    hid = ctx.hid
    wallets = await db.wallets.find({"household_id": hid}, {"_id": 0}).to_list(500)
    month = _month()
    txns = await db.transactions.find({"household_id": hid}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    budget = await db.budgets.find_one({"household_id": hid, "month": month}, {"_id": 0})
    goals = await db.goals.find({"household_id": hid}, {"_id": 0}).to_list(200)
    members = await household_members(hid)
    mmap = {m["user_id"]: m for m in members}

    assets = sum(w["balance"] for w in wallets if w["type"] not in ("credit_card", "paylater"))
    debt = sum(w["balance"] for w in wallets if w["type"] in ("credit_card", "paylater"))
    net_worth = assets - debt

    month_txns = [t for t in txns if (t.get("date") or "").startswith(month)]
    income = sum(t["amount"] for t in month_txns if t["type"] == "income")
    expense = sum(t["amount"] for t in month_txns if t["type"] == "expense")
    savings_rate = (income - expense) / income if income > 0 else 0

    score = 0
    score += 25 if net_worth > 0 else max(0, 25 + net_worth / max(assets, 1) * 25)
    score += min(30, max(0, savings_rate * 100 * 0.6))
    total_budget = sum(c["limit"] for c in budget["categories"]) if budget else 0
    if total_budget:
        adherence = 1 - min(1, expense / total_budget)
        score += adherence * 25
    else:
        score += 8
    score += 20 if any(g["saved_amount"] > 0 for g in goals) else 5
    score = int(max(0, min(100, round(score))))

    cat = {}
    for t in month_txns:
        if t["type"] == "expense":
            cat[t["category"]] = cat.get(t["category"], 0) + t["amount"]

    budget_status = []
    if budget:
        for c in budget["categories"]:
            spent = cat.get(c["category"], 0)
            budget_status.append({"category": c["category"], "group": c.get("group", "needs"),
                                  "limit": c["limit"], "spent": spent,
                                  "over": spent > c["limit"] and c["limit"] > 0})

    def annotate(t):
        m = mmap.get(t.get("member_id"))
        t["member_name"] = m["name"] if m else None
        t["member_picture"] = m.get("picture") if m else None
        return t

    # per-member spend this month
    member_spend = {}
    for t in month_txns:
        if t["type"] == "expense":
            member_spend[t.get("member_id")] = member_spend.get(t.get("member_id"), 0) + t["amount"]
    member_breakdown = [{"name": mmap.get(k, {}).get("name", "?"),
                         "picture": mmap.get(k, {}).get("picture"), "amount": v}
                        for k, v in member_spend.items()]

    today = datetime.now(timezone.utc).date()
    upcoming = await db.bills.find(
        {"household_id": hid, "is_paid_current_cycle": False}, {"_id": 0}
    ).sort("next_due_date", 1).to_list(50)
    upcoming = [b for b in upcoming
                if (datetime.strptime(b["next_due_date"], "%Y-%m-%d").date() - today).days <= 7]
    for b in upcoming:
        b["days_until"] = (datetime.strptime(b["next_due_date"], "%Y-%m-%d").date() - today).days

    return {
        "net_worth": net_worth, "assets": assets, "debt": debt,
        "income": income, "expense": expense, "savings_rate": savings_rate,
        "health_score": score, "wallet_count": len(wallets),
        "category_breakdown": [{"category": k, "amount": v} for k, v in sorted(cat.items(), key=lambda x: -x[1])],
        "budget_status": budget_status,
        "recent_transactions": [annotate(t) for t in txns[:8]],
        "wallets": wallets, "goals": goals, "has_budget": bool(budget),
        "members": members, "member_breakdown": sorted(member_breakdown, key=lambda x: -x["amount"]),
        "upcoming_bills": upcoming, "is_shared": len(members) > 1,
    }


@router.get("/analytics")
async def analytics(ctx: Ctx = Depends(get_ctx)):
    txns = await db.transactions.find({"household_id": ctx.hid}, {"_id": 0}).to_list(5000)
    from collections import defaultdict
    trend = defaultdict(lambda: {"income": 0, "expense": 0})
    for t in txns:
        m = (t.get("date") or "")[:7]
        if not m:
            continue
        if t["type"] == "income":
            trend[m]["income"] += t["amount"]
        elif t["type"] == "expense":
            trend[m]["expense"] += t["amount"]
    months = sorted(trend.keys())[-6:]
    trend_list = [{"month": m, "income": trend[m]["income"], "expense": trend[m]["expense"],
                   "savings": trend[m]["income"] - trend[m]["expense"]} for m in months]
    cur = _month()
    cat = {}
    for t in txns:
        if t["type"] == "expense" and (t.get("date") or "").startswith(cur):
            cat[t["category"]] = cat.get(t["category"], 0) + t["amount"]
    return {"trend": trend_list,
            "category_breakdown": [{"category": k, "amount": v} for k, v in sorted(cat.items(), key=lambda x: -x[1])]}


@router.get("/networth/history")
async def networth_history(ctx: Ctx = Depends(get_ctx)):
    return await db.networth_snapshots.find({"household_id": ctx.hid}, {"_id": 0}).sort("date", 1).to_list(400)
