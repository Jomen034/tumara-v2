import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from httpx import AsyncClient, ASGITransport
from server import app
from db import db
from datetime import datetime


@pytest.mark.asyncio
async def test_checkout_and_simulation_funnel():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ts = int(datetime.now().timestamp() * 1000)
        buyer_email = f"buyer_{ts}@example.com"
        buyer_name = "Budi Hartono"
        buyer_password = "password12345"

        # 1. Checkout Starter Plan
        r_checkout = await ac.post("/api/orders/checkout", json={
            "tier": "starter",
            "name": buyer_name,
            "email": buyer_email,
            "whatsapp": "081234567890",
            "password": buyer_password,
            "payment_method": "qris"
        })
        assert r_checkout.status_code == 200, r_checkout.text
        checkout_data = r_checkout.json()
        assert "order_id" in checkout_data
        assert checkout_data["amount"] == 49000
        assert checkout_data["tier"] == "starter"
        assert checkout_data["status"] == "pending"
        assert checkout_data["mode"] == "simulation"
        assert "simulation" in checkout_data
        order_id = checkout_data["order_id"]

        # 2. Check Order Status before payment
        r_status1 = await ac.get(f"/api/orders/{order_id}/status")
        assert r_status1.status_code == 200
        assert r_status1.json()["status"] == "pending"
        assert r_status1.json()["access_code"] is None

        # 3. Simulate Payment Success
        r_sim = await ac.post("/api/orders/simulate-pay", json={"order_id": order_id})
        assert r_sim.status_code == 200, r_sim.text
        sim_data = r_sim.json()
        assert sim_data["status"] == "paid"
        assert sim_data["tier"] == "starter"
        access_code = sim_data["access_code"]
        assert access_code.startswith("TMR-STR-")
        assert sim_data["auto_login"] is True
        assert "user" in sim_data
        assert sim_data["user"]["email"] == buyer_email
        assert sim_data["user"]["tier"] == "starter"
        assert "session_token" in sim_data

        # 4. Check Order Status after payment
        r_status2 = await ac.get(f"/api/orders/{order_id}/status")
        assert r_status2.status_code == 200
        assert r_status2.json()["status"] == "paid"
        assert r_status2.json()["access_code"] == access_code

        # 5. Access code should exist in access_codes table and be marked as used (due to auto-registration)
        ac_doc = await db.access_codes.find_one({"code": access_code})
        assert ac_doc is not None
        assert ac_doc["tier"] == "starter"
        assert ac_doc["used_count"] == 1

        # 6. Idempotency: re-simulating already paid order returns existing code without error
        r_re_sim = await ac.post("/api/orders/simulate-pay", json={"order_id": order_id})
        assert r_re_sim.status_code == 200
        assert r_re_sim.json()["access_code"] == access_code
        assert r_re_sim.json()["status"] == "paid"
