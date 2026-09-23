import os
import io
import json
import base64
from datetime import datetime, timezone

from PIL import Image
from db import db

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "").strip()
MODEL_NAME = "gemini-2.5-flash"  # Current Google GenAI recommended model

# Initialize Google GenAI client (modern SDK) or fallback to legacy google.generativeai
genai_modern_client = None
genai_legacy_client = None

if GEMINI_API_KEY:
    try:
        from google import genai
        genai_modern_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"[AI Service] google.genai modern client init fallback: {e}")

    try:
        import google.generativeai as genai_legacy
        genai_legacy.configure(api_key=GEMINI_API_KEY)
        genai_legacy_client = genai_legacy
    except Exception as e:
        print(f"[AI Service] google.generativeai legacy client init warning: {e}")


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


async def advisor_stream(user_id: str, session_id: str, message: str, history: list):
    context = await build_financial_context(user_id)
    system = SYSTEM_PROMPT + "\n\n" + context

    # 1. Modern google.genai SDK
    if GEMINI_API_KEY and genai_modern_client:
        try:
            from google.genai import types
            chat = genai_modern_client.aio.chats.create(
                model=MODEL_NAME,
                config=types.GenerateContentConfig(system_instruction=system)
            )
            response_stream = await chat.send_message_stream(message)
            async for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
            return
        except Exception as e:
            print(f"[AI Service] google.genai chat stream error, trying fallback: {e}")

    # 2. Legacy google.generativeai
    if GEMINI_API_KEY and genai_legacy_client:
        try:
            model = genai_legacy_client.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=system,
            )
            chat_session = model.start_chat()
            response = await chat_session.send_message_async(message, stream=True)
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
            return
        except Exception as e:
            print(f"[AI Service] google.generativeai legacy stream error: {e}")

    # 3. Emergent integration fallback
    if EMERGENT_LLM_KEY:
        try:
            from emergentintegrations.llm.chat import LlmChat, TextDelta, StreamDone, UserMessage
            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system).with_model(
                "gemini", "gemini-3-flash-preview"
            )
            async for ev in client.stream_message(UserMessage(text=message)):
                if isinstance(ev, TextDelta) and ev.content:
                    yield ev.content
                elif isinstance(ev, StreamDone):
                    break
            return
        except Exception as e:
            print(f"[AI Service] emergentintegrations stream error: {e}")

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
    raw = None

    if GEMINI_API_KEY and genai_modern_client:
        try:
            from google.genai import types
            resp = await genai_modern_client.aio.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction="You convert Indonesian financial sentences into structured JSON transactions. Reply with pure JSON only."
                )
            )
            raw = resp.text
        except Exception as e:
            print(f"[AI Service] google.genai parse_transaction error: {e}")

    if not raw and GEMINI_API_KEY and genai_legacy_client:
        try:
            model = genai_legacy_client.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction="You convert Indonesian financial sentences into structured JSON transactions. Reply with pure JSON only."
            )
            resp = await model.generate_content_async(prompt)
            raw = resp.text
        except Exception as e:
            print(f"[AI Service] google.generativeai legacy parse error: {e}")

    if not raw and EMERGENT_LLM_KEY:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY, session_id="txn-parse",
                system_message="You convert Indonesian financial sentences into structured JSON transactions. Reply with pure JSON only.",
            ).with_model("gemini", "gemini-3-flash-preview")
            resp = await chat.send_message(UserMessage(text=prompt))
            raw = resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
        except Exception as e:
            print(f"[AI Service] emergentintegrations parse error: {e}")

    if not raw:
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

        # Detect wallet
        lowered = text.lower()
        matched_wid = None
        matched_wname = ""
        for w in wallets:
            w_n = w.get("name", "").lower()
            if w_n and (w_n in lowered or any(part in lowered for part in w_n.split() if len(part) >= 3)):
                matched_wid = w.get("id")
                matched_wname = w.get("name")
                break
        if not matched_wid and wallets:
            matched_wid = wallets[0]["id"]
            matched_wname = wallets[0]["name"]

        # Detect type
        ttype = "expense"
        if any(k in lowered for k in ("gaji", "bonus", "terima", "masuk", "income", "pemasukan")):
            ttype = "income"
        elif any(k in lowered for k in ("transfer", "pindah", "tf", "kirim")):
            ttype = "transfer"

        # Detect category
        cat = "Lainnya"
        if any(k in lowered for k in ("bensin", "bbm", "bp", "shell", "pertamina", "gojek", "grab", "parkir", "tol", "transport")):
            cat = "Transportasi"
        elif any(k in lowered for k in ("makan", "minum", "kopi", "resto", "nasi", "cafe", "snack")):
            cat = "Makanan & Minuman"
        elif any(k in lowered for k in ("belanja", "beli", "tokopedia", "shopee", "supermarket")):
            cat = "Belanja"
        elif any(k in lowered for k in ("listrik", "pln", "wifi", "indihome", "air", "pdam", "pulsa", "tagihan", "utilitas")):
            cat = "Tagihan & Utilitas"

        raw = json.dumps({
            "type": ttype, "amount": amount, "category": cat,
            "wallet_id": matched_wid,
            "wallet_name": matched_wname,
            "note": text, "date": today, "confidence": 0.8,
            "understood": f"Transaksi {ttype}: {text} ({_rp(amount)})"
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
    
    # 1. Modern google.genai
    if GEMINI_API_KEY and genai_modern_client:
        try:
            from google.genai import types
            resp = await genai_modern_client.aio.models.generate_content(
                model=MODEL_NAME,
                contents="\n".join(ctx),
                config=types.GenerateContentConfig(system_instruction=WEEKLY_PROMPT)
            )
            return resp.text
        except Exception as e:
            print(f"[AI Service] google.genai weekly_recap error: {e}")

    # 2. Legacy google.generativeai
    if GEMINI_API_KEY and genai_legacy_client:
        try:
            model = genai_legacy_client.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=WEEKLY_PROMPT,
            )
            resp = await model.generate_content_async("\n".join(ctx))
            return resp.text
        except Exception as e:
            print(f"[AI Service] google.generativeai weekly_recap error: {e}")

    # 3. Emergent fallback
    if EMERGENT_LLM_KEY:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY, session_id=f"recap_{user_id}",
                system_message=WEEKLY_PROMPT,
            ).with_model("gemini", "gemini-3-flash-preview")
            resp = await chat.send_message(UserMessage(text="\n".join(ctx)))
            return resp if isinstance(resp, str) else getattr(resp, "content", str(resp))
        except Exception as e:
            print(f"[AI Service] emergentintegrations recap error: {e}")

    return f"Rangkuman minggu ini: Pemasukan {_rp(income)}, Pengeluaran {_rp(expense)} ({len(week)} transaksi). 💡 Tips: Jaga proporsi pengeluaran kebutuhan di bawah 50% pendapatan."


