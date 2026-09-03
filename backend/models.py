import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------- Auth ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    onboarded: bool = False
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Wallets ----------
WALLET_TYPES = ["bank", "ewallet", "credit_card", "paylater", "cash", "investment"]


class WalletCreate(BaseModel):
    name: str
    type: Literal["bank", "ewallet", "credit_card", "paylater", "cash", "investment"]
    balance: float = 0
    color: str = "#00E676"
    icon: str = "wallet"


class Wallet(WalletCreate):
    id: str = Field(default_factory=lambda: new_id("wal"))
    user_id: str
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Transactions ----------
CATEGORIES = [
    "Makanan & Minuman", "Transportasi", "Belanja", "Tagihan & Utilitas",
    "Hiburan", "Kesehatan", "Pendidikan", "Investasi", "Gaji", "Bonus", "Lainnya",
]


class TransactionCreate(BaseModel):
    type: Literal["expense", "income", "transfer"]
    amount: float
    wallet_id: str
    to_wallet_id: Optional[str] = None
    category: str = "Lainnya"
    note: str = ""
    date: Optional[str] = None
    source: str = "manual"  # manual | ai_receipt


class Transaction(TransactionCreate):
    id: str = Field(default_factory=lambda: new_id("txn"))
    user_id: str
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Budget ----------
class BudgetCategory(BaseModel):
    category: str
    limit: float
    group: Literal["needs", "wants", "savings"] = "needs"


class BudgetCreate(BaseModel):
    monthly_income: float
    mode: Literal["percentage", "fixed"] = "percentage"
    categories: List[BudgetCategory] = []


class Budget(BudgetCreate):
    id: str = Field(default_factory=lambda: new_id("bud"))
    user_id: str
    month: str  # YYYY-MM
    updated_at: datetime = Field(default_factory=now_utc)


# ---------- Goals ----------
class GoalCreate(BaseModel):
    title: str
    target_amount: float
    saved_amount: float = 0
    deadline: Optional[str] = None
    color: str = "#00F0FF"
    emoji: str = "🎯"


class Goal(GoalCreate):
    id: str = Field(default_factory=lambda: new_id("goal"))
    user_id: str
    created_at: datetime = Field(default_factory=now_utc)


class GoalDeposit(BaseModel):
    amount: float


# ---------- AI ----------
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
