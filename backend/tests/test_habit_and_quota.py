"""Unit test for Habit Tracker logic and AI Quota management.
Runs with standard library unittest (no external packages required).
"""
import asyncio
import unittest
from datetime import datetime, timezone, timedelta
from collections import defaultdict


class TestHabitTrackerLogic(unittest.TestCase):
    def test_habit_tracker_streak_and_discipline(self):
        wib_now = datetime.now(timezone(timedelta(hours=7)))
        today_day = wib_now.day

        # Mock transactions on past 5 days
        mock_txns = [
            {"date": f"{wib_now.strftime('%Y-%m')}-{str(d).zfill(2)}"}
            for d in range(max(1, today_day - 4), today_day + 1)
        ]

        active_day_set = set()
        day_txn_counts = defaultdict(int)
        for t in mock_txns:
            d_str = t.get("date") or ""
            if len(d_str) >= 10:
                day_int = int(d_str[8:10])
                active_day_set.add(day_int)
                day_txn_counts[day_int] += 1

        active_days = sorted(list(active_day_set))
        logged_today = today_day in active_day_set

        # Calculate streak
        streak = 0
        check_day = today_day if logged_today else today_day - 1
        while check_day > 0 and check_day in active_day_set:
            streak += 1
            check_day -= 1

        days_passed = max(1, today_day)
        logged_count = len([d for d in active_days if d <= days_passed])
        discipline_pct = round((logged_count / days_passed) * 100)

        self.assertTrue(logged_today)
        self.assertGreaterEqual(streak, 1)
        self.assertGreater(discipline_pct, 0)
        self.assertLessEqual(discipline_pct, 100)


class MockCollection:
    def __init__(self, data=None):
        self.data = data or {}

    async def find_one(self, query):
        uid = query.get("user_id")
        return self.data.get(uid)

    async def update_one(self, query, update):
        uid = query.get("user_id")
        if uid in self.data:
            if "$set" in update:
                for k, v in update["$set"].items():
                    if "." in k:
                        parent, child = k.split(".", 1)
                        if parent not in self.data[uid]:
                            self.data[uid][parent] = {}
                        self.data[uid][parent][child] = v
                    else:
                        self.data[uid][k] = v
            if "$inc" in update:
                for k, v in update["$inc"].items():
                    if "." in k:
                        parent, child = k.split(".", 1)
                        self.data[uid][parent][child] = self.data[uid][parent].get(child, 0) + v
                    else:
                        self.data[uid][k] = self.data[uid].get(k, 0) + v


class TestAiQuotaLimits(unittest.TestCase):
    def test_tier_limits_mapping(self):
        from ai_quota import TIER_LIMITS, get_next_reset_date, get_current_wib_month
        self.assertEqual(TIER_LIMITS["starter"]["scans"], 3)
        self.assertEqual(TIER_LIMITS["starter"]["chats"], 5)
        self.assertEqual(TIER_LIMITS["pro"]["scans"], 50)
        self.assertEqual(TIER_LIMITS["pro"]["chats"], 100)
        self.assertEqual(TIER_LIMITS["family"]["scans"], 120)
        self.assertEqual(TIER_LIMITS["family"]["chats"], 250)

        month_str = get_current_wib_month()
        self.assertRegex(month_str, r"^\d{4}-\d{2}$")

        reset_date = get_next_reset_date()
        self.assertTrue(reset_date.startswith("1 "))

    def test_quota_enforcement_and_fup(self):
        import ai_quota
        from ai_quota import enforce_and_increment_ai_quota, HTTPException

        # Mock user at quota limit with extra scans
        mock_user = {
            "user_id": "user_test_quota_01",
            "tier": "starter",
            "ai_usage": {
                "month": ai_quota.get_current_wib_month(),
                "scans_used": 3,
                "scans_limit": 3,
                "extra_scans": 1,
                "chats_used": 2,
                "chats_limit": 5,
                "extra_chats": 0,
            }
        }
        ai_quota.db = type("MockDB", (), {"users": MockCollection({"user_test_quota_01": mock_user})})

        # Test scan when limit reached but extra_scans > 0 -> decrements extra_scans, does not raise 429
        async def run_scan_with_extra():
            await enforce_and_increment_ai_quota("user_test_quota_01", "scan")
            u = await ai_quota.db.users.find_one({"user_id": "user_test_quota_01"})
            self.assertEqual(u["ai_usage"]["extra_scans"], 0)

        # Test scan when extra_scans is 0 -> raises 429
        async def run_scan_exceeded():
            try:
                await enforce_and_increment_ai_quota("user_test_quota_01", "scan")
                return False
            except HTTPException as e:
                self.assertEqual(e.status_code, 429)
                self.assertTrue(e.detail.get("quota_exceeded"))
                self.assertEqual(e.detail.get("scans_used"), 3)
                self.assertTrue(e.detail.get("can_upgrade"))
                return True

        # Test chat within limit -> increments counter
        async def run_chat_valid():
            await enforce_and_increment_ai_quota("user_test_quota_01", "chat")
            u = await ai_quota.db.users.find_one({"user_id": "user_test_quota_01"})
            self.assertEqual(u["ai_usage"]["chats_used"], 3)

        loop = asyncio.new_event_loop()
        loop.run_until_complete(run_scan_with_extra())
        res_exceeded = loop.run_until_complete(run_scan_exceeded())
        self.assertTrue(res_exceeded)
        loop.run_until_complete(run_chat_valid())
        loop.close()


if __name__ == "__main__":
    unittest.main()
