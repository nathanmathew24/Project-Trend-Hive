"""
lstm_slm_api_routes.py
TrendHive — LSTM Forecasting + SLM Narrative API Routes

Adds /forecast/* and /narrative/* endpoints to the FastAPI app.

HOW TO USE:
  In dubai_cafe_api.py, add at the bottom:

      from lstm_slm_api_routes import lstm_slm_router
      app.include_router(lstm_slm_router)

Then restart uvicorn. New endpoints will appear at:

  LSTM Forecasting:
    GET  /forecast/area/{area_name}           — Area demand forecast
    GET  /forecast/trend/{category}/{keyword} — Google Trends keyword forecast
    GET  /forecast/anomaly/{area_name}        — LSTM anomaly detection
    GET  /forecast/config                     — LSTM model configuration

  SLM Narratives:
    GET  /narrative/area/{area_name}          — SLM-generated area summary
    GET  /narrative/opportunity/{area_name}   — Opportunity narrative
    GET  /narrative/cafe/{place_id}           — Café insight narrative
    GET  /narrative/forecast/{category}/{kw}  — Forecast explanation text
    GET  /narrative/dashboard                 — All area narratives (batch)
    GET  /narrative/model-info                — SLM model details
"""

from fastapi import APIRouter, HTTPException, Query
import pandas as pd

from lstm_forecasting import (
    LSTMForecaster, TrendForecaster, AreaDemandForecaster,
    LSTMAnomalyDetector, LSTM_CONFIG,
)
from slm_narrative_engine import SLMNarrativeEngine, SLM_CONFIG

from pathlib import Path
_DATA = Path(__file__).resolve().parent.parent / "data" / "outputs"


try:
    biz_df  = pd.read_csv(_DATA / "cleaned_business_level.csv")
    area_df = pd.read_csv(_DATA / "area_metrics.csv")
    opp_df  = pd.read_csv(_DATA / "opportunity_metrics.csv")
except FileNotFoundError as e:
    print(f"[LSTM/SLM] Warning: Could not load data files. {e}")
    biz_df = area_df = opp_df = pd.DataFrame()


trend_forecaster = TrendForecaster()
area_forecaster  = AreaDemandForecaster()
anomaly_detector = LSTMAnomalyDetector()
slm_engine       = SLMNarrativeEngine(use_slm=True)


try:
    trend_forecaster.load_trends_data()
except Exception as e:
    print(f"[LSTM] Google Trends data not loaded: {e}")


lstm_slm_router = APIRouter(tags=["LSTM Forecasting & SLM Narratives"])



@lstm_slm_router.get("/forecast/area/{area_name}")
def forecast_area_demand(
    area_name: str,
    horizon: int = Query(default=6, ge=1, le=12,
                         description="Forecast horizon in periods")
):
    """
    Generates an LSTM-based demand forecast for a specific Dubai area.

    Returns predicted demand trajectory, confidence bounds, and trend
    direction over the specified horizon.
    """
    match = area_df[area_df["area"].str.lower() == area_name.strip().lower()]
    if match.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Area '{area_name}' not found. "
                   f"Available: {area_df['area'].tolist() if not area_df.empty else []}"
        )

    row = match.iloc[0].to_dict()
    forecast = area_forecaster.forecast_area(area_name, row, horizon=horizon)

    # Attach SLM narrative
    if "forecast" in forecast:
        narrative = slm_engine.generate_forecast_narrative(
            f"{area_name} demand", forecast
        )
        forecast["narrative"] = narrative

    return forecast



@lstm_slm_router.get("/forecast/trend/{category}/{keyword}")
def forecast_trend_keyword(
    category: str,
    keyword: str,
    horizon: int = Query(default=6, ge=1, le=12)
):
    """
    Trains an LSTM model on a Google Trends keyword and produces a forecast.

    Categories: core_demand, premium_segment, trending_beverages
    """
    valid_categories = list(TrendForecaster.TREND_CATEGORIES.keys())
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Valid: {valid_categories}"
        )

    result = trend_forecaster.forecast_keyword(category, keyword, horizon)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    # Attach SLM narrative
    if "forecast" in result:
        narrative = slm_engine.generate_forecast_narrative(keyword, result)
        result["narrative"] = narrative

    return result



@lstm_slm_router.get("/forecast/anomaly/{area_name}")
def detect_anomalies(area_name: str):
    """
    Runs LSTM-based anomaly detection on synthesized demand history
    for an area. Flags unusual demand shifts.
    """
    match = area_df[area_df["area"].str.lower() == area_name.strip().lower()]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Area '{area_name}' not found.")

    row = match.iloc[0].to_dict()

    # Synthesize history for anomaly detection
    history = area_forecaster._synthesize_history(row, periods=36)
    result = anomaly_detector.detect(history, series_name=f"anomaly_{area_name}")

    result["area"] = area_name

    # Generate alert narratives for detected anomalies
    if result.get("anomalies"):
        for anomaly in result["anomalies"][:3]:  # Top 3 alerts
            alert = slm_engine.generate_anomaly_alert(
                entity=area_name,
                metric="demand_score",
                actual=anomaly.get("actual_value", 0),
                expected=anomaly.get("expected_value", anomaly.get("actual_value", 0) * 0.9),
                severity=anomaly.get("severity", "MEDIUM"),
            )
            anomaly["alert_narrative"] = alert["narrative"]

    return result



