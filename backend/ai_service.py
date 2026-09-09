import os
import io
import json
import base64
from datetime import datetime, timezone

from PIL import Image
from db import db

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()
MODEL_NAME = "gemini-3.6-flash"  # Gemini model supported by current API

# Initialize direct Google Generative AI if key is available
genai_client = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        genai_client = genai
    except Exception as e:
        print(f"[AI Service] Warning: google-generativeai init failed: {e}")


def _rp(n):
    try:
        return "Rp " + f"{int(round(n)):,}".replace(",", ".")
    except Exception:
        return f"Rp {n}"


async def build_financial_context(user_id: str) -> str:
    hid = user_id  # now receives household_id
    wallets = await db.wallets.find({"household_id": hid}, {"_id": 0}).to_list(200)
    txns = await db.transactions.find({"household_id": hid}, {"_id": 0}).sort("created_at", -1).to_list(40)
    goals = await db.goals.find({"household_id": hid}, {"_id": 0}).to_list(50)
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    budget = await db.budgets.find_one({"household_id": hid, "month": month}, {"_id": 0})

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
    "Kamu adalah 'Tumara', CFO pribadi berbasis AI untuk pengguna di Indonesia dengan filosofi 'Tumbuh dengan arah'. "
    "Gaya bicara: hangat, santai, memotivasi, seperti teman yang jago finansial (boleh pakai bahasa Gen-Z ringan). "
    "Selalu jawab dalam Bahasa Indonesia. Gunakan format Rupiah (contoh: Rp 1.500.000). "
    "Berikan saran yang SPESIFIK dan personal berdasarkan data keuangan pengguna di bawah ini, bukan jawaban generik. "
    "Jika relevan, sebutkan angka nyata dari data mereka. Buat jawaban ringkas, actionable, dan pakai poin bila perlu. "
    "Jangan pernah mengaku sebagai penasihat investasi berlisensi; beri disclaimer singkat bila membahas investasi."
)


def _make_chat(session_id: str, context: str):
    system = SYSTEM_PROMPT + "\n\n" + context
    if GEMINI_API_KEY and genai_client:
        model = genai_client.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=system,
        )
        return ("direct", model)
    elif EMERGENT_LLM_KEY:
        from emergentintegrations.llm.chat import LlmChat
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system).with_model(
            "gemini", "gemini-3-flash-preview"
        )
        return ("emergent", chat)
    else:
        return ("dummy", None)


async def advisor_stream(user_id: str, session_id: str, message: str, history: list):
    context = await build_financial_context(user_id)
    engine_type, client = _make_chat(session_id, context)

    if engine_type == "direct":
        chat_session = client.start_chat()
        response = await chat_session.send_message_async(message, stream=True)
        async for chunk in response:
            if chunk.text:
                yield chunk.text
    elif engine_type == "emergent":
        from emergentintegrations.llm.chat import TextDelta, StreamDone, UserMessage
        async for ev in client.stream_message(UserMessage(text=message)):
            if isinstance(ev, TextDelta):
                if ev.content:
                    yield ev.content
            elif isinstance(ev, StreamDone):
                break
    else:
        yield "Halo! Tumara berjalan dalam mode lokal offline. Untuk mengaktifkan respon AI pintar, masukkan `GEMINI_API_KEY` (dari Google AI Studio) di `backend/.env`."


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
    if GEMINI_API_KEY and genai_client:
        model = genai_client.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction="You convert Indonesian financial sentences into structured JSON transactions. Reply with pure JSON only."
        )
        resp = await model.generate_content_async(prompt)
        raw = resp.text
    elif EMERGENT_LLM_KEY:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY, session_id="txn-parse",
            system_message="You convert Indonesian financial sentences into structured JSON transactions. Reply with pure JSON only.",
        ).with_model("gemini", "gemini-3-flash-preview")
        resp = await chat.send_message(UserMessage(text=prompt))
        raw = resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
    else:
        # Simple offline regex-based parser heuristic
        import re
        amount_match = re.search(r"(\d+(?:\.\d+)?)\s*(k|rb|jt|m)?", text.lower())
        amount = 0
        if amount_match:
            num = float(amount_match.group(1))
            unit = amount_match.group(2)
            if unit in ("k", "rb"): num *= 1000
            elif unit == "jt": num *= 1000000
            elif unit == "m": num *= 1000000000
            amount = int(num)
        raw = json.dumps({
            "type": "expense", "amount": amount, "category": "Lainnya",
            "wallet_id": wallets[0]["id"] if wallets else None,
            "wallet_name": wallets[0]["name"] if wallets else "",
            "note": text, "date": today, "confidence": 0.6,
            "understood": f"Transaksi: {text} ({_rp(amount)})"
        })

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
    hid = user_id  # now receives household_id
    since = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    txns = await db.transactions.find({"household_id": hid}, {"_id": 0}).sort("created_at", -1).to_list(300)
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
    
    if GEMINI_API_KEY and genai_client:
        model = genai_client.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=WEEKLY_PROMPT,
        )
        resp = await model.generate_content_async("\n".join(ctx))
        return resp.text
    elif EMERGENT_LLM_KEY:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY, session_id=f"recap_{user_id}",
            system_message=WEEKLY_PROMPT,
        ).with_model("gemini", "gemini-3-flash-preview")
        resp = await chat.send_message(UserMessage(text="\n".join(ctx)))
        return resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
    else:
        return f"Rangkuman minggu ini: Pemasukan {_rp(income)}, Pengeluaran {_rp(expense)} ({len(week)} transaksi). 💡 Tips: Jaga proporsi pengeluaran kebutuhan di bawah 50% pendapatan."


async def scan_receipt(raw: bytes) -> dict:
    resized = _resize_image(raw)
    
    if GEMINI_API_KEY and genai_client:
        model = genai_client.GenerativeModel(model_name=MODEL_NAME)
        img = Image.open(io.BytesIO(resized))
        resp = await model.generate_content_async([RECEIPT_PROMPT, img])
        text = resp.text
    elif EMERGENT_LLM_KEY:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        b64 = base64.b64encode(resized).decode()
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY, session_id="receipt-scan",
            system_message="You extract structured data from receipt images and reply with pure JSON only.",
        ).with_model("gemini", "gemini-3-flash-preview")
        resp = await chat.send_message(
            UserMessage(text=RECEIPT_PROMPT, file_contents=[ImageContent(image_base64=b64)])
        )
        text = resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
    else:
        text = json.dumps({
            "merchant": "Struk Lokal", "total": 50000, "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "category": "Makanan & Minuman", "items": [{"name": "Item Struk", "price": 50000, "category": "Makanan & Minuman"}]
        })
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
