"""
TrendHive — FastAPI Backend Server
Dubai Cafe Market Intelligence API

Run:  uvicorn main:app --reload --port 8000
"""
import sys
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "routes"))
sys.path.insert(0, str(BASE_DIR / "engines"))

DATA_DIR   = BASE_DIR / "data" / "outputs"
MODELS_DIR = BASE_DIR / "models"

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import json
import joblib


app = FastAPI(title="TrendHive — Dubai Cafe Market Intelligence API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


try:
    biz_df  = pd.read_csv(DATA_DIR / "cleaned_business_level.csv")
    area_df = pd.read_csv(DATA_DIR / "area_metrics.csv")
    cat_df  = pd.read_csv(DATA_DIR / "category_metrics.csv")
    opp_df  = pd.read_csv(DATA_DIR / "opportunity_metrics.csv")
    print(f"Base data loaded: {len(area_df)} areas, {len(biz_df)} businesses (from area_metrics + cleaned_business_level)")
except FileNotFoundError as e:
    print(f"Warning: data files not found — {e}")
    biz_df = area_df = cat_df = opp_df = pd.DataFrame()




@app.get("/health")
def health():
    # Use the full 4200+ predictions dataset when available
    src = _pred_df if not _pred_df.empty else biz_df
    if not src.empty:
        area_col = "detected_area" if "detected_area" in src.columns else "area"
        n_areas = int(src[area_col].nunique()) if area_col in src.columns else len(area_df)
        n_biz = len(src)
    else:
        n_areas = len(area_df)
        n_biz = len(biz_df)
    return {"status": "ok", "areas": n_areas, "businesses": n_biz}


@app.get("/areas")
def list_areas():
    if area_df.empty:
        return []
    return area_df.fillna(0).to_dict(orient="records")


@app.get("/areas/{area_name}")
def get_area(area_name: str):
    m = area_df[area_df["area"].str.lower() == area_name.lower()]
    if m.empty:
        raise HTTPException(404, f"Area not found: {area_name}")
    row = m.fillna(0).iloc[0].to_dict()

    
    if not _pred_df.empty:
        area_col = "detected_area" if "detected_area" in _pred_df.columns else "area"
        biz = _pred_df[_pred_df[area_col].str.lower() == area_name.lower()]
        cols = [c for c in ["Name", "Rating", "Reviews", "predicted_tier", "prediction_confidence", "avg_polarity"] if c in biz.columns]
        biz = biz[cols].fillna(0) if cols else biz.head(0)
    else:
        biz = biz_df[biz_df["area"].str.lower() == area_name.lower()][
            ["Name", "Rating", "Reviews", "price_index", "sentiment_mean"]
        ].fillna(0)

    
    biz_records = biz.where(biz.notna(), None).to_dict(orient="records")
    row["businesses"] = biz_records
    row["total_cafes"] = len(biz)
    return row


@app.get("/recommend")
def recommend(
    profile: str = Query("balanced_investor"),
    top_n: int = Query(10),
):
    m = opp_df[opp_df["profile"] == profile]
    if m.empty:
        raise HTTPException(404, f"Profile not found: {profile}")
    return m.nlargest(top_n, "opportunity_score").fillna(0).to_dict(orient="records")


@app.get("/categories")
def categories():
    return cat_df.to_dict(orient="records") if not cat_df.empty else []


@app.get("/business/{name}")
def business(name: str):
    # Search in the full predictions dataset first, then fall back to biz_df
    src = _pred_df if not _pred_df.empty else biz_df
    m = src[src["Name"].str.lower().str.contains(name.lower(), na=False)]
    if m.empty:
        raise HTTPException(404, f"Not found: {name}")
    return m.head(5).where(m.head(5).notna(), None).to_dict(orient="records")



from xai_api_routes import xai_router
app.include_router(xai_router)

from lstm_slm_api_routes import lstm_slm_router
app.include_router(lstm_slm_router)



try:
    _growth_model   = joblib.load(MODELS_DIR / "trendhive_growth_classifier.pkl")
    _growth_encoder = joblib.load(MODELS_DIR / "trendhive_growth_label_encoder.pkl")
    with open(MODELS_DIR / "trendhive_growth_features.json") as f:
        _growth_features = json.load(f)
    print("Growth classifier loaded")
except Exception as e:
    print(f"Warning: could not load growth model — {e}")
    _growth_model = None


@app.get("/predict/growth/{place_id}")
def predict_growth(place_id: str):
    if _growth_model is None:
        raise HTTPException(500, "Growth model not loaded")

    cafe = biz_df[biz_df["Place_ID"] == place_id]
    if cafe.empty:
        raise HTTPException(404, f"Cafe not found: {place_id}")

    row = cafe.iloc[0].to_dict()
    features = {f: row.get(f, 0) for f in _growth_features}

    import shap

    X = pd.DataFrame([features]).fillna(0)

    pred_encoded = _growth_model.predict(X)[0]
    pred_proba   = _growth_model.predict_proba(X)[0]
    pred_class   = _growth_encoder.inverse_transform([pred_encoded])[0]
    confidence   = round(float(pred_proba.max()) * 100, 1)

    explainer  = shap.TreeExplainer(_growth_model)
    shap_vals  = explainer.shap_values(X)
    class_idx  = list(_growth_encoder.classes_).index(pred_class)

    if isinstance(shap_vals, list):
        shap_row = shap_vals[class_idx][0]
    else:
        shap_row = shap_vals[0, :, class_idx]

    contributions = sorted(
        [
            {
                "feature":    _growth_features[i],
                "value":      round(float(X.iloc[0, i]), 3),
                "shap_value": round(float(shap_row[i]), 4),
                "direction":  "positive" if shap_row[i] > 0 else "negative",
            }
            for i in range(len(_growth_features))
        ],
        key=lambda x: abs(x["shap_value"]),
        reverse=True,
    )

    class_probs = {
        _growth_encoder.classes_[i]: round(float(p) * 100, 1)
        for i, p in enumerate(pred_proba)
    }

    return {
        "cafe":               row.get("Name"),
        "place_id":           place_id,
        "predicted_class":    pred_class,
        "confidence_pct":     confidence,
        "class_probabilities": class_probs,
        "top_drivers":        contributions[:5],
        "proxy_note":         "Growth classification is based on review velocity patterns, not verified revenue data.",
    }




try:
    _pop_model = joblib.load(MODELS_DIR / "popularity_rf.joblib")
    with open(MODELS_DIR / "popularity_rf_features.json") as f:
        _pop_features = json.load(f)
    with open(MODELS_DIR / "popularity_rf_classes.json") as f:
        _pop_classes = json.load(f)
    print("Popularity tier classifier loaded")
except Exception as e:
    print(f"Popularity model not found — run 'python ml/train_popularity_model.py' first. ({e})")
    _pop_model = None


_pred_df = pd.DataFrame()
try:
    _pred_path = DATA_DIR / "cafes_with_predictions.csv"
    if _pred_path.exists():
        _pred_df = pd.read_csv(_pred_path)
        print(f"Loaded {len(_pred_df)} cafe predictions")
except Exception:
    pass


@app.get("/predict/popularity/{place_id}")
def predict_popularity(place_id: str):
    """
    Predict the popularity tier for a cafe using the Random Forest model
    trained from the ML notebook (TrendHive_Cafes_ML_Analytics_Map.ipynb).

    Tiers: Very Low / Low / Medium / High / Very High
    """
    
    if not _pred_df.empty:
        match = _pred_df[_pred_df["Place_ID"] == place_id.strip()]
        if not match.empty:
            row = match.iloc[0]
            return {
                "cafe":                 row.get("Name"),
                "place_id":             place_id,
                "predicted_tier":       row.get("predicted_tier"),
                "prediction_confidence": round(float(row.get("prediction_confidence", 0)), 3),
                "popularity_score":     round(float(row.get("popularity_score", 0)), 3),
                "rating":               row.get("Rating"),
                "reviews":              row.get("Reviews"),
                "area":                 row.get("detected_area"),
                "source":               "pre-computed",
            }

    
    if _pop_model is None:
        raise HTTPException(
            500,
            "Popularity model not loaded. Run: python ml/train_popularity_model.py",
        )

    cafe = biz_df[biz_df["Place_ID"] == place_id.strip()]
    if cafe.empty:
        raise HTTPException(404, f"Cafe not found: {place_id}")

    row = cafe.iloc[0].to_dict()
    features = {f: row.get(f, 0) for f in _pop_features}
    X = pd.DataFrame([features]).fillna(0)

    pred_tier  = _pop_model.predict(X)[0]
    pred_proba = _pop_model.predict_proba(X)[0]
    confidence = round(float(pred_proba.max()), 3)

    tier_probs = {
        cls: round(float(p), 3)
        for cls, p in zip(_pop_classes, pred_proba)
    }

    return {
        "cafe":                 row.get("Name"),
        "place_id":             place_id,
        "predicted_tier":       pred_tier,
        "prediction_confidence": confidence,
        "tier_probabilities":   tier_probs,
        "rating":               row.get("Rating"),
        "reviews":              row.get("Reviews"),
        "area":                 row.get("detected_area", row.get("area")),
        "source":               "live-prediction",
    }


@app.get("/predict/popularity/search/{name}")
def predict_popularity_by_name(name: str, top_n: int = Query(default=5)):
    """Search cafes by name and return popularity tier predictions."""
    if not _pred_df.empty:
        matches = _pred_df[
            _pred_df["Name"].str.lower().str.contains(name.lower(), na=False)
        ].head(top_n)
        if not matches.empty:
            results = []
            for _, row in matches.iterrows():
                results.append({
                    "cafe":                 row.get("Name"),
                    "place_id":             row.get("Place_ID"),
                    "area":                 row.get("detected_area"),
                    "predicted_tier":       row.get("predicted_tier"),
                    "prediction_confidence": round(float(row.get("prediction_confidence", 0)), 3),
                    "popularity_score":     round(float(row.get("popularity_score", 0)), 3),
                    "rating":               row.get("Rating"),
                    "reviews":              row.get("Reviews"),
                })
            return results

    raise HTTPException(404, f"No cafes found matching '{name}'. Run the popularity model first.")




@app.get("/overview/cards")
def overview_cards():
    """
    Dashboard KPI cards using the full 4200-cafe predictions dataset.
    Falls back to the 349-cafe business-level data if predictions unavailable.
    """
    src = _pred_df if not _pred_df.empty else biz_df
    if src.empty:
        return {"error": "No data loaded"}

    total = int(src["Place_ID"].nunique()) if "Place_ID" in src.columns else len(src)
    avg_rat = round(float(pd.to_numeric(src.get("Rating"), errors="coerce").mean()), 2)
    avg_rev = round(float(pd.to_numeric(src.get("Reviews"), errors="coerce").mean()), 1)

    area_col = "detected_area" if "detected_area" in src.columns else "area"
    top_area = str(src[area_col].value_counts().index[0]) if src[area_col].notna().any() else None

    result = {
        "total_cafes":   total,
        "avg_rating":    avg_rat,
        "avg_reviews":   avg_rev,
        "top_area":      top_area,
        "data_source":   "predictions" if not _pred_df.empty else "business_level",
    }

    if not _pred_df.empty and "predicted_tier" in _pred_df.columns:
        high_count = int(_pred_df["predicted_tier"].isin(["High", "Very High"]).sum())
        result["share_high_or_very_high"] = round(high_count / max(total, 1), 3)
        result["tier_distribution"] = _pred_df["predicted_tier"].value_counts().to_dict()

    return result


@app.get("/analytics/area-summary")
def area_summary():
    """
    Area-level summary aggregated from the full predictions dataset.
    Shows cafe count, avg rating, avg reviews, avg sentiment per area.
    """
    if _pred_df.empty:
        return area_df.fillna(0).to_dict(orient="records") if not area_df.empty else []

    area_col = "detected_area" if "detected_area" in _pred_df.columns else "area"
    agg_cols = {
        "cafes": ("Place_ID", "count"),
        "avg_rating": ("Rating", "mean"),
        "avg_reviews": ("Reviews", "mean"),
    }
    if "avg_polarity" in _pred_df.columns:
        agg_cols["avg_sentiment"] = ("avg_polarity", "mean")
    if "competitors_within_500m" in _pred_df.columns:
        agg_cols["avg_comp_500"] = ("competitors_within_500m", "mean")
    if "avg_commercial_rent_aed_sqft_year" in _pred_df.columns:
        agg_cols["avg_rent"] = ("avg_commercial_rent_aed_sqft_year", "mean")
    if "utility_cost_aed_month" in _pred_df.columns:
        agg_cols["avg_utility"] = ("utility_cost_aed_month", "mean")

    summary = _pred_df.groupby(area_col).agg(**agg_cols).reset_index()
    summary = summary.sort_values("cafes", ascending=False)
    return summary.fillna(0).to_dict(orient="records")


@app.get("/analytics/opportunity-ranking")
def opportunity_ranking():
    """
    Z-score based opportunity ranking from the ML notebook.
    Uses the full 4200-cafe dataset for richer analysis.
    """
    opp_path = DATA_DIR / "opportunity_ranking.csv"
    if opp_path.exists():
        opps = pd.read_csv(opp_path)
        return opps.fillna(0).to_dict(orient="records")

    # Fallback: compute live from predictions
    if _pred_df.empty:
        return []

    area_col = "detected_area" if "detected_area" in _pred_df.columns else "area"
    tmp = _pred_df.copy()
    for col in ["avg_polarity", "Rating", "Reviews", "competitors_within_500m",
                "avg_commercial_rent_aed_sqft_year", "utility_cost_aed_month"]:
        if col in tmp.columns:
            tmp[col] = pd.to_numeric(tmp[col], errors="coerce")

    a = tmp.groupby(area_col).agg(
        cafes=("Place_ID", "count"), rating=("Rating", "mean"),
        sentiment=("avg_polarity", "mean") if "avg_polarity" in tmp.columns else ("Rating", "count"),
        reviews=("Reviews", "mean"),
        comp=("competitors_within_500m", "mean") if "competitors_within_500m" in tmp.columns else ("Reviews", "count"),
        rent=("avg_commercial_rent_aed_sqft_year", "mean") if "avg_commercial_rent_aed_sqft_year" in tmp.columns else ("Reviews", "count"),
        utility=("utility_cost_aed_month", "mean") if "utility_cost_aed_month" in tmp.columns else ("Reviews", "count"),
    ).reset_index()

    def _z(s):
        s = s.fillna(s.median())
        return (s - s.mean()) / (s.std(ddof=0) + 1e-9)

    a["opportunity_score"] = (
        0.35 * _z(a["rating"]) + 0.25 * _z(a["sentiment"])
        + 0.15 * _z(a["reviews"]) - 0.15 * _z(a["comp"])
        - 0.07 * _z(a["rent"]) - 0.03 * _z(a["utility"])
    )
    return a.sort_values("opportunity_score", ascending=False).fillna(0).to_dict(orient="records")




def _safe(val, default=None):
    """Convert pandas/numpy values to JSON-safe Python types (NaN -> default)."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return default
    try:
        if np.isnan(val):
            return default
    except (TypeError, ValueError):
        pass
    return val


@app.get("/map/markers")
def map_markers(limit: int = Query(default=3000, le=5000)):
    """
    Returns cafe locations with rating, reviews, sentiment, and predicted tier
    for map marker rendering. Caps at `limit` markers.
    """
    src = _pred_df if not _pred_df.empty else biz_df
    if src.empty:
        return []

    lat_col = "Latitude" if "Latitude" in src.columns else "latitude"
    lng_col = "Longitude" if "Longitude" in src.columns else "longitude"

    if lat_col not in src.columns or lng_col not in src.columns:
        return {"error": "No coordinates available in dataset"}

    m_df = src.dropna(subset=[lat_col, lng_col]).copy()
    if len(m_df) > limit:
        m_df = m_df.sample(limit, random_state=42)

    markers = []
    for _, r in m_df.iterrows():
        marker = {
            "name":     str(r.get("Name", "") or ""),
            "lat":      float(r[lat_col]),
            "lng":      float(r[lng_col]),
            "rating":   _safe(r.get("Rating")),
            "reviews":  _safe(r.get("Reviews")),
        }
        area_col = "detected_area" if "detected_area" in r.index else "area"
        marker["area"] = str(r.get(area_col, "") or "")

        pol = _safe(r.get("avg_polarity") if "avg_polarity" in r.index else None)
        if pol is not None:
            marker["sentiment"] = round(float(pol), 3)
        tier = _safe(r.get("predicted_tier") if "predicted_tier" in r.index else None)
        if tier is not None:
            marker["predicted_tier"] = str(tier)
        conf = _safe(r.get("prediction_confidence") if "prediction_confidence" in r.index else None)
        if conf is not None:
            marker["confidence"] = round(float(conf), 3)
        markers.append(marker)

    return {
        "total":   len(m_df),
        "center":  [float(m_df[lat_col].mean()), float(m_df[lng_col].mean())],
        "markers": markers,
    }


@app.get("/map/cells")
def map_heatmap_cells(precision: int = Query(default=3, ge=2, le=4)):
    """
    Returns grid heatmap cells for density visualization.
    Each cell has: cafe count, avg rating, share of high-popularity tiers, avg sentiment.
    """
    cells_path = DATA_DIR / "grid_cells.csv"
    if cells_path.exists():
        cells = pd.read_csv(cells_path)
        return cells.fillna(0).to_dict(orient="records")

   
    src = _pred_df if not _pred_df.empty else biz_df
    if src.empty:
        return []

    lat_col = "Latitude" if "Latitude" in src.columns else "latitude"
    lng_col = "Longitude" if "Longitude" in src.columns else "longitude"

    g = src.dropna(subset=[lat_col, lng_col]).copy()
    g["lat_cell"] = g[lat_col].round(precision)
    g["lng_cell"] = g[lng_col].round(precision)
    g["cell_id"] = g["lat_cell"].astype(str) + "," + g["lng_cell"].astype(str)

    agg_dict = {
        "cafes": ("Place_ID" if "Place_ID" in g.columns else "Name", "count"),
        "avg_rating": ("Rating", "mean"),
    }
    if "predicted_tier" in g.columns:
        agg_dict["share_high"] = ("predicted_tier", lambda s: float(s.isin(["High", "Very High"]).mean()))
    if "avg_polarity" in g.columns:
        agg_dict["avg_sentiment"] = ("avg_polarity", "mean")

    cells = g.groupby(["cell_id", "lat_cell", "lng_cell"]).agg(**agg_dict).reset_index()
    return cells.fillna(0).to_dict(orient="records")
