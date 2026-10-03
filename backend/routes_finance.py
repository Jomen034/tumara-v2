import io
import csv
import calendar
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from db import db
import ledger
from models import (
    Wallet, WalletCreate, Transaction, TransactionCreate, TransactionUpdate,
    Budget, BudgetCreate, CategoryLimitUpdate, BudgetIncomeUpdate, Goal, GoalCreate, GoalDeposit, new_id,
)
from deps import get_ctx, Ctx, household_members

router = APIRouter(tags=["finance"])


def _month():
    return datetime.now(timezone.utc).strftime("%Y-%m")


_snapshot_networth = ledger.snapshot_networth


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
    return await db.wallets.find_one({"id": wallet_id, "household_id": ctx.hid}, {"_id": 0})


@router.delete("/wallets/{wallet_id}")
async def delete_wallet(wallet_id: str, ctx: Ctx = Depends(get_ctx)):
    if ctx.user.role != "admin":
        raise HTTPException(403, "Hanya admin rumah tangga yang bisa menghapus dompet")
    res = await db.wallets.delete_one({"id": wallet_id, "household_id": ctx.hid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Wallet not found")
    await _snapshot_networth(ctx.hid)
    return {"ok": True}


@router.get("/wallets/{wallet_id}/detail")
async def get_wallet_detail(wallet_id: str, limit: int = 10, ctx: Ctx = Depends(get_ctx)):
    wallet = await db.wallets.find_one({"id": wallet_id, "household_id": ctx.hid}, {"_id": 0})
    if not wallet:
        raise HTTPException(404, "Wallet not found")

    txn_query = {
        "household_id": ctx.hid,
        "$or": [{"wallet_id": wallet_id}, {"to_wallet_id": wallet_id}],
    }
    recent_txns = await db.transactions.find(txn_query, {"_id": 0}).sort([("date", -1), ("created_at", -1)]).to_list(limit)

    cur_month = _month()
    month_query = {
        "household_id": ctx.hid,
        "date": {"$regex": f"^{cur_month}"},
        "$or": [{"wallet_id": wallet_id}, {"to_wallet_id": wallet_id}],
    }
    month_txns = await db.transactions.find(month_query, {"_id": 0}).to_list(2000)

    inflow = 0.0
    outflow = 0.0
    for t in month_txns:
        amt = float(t.get("amount", 0))
        ttype = t.get("type")
        twallet = t.get("wallet_id")
        tto_wallet = t.get("to_wallet_id")

        if ttype == "income" and twallet == wallet_id:
            inflow += amt
        elif ttype == "expense" and twallet == wallet_id:
            outflow += amt
        elif ttype == "transfer":
            if twallet == wallet_id:
                outflow += amt
            if tto_wallet == wallet_id:
                inflow += amt

    total_count = await db.transactions.count_documents(txn_query)

    return {
        "wallet": wallet,
        "recent_transactions": recent_txns,
        "monthly_flow": {
            "month": cur_month,
            "inflow": inflow,
            "outflow": outflow,
            "net": inflow - outflow,
        },
        "transaction_count": total_count,
    }


# ---------------- Transactions ----------------
async def _apply_txn(hid: str, t: Transaction, sign: int):
    await ledger.apply_transaction(hid, t, sign)


async def _validate_wallets(hid: str, ttype: str, wallet_id: str, to_wallet_id: Optional[str] = None):
    if not await ledger.get_wallet(hid, wallet_id):
        raise HTTPException(404, "Dompet asal tidak ditemukan")
    if ttype != "transfer":
        return
    if not to_wallet_id:
        raise HTTPException(400, "Transfer harus memiliki dompet tujuan")
    if to_wallet_id == wallet_id:
        raise HTTPException(400, "Dompet tujuan harus berbeda dari dompet asal")
    if not await ledger.get_wallet(hid, to_wallet_id):
        raise HTTPException(404, "Dompet tujuan tidak ditemukan")


@router.get("/transactions")
async def list_transactions(
    limit: int = 1000,
    member_id: Optional[str] = None,
    goal_id: Optional[str] = None,
    wallet_id: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
    ctx: Ctx = Depends(get_ctx),
):
    query = {"household_id": ctx.hid}
    if member_id and member_id != "all":
        query["member_id"] = member_id
    if goal_id:
        query["goal_id"] = goal_id
    if wallet_id and wallet_id != "all":
        query["$or"] = [{"wallet_id": wallet_id}, {"to_wallet_id": wallet_id}]
    if category and category != "all":
        query["category"] = category
    if type and type != "all":
        query["type"] = type
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    if q:
        search_filter = [
            {"note": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
        ]
        if "$or" in query:
            query = {"$and": [query, {"$or": search_filter}]}
        else:
            query["$or"] = search_filter
    return await db.transactions.find(query, {"_id": 0}).sort([("date", -1), ("created_at", -1)]).to_list(limit)


@router.get("/transactions/{txn_id}")
async def get_transaction(txn_id: str, ctx: Ctx = Depends(get_ctx)):
    doc = await db.transactions.find_one({"id": txn_id, "household_id": ctx.hid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    return doc


async def _new_txn(ctx: Ctx, data: dict) -> Transaction:
    if not data.get("date"):
        data["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await _validate_wallets(ctx.hid, data.get("type"), data.get("wallet_id"), data.get("to_wallet_id"))
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


@router.put("/transactions/{txn_id}")
async def update_transaction(txn_id: str, body: TransactionUpdate, ctx: Ctx = Depends(get_ctx)):
    old_doc = await db.transactions.find_one({"id": txn_id, "household_id": ctx.hid}, {"_id": 0})
    if not old_doc:
        raise HTTPException(404, "Transaksi tidak ditemukan")

    data = {**old_doc}
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            data[k] = v

    if not data.get("date"):
        data["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    await _validate_wallets(ctx.hid, data.get("type"), data.get("wallet_id"), data.get("to_wallet_id"))

    # 1. Reverse old ledger movement
    old_txn = Transaction(**old_doc)
    await _apply_txn(ctx.hid, old_txn, -1)

    # If old txn was linked to a goal, reverse saved_amount
    if old_doc.get("goal_id"):
        await db.goals.update_one(
            {"id": old_doc["goal_id"], "household_id": ctx.hid},
            {"$inc": {"saved_amount": -float(old_doc["amount"])}}
        )

    # 2. Apply new ledger movement
    new_txn = Transaction(**data)
    await _apply_txn(ctx.hid, new_txn, +1)

    # If new txn is linked to a goal, apply saved_amount
    if data.get("goal_id"):
        await db.goals.update_one(
            {"id": data["goal_id"], "household_id": ctx.hid},
            {"$inc": {"saved_amount": float(data["amount"])}}
        )

    doc = new_txn.model_dump()
    doc["household_id"] = ctx.hid
    doc["member_id"] = old_doc.get("member_id", ctx.user.user_id)
    await db.transactions.update_one({"id": txn_id, "household_id": ctx.hid}, {"$set": doc})
    await _snapshot_networth(ctx.hid)
    return doc


@router.delete("/transactions/{txn_id}")
async def delete_transaction(txn_id: str, ctx: Ctx = Depends(get_ctx)):
    doc = await db.transactions.find_one({"id": txn_id, "household_id": ctx.hid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    await _apply_txn(ctx.hid, Transaction(**doc), -1)
    if doc.get("goal_id"):
        await db.goals.update_one(
            {"id": doc["goal_id"], "household_id": ctx.hid},
            {"$inc": {"saved_amount": -float(doc["amount"])}}
        )
    await db.transactions.delete_one({"id": txn_id, "household_id": ctx.hid})
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
    fname = f"tumara-transaksi-{_month()}.csv"
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


@router.get("/budget/category/{category:path}")
async def get_category_budget_detail(category: str, ctx: Ctx = Depends(get_ctx)):
    month = _month()
    budget = await db.budgets.find_one({"household_id": ctx.hid, "month": month}, {"_id": 0})

    cat_item = None
    if budget:
        for c in budget.get("categories", []):
            if c.get("category") == category:
                cat_item = c
                break

    txns = await db.transactions.find({
        "household_id": ctx.hid,
        "category": category,
        "type": "expense",
        "date": {"$regex": f"^{month}"}
    }, {"_id": 0}).sort([("date", -1), ("created_at", -1)]).to_list(200)

    spent = sum(t.get("amount", 0) for t in txns)
    limit = float(cat_item.get("limit", 0)) if cat_item else 0.0
    group = cat_item.get("group", "needs") if cat_item else "needs"
    remaining = max(0.0, limit - spent)
    over = spent > limit and limit > 0
    over_amount = max(0.0, spent - limit) if over else 0.0
    pct = round((spent / limit * 100), 1) if limit > 0 else (100.0 if spent > 0 else 0.0)

    today = datetime.now(timezone.utc).date()
    y, m = today.year, today.month
    _, total_days = calendar.monthrange(y, m)
    current_day = today.day
    days_left = max(1, total_days - current_day + 1)
    safe_daily_spend = round(remaining / days_left) if remaining > 0 else 0
    daily_spent_avg = round(spent / max(1, current_day))

    return {
        "category": category,
        "group": group,
        "limit": limit,
        "spent": spent,
        "remaining": remaining,
        "over": over,
        "over_amount": over_amount,
        "pct": pct,
        "month": month,
        "total_days": total_days,
        "current_day": current_day,
        "days_left": days_left,
        "safe_daily_spend": safe_daily_spend,
        "daily_spent_avg": daily_spent_avg,
        "transactions": txns,
        "tx_count": len(txns),
    }


@router.put("/budget/category/{category:path}")
async def update_category_budget(category: str, body: CategoryLimitUpdate, ctx: Ctx = Depends(get_ctx)):
    month = _month()
    budget = await db.budgets.find_one({"household_id": ctx.hid, "month": month})
    if not budget:
        budget_doc = {
            "id": new_id("bud"),
            "user_id": ctx.user.user_id,
            "household_id": ctx.hid,
            "month": month,
            "monthly_income": body.limit,
            "mode": "fixed",
            "categories": [{"category": category, "limit": body.limit, "group": body.group or "needs"}],
            "updated_at": datetime.now(timezone.utc),
        }
        await db.budgets.insert_one(budget_doc)
        return await db.budgets.find_one({"household_id": ctx.hid, "month": month}, {"_id": 0})

    categories = budget.get("categories", [])
    found = False
    for c in categories:
        if c.get("category") == category:
            c["limit"] = body.limit
            if body.group:
                c["group"] = body.group
            found = True
            break
    if not found:
        categories.append({"category": category, "limit": body.limit, "group": body.group or "needs"})

    await db.budgets.update_one(
        {"household_id": ctx.hid, "month": month},
        {"$set": {"categories": categories, "updated_at": datetime.now(timezone.utc)}}
    )
    return await db.budgets.find_one({"household_id": ctx.hid, "month": month}, {"_id": 0})


@router.delete("/budget/category/{category:path}")
async def delete_category_budget(category: str, ctx: Ctx = Depends(get_ctx)):
    month = _month()
    budget = await db.budgets.find_one({"household_id": ctx.hid, "month": month})
    if not budget:
        raise HTTPException(status_code=404, detail="Budget belum diatur untuk bulan ini")

    categories = budget.get("categories", [])
    new_categories = [c for c in categories if c.get("category") != category]

    await db.budgets.update_one(
        {"household_id": ctx.hid, "month": month},
        {"$set": {"categories": new_categories, "updated_at": datetime.now(timezone.utc)}}
    )
    return await db.budgets.find_one({"household_id": ctx.hid, "month": month}, {"_id": 0})


@router.put("/budget/income")
async def update_budget_income(body: BudgetIncomeUpdate, ctx: Ctx = Depends(get_ctx)):
    month = _month()
    budget = await db.budgets.find_one({"household_id": ctx.hid, "month": month})
    if not budget:
        raise HTTPException(status_code=404, detail="Budget belum diatur untuk bulan ini")

    update_fields = {"monthly_income": body.monthly_income, "updated_at": datetime.now(timezone.utc)}
    if body.mode:
        update_fields["mode"] = body.mode

    await db.budgets.update_one(
        {"household_id": ctx.hid, "month": month},
        {"$set": update_fields}
    )
    return await db.budgets.find_one({"household_id": ctx.hid, "month": month}, {"_id": 0})



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
    goal = await db.goals.find_one({"id": goal_id, "household_id": ctx.hid}, {"_id": 0})
    if not goal:
        raise HTTPException(404, "Goal not found")

    if body.wallet_id:
        w_from = await ledger.get_wallet(ctx.hid, body.wallet_id)
        if not w_from:
            raise HTTPException(404, "Dompet sumber tidak ditemukan")

        is_transfer = bool(body.to_wallet_id and body.to_wallet_id != body.wallet_id)
        if is_transfer:
            w_to = await ledger.get_wallet(ctx.hid, body.to_wallet_id)
            if not w_to:
                raise HTTPException(404, "Dompet tujuan tidak ditemukan")

        txn_data = {
            "type": "transfer" if is_transfer else "expense",
            "amount": body.amount,
            "wallet_id": body.wallet_id,
            "to_wallet_id": body.to_wallet_id if is_transfer else None,
            "category": "Investasi",
            "note": (body.note or f"Nabung: {goal.get('title', 'Tujuan')}").strip(),
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "source": "goal_deposit",
            "goal_id": goal_id,
        }
        await _new_txn(ctx, txn_data)
        await _snapshot_networth(ctx.hid)

    res = await db.goals.update_one(
        {"id": goal_id, "household_id": ctx.hid}, {"$inc": {"saved_amount": body.amount}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Goal not found")
    return await db.goals.find_one({"id": goal_id, "household_id": ctx.hid}, {"_id": 0})


@router.put("/goals/{goal_id}")
async def update_goal(goal_id: str, body: GoalCreate, ctx: Ctx = Depends(get_ctx)):
    doc = body.model_dump()
    res = await db.goals.update_one(
        {"id": goal_id, "household_id": ctx.hid}, {"$set": doc}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Goal not found")
    return await db.goals.find_one({"id": goal_id, "household_id": ctx.hid}, {"_id": 0})


@router.get("/goals/{goal_id}/detail")
async def get_goal_detail(goal_id: str, ctx: Ctx = Depends(get_ctx)):
    goal = await db.goals.find_one({"id": goal_id, "household_id": ctx.hid}, {"_id": 0})
    if not goal:
        raise HTTPException(404, "Goal not found")
    txns = await db.transactions.find({"household_id": ctx.hid, "goal_id": goal_id}, {"_id": 0}).sort([("date", -1), ("created_at", -1)]).to_list(100)

    saved = float(goal.get("saved_amount", 0))
    target = float(goal.get("target_amount", 0))
    remaining = max(0.0, target - saved)
    pct = round((saved / target * 100), 1) if target > 0 else 0

    months_left = None
    monthly_recommendation = None
    if goal.get("deadline"):
        try:
            today = datetime.now(timezone.utc).date()
            d_date = datetime.strptime(goal["deadline"], "%Y-%m-%d").date()
            days = (d_date - today).days
            if days > 0:
                months_left = max(1, round(days / 30.4))
                if remaining > 0 and months_left > 0:
                    monthly_recommendation = round(remaining / months_left)
            else:
                months_left = 0
        except Exception:
            pass

    return {
        "goal": goal,
        "transactions": txns,
        "metrics": {
            "saved_amount": saved,
            "target_amount": target,
            "remaining_amount": remaining,
            "progress_pct": pct,
            "months_left": months_left,
            "monthly_recommendation": monthly_recommendation,
            "deposit_count": len(txns),
        },
    }


@router.get("/goals/{goal_id}/transactions")
async def list_goal_transactions(goal_id: str, ctx: Ctx = Depends(get_ctx)):
    return await db.transactions.find({"household_id": ctx.hid, "goal_id": goal_id}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, ctx: Ctx = Depends(get_ctx)):
    res = await db.goals.delete_one({"id": goal_id, "household_id": ctx.hid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Goal not found")
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

    # 1. Solvabilitas & Net Worth (max 25)
    if assets == 0 and debt == 0:
        nw_score = 15
        nw_desc = "Belum ada saldo dompet yang dicatat."
        nw_status = "neutral"
    elif net_worth > 0:
        if debt == 0:
            nw_score = 25
            nw_desc = f"Aset positif (Rp {assets:,.0f}) dan bebas dari utang berbunga/paylater.".replace(",", ".")
            nw_status = "good"
        else:
            debt_ratio = debt / assets
            nw_score = max(10, int(round(25 * (1 - min(1, debt_ratio)))))
            nw_desc = f"Aset Rp {assets:,.0f} vs Utang Rp {debt:,.0f} (Rasio utang {debt_ratio*100:.1f}%)".replace(",", ".")
            nw_status = "good" if debt_ratio <= 0.3 else "warning"
    else:
        nw_score = max(0, int(round(max(0, 25 + (net_worth / max(assets, 1)) * 25))))
        nw_desc = f"Utang (Rp {debt:,.0f}) melebihi total aset (Rp {assets:,.0f}).".replace(",", ".")
        nw_status = "danger"

    # 2. Saving rate (max 30)
    if income > 0:
        sr_score = min(30, max(0, int(round(savings_rate * 100 * 0.6))))
        sr_desc = f"Menabung {savings_rate * 100:.1f}% dari pemasukan bulan ini."
        sr_status = "good" if savings_rate >= 0.2 else "warning" if savings_rate > 0 else "danger"
    else:
        sr_score = 0
        sr_desc = "Belum ada pemasukan yang dicatat bulan ini."
        sr_status = "neutral"

    # 3. Budget adherence (max 25)
    total_budget = sum(c["limit"] for c in budget["categories"]) if budget else 0
    if total_budget > 0:
        if expense <= total_budget:
            adherence = 1 - (expense / total_budget)
            b_score = int(round(15 + adherence * 10))
            b_desc = f"Pengeluaran aman: Rp {expense:,.0f} dari limit Rp {total_budget:,.0f} ({expense/total_budget*100:.0f}% terpakai).".replace(",", ".")
            b_status = "good"
        else:
            over = expense - total_budget
            b_score = max(0, int(round(15 - min(15, (over / total_budget) * 15))))
            b_desc = f"Overbudget Rp {over:,.0f} dari limit Rp {total_budget:,.0f}.".replace(",", ".")
            b_status = "danger"
    else:
        b_score = 10
        b_desc = "Belum ada anggaran bulanan yang diset untuk membatasi pengeluaran."
        b_status = "neutral"

    # 4. Goals & Menabung (max 20)
    has_deposited_goals = any(g.get("saved_amount", 0) > 0 for g in goals)
    if has_deposited_goals:
        g_score = 20
        total_saved = sum(g.get("saved_amount", 0) for g in goals)
        g_desc = f"Aktif menabung! Total Rp {total_saved:,.0f} tersimpan untuk tujuan finansial.".replace(",", ".")
        g_status = "good"
    elif len(goals) > 0:
        g_score = 10
        g_desc = "Sudah memiliki tujuan nabung, tapi belum ada setoran tercatat."
        g_status = "warning"
    else:
        g_score = 5
        g_desc = "Belum membuat tujuan finansial atau dana darurat."
        g_status = "neutral"

    score = int(max(0, min(100, round(nw_score + sr_score + b_score + g_score))))

    if score >= 80:
        status_label = "Sangat Sehat"
        summary_msg = "Kondisi finansial Anda sangat prima! Arus kas, aset, dan tujuan terkelola dengan sangat baik."
    elif score >= 65:
        status_label = "Sehat"
        summary_msg = "Kondisi finansial Anda berada di jalur aman, namun ada beberapa pos yang bisa dioptimalkan lebih lanjut."
    elif score >= 45:
        status_label = "Cukup"
        summary_msg = "Keuangan Anda cukup stabil, namun perlu perhatian ekstra pada alokasi anggaran dan tabungan agar tidak rentan."
    else:
        status_label = "Perlu Perhatian"
        summary_msg = "Kesehatan finansial Anda perlu pembenahan segera, terutama pada rasio utang dan pengelolaan pengeluaran."

    pillars = [
        {
            "id": "net_worth",
            "title": "Solvabilitas & Aset",
            "score": nw_score,
            "max": 25,
            "status": nw_status,
            "desc": nw_desc
        },
        {
            "id": "savings_rate",
            "title": "Tingkat Tabungan (Savings Rate)",
            "score": sr_score,
            "max": 30,
            "status": sr_status,
            "desc": sr_desc
        },
        {
            "id": "budget",
            "title": "Disiplin Anggaran",
            "score": b_score,
            "max": 25,
            "status": b_status,
            "desc": b_desc
        },
        {
            "id": "goals",
            "title": "Komitmen Nabung & Masa Depan",
            "score": g_score,
            "max": 20,
            "status": g_status,
            "desc": g_desc
        }
    ]

    recommendations = []
    if not budget:
        recommendations.append({
            "action_id": "create_budget",
            "title": "Buat Budget Bulanan",
            "desc": "Kendalikan pengeluaran dengan limit per kategori agar terhindar dari bocor halus.",
            "btn_label": "Atur Budget",
            "target": "/budget",
            "badge": "Prioritas"
        })
    elif total_budget > 0 and expense > total_budget:
        recommendations.append({
            "action_id": "review_budget",
            "title": "Evaluasi Pos Pengeluaran",
            "desc": f"Pengeluaran bulan ini (Rp {expense:,.0f}) sudah melampaui limit anggaran (Rp {total_budget:,.0f}).".replace(",", "."),
            "btn_label": "Cek Anggaran",
            "target": "/budget",
            "badge": "Peringatan"
        })

    if income == 0:
        recommendations.append({
            "action_id": "add_income",
            "title": "Catat Pemasukan Bulan Ini",
            "desc": "Masukkan pemasukan (gaji, bisnis, bonus) agar Tumara dapat mengukur rasio menabungmu.",
            "btn_label": "Catat Pemasukan",
            "target": "open_add_income",
            "badge": "Penting"
        })

    if not has_deposited_goals:
        recommendations.append({
            "action_id": "fund_goal",
            "title": "Mulai Setor ke Tujuan Nabung",
            "desc": "Buat atau setor ke pos tujuan menabung untuk memperkuat dana darurat masa depan.",
            "btn_label": "Buka Tujuan",
            "target": "/goals",
            "badge": "Saran"
        })

    if debt > 0:
        recommendations.append({
            "action_id": "reduce_debt",
            "title": "Kurangi Saldo Utang",
            "desc": f"Lunasi tagihan kartu kredit atau paylater sebesar Rp {debt:,.0f} untuk memaksimalkan skor.".replace(",", "."),
            "btn_label": "Cek Dompet",
            "target": "/wallets",
            "badge": "Penting"
        })

    recommendations.append({
        "action_id": "ask_ai",
        "title": "Konsultasi Finansial dengan AI",
        "desc": f"Tanyakan ke Tumara AI strategi personal untuk menaikkan skormu dari {score}/100.",
        "btn_label": "Tanya Tumara",
        "target": "/advisor",
        "badge": "AI Advisor"
    })

    health_detail = {
        "score": score,
        "status_label": status_label,
        "summary": summary_msg,
        "pillars": pillars,
        "recommendations": recommendations,
        "savings_rate_pct": round(savings_rate * 100, 1),
    }

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
        {"household_id": hid, "is_paid_current_cycle": False, "is_completed": {"$ne": True}}, {"_id": 0}
    ).sort("next_due_date", 1).to_list(50)
    upcoming = [b for b in upcoming
                if (datetime.strptime(b["next_due_date"], "%Y-%m-%d").date() - today).days <= 7]
    for b in upcoming:
        b["days_until"] = (datetime.strptime(b["next_due_date"], "%Y-%m-%d").date() - today).days

    now_d = datetime.now(timezone.utc).date()
    days_in_month = 31 if now_d.month in (1,3,5,7,8,10,12) else (29 if now_d.year % 4 == 0 and now_d.month == 2 else 28 if now_d.month == 2 else 30)
    days_left = max(1, days_in_month - now_d.day + 1)
    remaining_budget = max(0, total_budget - expense) if total_budget > 0 else 0
    safe_daily_spend = round(remaining_budget / days_left) if total_budget > 0 else 0
    is_overbudget = total_budget > 0 and expense > total_budget
    over_amount = max(0, expense - total_budget) if total_budget > 0 else 0

    budget_summary = {
        "total_limit": total_budget,
        "total_spent": expense,
        "remaining": remaining_budget,
        "safe_daily_spend": safe_daily_spend,
        "days_left": days_left,
        "days_in_month": days_in_month,
        "is_overbudget": is_overbudget,
        "over_amount": over_amount,
        "spent_pct": round((expense / total_budget) * 100, 1) if total_budget > 0 else 0,
    }

    return {
        "net_worth": net_worth, "assets": assets, "debt": debt,
        "income": income, "expense": expense, "net_cash_flow": income - expense, "savings_rate": savings_rate,
        "health_score": score, "health_detail": health_detail, "wallet_count": len(wallets),
        "category_breakdown": [{"category": k, "amount": v} for k, v in sorted(cat.items(), key=lambda x: -x[1])],
        "budget_status": budget_status, "budget_summary": budget_summary,
        "recent_transactions": [annotate(t) for t in txns[:8]],
        "wallets": wallets, "goals": goals, "has_budget": bool(budget),
        "members": members, "member_breakdown": sorted(member_breakdown, key=lambda x: -x["amount"]),
        "upcoming_bills": upcoming, "is_shared": len(members) > 1,
    }


@router.get("/analytics")
async def analytics(
    period: Optional[str] = "this_month",
    month: Optional[str] = None,
    ctx: Ctx = Depends(get_ctx)
):
    today = datetime.now(timezone.utc).date()
    cur_ym = today.strftime("%Y-%m")

    # Determine date boundaries
    start_date = None
    end_date = None

    if month:
        start_date = f"{month}-01"
        try:
            y, m = map(int, month.split("-"))
            _, last_day = calendar.monthrange(y, m)
            end_date = f"{month}-{last_day:02d}"
        except Exception:
            end_date = f"{month}-31"
    elif period == "last_month":
        prev_m = today.month - 1 if today.month > 1 else 12
        prev_y = today.year if today.month > 1 else today.year - 1
        _, last_day = calendar.monthrange(prev_y, prev_m)
        start_date = f"{prev_y:04d}-{prev_m:02d}-01"
        end_date = f"{prev_y:04d}-{prev_m:02d}-{last_day:02d}"
    elif period == "3m":
        start_date = (today - timedelta(days=90)).strftime("%Y-%m-%d")
        end_date = today.strftime("%Y-%m-%d")
    elif period == "6m":
        start_date = (today - timedelta(days=180)).strftime("%Y-%m-%d")
        end_date = today.strftime("%Y-%m-%d")
    elif period == "ytd":
        start_date = f"{today.year:04d}-01-01"
        end_date = today.strftime("%Y-%m-%d")
    elif period == "all":
        start_date = None
        end_date = None
    else:  # "this_month"
        start_date = f"{cur_ym}-01"
        _, last_day = calendar.monthrange(today.year, today.month)
        end_date = f"{cur_ym}-{last_day:02d}"

    txns = await db.transactions.find({"household_id": ctx.hid}, {"_id": 0}).sort([("date", -1), ("created_at", -1)]).to_list(5000)
    wallets = await db.wallets.find({"household_id": ctx.hid}, {"_id": 0}).to_list(500)
    wmap = {w["id"]: w for w in wallets}

    assets = sum(w["balance"] for w in wallets if not ledger.is_debt_wallet(w))
    debt = sum(w["balance"] for w in wallets if ledger.is_debt_wallet(w))
    current_net_worth = assets - debt

    period_txns = []
    for t in txns:
        t_date = t.get("date") or ""
        if start_date and t_date < start_date:
            continue
        if end_date and t_date > end_date:
            continue
        period_txns.append(t)

    period_income = sum(t["amount"] for t in period_txns if t["type"] == "income")
    period_expense = sum(t["amount"] for t in period_txns if t["type"] == "expense")
    period_net = period_income - period_expense
    savings_rate = round(((period_income - period_expense) / period_income * 100), 1) if period_income > 0 else 0.0

    if start_date and end_date:
        try:
            d1 = datetime.strptime(start_date, "%Y-%m-%d").date()
            d2 = min(today, datetime.strptime(end_date, "%Y-%m-%d").date())
            days_count = max(1, (d2 - d1).days + 1)
        except Exception:
            days_count = max(1, today.day)
    else:
        days_count = max(1, today.day)
    daily_expense_avg = round(period_expense / days_count)

    cat = defaultdict(float)
    for t in period_txns:
        if t["type"] == "expense":
            cat[t.get("category", "Lainnya")] += t["amount"]

    total_cat_amt = sum(cat.values())
    category_breakdown = [
        {
            "category": k,
            "amount": v,
            "pct": round((v / total_cat_amt * 100), 1) if total_cat_amt > 0 else 0.0
        }
        for k, v in sorted(cat.items(), key=lambda x: -x[1])
    ]

    expense_txns = [t for t in period_txns if t["type"] == "expense"]
    expense_txns.sort(key=lambda x: -x.get("amount", 0))
    top_expenses = []
    for t in expense_txns[:5]:
        top_expenses.append({
            "id": t.get("id"),
            "amount": t.get("amount", 0),
            "note": t.get("note") or t.get("category", "Pengeluaran"),
            "category": t.get("category", "Lainnya"),
            "date": t.get("date"),
            "wallet_name": wmap.get(t.get("wallet_id"), {}).get("name", "Dompet"),
        })

    snapshots = await db.networth_snapshots.find({"household_id": ctx.hid}, {"_id": 0}).sort("date", 1).to_list(400)
    prev_net_worth = current_net_worth
    if len(snapshots) >= 2:
        prev_net_worth = snapshots[-2].get("net_worth", current_net_worth)
    elif len(snapshots) == 1:
        prev_net_worth = snapshots[0].get("net_worth", current_net_worth)

    net_worth_delta = current_net_worth - prev_net_worth
    net_worth_delta_pct = (
        round((net_worth_delta / abs(prev_net_worth)) * 100, 1)
        if prev_net_worth != 0
        else 0.0
    )

    trend_map = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for t in txns:
        m = (t.get("date") or "")[:7]
        if not m:
            continue
        if t["type"] == "income":
            trend_map[m]["income"] += t["amount"]
        elif t["type"] == "expense":
            trend_map[m]["expense"] += t["amount"]

    all_months = sorted(trend_map.keys())
    recent_months = all_months[-12:] if len(all_months) > 12 else all_months

    trend_list = []
    monthly_table = []
    for m in recent_months:
        inc = trend_map[m]["income"]
        exp = trend_map[m]["expense"]
        sav = inc - exp
        sr = round((sav / inc * 100), 1) if inc > 0 else 0.0
        status = "surplus" if sav > 0 else "deficit" if sav < 0 else "even"
        entry = {
            "month": m,
            "income": inc,
            "expense": exp,
            "savings": sav,
            "savings_rate": sr,
            "status": status,
        }
        trend_list.append(entry)
        monthly_table.append(entry)

    monthly_table_reversed = list(reversed(monthly_table))

    return {
        "kpi": {
            "current_net_worth": current_net_worth,
            "assets": assets,
            "debt": debt,
            "prev_net_worth": prev_net_worth,
            "net_worth_delta": net_worth_delta,
            "net_worth_delta_pct": net_worth_delta_pct,
            "period_income": period_income,
            "period_expense": period_expense,
            "period_net": period_net,
            "savings_rate": savings_rate,
            "daily_expense_avg": daily_expense_avg,
            "tx_count": len(period_txns),
            "start_date": start_date,
            "end_date": end_date,
        },
        "trend": trend_list,
        "category_breakdown": category_breakdown,
        "top_expenses": top_expenses,
        "monthly_table": monthly_table_reversed,
    }


@router.get("/networth/history")
async def networth_history(range: Optional[str] = "all", ctx: Ctx = Depends(get_ctx)):
    q = {"household_id": ctx.hid}
    today = datetime.now(timezone.utc).date()
    if range == "1m":
        cutoff = (today - timedelta(days=30)).strftime("%Y-%m-%d")
        q["date"] = {"$gte": cutoff}
    elif range == "3m":
        cutoff = (today - timedelta(days=90)).strftime("%Y-%m-%d")
        q["date"] = {"$gte": cutoff}
    elif range == "6m":
        cutoff = (today - timedelta(days=180)).strftime("%Y-%m-%d")
        q["date"] = {"$gte": cutoff}
    elif range == "1y":
        cutoff = (today - timedelta(days=365)).strftime("%Y-%m-%d")
        q["date"] = {"$gte": cutoff}
    return await db.networth_snapshots.find(q, {"_id": 0}).sort("date", 1).to_list(400)

