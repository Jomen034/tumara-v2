from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends, HTTPException

from db import db
from models import Bill, BillCreate, Transaction, now_utc
from deps import get_ctx, Ctx

router = APIRouter(prefix="/bills", tags=["bills"])


def _advance(d: str, recurrence: str) -> str:
    dt = datetime.strptime(d, "%Y-%m-%d").date()
    if recurrence == "weekly":
        dt = dt + timedelta(days=7)
    elif recurrence == "yearly":
        dt = dt.replace(year=dt.year + 1)
    elif recurrence == "monthly":
        m = dt.month + 1
        y = dt.year + (1 if m > 12 else 0)
        m = 1 if m > 12 else m
        day = min(dt.day, 28)
        dt = date(y, m, day)
    return dt.isoformat()


@router.get("")
async def list_bills(ctx: Ctx = Depends(get_ctx)):
    bills = await db.bills.find({"household_id": ctx.hid}, {"_id": 0}).sort("next_due_date", 1).to_list(200)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for b in bills:
        b["days_until"] = (datetime.strptime(b["next_due_date"], "%Y-%m-%d").date()
                           - datetime.strptime(today, "%Y-%m-%d").date()).days
    return bills


@router.get("/upcoming")
async def upcoming_bills(days: int = 7, ctx: Ctx = Depends(get_ctx)):
    today = datetime.now(timezone.utc).date()
    limit = (today + timedelta(days=days)).isoformat()
    bills = await db.bills.find(
        {"household_id": ctx.hid, "is_paid_current_cycle": False,
         "next_due_date": {"$lte": limit}}, {"_id": 0}
    ).sort("next_due_date", 1).to_list(50)
    for b in bills:
        b["days_until"] = (datetime.strptime(b["next_due_date"], "%Y-%m-%d").date() - today).days
    return bills


@router.post("")
async def create_bill(body: BillCreate, ctx: Ctx = Depends(get_ctx)):
    b = Bill(household_id=ctx.hid, member_id=ctx.user.user_id, **body.model_dump())
    await db.bills.insert_one(b.model_dump())
    return b.model_dump()


@router.put("/{bill_id}")
async def update_bill(bill_id: str, body: BillCreate, ctx: Ctx = Depends(get_ctx)):
    res = await db.bills.update_one(
        {"id": bill_id, "household_id": ctx.hid}, {"$set": body.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    return await db.bills.find_one({"id": bill_id}, {"_id": 0})


@router.delete("/{bill_id}")
async def delete_bill(bill_id: str, ctx: Ctx = Depends(get_ctx)):
    await db.bills.delete_one({"id": bill_id, "household_id": ctx.hid})
    return {"ok": True}


@router.post("/{bill_id}/pay")
async def pay_bill(bill_id: str, ctx: Ctx = Depends(get_ctx)):
    bill = await db.bills.find_one({"id": bill_id, "household_id": ctx.hid}, {"_id": 0})
    if not bill:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    # create an expense if a wallet is linked
    if bill.get("wallet_id"):
        t = Transaction(
            user_id=ctx.user.user_id, household_id=ctx.hid, member_id=ctx.user.user_id,
            type="expense", amount=bill["amount"], wallet_id=bill["wallet_id"],
            category=bill.get("category", "Tagihan & Utilitas"),
            note=f"Bayar tagihan: {bill['name']}",
            date=datetime.now(timezone.utc).strftime("%Y-%m-%d"), source="bill",
        )
        await db.transactions.insert_one(t.model_dump())
        await db.wallets.update_one(
            {"id": bill["wallet_id"], "household_id": ctx.hid}, {"$inc": {"balance": -bill["amount"]}}
        )
    # advance to next cycle (or mark paid for one-time)
    if bill["recurrence"] == "once":
        await db.bills.update_one({"id": bill_id}, {"$set": {"is_paid_current_cycle": True}})
    else:
        nxt = _advance(bill["next_due_date"], bill["recurrence"])
        await db.bills.update_one(
            {"id": bill_id}, {"$set": {"next_due_date": nxt, "is_paid_current_cycle": False}}
        )
    return await db.bills.find_one({"id": bill_id}, {"_id": 0})
