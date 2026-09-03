import os
import io
import json
import base64
from datetime import datetime, timezone

from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from db import db

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL_PROVIDER = "gemini"
MODEL_NAME = "gemini-3-flash-preview"


def _rp(n):
    try:
        return "Rp " + f"{int(round(n)):,}".replace(",", ".")
    except Exception:
        return f"Rp {n}"


async def build_financial_context(user_id: str) -> str:
    wallets = await db.wallets.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    txns = await db.transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(40)
    goals = await db.goals.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    budget = await db.budgets.find_one({"user_id": user_id, "month": month}, {"_id": 0})

    total_balance = sum(w.get("balance", 0) for w in wallets if w.get("type") not in ("credit_card", "paylater"))
    debt = sum(w.get("balance", 0) for w in wallets if w.get("type") in ("credit_card", "paylater"))

    income = sum(t["amount"] for t in txns if t["type"] == "income")
    expense = sum(t["amount"] for t in txns if t["type"] == "expense")

    lines = ["=== KONTEKS KEUANGAN PENGGUNA ==="]
    lines.append(f"Total saldo aset: {_rp(total_balance)}")
    lines.append(f"Total utang (CC/PayLater): {_rp(debt)}")
    lines.append(f"Net worth: {_rp(total_balance - debt)}")
    lines.append("")
    lines.append("Dompet:")
    for w in wallets:
        lines.append(f"- {w['name']} ({w['type']}): {_rp(w.get('balance', 0))}")
    if budget:
        lines.append("")
        lines.append(f"Budget bulan ini ({budget['mode']}), penghasilan {_rp(budget['monthly_income'])}:")
        for c in budget.get("categories", []):
            lines.append(f"- {c['category']} [{c.get('group','needs')}]: limit {_rp(c['limit'])}")
    lines.append("")
    lines.append(f"40 transaksi terakhir: pemasukan {_rp(income)}, pengeluaran {_rp(expense)}")
    cat = {}
    for t in txns:
        if t["type"] == "expense":
            cat[t["category"]] = cat.get(t["category"], 0) + t["amount"]
    if cat:
        lines.append("Pengeluaran per kategori (terbaru):")
        for k, v in sorted(cat.items(), key=lambda x: -x[1]):
            lines.append(f"- {k}: {_rp(v)}")
    if goals:
        lines.append("")
        lines.append("Tujuan menabung:")
        for g in goals:
            lines.append(f"- {g['title']}: {_rp(g['saved_amount'])} / {_rp(g['target_amount'])}")
    return "\n".join(lines)


SYSTEM_PROMPT = (
    "Kamu adalah 'Nusa', CFO pribadi berbasis AI untuk pengguna di Indonesia. "
    "Gaya bicara: hangat, santai, memotivasi, seperti teman yang jago finansial (boleh pakai bahasa Gen-Z ringan). "
    "Selalu jawab dalam Bahasa Indonesia. Gunakan format Rupiah (contoh: Rp 1.500.000). "
    "Berikan saran yang SPESIFIK dan personal berdasarkan data keuangan pengguna di bawah ini, bukan jawaban generik. "
    "Jika relevan, sebutkan angka nyata dari data mereka. Buat jawaban ringkas, actionable, dan pakai poin bila perlu. "
    "Jangan pernah mengaku sebagai penasihat investasi berlisensi; beri disclaimer singkat bila membahas investasi."
)


def _make_chat(session_id: str, context: str) -> LlmChat:
    system = SYSTEM_PROMPT + "\n\n" + context
    return LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system).with_model(
        MODEL_PROVIDER, MODEL_NAME
    )


async def advisor_stream(user_id: str, session_id: str, message: str, history: list):
    context = await build_financial_context(user_id)
    chat = _make_chat(session_id, context)
    # replay short history so the model has continuity within the persisted thread
    from emergentintegrations.llm.chat import TextDelta, StreamDone

    async for ev in chat.stream_message(UserMessage(text=message)):
        if isinstance(ev, TextDelta):
            if ev.content:
                yield ev.content
        elif isinstance(ev, StreamDone):
            break


def _resize_image(raw: bytes) -> bytes:
    img = Image.open(io.BytesIO(raw))
    if getattr(img, "is_animated", False):
        img.seek(0)
    img = img.convert("RGB")
    img.thumbnail((1600, 1600))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue()


CATEGORY_LIST = '["Makanan & Minuman","Transportasi","Belanja","Tagihan & Utilitas","Hiburan","Kesehatan","Pendidikan","Investasi","Gaji","Bonus","Lainnya"]'

RECEIPT_PROMPT = (
    "Kamu adalah mesin OCR struk belanja. Analisis gambar struk ini dan kembalikan HANYA JSON valid "
    "(tanpa markdown, tanpa penjelasan) dengan skema: "
    '{"merchant": string, "total": number, "date": "YYYY-MM-DD" | null, '
    '"category": salah satu dari ["Makanan & Minuman","Transportasi","Belanja","Tagihan & Utilitas","Hiburan","Kesehatan","Pendidikan","Lainnya"], '
    '"items": [{"name": string, "price": number, "category": salah satu dari kategori di atas}]}. '
    "Untuk setiap item, tebak kategori paling sesuai (mis. minuman -> Makanan & Minuman). "
    "Nilai uang sebagai angka tanpa titik/koma pemisah ribuan (contoh 15000). "
    "Tebak kategori keseluruhan paling sesuai. Jika tidak terbaca, isi total 0 dan items []."
)


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except Exception:
        s, e = text.find("{"), text.rfind("}")
        if s != -1 and e != -1:
            return json.loads(text[s:e + 1])
        raise


