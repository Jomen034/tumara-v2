from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from db import db
from models import (
    User, Wallet, WalletCreate, Transaction, TransactionCreate,
    Budget, BudgetCreate, Goal, GoalCreate, GoalDeposit, now_utc, new_id,
)
from auth import get_current_user

router = APIRouter(tags=["finance"])


def _month():
    return datetime.now(timezone.utc).strftime("%Y-%m")


# ---------------- Wallets ----------------
@router.get("/wallets")
async def list_wallets(user: User = Depends(get_current_user)):
    return await db.wallets.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)


@router.post("/wallets")
async def create_wallet(body: WalletCreate, user: User = Depends(get_current_user)):
    w = Wallet(user_id=user.user_id, **body.model_dump())
    await db.wallets.insert_one(w.model_dump())
    return w.model_dump()


@router.put("/wallets/{wallet_id}")
async def update_wallet(wallet_id: str, body: WalletCreate, user: User = Depends(get_current_user)):
    res = await db.wallets.update_one(
        {"id": wallet_id, "user_id": user.user_id}, {"$set": body.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Wallet not found")
    return await db.wallets.find_one({"id": wallet_id}, {"_id": 0})


@router.delete("/wallets/{wallet_id}")
async def delete_wallet(wallet_id: str, user: User = Depends(get_current_user)):
    await db.wallets.delete_one({"id": wallet_id, "user_id": user.user_id})
    return {"ok": True}


# ---------------- Transactions ----------------
async def _apply_txn(t: Transaction, sign: int):
    """sign=+1 apply, -1 revert. Adjust wallet balances (scoped to owner)."""
    uid = t.user_id
    if t.type == "income":
        await db.wallets.update_one({"id": t.wallet_id, "user_id": uid}, {"$inc": {"balance": sign * t.amount}})
    elif t.type == "expense":
        await db.wallets.update_one({"id": t.wallet_id, "user_id": uid}, {"$inc": {"balance": -sign * t.amount}})
    elif t.type == "transfer" and t.to_wallet_id:
        await db.wallets.update_one({"id": t.wallet_id, "user_id": uid}, {"$inc": {"balance": -sign * t.amount}})
        await db.wallets.update_one({"id": t.to_wallet_id, "user_id": uid}, {"$inc": {"balance": sign * t.amount}})


@router.get("/transactions")
async def list_transactions(limit: int = 100, user: User = Depends(get_current_user)):
    return await db.transactions.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)


@router.post("/transactions")
async def create_transaction(body: TransactionCreate, user: User = Depends(get_current_user)):
    data = body.model_dump()
    if not data.get("date"):
        data["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    t = Transaction(user_id=user.user_id, **data)
    await db.transactions.insert_one(t.model_dump())
    await _apply_txn(t, +1)
    return t.model_dump()


@router.delete("/transactions/{txn_id}")
async def delete_transaction(txn_id: str, user: User = Depends(get_current_user)):
    doc = await db.transactions.find_one({"id": txn_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    await _apply_txn(Transaction(**doc), -1)
    await db.transactions.delete_one({"id": txn_id})
    return {"ok": True}


# ---------------- Budget ----------------
@router.get("/budget")
async def get_budget(user: User = Depends(get_current_user)):
    return await db.budgets.find_one({"user_id": user.user_id, "month": _month()}, {"_id": 0})


@router.post("/budget")
async def set_budget(body: BudgetCreate, user: User = Depends(get_current_user)):
    b = Budget(user_id=user.user_id, month=_month(), **body.model_dump())
    await db.budgets.update_one(
        {"user_id": user.user_id, "month": _month()},
        {"$set": b.model_dump()}, upsert=True,
    )
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"onboarded": True}})
    return b.model_dump()


# ---------------- Goals ----------------
@router.get("/goals")
async def list_goals(user: User = Depends(get_current_user)):
    return await db.goals.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/goals")
async def create_goal(body: GoalCreate, user: User = Depends(get_current_user)):
    g = Goal(user_id=user.user_id, **body.model_dump())
    await db.goals.insert_one(g.model_dump())
    return g.model_dump()


@router.post("/goals/{goal_id}/deposit")
async def deposit_goal(goal_id: str, body: GoalDeposit, user: User = Depends(get_current_user)):
    res = await db.goals.update_one(
        {"id": goal_id, "user_id": user.user_id}, {"$inc": {"saved_amount": body.amount}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Goal not found")
    return await db.goals.find_one({"id": goal_id}, {"_id": 0})


@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, user: User = Depends(get_current_user)):
    await db.goals.delete_one({"id": goal_id, "user_id": user.user_id})
    return {"ok": True}


# ---------------- Dashboard / Analytics ----------------
@router.get("/dashboard")
async def dashboard(user: User = Depends(get_current_user)):
    wallets = await db.wallets.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    month = _month()
    txns = await db.transactions.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    budget = await db.budgets.find_one({"user_id": user.user_id, "month": month}, {"_id": 0})
    goals = await db.goals.find({"user_id": user.user_id}, {"_id": 0}).to_list(200)

    assets = sum(w["balance"] for w in wallets if w["type"] not in ("credit_card", "paylater"))
    debt = sum(w["balance"] for w in wallets if w["type"] in ("credit_card", "paylater"))
    net_worth = assets - debt

    month_txns = [t for t in txns if (t.get("date") or "").startswith(month)]
    income = sum(t["amount"] for t in month_txns if t["type"] == "income")
    expense = sum(t["amount"] for t in month_txns if t["type"] == "expense")
    savings_rate = (income - expense) / income if income > 0 else 0

    # Financial health score (0-100)
    score = 0
    score += 25 if net_worth > 0 else max(0, 25 + net_worth / max(assets, 1) * 25)
    score += min(30, max(0, savings_rate * 100 * 0.6))  # up to 30 for savings rate
    total_budget = sum(c["limit"] for c in budget["categories"]) if budget else 0
    if total_budget:
        adherence = 1 - min(1, expense / total_budget) if total_budget else 0
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
            budget_status.append({
                "category": c["category"], "group": c.get("group", "needs"),
                "limit": c["limit"], "spent": spent,
                "over": spent > c["limit"] and c["limit"] > 0,
            })

    return {
        "net_worth": net_worth, "assets": assets, "debt": debt,
        "income": income, "expense": expense, "savings_rate": savings_rate,
        "health_score": score,
        "wallet_count": len(wallets),
        "category_breakdown": [{"category": k, "amount": v} for k, v in sorted(cat.items(), key=lambda x: -x[1])],
        "budget_status": budget_status,
        "recent_transactions": txns[:8],
        "wallets": wallets,
        "goals": goals,
        "has_budget": bool(budget),
    }


@router.get("/analytics")
async def analytics(user: User = Depends(get_current_user)):
    txns = await db.transactions.find({"user_id": user.user_id}, {"_id": 0}).to_list(2000)
    # last 6 months trend
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
    return {
        "trend": trend_list,
        "category_breakdown": [{"category": k, "amount": v} for k, v in sorted(cat.items(), key=lambda x: -x[1])],
    }
