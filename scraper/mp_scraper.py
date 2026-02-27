#!/usr/bin/env python3
"""
Sri Lanka Parliament MP Attendance Scraper
==========================================
Scrapes all 225 MPs' attendance records from parliament.lk
Run quarterly to refresh the dashboard data.

Usage:
    python mp_scraper.py

Output:
    ../public/data/mp_attendance.json
"""

import json
import time
import re
import os
import sys
from datetime import datetime, timedelta
from html.parser import HTMLParser
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode

# ── Configuration ───────────────────────────────────────────────────────────
BASE_URL = "https://www.parliament.lk"
DIRECTORY_URL = f"{BASE_URL}/en/members-of-parliament/mp-listing"
ATTENDANCE_URL = f"{BASE_URL}/en/members-of-parliament/house-attendance"
PROFILE_URL = f"{BASE_URL}/en/members-of-parliament/mp-profile"
LEGISLATURE_ID = "995"  # 10th Parliament (2024-present)
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "mp_attendance.json")
REQUEST_DELAY = 0.5  # seconds between requests to be polite

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MPTracker/1.0; +https://analyst.rizrazak.com)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}


# ── HTML Parsers ────────────────────────────────────────────────────────────

class MPDirectoryParser(HTMLParser):
    """Parses MP directory pages to extract MP profiles."""

    def __init__(self):
        super().__init__()
        self.mps = []
        self.current_mp = {}
        self.in_profile_link = False
        self.in_party_label = False
        self.in_party_value = False
        self.in_district_label = False
        self.in_district_value = False
        self.capture_text = False
        self.text_buffer = ""
        self.last_text = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "a" and "href" in attrs_dict:
            href = attrs_dict["href"]
            if "/mp-profile/" in href:
                mp_id = href.split("/mp-profile/")[-1].split("?")[0].split("/")[0]
                self.current_mp = {"id": mp_id, "name": "", "party": "", "district": ""}
                self.in_profile_link = True
                self.text_buffer = ""

    def handle_endtag(self, tag):
        if tag == "a" and self.in_profile_link:
            self.in_profile_link = False
            name = self.text_buffer.strip().split("\n")[0].strip()
            self.current_mp["name"] = name

    def handle_data(self, data):
        stripped = data.strip()
        if self.in_profile_link:
            self.text_buffer += data

        if stripped == "Political Party":
            self.in_party_label = True
        elif self.in_party_label and stripped:
            if self.current_mp:
                self.current_mp["party"] = stripped
            self.in_party_label = False

        if stripped == "District":
            self.in_district_label = True
        elif self.in_district_label and stripped:
            if self.current_mp:
                self.current_mp["district"] = stripped
                # Both party and district captured — save MP
                if self.current_mp.get("id") and self.current_mp.get("name"):
                    self.mps.append(self.current_mp.copy())
                self.current_mp = {}
            self.in_district_label = False


class AttendancePageParser(HTMLParser):
    """Parses the attendance page to extract date-keyed attendance records."""

    def __init__(self):
        super().__init__()
        self.records = []  # [{date, name, status}]
        self.dates = []
        self.in_accordion_button = False
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.cell_index = 0
        self.current_row = {}
        self.current_date_idx = -1
        self.text_buffer = ""
        self.table_count = 0

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get("class", "")

        if tag == "button" and "accordion-button" in cls:
            self.in_accordion_button = True
            self.text_buffer = ""

        if tag == "table":
            self.in_table = True
            self.table_count += 1

        if tag == "tr" and self.in_table:
            self.in_row = True
            self.cell_index = 0
            self.current_row = {}

        if tag == "td" and self.in_row:
            self.in_cell = True
            self.text_buffer = ""

    def handle_endtag(self, tag):
        if tag == "button" and self.in_accordion_button:
            self.in_accordion_button = False
            text = self.text_buffer.strip()
            if re.match(r"\d{4}-\d{2}-\d{2}", text):
                self.dates.append(text)
                self.current_date_idx = len(self.dates) - 1

        if tag == "td" and self.in_cell:
            self.in_cell = False
            value = self.text_buffer.strip()
            if self.cell_index == 0:
                self.current_row["name"] = value
            elif self.cell_index == 1:
                self.current_row["status"] = value
            self.cell_index += 1

        if tag == "tr" and self.in_row:
            self.in_row = False
            if self.current_row.get("name") and self.current_row.get("status"):
                date_idx = self.table_count - 1
                date = self.dates[date_idx] if date_idx < len(self.dates) else "unknown"
                self.records.append({
                    "date": date,
                    "name": self.current_row["name"],
                    "status": self.current_row["status"]
                })

        if tag == "table":
            self.in_table = False

    def handle_data(self, data):
        if self.in_accordion_button or self.in_cell:
            self.text_buffer += data


