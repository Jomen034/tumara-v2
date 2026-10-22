import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------- Auth ----------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    onboarded: bool = False
    household_id: Optional[str] = None
    role: str = "admin"  # admin | partner
    tier: str = "pro"  # starter | pro | family
    display_name: Optional[str] = None
    active: bool = True
    ai_usage: Optional[dict] = None
    created_at: datetime = Field(default_factory=now_utc)


class AccessCode(BaseModel):
    id: str = Field(default_factory=lambda: new_id("ac"))
    code: str
    max_uses: int = 100
    used_count: int = 0
    active: bool = True
    created_by: Optional[str] = "system"
    note: Optional[str] = None
    tier: str = "pro"  # starter | pro | family | addon_scan50
    created_at: datetime = Field(default_factory=now_utc)


class RedeemCodeRequest(BaseModel):
    code: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ---------- Household ----------
MAX_HOUSEHOLD_MEMBERS = 2


class Household(BaseModel):
    id: str = Field(default_factory=lambda: new_id("hh"))
    name: str
    owner_user_id: str
    currency: str = "IDR"
    created_at: datetime = Field(default_factory=now_utc)


class HouseholdUpdate(BaseModel):
    name: Optional[str] = None
    emoji_icon: Optional[str] = None


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    picture: Optional[str] = None


class ResetDataRequest(BaseModel):
    confirm_text: str


class DeleteAccountRequest(BaseModel):
    confirm_text: str


class InviteCreate(BaseModel):
    email: Optional[str] = None


class JoinRequest(BaseModel):
    code: str


# ---------- Bills ----------
class BillCreate(BaseModel):
    name: str
    amount: float
    category: str = "Tagihan & Utilitas"
    recurrence: Literal["monthly", "weekly", "yearly", "once"] = "monthly"
    next_due_date: str  # YYYY-MM-DD
    wallet_id: Optional[str] = None
    bill_type: Literal["recurring", "installment"] = "recurring"
    total_tenor: Optional[int] = None
    paid_tenor: int = 0
    total_amount: Optional[float] = None
    note: Optional[str] = None


class Bill(BillCreate):
    id: str = Field(default_factory=lambda: new_id("bill"))
    household_id: str
    member_id: str
    is_paid_current_cycle: bool = False
    is_completed: bool = False
    last_paid_date: Optional[str] = None
    last_paid_amount: Optional[float] = None
    created_at: datetime = Field(default_factory=now_utc)


class BillPaymentRequest(BaseModel):
    wallet_id: Optional[str] = None
    paid_date: Optional[str] = None  # YYYY-MM-DD
    note: Optional[str] = None
    record_transaction: bool = True
    amount: Optional[float] = None
    update_master_amount: bool = False


# ---------- Wallets ----------
WALLET_TYPES = ["bank", "ewallet", "credit_card", "paylater", "cash", "investment"]


class WalletCreate(BaseModel):
    name: str
    type: Literal["bank", "ewallet", "credit_card", "paylater", "cash", "investment"]
    balance: float = 0
    credit_limit: Optional[float] = None
    color: str = "#00E676"
    icon: str = "wallet"

    @model_validator(mode="after")
    def _sanitize_debt_balance(self):
        # Dompet utang (kartu kredit & paylater) saldo tagihannya selalu non-negatif
        if self.type in ("credit_card", "paylater") and self.balance is not None:
            self.balance = abs(float(self.balance))
        return self


class Wallet(WalletCreate):
    id: str = Field(default_factory=lambda: new_id("wal"))
    user_id: str
    created_at: datetime = Field(default_factory=now_utc)


# ---------- Financial Number Parser ----------
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


# ---------- Transactions ----------
CATEGORIES = [
    "Groceries & Kebutuhan Rumah", "Makanan & Minuman", "Transportasi", "Belanja", "Tagihan & Utilitas",
    "Biaya Admin & Layanan", "Hiburan", "Kesehatan", "Pendidikan", "Investasi", "Gaji", "Bonus", "Lainnya",
]


class SubItem(BaseModel):
    name: str
    price: float = 0.0
    category: Optional[str] = None
    quantity: Optional[Union[float, int, str]] = 1.0

    @field_validator("quantity", mode="before")
    @classmethod
    def _parse_qty(cls, v):
        if v is None:
            return 1.0
        try:
            return float(str(v).replace(",", "."))
        except Exception:
            return 1.0

    @field_validator("price", mode="before")
    @classmethod
    def _parse_price(cls, v):
        return parse_financial_number(v)


class TransactionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Literal["expense", "income", "transfer"]
    amount: float = Field(gt=0)
    wallet_id: str
    to_wallet_id: Optional[str] = None
    category: str = "Lainnya"
    note: str = ""
    date: Optional[str] = None
    source: str = "manual"  # manual | ai_receipt | goal_deposit | bill
    goal_id: Optional[str] = None
    bill_id: Optional[str] = None
    items: Optional[List[SubItem]] = None

    @field_validator("amount", mode="before")
    @classmethod
    def _parse_amount(cls, v):
        return parse_financial_number(v)


class TransactionUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Optional[Literal["expense", "income", "transfer"]] = None
    amount: Optional[float] = Field(default=None, gt=0)
    wallet_id: Optional[str] = None
    to_wallet_id: Optional[str] = None
    category: Optional[str] = None
    note: Optional[str] = None
    date: Optional[str] = None
    goal_id: Optional[str] = None
    bill_id: Optional[str] = None
    items: Optional[List[SubItem]] = None

    @field_validator("amount", mode="before")
    @classmethod
    def _parse_amount(cls, v):
        if v is None:
            return None
        return parse_financial_number(v)


class Transaction(TransactionCreate):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: new_id("txn"))
    user_id: Optional[str] = "system"
    household_id: Optional[str] = None
    member_id: Optional[str] = None
    amount: float = Field(default=0.0, ge=0)
    created_at: Optional[Union[datetime, str]] = Field(default_factory=now_utc)
    updated_at: Optional[Union[datetime, str]] = None
    updated_by: Optional[str] = None


# ---------- Budget ----------
class BudgetCategory(BaseModel):
    category: str
    limit: float
    group: Literal["needs", "wants", "savings"] = "needs"


class CategoryLimitUpdate(BaseModel):
    limit: float = Field(ge=0)
    group: Optional[Literal["needs", "wants", "savings"]] = None


class BudgetIncomeUpdate(BaseModel):
    monthly_income: float = Field(gt=0)
    mode: Optional[Literal["percentage", "fixed"]] = None


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
    amount: float = Field(gt=0)
    wallet_id: Optional[str] = None
    to_wallet_id: Optional[str] = None
    note: Optional[str] = None


# ---------- AI ----------
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: Optional[List[dict]] = None

