import pandas as pd
import numpy as np
from math import radians
from sklearn.neighbors import BallTree

print("==============================================")
print(" COMPETITORS WITHIN RADIUS CALCULATOR")
print("==============================================")

# ============================================================================
# SETTINGS
# ============================================================================

INPUT_FILE  = "/Users/ina/Downloads/datanew/dubai_cafes_WITH_UTILITY_ESTIMATE.xlsx"
OUTPUT_FILE = "/Users/ina/Downloads/datanew/dubai_cafes_WITH_COMPETITORS.xlsx"

RADII_METERS = [300, 500, 1000]   # generates a column for each radius

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("Loading data...")
    df = pd.read_excel(INPUT_FILE)
    print(f"Loaded : {len(df)} cafes")

    for col in ["Latitude", "Longitude"]:
        if col not in df.columns:
            raise ValueError(f"Missing column: {col}")

    # Drop rows with missing coords
    original_len = len(df)
    df = df.dropna(subset=["Latitude", "Longitude"]).reset_index(drop=True)
    if len(df) < original_len:
        print(f"⚠️  Dropped {original_len - len(df)} rows with missing coordinates")

    # Convert lat/lon to radians for BallTree (uses haversine metric)
    coords_rad = np.radians(df[["Latitude", "Longitude"]].values)

    # Build BallTree — much faster than O(n²) loops for 4000+ points
    print("Building spatial index...")
    tree = BallTree(coords_rad, metric="haversine")

    EARTH_RADIUS_M = 6_371_000

    for radius_m in RADII_METERS:
        radius_rad = radius_m / EARTH_RADIUS_M
        col_name   = f"competitors_within_{radius_m}m"

        print(f"Calculating {col_name}...")

        # query_radius returns indices of all points within radius (including self)
        counts = tree.query_radius(coords_rad, r=radius_rad, count_only=True)

        # Subtract 1 to exclude the cafe itself
        df[col_name] = counts - 1

        print(f"  Min: {df[col_name].min()}  |  Max: {df[col_name].max()}  |  Mean: {df[col_name].mean():.1f}")

    # Add competition level label based on 500m radius
    if "competitors_within_500m" in df.columns:
        df["competition_level"] = pd.cut(
            df["competitors_within_500m"],
            bins=[-1, 2, 7, 15, 9999],
            labels=["Low", "Medium", "High", "Very High"]
        )

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n── COMPETITION LEVEL BREAKDOWN (500m) ──────────────")
    if "competition_level" in df.columns:
        print(df["competition_level"].value_counts().sort_index().to_string())

    print(f"\n── TOP 10 MOST COMPETITIVE LOCATIONS ───────────────")
    top_cols = ["Name", "Address", "competitors_within_500m", "competition_level"]
    available = [c for c in top_cols if c in df.columns]
    print(df.nlargest(10, "competitors_within_500m")[available].to_string(index=False))

    # ── Save ──────────────────────────────────────────────────────────────────
    df.to_excel(OUTPUT_FILE, index=False)
    print(f"\n✅ Saved: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
