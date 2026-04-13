import pandas as pd
import numpy as np
import os

# ============================================================================
# SETTINGS
# ============================================================================

INPUT_FILE  = "/Users/ina/Downloads/datanew/dubai_cafes_with_tourist_proxy.xlsx"
OUTPUT_FILE = "/Users/ina/Downloads/datanew/dubai_cafes_WITH_UTILITY_ESTIMATE.xlsx"

FOOTFALL_COL = "tourist_score"
TOURIST_COL  = "tourist_score"

# ============================================================================
# 2025 DEWA COMMERCIAL SLAB RATES
# Source: DEWA official tariff + utilitybilluae.com (verified Sept 2025)
# ============================================================================

# Electricity slabs (AED per kWh)
ELEC_SLABS = [
    (2000, 0.23),
    (2000, 0.28),
    (2000, 0.32),
    (float("inf"), 0.38),
]
ELEC_FUEL_SURCHARGE = 0.060   # AED/kWh (Sept 2025)
ELEC_METER_CHARGE   = 23.0    # AED/month fixed

# Water slabs (AED per m³) — DEWA switched to m³ in March 2025
WATER_SLABS = [
    (27,  7.70),
    (27,  8.80),
    (float("inf"), 10.12),
]
WATER_FUEL_SURCHARGE = 1.10   # AED/m³
WATER_SEWERAGE       = 0.33   # AED/m³ (Dubai Municipality 2025)
WATER_METER_CHARGE   = 11.0   # AED/month fixed

VAT = 0.05  # 5% on all charges

# Base monthly usage — mid-size Dubai cafe (~800–1200 sqft)
BASE_ELEC_KWH = 5000   # kWh/month
BASE_WATER_M3 = 65     # m³/month

# ============================================================================
# SLAB CALCULATORS
# ============================================================================

def calc_elec_cost(kwh):
    cost = 0.0
    remaining = kwh
    for band, rate in ELEC_SLABS:
        used = min(remaining, band)
        cost += used * rate
        remaining -= used
        if remaining <= 0:
            break
    cost += kwh * ELEC_FUEL_SURCHARGE
    cost += ELEC_METER_CHARGE
    return cost * (1 + VAT)

def calc_water_cost(m3):
    cost = 0.0
    remaining = m3
    for band, rate in WATER_SLABS:
        used = min(remaining, band)
        cost += used * rate
        remaining -= used
        if remaining <= 0:
            break
    cost += m3 * WATER_FUEL_SURCHARGE
    cost += m3 * WATER_SEWERAGE
    cost += WATER_METER_CHARGE
    return cost * (1 + VAT)

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 55)
    print("  DUBAI CAFE UTILITY ESTIMATOR — 2025 DEWA RATES")
    print("=" * 55)
    print("Electricity : 0.23/0.28/0.32/0.38 AED/kWh + 0.06 surcharge")
    print("Water       : 7.70/8.80/10.12 AED/m³ + 1.10 surcharge")
    print("Sewerage    : 0.33 AED/m³  |  VAT: 5%")
    print("=" * 55)

    # ── Load (auto-finds file if exact name differs) ─────────────────────────
    if not os.path.exists(INPUT_FILE):
        folder = os.path.dirname(INPUT_FILE)
        candidates = [f for f in os.listdir(folder) if "tourist" in f.lower() and f.endswith(".xlsx")]
        if candidates:
            found = os.path.join(folder, candidates[0])
            print(f"⚠️  Using: {found}")
            df = pd.read_excel(found)
        else:
            raise FileNotFoundError(f"No tourist file found in {folder}")
    else:
        df = pd.read_excel(INPUT_FILE)

    print(f"Loaded : {len(df)} cafes")
    print(f"Columns: {list(df.columns)}\n")

    # ── Validate columns ─────────────────────────────────────────────────────
    missing = [c for c in [FOOTFALL_COL, TOURIST_COL] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}\nAvailable: {list(df.columns)}")

    # ── Normalize 0–1 ────────────────────────────────────────────────────────
    df["footfall_norm"] = df[FOOTFALL_COL] / df[FOOTFALL_COL].max()
    df["tourist_norm"]  = df[TOURIST_COL]  / df[TOURIST_COL].max()

    # ── Usage factor per cafe ────────────────────────────────────────────────
    df["utility_usage_factor"] = (
        (0.6 * df["footfall_norm"]) + (0.4 * df["tourist_norm"])
    ).clip(0.2, 1.0)

    # ── Estimated consumption ────────────────────────────────────────────────
    df["est_elec_kwh_month"] = (BASE_ELEC_KWH * df["utility_usage_factor"]).round(0)
    df["est_water_m3_month"] = (BASE_WATER_M3  * df["utility_usage_factor"]).round(1)

    # ── Apply DEWA slabs ──────────────────────────────────────────────────────
    df["utility_elec_aed_month"]  = df["est_elec_kwh_month"].apply(calc_elec_cost).round(2)
    df["utility_water_aed_month"] = df["est_water_m3_month"].apply(calc_water_cost).round(2)
    df["utility_cost_aed_month"]  = (df["utility_elec_aed_month"] + df["utility_water_aed_month"]).round(2)

    # ── Tier labels ───────────────────────────────────────────────────────────
    df["utility_level"] = pd.cut(
        df["utility_cost_aed_month"],
        bins=[0, 1000, 2000, 3500, 99999],
        labels=["Low", "Medium", "High", "Very High"]
    )

    df["utility_estimation_method"] = (
        "2025 DEWA slab tariffs + fuel surcharge + sewerage + 5% VAT "
        "scaled by Footfall_Score & tourist_index"
    )

    # ── Print summary ─────────────────────────────────────────────────────────
    print("SAMPLE (first 5 rows):")
    print(df[[FOOTFALL_COL, TOURIST_COL, "utility_usage_factor",
              "est_elec_kwh_month", "utility_cost_aed_month"]].head().to_string())

    print(f"\nMin  : AED {df['utility_cost_aed_month'].min():,.2f}/month")
    print(f"Max  : AED {df['utility_cost_aed_month'].max():,.2f}/month")
    print(f"Mean : AED {df['utility_cost_aed_month'].mean():,.2f}/month")
    print(f"\nTIER BREAKDOWN:\n{df['utility_level'].value_counts().sort_index().to_string()}")

    # ── Save ──────────────────────────────────────────────────────────────────
    df.to_excel(OUTPUT_FILE, index=False)
    print(f"\n✅ Saved: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()