class MemberAttendanceParser(HTMLParser):
    """Parses individual MP attendance page."""

    def __init__(self):
        super().__init__()
        self.records = []  # [{date, status}]
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.cell_index = 0
        self.current_row = {}
        self.text_buffer = ""
        self.page_count = 1

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get("class", "")

        if tag == "table":
            self.in_table = True
        if tag == "tr" and self.in_table:
            self.in_row = True
            self.cell_index = 0
            self.current_row = {}
        if tag == "td" and self.in_row:
            self.in_cell = True
            self.text_buffer = ""

        # Check pagination for total pages
        if tag == "a" and "page-link" in cls:
            pass

    def handle_endtag(self, tag):
        if tag == "td" and self.in_cell:
            self.in_cell = False
            value = self.text_buffer.strip()
            if self.cell_index == 0:
                self.current_row["date"] = value
            elif self.cell_index == 1:
                self.current_row["status"] = value
            self.cell_index += 1

        if tag == "tr" and self.in_row:
            self.in_row = False
            if self.current_row.get("date") and self.current_row.get("status"):
                self.records.append(self.current_row.copy())

        if tag == "table":
            self.in_table = False

    def handle_data(self, data):
        if self.in_cell:
            self.text_buffer += data


# ── HTTP Helpers ────────────────────────────────────────────────────────────

