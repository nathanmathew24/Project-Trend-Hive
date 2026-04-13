"""
TrendHive — Train Popularity Tier Random Forest Model
======================================================

Converts the Colab notebook (TrendHive_Cafes_ML_Analytics_Map.ipynb) into a
runnable local script.

Reads:
  ../datasets/dubai_cafes_last4combined.xlsx
  ../datasets/dubai_cafes_50plus_reviews_ALL_REVIEWS.xlsx

Produces:
  ../backend/models/popularity_rf.joblib          — Trained sklearn Pipeline
  ../backend/models/popularity_rf_features.json   — Feature column list
  ../backend/models/popularity_rf_classes.json    — Class labels list
  ../backend/data/outputs/cafes_with_predictions.csv
  ../backend/data/outputs/area_summary.csv
  ../backend/data/outputs/opportunity_ranking.csv
  ../backend/data/outputs/grid_cells.csv

Usage:
  cd TrendHive-Complete/ml
  pip install openpyxl textblob scikit-learn joblib tqdm pandas numpy
  python train_popularity_model.py
"""

import numpy as np
import pandas as pd
from pathlib import Path
from textblob import TextBlob
from tqdm import tqdm
import joblib
import json

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score

# ── Paths ────────────────────────────────────────────────────────────────────
BASE = Path(__file__).resolve().parent.parent
DATASETS     = BASE / "datasets"
MODELS_DIR   = BASE / "backend" / "models"
OUTPUTS_DIR  = BASE / "backend" / "data" / "outputs"

CAFES_XLSX   = DATASETS / "dubai_cafes_last4combined.xlsx"
REVIEWS_XLSX = DATASETS / "dubai_cafes_50plus_reviews_ALL_REVIEWS.xlsx"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 1) LOAD DATA
# ═══════════════════════════════════════════════════════════════════════════════

COLMAP_CAFES = {
    "Place_ID": "Place_ID", "Name": "Name", "Rating": "Rating",
    "Reviews": "Reviews", "Latitude": "Latitude", "Longitude": "Longitude",
    "detected_area": "detected_area", "rent_tier": "rent_tier",
    "competition_level": "competition_level", "utility_level": "utility_level",
    "utility_cost_aed_month": "utility_cost_aed_month",
    "avg_commercial_rent_aed_sqft_year": "avg_commercial_rent_aed_sqft_year",
    "competitors_within_300m": "competitors_within_300m",
    "competitors_within_500m": "competitors_within_500m",
    "competitors_within_1000m": "competitors_within_1000m",
    "free_parking_lot": "free_parking_lot", "paid_parking_lot": "paid_parking_lot",
    "free_street_parking": "free_street_parking",
    "paid_street_parking": "paid_street_parking", "valet_parking": "valet_parking",
}

COLMAP_REVIEWS = {
    "Place_ID": "Place_ID", "Review_Text": "Review_Text",
    "Review_Rating": "Review_Rating",
}


