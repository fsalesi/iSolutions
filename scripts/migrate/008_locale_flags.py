#!/usr/bin/env python3
"""Migration 008: Add flag_svg column to locales and backfill flag data."""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

# Add column
cur.execute("ALTER TABLE locales ADD COLUMN IF NOT EXISTS flag_svg text")
print("✓ Added flag_svg column to locales")

# Flag SVGs — compact inline SVGs for each locale
flags = {
    "en-us": '<svg viewBox="0 0 21 15"><rect width="21" height="15" fill="#B22234"/><rect y="1.15" width="21" height="1.15" fill="#fff"/><rect y="3.46" width="21" height="1.15" fill="#fff"/><rect y="5.77" width="21" height="1.15" fill="#fff"/><rect y="8.08" width="21" height="1.15" fill="#fff"/><rect y="10.38" width="21" height="1.15" fill="#fff"/><rect y="12.69" width="21" height="1.15" fill="#fff"/><rect width="8.4" height="8.08" fill="#3C3B6E"/></svg>',
    "en-uk": '<svg viewBox="0 0 60 30"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="2"/><path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/></svg>',
    "es": '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#AA151B"/><rect y="0.5" width="3" height="1" fill="#F1BF00"/></svg>',
    "fr": '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#002395"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ED2939"/></svg>',
    "de": '<svg viewBox="0 0 5 3"><rect width="5" height="1" fill="#000"/><rect y="1" width="5" height="1" fill="#D00"/><rect y="2" width="5" height="1" fill="#FFCE00"/></svg>',
    "it-it": '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#CE2B37"/></svg>',
    "pt": '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#FF0000"/><rect width="1.2" height="2" fill="#006600"/></svg>',
    "nl": '<svg viewBox="0 0 9 6"><rect width="9" height="2" fill="#AE1C28"/><rect y="2" width="9" height="2" fill="#fff"/><rect y="4" width="9" height="2" fill="#21468B"/></svg>',
    "pl": '<svg viewBox="0 0 8 5"><rect width="8" height="2.5" fill="#fff"/><rect y="2.5" width="8" height="2.5" fill="#DC143C"/></svg>',
    "ru": '<svg viewBox="0 0 9 6"><rect width="9" height="2" fill="#fff"/><rect y="2" width="9" height="2" fill="#0039A6"/><rect y="4" width="9" height="2" fill="#D52B1E"/></svg>',
    "cs": '<svg viewBox="0 0 6 4"><rect width="6" height="2" fill="#fff"/><rect y="2" width="6" height="2" fill="#D7141A"/><polygon points="0,0 3,2 0,4" fill="#11457E"/></svg>',
    "ja": '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><circle cx="1.5" cy="1" r="0.6" fill="#BC002D"/></svg>',
    "ko": '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><circle cx="1.5" cy="1" r="0.6" fill="#CD2E3A"/><path d="M1.5 0.4 A0.6 0.6 0 0 1 1.5 1 A0.3 0.3 0 0 0 1.5 0.4" fill="#0047A0"/></svg>',
    "zh-cn": '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#DE2910"/><polygon points="0.45,0.3 0.5,0.15 0.55,0.3 0.4,0.2 0.6,0.2" fill="#FFDE00"/></svg>',
    "zh-tw": '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#FE0000"/><rect width="1.2" height="0.8" fill="#000095"/><circle cx="0.6" cy="0.4" r="0.2" fill="#fff"/></svg>',
    "he": '<svg viewBox="0 0 11 8"><rect width="11" height="8" fill="#fff"/><rect y="0.7" width="11" height="1.2" fill="#0038B8"/><rect y="6.1" width="11" height="1.2" fill="#0038B8"/><polygon points="5.5,2 7,5.5 4,5.5" fill="none" stroke="#0038B8" stroke-width="0.35"/><polygon points="5.5,5.5 7,2 4,2" fill="none" stroke="#0038B8" stroke-width="0.35"/></svg>',
}

for code, svg in flags.items():
    cur.execute("UPDATE locales SET flag_svg = %s WHERE code = %s", (svg, code))

print(f"✓ Backfilled {len(flags)} flag SVGs")

cur.close()
conn.close()
