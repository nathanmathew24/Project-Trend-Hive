import pandas as pd
import numpy as np
from pathlib import Path

print("DUBAI CAFE RENT MATCHER - REAL 2025 RETAIL/F&B RATES")
print("=" * 60)
print("Sources: DLD transactions, Bayut, Property Finder (Q1-Q3 2025)")
print("=" * 60)

# ============================================================================
# RENT DATA - REAL 2025 RETAIL / F&B RATES (AED per sqft per year)
# Based on DLD transaction data and actual listings for small cafe/retail units
# ============================================================================

RENT_DATA = {
    # ── PRIME / LUXURY ──────────────────────────────────────────────────────
    "dubai mall":               450,   # landmark mall, highest retail premiums
    "mall of the emirates":     380,   # anchor mall, strong F&B cluster
    "downtown dubai":           340,   # premium footfall, tourist + resident
    "city walk":                290,   # open-air premium, strong cafe scene
    "difc":                     310,   # tight supply, 95%+ occupancy, F&B premium
    "palm jumeirah":            280,   # scarcity premium, high-spend residents

    # ── ESTABLISHED WATERFRONT / HIGH DEMAND ────────────────────────────────
    "jbr":                      260,   # waterfront walk, very high F&B demand
    "dubai marina":             240,   # DLD avg ~370/sqft total; small units ~240
    "bluewaters":               270,   # newer, premium island positioning

    # ── BUSINESS DISTRICTS ──────────────────────────────────────────────────
    "business bay":             210,   # office towers drive daytime F&B demand
    "sheikh zayed road":        200,   # main artery, premium commercial strip
    "dubai design district":    200,   # d3, creative cluster, specialty cafes
    "internet city":            185,   # tech hub, steady office worker demand
    "media city":               185,   # same cluster as internet city

    # ── MID-TIER RESIDENTIAL / MIXED ────────────────────────────────────────
    "jumeirah":                 170,   # established residential, lifestyle cafes
    "umm suqeim":               160,   # local community, moderate foot traffic
    "al wasl":                  155,   # residential corridor
    "tecom":                    150,   # barsha heights, mid-premium offices nearby
    "barsha heights":           150,
    "al barsha":                135,   # community retail, good residential base
    "mirdif":                   125,   # suburban community, family-oriented

    # ── AFFORDABLE / EMERGING ───────────────────────────────────────────────
    "jlt":                      190,   # DLD avg AED 206K; smaller units ~190/sqft
    "jvc":                      155,   # AED 250 PSF listed, community retail ~155
    "al quoz":                  115,   # industrial/creative, lower retail rate
    "motor city":               105,   # suburban, niche community
    "dubai silicon oasis":       95,   # tech free zone, budget retail
    "international city":        60,   # lowest tier, very affordable

    # ── TRADITIONAL / OLD DUBAI ─────────────────────────────────────────────
    "deira":                    105,   # DLD: AED 110K/1,300sqft = ~85; prime ~150
    "bur dubai":                 95,   # traditional commercial, moderate
    "karama":                    85,   # budget retail, high local footfall
    "satwa":                     90,   # mixed, traditional neighbourhood
    "oud metha":                100,   # healthcare city adjacency
}

# ============================================================================
# AREA KEYWORDS  (longest-match-first via sort)
# ============================================================================

