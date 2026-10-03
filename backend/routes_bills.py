from datetime import datetime, timezone, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from db import db
import ledger
from models import Bill, BillCreate, BillPaymentRequest, Transaction, now_utc
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
        try:
            b["days_until"] = (datetime.strptime(b["next_due_date"], "%Y-%m-%d").date()
                               - datetime.strptime(today, "%Y-%m-%d").date()).days
        except Exception:
            b["days_until"] = 0

        if b.get("bill_type") == "installment":
            total = b.get("total_tenor") or 0
            paid = b.get("paid_tenor") or 0
            b["remaining_tenor"] = max(0, total - paid) if total > 0 else 0
            b["progress_pct"] = round((paid / total) * 100, 1) if total > 0 else 0
            b["remaining_amount"] = b["remaining_tenor"] * b.get("amount", 0)
            b["is_completed"] = b.get("is_completed", False) or (total > 0 and paid >= total)
    return bills


@router.get("/upcoming")
async def upcoming_bills(days: int = 7, ctx: Ctx = Depends(get_ctx)):
    today = datetime.now(timezone.utc).date()
    limit = (today + timedelta(days=days)).isoformat()
    bills = await db.bills.find(
        {"household_id": ctx.hid, "is_paid_current_cycle": False,
         "is_completed": {"$ne": True},
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
    return await db.bills.find_one({"id": bill_id, "household_id": ctx.hid}, {"_id": 0})


@router.delete("/{bill_id}")
async def delete_bill(bill_id: str, ctx: Ctx = Depends(get_ctx)):
    res = await db.bills.delete_one({"id": bill_id, "household_id": ctx.hid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    return {"ok": True}


@router.get("/{bill_id}/history")
async def bill_history(bill_id: str, ctx: Ctx = Depends(get_ctx)):
    bill = await db.bills.find_one({"id": bill_id, "household_id": ctx.hid}, {"_id": 0})
    if not bill:
        raise HTTPException(404, "Tagihan tidak ditemukan")

    txns = await db.transactions.find(
        {"household_id": ctx.hid, "bill_id": bill_id},
        {"_id": 0}
    ).sort([("date", -1), ("created_at", -1)]).to_list(200)

    total_paid_in_app = sum(t["amount"] for t in txns)

    return {
        "bill": bill,
        "transactions": txns,
        "total_paid_in_app": total_paid_in_app,
        "payment_count_in_app": len(txns),
    }


@router.post("/{bill_id}/pay")
async def pay_bill(bill_id: str, body: Optional[BillPaymentRequest] = None, ctx: Ctx = Depends(get_ctx)):
    bill = await db.bills.find_one({"id": bill_id, "household_id": ctx.hid}, {"_id": 0})
    if not bill:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    if bill.get("is_completed"):
        raise HTTPException(400, "Tagihan/cicilan ini sudah lunas sepenuhnya")

    # Determine which wallet to use
    chosen_wallet = (body.wallet_id if body and body.wallet_id else None) or bill.get("wallet_id")

    # Determine if a transaction should be recorded
    should_record = True
    if body and body.record_transaction is False:
        should_record = False

    created_txn_id = None
    if chosen_wallet and should_record:
        # Validate that the chosen wallet exists in this household
        wal = await db.wallets.find_one({"id": chosen_wallet, "household_id": ctx.hid})
        if not wal:
            raise HTTPException(400, "Dompet pembayaran tidak valid atau tidak ditemukan")

        # Determine note
        if body and body.note:
            note_text = body.note
        else:
            note_text = f"Bayar tagihan: {bill['name']}"
            if bill.get("bill_type") == "installment":
                curr_inst = (bill.get("paid_tenor") or 0) + 1
                tot = bill.get("total_tenor")
                if tot:
                    note_text = f"Bayar cicilan ke-{curr_inst}/{tot}: {bill['name']}"

        paid_date = (body.paid_date if (body and body.paid_date) else None) or datetime.now(timezone.utc).strftime("%Y-%m-%d")

        t = Transaction(
            user_id=ctx.user.user_id,
            household_id=ctx.hid,
            member_id=ctx.user.user_id,
            type="expense",
            amount=bill["amount"],
            wallet_id=chosen_wallet,
            category=bill.get("category", "Tagihan & Utilitas"),
            note=note_text,
            date=paid_date,
            source="bill",
            bill_id=bill_id,
        )
        await db.transactions.insert_one(t.model_dump())
        await ledger.apply_transaction(ctx.hid, t, +1)
        await ledger.snapshot_networth(ctx.hid)
        created_txn_id = t.id

    # advance to next cycle or complete installment
    if bill.get("bill_type") == "installment":
        new_paid = (bill.get("paid_tenor") or 0) + 1
        total_tenor = bill.get("total_tenor") or 0
        is_completed = total_tenor > 0 and new_paid >= total_tenor

        if is_completed:
            await db.bills.update_one(
                {"id": bill_id, "household_id": ctx.hid},
                {"$set": {"paid_tenor": new_paid, "is_completed": True, "is_paid_current_cycle": True}}
            )
        else:
            nxt = _advance(bill["next_due_date"], bill.get("recurrence", "monthly"))
            await db.bills.update_one(
                {"id": bill_id, "household_id": ctx.hid},
                {"$set": {"paid_tenor": new_paid, "next_due_date": nxt, "is_paid_current_cycle": False}}
            )
    elif bill.get("recurrence") == "once":
        await db.bills.update_one({"id": bill_id, "household_id": ctx.hid}, {"$set": {"is_paid_current_cycle": True, "is_completed": True}})
    else:
        nxt = _advance(bill["next_due_date"], bill["recurrence"])
        await db.bills.update_one(
            {"id": bill_id, "household_id": ctx.hid}, {"$set": {"next_due_date": nxt, "is_paid_current_cycle": False}}
        )

    updated_bill = await db.bills.find_one({"id": bill_id, "household_id": ctx.hid}, {"_id": 0})
    return {
        **updated_bill,
        "transaction_recorded": bool(created_txn_id),
        "transaction_id": created_txn_id,
        "wallet_id_used": chosen_wallet,
    }