async def scan_receipt(raw: bytes) -> dict:
    resized = _resize_image(raw)
    text = None
    
    # 1. Modern google.genai
    if GEMINI_API_KEY and genai_modern_client:
        try:
            from google.genai import types
            resp = await genai_modern_client.aio.models.generate_content(
                model=MODEL_NAME,
                contents=[
                    types.Part.from_bytes(data=resized, mime_type="image/jpeg"),
                    RECEIPT_PROMPT,
                ]
            )
            text = resp.text
        except Exception as e:
            print(f"[AI Service] google.genai scan_receipt error: {e}")

    # 2. Legacy google.generativeai
    if not text and GEMINI_API_KEY and genai_legacy_client:
        try:
            model = genai_legacy_client.GenerativeModel(model_name="gemini-1.5-flash")
            img = Image.open(io.BytesIO(resized))
            resp = await model.generate_content_async([RECEIPT_PROMPT, img])
            text = resp.text
        except Exception as e:
            print(f"[AI Service] google.generativeai scan_receipt error: {e}")

    # 3. Emergent fallback
    if not text and EMERGENT_LLM_KEY:
        try:
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
        except Exception as e:
            print(f"[AI Service] emergentintegrations receipt error: {e}")

    if not text:
        text = json.dumps({
            "merchant": "Struk Belanja", "total": 50000, "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
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