def load_cafes(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    rename = {v: k for k, v in COLMAP_CAFES.items() if v in df.columns}
    return df.rename(columns=rename)


def load_reviews(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    rename = {v: k for k, v in COLMAP_REVIEWS.items() if v in df.columns}
    return df.rename(columns=rename)


print("Loading data...")
assert CAFES_XLSX.exists(), f"Missing: {CAFES_XLSX}"
assert REVIEWS_XLSX.exists(), f"Missing: {REVIEWS_XLSX}"

cafes = load_cafes(CAFES_XLSX)
reviews = load_reviews(REVIEWS_XLSX)
print(f"  Cafes: {cafes.shape},  Reviews: {reviews.shape}")


# ═══════════════════════════════════════════════════════════════════════════════
# 2) SENTIMENT AGGREGATION
# ═══════════════════════════════════════════════════════════════════════════════

def polarity(txt: str) -> float:
    try:
        return TextBlob(str(txt)).sentiment.polarity
    except Exception:
        return np.nan


CACHE_AGG = BASE / "ml" / "review_agg_by_place.csv"

if CACHE_AGG.exists():
    agg = pd.read_csv(CACHE_AGG)
    print(f"Loaded cached review aggregates ({agg.shape[0]} cafes)")
else:
    print("Computing sentiment aggregates (this may take a few minutes)...")
    r = reviews.dropna(subset=["Review_Text"]).copy()
    tqdm.pandas()
    r["polarity"] = r["Review_Text"].astype(str).progress_map(polarity)
    r["is_neg"] = (r["polarity"] < -0.10).astype(int)
    r["is_pos"] = (r["polarity"] > 0.10).astype(int)

    agg = r.groupby("Place_ID").agg(
        avg_review_rating=("Review_Rating", "mean"),
        avg_polarity=("polarity", "mean"),
        neg_share=("is_neg", "mean"),
        pos_share=("is_pos", "mean"),
        reviews_used=("Review_Text", "count"),
    ).reset_index()

    agg.to_csv(CACHE_AGG, index=False)
    print(f"Computed + cached review aggregates ({agg.shape[0]} cafes)")


# ═══════════════════════════════════════════════════════════════════════════════
# 3) BUILD TRAINING TABLE + POPULARITY TARGET
# ═══════════════════════════════════════════════════════════════════════════════

df = cafes.merge(agg, on="Place_ID", how="left")
df["Rating"] = pd.to_numeric(df.get("Rating"), errors="coerce")
df["Reviews"] = pd.to_numeric(df.get("Reviews"), errors="coerce")

df["popularity_score"] = np.log1p(df["Reviews"].fillna(0)) * df["Rating"].fillna(0)

q = df["popularity_score"].quantile([0.2, 0.4, 0.6, 0.8]).to_dict()
bins = [-np.inf, q[0.2], q[0.4], q[0.6], q[0.8], np.inf]
labels = ["Very Low", "Low", "Medium", "High", "Very High"]
df["popularity_tier"] = pd.cut(df["popularity_score"], bins=bins, labels=labels)

print("\nPopularity tier distribution:")
print(df["popularity_tier"].value_counts(dropna=False))


# ═══════════════════════════════════════════════════════════════════════════════
# 4) TRAIN RANDOM FOREST
# ═══════════════════════════════════════════════════════════════════════════════

FEATURE_COLS = [
    "Rating", "Reviews",
    "free_parking_lot", "paid_parking_lot", "free_street_parking",
    "paid_street_parking", "valet_parking",
    "utility_cost_aed_month", "avg_commercial_rent_aed_sqft_year",
    "competitors_within_300m", "competitors_within_500m", "competitors_within_1000m",
    "avg_review_rating", "avg_polarity", "neg_share", "pos_share",
    "utility_level", "rent_tier", "competition_level", "detected_area",
]

# Explicitly define categorical columns (they may contain strings like 'High', 'Low')
CATEGORICAL_COLS = {"utility_level", "rent_tier", "competition_level", "detected_area"}

for c in FEATURE_COLS:
    if c not in df.columns:
        df[c] = np.nan

X = df[FEATURE_COLS].copy()
y = df["popularity_tier"].astype(str)

# Force numeric columns to numeric, coercing any stray strings to NaN
for c in FEATURE_COLS:
    if c not in CATEGORICAL_COLS:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    else:
        X[c] = X[c].astype(str)

num_cols = [c for c in FEATURE_COLS if c not in CATEGORICAL_COLS]
cat_cols = [c for c in FEATURE_COLS if c in CATEGORICAL_COLS]

print(f"\nNumeric features ({len(num_cols)}): {num_cols}")
print(f"Categorical features ({len(cat_cols)}): {cat_cols}")

pre = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median"))]), num_cols),
    ("cat", Pipeline([
        ("imp", SimpleImputer(strategy="most_frequent")),
        ("oh", OneHotEncoder(handle_unknown="ignore")),
    ]), cat_cols),
])

rf = RandomForestClassifier(
    n_estimators=400,
    random_state=42,
    class_weight="balanced",
    n_jobs=-1,
)

pipe = Pipeline([("pre", pre), ("rf", rf)])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y,
)

print("\nTraining Random Forest (400 trees)...")
pipe.fit(X_train, y_train)
pred = pipe.predict(X_test)

acc = accuracy_score(y_test, pred)
print(f"\nAccuracy: {acc:.4f}")
print(classification_report(y_test, pred))


# ═══════════════════════════════════════════════════════════════════════════════
# 5) SAVE MODEL + METADATA
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_FILE   = MODELS_DIR / "popularity_rf.joblib"
FEATURES_FILE = MODELS_DIR / "popularity_rf_features.json"
CLASSES_FILE  = MODELS_DIR / "popularity_rf_classes.json"