async def parse_transaction_text(text: str, wallets: list) -> dict:
    """Parse a free-text Indonesian sentence into a structured transaction draft."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    wallet_lines = "\n".join([f'- id="{w["id"]}" nama="{w["name"]}" jenis={w["type"]}' for w in wallets]) or "(belum ada dompet)"
    prompt = (
        f"Hari ini {today}. Ubah kalimat pengguna menjadi SATU transaksi keuangan.\n"
        f"Daftar dompet pengguna:\n{wallet_lines}\n\n"
        "Kembalikan HANYA JSON valid tanpa markdown dengan skema:\n"
        '{"type": "expense"|"income"|"transfer", "amount": number, '
        f'"category": salah satu dari {CATEGORY_LIST}, '
        '"wallet_id": id dompet paling cocok dari daftar (atau null jika tak yakin), '
        '"wallet_name": nama dompet yang kamu maksud (string, boleh tebakan), '
        '"note": ringkasan singkat (mis. nama merchant/keterangan), '
        '"date": "YYYY-MM-DD", '
        '"confidence": angka 0-1, '
        '"understood": kalimat singkat Bahasa Indonesia yang menjelaskan interpretasimu}\n'
        "Aturan angka: '400k'/'400rb'=400000, '1.5jt'/'1,5jt'=1500000, '2m'=2000000. "
        "Kata seperti 'isi bensin','makan','beli','bayar','top up' -> expense. "
        "'gaji','bonus','terima','masuk' -> income. 'transfer','pindah','tf' -> transfer. "
        "Cocokkan dompet dari kata kunci (mis. 'debit ocbc'->dompet OCBC, 'gopay'->GoPay). "
        "Jika tanggal tidak disebut, pakai hari ini. Jika 'kemarin', kurangi 1 hari.\n\n"
        f'Kalimat pengguna: "{text}"'
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY, session_id="txn-parse",
        system_message="You convert Indonesian financial sentences into structured JSON transactions. Reply with pure JSON only.",
    ).with_model(MODEL_PROVIDER, MODEL_NAME)
    resp = await chat.send_message(UserMessage(text=prompt))
    raw = resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
    data = _extract_json(raw)
    data.setdefault("type", "expense")
    data.setdefault("amount", 0)
    data.setdefault("category", "Lainnya")
    data.setdefault("wallet_id", None)
    data.setdefault("wallet_name", "")
    data.setdefault("note", "")
    data.setdefault("date", today)
    data.setdefault("confidence", 0.5)
    data.setdefault("understood", "")
    # validate wallet_id belongs to the user's list
    ids = {w["id"] for w in wallets}
    if data["wallet_id"] not in ids:
        data["wallet_id"] = None
    return data


WEEKLY_PROMPT = (
    "Buat rangkuman keuangan MINGGUAN yang singkat, hangat, dan memotivasi dalam Bahasa Indonesia "
    "berdasarkan data 7 hari terakhir di bawah. Format: 2-3 kalimat rangkuman + 1 baris tips actionable "
    "diawali '💡 Tips:'. Sebut angka nyata (Rupiah) dan kategori terbesar bila ada. "
    "Jangan pakai heading atau bullet berlebihan. Maksimal 90 kata."
)


async def generate_weekly_recap(user_id: str) -> str:
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    txns = await db.transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(300)
    week = [t for t in txns if (t.get("date") or "") >= since]
    income = sum(t["amount"] for t in week if t["type"] == "income")
    expense = sum(t["amount"] for t in week if t["type"] == "expense")
    cat = {}
    for t in week:
        if t["type"] == "expense":
            cat[t["category"]] = cat.get(t["category"], 0) + t["amount"]
    ctx = [f"Periode: 7 hari terakhir (sejak {since})",
           f"Total pemasukan: {_rp(income)}", f"Total pengeluaran: {_rp(expense)}",
           f"Jumlah transaksi: {len(week)}"]
    if cat:
        ctx.append("Pengeluaran per kategori:")
        for k, v in sorted(cat.items(), key=lambda x: -x[1]):
            ctx.append(f"- {k}: {_rp(v)}")
    if not week:
        ctx.append("Tidak ada transaksi minggu ini.")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY, session_id=f"recap_{user_id}",
        system_message=WEEKLY_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)
    resp = await chat.send_message(UserMessage(text="\n".join(ctx)))
    return resp if isinstance(resp, str) else getattr(resp, "content", str(resp))


async def scan_receipt(raw: bytes) -> dict:
    resized = _resize_image(raw)
    b64 = base64.b64encode(resized).decode()
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY, session_id="receipt-scan",
        system_message="You extract structured data from receipt images and reply with pure JSON only.",
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    resp = await chat.send_message(
        UserMessage(text=RECEIPT_PROMPT, file_contents=[ImageContent(image_base64=b64)])
    )
    text = resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        data = json.loads(text.strip())
    except Exception:
        start, end = text.find("{"), text.rfind("}")
        data = json.loads(text[start:end + 1]) if start != -1 else {
            "merchant": "", "total": 0, "date": None, "category": "Lainnya", "items": []
        }
    data.setdefault("merchant", "")
    data.setdefault("total", 0)
    data.setdefault("date", None)
    data.setdefault("category", "Lainnya")
    data.setdefault("items", [])
    for it in data["items"]:
        it.setdefault("category", data.get("category", "Lainnya"))
        it.setdefault("price", 0)
        it.setdefault("name", "Item")
    return data