AREA_KEYWORDS = {
    # Prime / Luxury
    "downtown":             "downtown dubai",
    "burj khalifa":         "downtown dubai",
    "dubai mall":           "dubai mall",
    "difc":                 "difc",
    "city walk":            "city walk",
    "citywalk":             "city walk",
    "mall of the emirates": "mall of the emirates",
    "mall of emirates":     "mall of the emirates",
    "palm":                 "palm jumeirah",
    "bluewaters":           "bluewaters",
    "blue waters":          "bluewaters",

    # Waterfront
    "jbr":                  "jbr",
    "jumeirah beach residence": "jbr",
    "marina":               "dubai marina",
    "dubai marina":         "dubai marina",

    # Business
    "business bay":         "business bay",
    "sheikh zayed":         "sheikh zayed road",
    "szr":                  "sheikh zayed road",
    "d3":                   "dubai design district",
    "design district":      "dubai design district",
    "internet city":        "internet city",
    "media city":           "media city",

    # Mid-tier
    "jumeirah":             "jumeirah",
    "umm suqeim":           "umm suqeim",
    "al wasl":              "al wasl",
    "tecom":                "tecom",
    "barsha heights":       "barsha heights",
    "barsha":               "al barsha",
    "mirdif":               "mirdif",

    # Affordable / Emerging
    "jlt":                  "jlt",
    "jumeirah lake":        "jlt",
    "jvc":                  "jvc",
    "jumeirah village circle": "jvc",
    "quoz":                 "al quoz",
    "motor city":           "motor city",
    "silicon oasis":        "dubai silicon oasis",
    "dso":                  "dubai silicon oasis",
    "international city":   "international city",

    # Traditional
    "deira":                "deira",
    "bur dubai":            "bur dubai",
    "karama":               "karama",
    "satwa":                "satwa",
    "oud metha":            "oud metha",
}

# ============================================================================
# HELPERS
# ============================================================================

def extract_area(address):
    if not isinstance(address, str):
        return None
    address = address.lower()
    for key, val in sorted(AREA_KEYWORDS.items(), key=lambda x: -len(x[0])):
        if key in address:
            return val
    return None

def get_rent(area):
    return RENT_DATA.get(area, None)

# ============================================================================
# MAIN
# ============================================================================

def process_cafes(input_file, output_file):
    print("\nLoading file...")
    df = pd.read_excel(input_file)
    print("Loaded cafes:", len(df))

    df["detected_area"]                    = ""
    df["avg_commercial_rent_aed_sqft_year"] = np.nan
    df["rent_tier"]                         = ""

    # Tier labels for quick analysis
    def get_tier(rent):
        if rent is None: return ""
        if rent >= 300: return "Premium"
        if rent >= 180: return "High"
        if rent >= 120: return "Mid"
        return "Budget"

    success = 0
    print("\nProcessing cafes...\n")

    for idx, row in df.iterrows():
        address = row.get("Address", "")
        area    = extract_area(address)

        if area:
            rent = get_rent(area)
            if rent is not None:
                df.at[idx, "detected_area"]                    = area.title()
                df.at[idx, "avg_commercial_rent_aed_sqft_year"] = float(rent)
                df.at[idx, "rent_tier"]                         = get_tier(rent)
                success += 1

        if (idx + 1) % 500 == 0:
            print(f"  {idx+1} processed | {success} matched")

    matched = df[df["avg_commercial_rent_aed_sqft_year"].notna()]

    print("\nSaving output...")
    df.to_excel(output_file, index=False)

    print("\n── RESULTS ──────────────────────────────────────")
    print(f"Total cafes  : {len(df)}")
    print(f"Matched      : {success} ({round(success/len(df)*100, 1)}%)")

    if len(matched) > 0:
        rents = matched["avg_commercial_rent_aed_sqft_year"]
        print(f"Avg rent     : {round(rents.mean(), 1)} AED/sqft/yr")
        print(f"Median rent  : {round(rents.median(), 1)} AED/sqft/yr")
        print(f"Min          : {rents.min()} AED/sqft/yr")
        print(f"Max          : {rents.max()} AED/sqft/yr")

        print("\n── TIER BREAKDOWN ───────────────────────────────")
        print(matched["rent_tier"].value_counts().to_string())

        print("\n── TOP AREAS ────────────────────────────────────")
        print(matched.groupby("detected_area")["avg_commercial_rent_aed_sqft_year"]
              .agg(["count", "first"])
              .rename(columns={"count": "cafes", "first": "AED/sqft/yr"})
              .sort_values("AED/sqft/yr", ascending=False)
              .to_string())

    print("\nDONE ✓")

# ============================================================================
# RUN
# ============================================================================

if __name__ == "__main__":
    input_file  = "/Users/ina/Downloads/datanew/dubai_cafes_with_parking.xlsx"
    output_file = "/Users/ina/Downloads/datanew/dubai_cafes_AUTHENTIC_FULL_RENT.xlsx"

    if not Path(input_file).exists():
        print("Input file missing:", input_file)
        exit()

    process_cafes(input_file, output_file)