@lstm_slm_router.get("/forecast/trends/{category}")
def forecast_all_trends(
    category: str,
    horizon: int = Query(default=6, ge=1, le=12)
):
    """Forecast all keywords in a trend category."""
    results = trend_forecaster.forecast_all_keywords(category, horizon)
    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No trend data available for category '{category}'. "
                   f"Ensure Google Trends CSVs are in the data directory."
        )
    return {"category": category, "forecasts": results}



@lstm_slm_router.get("/forecast/config")
def get_forecast_config():
    """Returns the LSTM model configuration and available trend categories."""
    return {
        "lstm_config": LSTM_CONFIG,
        "trend_categories": {
            k: v["label"] for k, v in TrendForecaster.TREND_CATEGORIES.items()
        },
        "loaded_categories": list(trend_forecaster.keyword_data.keys()),
        "model_architecture": {
            "type": "LSTM (Long Short-Term Memory)",
            "layers": [
                f"LSTM({LSTM_CONFIG['lstm_units']}, return_sequences=True)",
                f"Dropout({LSTM_CONFIG['dropout_rate']})",
                f"LSTM({LSTM_CONFIG['lstm_units'] // 2})",
                f"Dropout({LSTM_CONFIG['dropout_rate']})",
                "Dense(16, ReLU)",
                "Dense(1, Linear)",
            ],
            "uncertainty": f"Monte Carlo Dropout ({LSTM_CONFIG['mc_dropout_passes']} passes)",
            "optimizer": f"Adam(lr={LSTM_CONFIG['learning_rate']})",
            "fallback": "Holt's Linear Exponential Smoothing",
        },
    }



@lstm_slm_router.get("/narrative/area/{area_name}")
def get_area_narrative(
    area_name: str,
    slm_refine: bool = Query(default=False,
                             description="Apply SLM text refinement")
):
    """
    Generates a natural-language area summary using the SLM engine.
    """
    match = area_df[area_df["area"].str.lower() == area_name.strip().lower()]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Area '{area_name}' not found.")

    row = match.iloc[0].to_dict()
    result = slm_engine.generate_area_summary(
        area_name, row, include_slm_refinement=slm_refine
    )
    result["area"] = area_name
    result["market_positioning"] = row.get("market_positioning", "N/A")
    return result



@lstm_slm_router.get("/narrative/opportunity/{area_name}")
def get_opportunity_narrative(
    area_name: str,
    profile: str = Query(default="balanced_investor")
):
    """Generates an SLM narrative for an opportunity score."""
    area_match = area_df[area_df["area"].str.lower() == area_name.strip().lower()]
    opp_match = opp_df[
        (opp_df["area"].str.lower() == area_name.strip().lower()) &
        (opp_df["profile"] == profile)
    ] if not opp_df.empty else pd.DataFrame()

    if area_match.empty:
        raise HTTPException(status_code=404, detail=f"Area '{area_name}' not found.")

    area_row = area_match.iloc[0].to_dict()
    opp_data = opp_match.iloc[0].to_dict() if not opp_match.empty else {}

    result = slm_engine.generate_opportunity_narrative(
        area_name, area_row, opp_data, profile
    )
    result["area"] = area_name
    return result



@lstm_slm_router.get("/narrative/cafe/{place_id}")
def get_cafe_narrative(place_id: str):
    """Generates an SLM narrative for a single café."""
    match = biz_df[biz_df["Place_ID"] == place_id.strip()] if not biz_df.empty else pd.DataFrame()
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Café '{place_id}' not found.")

    row = match.iloc[0].to_dict()
    result = slm_engine.generate_cafe_insight(row)
    result["cafe_name"] = row.get("Name")
    result["area"] = row.get("area")
    return result



@lstm_slm_router.get("/narrative/forecast/{category}/{keyword}")
def get_forecast_narrative(category: str, keyword: str):
    """
    Generates a forecast and its SLM narrative in one call.
    Combines LSTM prediction with natural-language explanation.
    """
    forecast_result = trend_forecaster.forecast_keyword(category, keyword)

    if "error" in forecast_result:
        raise HTTPException(status_code=404, detail=forecast_result["error"])

    narrative = slm_engine.generate_forecast_narrative(keyword, forecast_result)
    forecast_result["narrative"] = narrative
    return forecast_result



@lstm_slm_router.get("/narrative/dashboard")
def get_dashboard_narratives(
    profile: str = Query(default="balanced_investor")
):
    """
    Generates all area narratives for the dashboard in one batch call.
    Optimized for the frontend to load all tooltips at once.
    """
    if area_df.empty:
        raise HTTPException(status_code=500, detail="Area data not loaded.")

    narratives = slm_engine.generate_dashboard_narratives(area_df, opp_df, profile)
    return {
        "profile": profile,
        "total_areas": len(narratives),
        "narratives": narratives,
    }



@lstm_slm_router.get("/narrative/model-info")
def get_slm_model_info():
    """Returns detailed information about the SLM model and configuration."""
    return slm_engine.get_model_info()