joblib.dump(pipe, MODEL_FILE)
with open(FEATURES_FILE, "w") as f:
    json.dump(FEATURE_COLS, f, indent=2)
with open(CLASSES_FILE, "w") as f:
    json.dump(list(pipe.named_steps["rf"].classes_), f, indent=2)

print(f"\nSaved model     -> {MODEL_FILE}")
print(f"Saved features  -> {FEATURES_FILE}")
print(f"Saved classes   -> {CLASSES_FILE}")


# ═══════════════════════════════════════════════════════════════════════════════
# 6) PREDICT ON ALL CAFES + EXPORT
# ═══════════════════════════════════════════════════════════════════════════════

df["predicted_tier"] = pipe.predict(df[FEATURE_COLS])
proba = pipe.predict_proba(df[FEATURE_COLS])
df["prediction_confidence"] = proba.max(axis=1)

print(f"\nPredicted tiers for {len(df)} cafes")


# ═══════════════════════════════════════════════════════════════════════════════
# 7) AREA ANALYTICS + OPPORTUNITY RANKING
# ═══════════════════════════════════════════════════════════════════════════════

area = df.groupby("detected_area").agg(
    cafes=("Place_ID", "count"),
    avg_rating=("Rating", "mean"),
    avg_reviews=("Reviews", "mean"),
    avg_sentiment=("avg_polarity", "mean"),
    avg_comp_500=("competitors_within_500m", "mean"),
    avg_rent=("avg_commercial_rent_aed_sqft_year", "mean"),
    avg_utility=("utility_cost_aed_month", "mean"),
).reset_index().sort_values("cafes", ascending=False)

# Opportunity ranking
tmp = df.copy()
for col in ["avg_polarity", "Rating", "Reviews", "competitors_within_500m",
            "avg_commercial_rent_aed_sqft_year", "utility_cost_aed_month"]:
    tmp[col] = pd.to_numeric(tmp[col], errors="coerce")

a = tmp.groupby("detected_area").agg(
    cafes=("Place_ID", "count"), rating=("Rating", "mean"),
    sentiment=("avg_polarity", "mean"), reviews=("Reviews", "mean"),
    comp=("competitors_within_500m", "mean"),
    rent=("avg_commercial_rent_aed_sqft_year", "mean"),
    utility=("utility_cost_aed_month", "mean"),
).reset_index()


def z(s):
    s = s.fillna(s.median())
    return (s - s.mean()) / (s.std(ddof=0) + 1e-9)


a["opportunity_score"] = (
    0.35 * z(a["rating"])
    + 0.25 * z(a["sentiment"])
    + 0.15 * z(a["reviews"])
    - 0.15 * z(a["comp"])
    - 0.07 * z(a["rent"])
    - 0.03 * z(a["utility"])
)
opps = a.sort_values("opportunity_score", ascending=False)

# Grid cells
g = df.dropna(subset=["Latitude", "Longitude"]).copy()
g["lat_cell"] = g["Latitude"].round(3)
g["lng_cell"] = g["Longitude"].round(3)
g["cell_id"] = g["lat_cell"].astype(str) + "," + g["lng_cell"].astype(str)

cell = g.groupby(["cell_id", "lat_cell", "lng_cell"]).agg(
    cafes=("Place_ID", "count"),
    avg_rating=("Rating", "mean"),
    share_high=("predicted_tier", lambda s: float(s.isin(["High", "Very High"]).mean())),
    avg_sentiment=("avg_polarity", "mean"),
).reset_index()


# ═══════════════════════════════════════════════════════════════════════════════
# 8) EXPORT CSVS
# ═══════════════════════════════════════════════════════════════════════════════

df.to_csv(OUTPUTS_DIR / "cafes_with_predictions.csv", index=False)
area.to_csv(OUTPUTS_DIR / "area_summary.csv", index=False)
opps.to_csv(OUTPUTS_DIR / "opportunity_ranking.csv", index=False)
cell.to_csv(OUTPUTS_DIR / "grid_cells.csv", index=False)

print(f"\nExported CSVs to: {OUTPUTS_DIR}")
print("  - cafes_with_predictions.csv")
print("  - area_summary.csv")
print("  - opportunity_ranking.csv")
print("  - grid_cells.csv")
print("\nDone! Model is ready for the backend API.")