def fetch_page(url, retries=3):
    """Fetch a URL with retries and polite delays."""
    for attempt in range(retries):
        try:
            req = Request(url, headers=HEADERS)
            with urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except (URLError, HTTPError) as e:
            print(f"  ⚠ Attempt {attempt+1} failed for {url}: {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise
    return ""


# ── Scraper Functions ───────────────────────────────────────────────────────

def scrape_mp_directory():
    """Scrape all MPs from the directory (paginated, 32 per page)."""
    print("\n📋 Scraping MP directory...")
    all_mps = []
    seen_ids = set()

    for page in range(1, 10):  # Max 10 pages
        url = f"{DIRECTORY_URL}?itemCount=32&page={page}"
        print(f"  Page {page}...", end=" ")

        html = fetch_page(url)
        parser = MPDirectoryParser()
        parser.feed(html)

        new_count = 0
        for mp in parser.mps:
            if mp["id"] not in seen_ids:
                seen_ids.add(mp["id"])
                all_mps.append(mp)
                new_count += 1

        print(f"{new_count} new MPs")

        if new_count == 0:
            break

        time.sleep(REQUEST_DELAY)

    print(f"  ✅ Total: {len(all_mps)} MPs")
    return all_mps


def scrape_attendance_for_mp(mp_id, mp_name, legislature=LEGISLATURE_ID):
    """Scrape all attendance records for a single MP."""
    all_records = []

    for page in range(1, 20):  # Max 20 pages per MP
        url = f"{BASE_URL}/en/members-of-parliament/house-attendance/{mp_id}?legislature={legislature}&page={page}"

        try:
            html = fetch_page(url)
        except Exception:
            break

        parser = MemberAttendanceParser()
        parser.feed(html)

        if not parser.records:
            break

        all_records.extend(parser.records)
        time.sleep(REQUEST_DELAY * 0.5)

    return all_records


def scrape_all_attendance(mps):
    """Scrape attendance for all MPs — the main heavy-lifting function."""
    print(f"\n📊 Scraping attendance for {len(mps)} MPs...")
    print("   (This may take 15-20 minutes. Be patient.)\n")

    results = {}
    total = len(mps)

    for i, mp in enumerate(mps):
        mp_id = mp["id"]
        mp_name = mp["name"]
        progress = f"[{i+1}/{total}]"
        print(f"  {progress} {mp_name}...", end=" ", flush=True)

        records = scrape_attendance_for_mp(mp_id, mp_name)

        present = sum(1 for r in records if r["status"] == "Present")
        absent = sum(1 for r in records if r["status"] == "Absent")
        total_sittings = present + absent
        absentee_rate = round((absent / total_sittings * 100), 1) if total_sittings > 0 else 0

        results[mp_id] = {
            "total_sittings": total_sittings,
            "present": present,
            "absent": absent,
            "absentee_rate": absentee_rate,
            "records": records  # Full day-by-day breakdown
        }

        print(f"✓ {present}/{total_sittings} present ({absentee_rate}% absent)")
        time.sleep(REQUEST_DELAY)

    return results


def compute_statistics(mps, attendance):
    """Compute aggregate stats for the dashboard."""
    stats = {
        "by_party": {},
        "by_district": {},
        "worst_absentees": [],
        "best_attendees": [],
        "overall": {}
    }

    mp_stats = []
    for mp in mps:
        mp_id = mp["id"]
        att = attendance.get(mp_id, {})
        mp_stats.append({
            **mp,
            "total_sittings": att.get("total_sittings", 0),
            "present": att.get("present", 0),
            "absent": att.get("absent", 0),
            "absentee_rate": att.get("absentee_rate", 0),
            "attendance_rate": round(100 - att.get("absentee_rate", 0), 1),
            "photo_url": f"https://www.parliament.lk/uploads/images/members/profile_images/thumbs/{mp_id}.jpg",
            "profile_url": f"https://www.parliament.lk/en/members-of-parliament/mp-profile/{mp_id}",
            "attendance_url": f"https://www.parliament.lk/en/members-of-parliament/house-attendance/{mp_id}?legislature={LEGISLATURE_ID}",
            "daily_records": att.get("records", [])
        })

    # Sort for worst/best
    ranked = sorted(mp_stats, key=lambda x: x["absentee_rate"], reverse=True)
    stats["worst_absentees"] = [m["id"] for m in ranked[:20]]
    stats["best_attendees"] = [m["id"] for m in ranked[-20:]]

    # By party
    party_map = {}
    for mp in mp_stats:
        party = mp["party"] or "Unknown"
        if party not in party_map:
            party_map[party] = {"present": 0, "absent": 0, "members": 0}
        party_map[party]["present"] += mp["present"]
        party_map[party]["absent"] += mp["absent"]
        party_map[party]["members"] += 1

    for party, data in party_map.items():
        total = data["present"] + data["absent"]
        data["absentee_rate"] = round(data["absent"] / total * 100, 1) if total > 0 else 0
    stats["by_party"] = party_map

    # By district
    district_map = {}
    for mp in mp_stats:
        district = mp["district"] or "Unknown"
        if district not in district_map:
            district_map[district] = {"present": 0, "absent": 0, "members": 0}
        district_map[district]["present"] += mp["present"]
        district_map[district]["absent"] += mp["absent"]
        district_map[district]["members"] += 1

    for district, data in district_map.items():
        total = data["present"] + data["absent"]
        data["absentee_rate"] = round(data["absent"] / total * 100, 1) if total > 0 else 0
    stats["by_district"] = district_map

    # Overall
    total_present = sum(m["present"] for m in mp_stats)
    total_absent = sum(m["absent"] for m in mp_stats)
    total_all = total_present + total_absent

    # Determine total sitting days
    all_dates = set()
    for mp in mp_stats:
        for r in mp.get("daily_records", []):
            all_dates.add(r["date"])

    stats["overall"] = {
        "total_mps": len(mps),
        "total_sitting_days": len(all_dates),
        "avg_absentee_rate": round(total_absent / total_all * 100, 1) if total_all > 0 else 0,
        "avg_attendance_rate": round(total_present / total_all * 100, 1) if total_all > 0 else 0,
    }

    return mp_stats, stats


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Sri Lanka Parliament — MP Attendance Scraper")
    print("  10th Parliament of the D.S.R. of Sri Lanka")
    print("=" * 60)

    start_time = time.time()

    # Step 1: Get all MPs
    mps = scrape_mp_directory()

    if not mps:
        print("❌ Failed to scrape MP directory. Exiting.")
        sys.exit(1)

    # Step 2: Get attendance for each MP
    attendance = scrape_all_attendance(mps)

    # Step 3: Compute statistics
    mp_stats, aggregate_stats = compute_statistics(mps, attendance)

    # Step 4: Build output JSON
    output = {
        "metadata": {
            "scraped_at": datetime.now().isoformat(),
            "legislature": "10th Parliament of the D.S.R. of Sri Lanka (2024-present)",
            "legislature_id": LEGISLATURE_ID,
            "total_mps": len(mps),
            "source": "https://www.parliament.lk",
            "scraper_version": "1.0"
        },
        "statistics": aggregate_stats,
        "members": mp_stats
    }

    # Remove daily_records from the main output to keep size manageable
    # (keep only summary stats per MP)
    for member in output["members"]:
        del member["daily_records"]

    # Step 5: Save
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    elapsed = time.time() - start_time
    file_size = os.path.getsize(OUTPUT_FILE) / 1024

    print(f"\n{'=' * 60}")
    print(f"  ✅ Done! Scraped {len(mps)} MPs in {elapsed:.0f}s")
    print(f"  📁 Output: {OUTPUT_FILE} ({file_size:.0f} KB)")
    print(f"  📊 Total sitting days: {aggregate_stats['overall']['total_sitting_days']}")
    print(f"  📉 Avg absentee rate: {aggregate_stats['overall']['avg_absentee_rate']}%")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
