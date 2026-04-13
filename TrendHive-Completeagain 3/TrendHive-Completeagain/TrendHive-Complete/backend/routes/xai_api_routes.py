"""
xai_api_routes.py
TrendHive — XAI API Routes

Adds /explain/* endpoints to your existing FastAPI app.

HOW TO USE:
  In dubai_cafe_api.py, add at the bottom:

      from xai_api_routes import xai_router
      app.include_router(xai_router)

Then restart uvicorn.  New endpoints will appear at:
  GET /explain/area/{area_name}
  GET /explain/area/{area_name}/score/{score_type}
  GET /explain/opportunity/{area_name}?profile=balanced_investor
  GET /explain/cafe/{place_id}
  GET /explain/cafe/search/{name}
  GET /explain/chatbot/{area_name}?profile=balanced_investor
  GET /explain/profiles
"""

from fastapi import APIRouter, HTTPException, Query
import pandas as pd

from xai_engine import ScoreDecomposer, SentimentExplainer, OpportunityExplainer, NLExplanationGenerator
from xai_confidence import PROXY_DISCLAIMERS, SCORE_CONFIDENCE

from pathlib import Path
_DATA = Path(__file__).resolve().parent.parent / "data" / "outputs"


try:
    biz_df  = pd.read_csv(_DATA / "cleaned_business_level.csv")
    area_df = pd.read_csv(_DATA / "area_metrics.csv")
    opp_df  = pd.read_csv(_DATA / "opportunity_metrics.csv")
except FileNotFoundError as e:
    print(f"[XAI] Warning: Could not load data files. Run main pipeline first. {e}")
    biz_df = area_df = opp_df = pd.DataFrame()


decomposer   = ScoreDecomposer()
sent_exp     = SentimentExplainer()
opp_exp      = OpportunityExplainer()
nl_gen       = NLExplanationGenerator()


xai_router = APIRouter(prefix="/explain", tags=["Explainable AI"])



@xai_router.get("/area/{area_name}")
def explain_area(area_name: str):
    """
    Returns a full decomposition of all composite scores for an area,
    plus a natural-language summary and confidence annotations.
    """
    match = area_df[area_df["area"].str.lower() == area_name.strip().lower()]
    if match.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Area '{area_name}' not found. "
                   f"Available areas: {area_df['area'].tolist() if not area_df.empty else []}"
        )

    row = match.iloc[0].to_dict()

   
    decompositions = decomposer.decompose_all(row)

    
    demand_xai = decompositions.get("demand", {})
    nl_summary = nl_gen.area_summary(area_name, row, demand_xai=demand_xai)

    return {
        "area":            area_name,
        "market_positioning": row.get("market_positioning", "N/A"),
        "scores": {
            "demand_score":          round(float(row.get("demand_score", 0) or 0), 3),
            "competition_intensity": round(float(row.get("competition_intensity", 0) or 0), 3),
            "reputation_strength":   round(float(row.get("reputation_strength", 0) or 0), 3),
            "growth_momentum":       round(float(row.get("growth_momentum", 0) or 0), 3),
            "barrier_to_entry":      round(float(row.get("barrier_to_entry", 0) or 0), 3),
            "market_balance":        round(float(row.get("market_balance", 0) or 0), 3),
        },
        "decompositions": decompositions,
        "nl_summary":     nl_summary,
        "strengths":      row.get("strengths", ""),
        "risks":          row.get("risks", ""),
    }



@xai_router.get("/area/{area_name}/score/{score_type}")
def explain_area_score(area_name: str, score_type: str):
    """
    Decomposes a single score (demand/competition/reputation/growth/barrier)
    for one area.
    """
    valid_scores = ["demand", "competition", "reputation", "growth", "barrier"]
    if score_type not in valid_scores:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid score_type '{score_type}'. Choose from: {valid_scores}"
        )

    match = area_df[area_df["area"].str.lower() == area_name.strip().lower()]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Area '{area_name}' not found.")

    row = match.iloc[0].to_dict()
    return decomposer.decompose(row, score_type)



@xai_router.get("/opportunity/{area_name}")
def explain_opportunity(
    area_name: str,
    profile: str = Query(default="balanced_investor",
                         description="Investor profile key")
):
    """
    Explains why an area scored the way it did for a specific investor profile.
    """
    area_match = area_df[area_df["area"].str.lower() == area_name.strip().lower()]
    opp_match  = opp_df[
        (opp_df["area"].str.lower() == area_name.strip().lower()) &
        (opp_df["profile"] == profile)
    ] if not opp_df.empty else pd.DataFrame()

    if area_match.empty:
        raise HTTPException(status_code=404, detail=f"Area '{area_name}' not found.")
    if opp_match.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No opportunity data for area='{area_name}', profile='{profile}'. "
                   f"Valid profiles: {list(opp_exp.PROFILES.keys())}"
        )

   
    row = {**area_match.iloc[0].to_dict(), **opp_match.iloc[0].to_dict()}

    xai_result = opp_exp.explain(row, profile)

    
    xai_result["nl_summary"] = nl_gen.opportunity_summary(area_name, xai_result)

    return xai_result



@xai_router.get("/cafe/{place_id}")
def explain_cafe(place_id: str):
    """
    Returns a full explanation for a single cafe: footfall proxy breakdown,
    sentiment score explanation, and natural-language summary.
    """
    match = biz_df[biz_df["Place_ID"] == place_id.strip()] if not biz_df.empty else pd.DataFrame()
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Cafe with Place ID '{place_id}' not found.")

    row = match.iloc[0].to_dict()

    
    sent_xai = sent_exp.explain_cafe_sentiment(row)

    
    footfall_xai = _explain_footfall_proxy(row)

    
    nl_summary = nl_gen.cafe_summary(row.get("Name", "This cafe"), row)
    sent_nl    = nl_gen.sentiment_summary(row.get("Name", "This cafe"), sent_xai)

    return {
        "cafe_name":           row.get("Name"),
        "area":                row.get("area"),
        "rating":              row.get("Rating"),
        "reviews":             row.get("Reviews"),
        "cuisine":             row.get("Cuisine_Primary"),
        "growth_class":        row.get("growth_class"),
        "footfall_explanation":footfall_xai,
        "sentiment_explanation": sent_xai,
        "nl_summary":          nl_summary,
        "sentiment_nl":        sent_nl,
    }



@xai_router.get("/cafe/search/{name}")
def explain_cafe_by_name(name: str, top_n: int = Query(default=3)):
    """
    Search for cafes by name and return XAI explanations.
    """
    matches = biz_df[
        biz_df["Name"].str.lower().str.contains(name.lower(), na=False)
    ].head(top_n) if not biz_df.empty else pd.DataFrame()

    if matches.empty:
        raise HTTPException(status_code=404, detail=f"No cafes found matching '{name}'.")

    results = []
    for _, row in matches.iterrows():
        row_dict = row.to_dict()
        sent_xai = sent_exp.explain_cafe_sentiment(row_dict)
        results.append({
            "cafe_name":   row_dict.get("Name"),
            "place_id":    row_dict.get("Place_ID"),
            "area":        row_dict.get("area"),
            "rating":      row_dict.get("Rating"),
            "reviews":     row_dict.get("Reviews"),
            "growth_class": row_dict.get("growth_class"),
            "sentiment_explanation": sent_xai,
            "nl_summary":  nl_gen.cafe_summary(row_dict.get("Name", ""), row_dict),
        })
    return results



@xai_router.get("/chatbot/{area_name}")
def chatbot_area_explanation(
    area_name: str,
    profile: str = Query(default="balanced_investor")
):
    """
    Returns a formatted multi-line chatbot response for Aria.
    """
    area_match = area_df[area_df["area"].str.lower() == area_name.strip().lower()]
    opp_match  = opp_df[
        (opp_df["area"].str.lower() == area_name.strip().lower()) &
        (opp_df["profile"] == profile)
    ] if not opp_df.empty else pd.DataFrame()

    if area_match.empty:
        raise HTTPException(status_code=404, detail=f"Area '{area_name}' not found.")

    row = area_match.iloc[0].to_dict()

    demand_xai = decomposer.decompose(row, "demand")
    opp_row    = {**row, **opp_match.iloc[0].to_dict()} if not opp_match.empty else row
    opp_xai    = opp_exp.explain(opp_row, profile)

    response_text = nl_gen.chatbot_area_response(
        area_name, row, demand_xai, opp_xai, profile
    )

    return {
        "area":     area_name,
        "profile":  profile,
        "response": response_text,
        "data": {
            "demand_xai":      demand_xai,
            "opportunity_xai": opp_xai,
        }
    }



@xai_router.get("/profiles")
def list_profiles():
    """Returns all available investor profiles with descriptions and weights."""
    return [
        {
            "key":         k,
            "label":       v["label"],
            "description": v["description"],
            "weights":     v["weights"],
        }
        for k, v in opp_exp.PROFILES.items()
    ]



def _explain_footfall_proxy(cafe_row: dict) -> dict:
    """
    Decomposes the footfall proxy score for a single cafe.
    Mirrors the proxy model in Inara's data pipeline.
    """
    from xai_confidence import _safe_norm, PROXY_DISCLAIMERS

    reviews      = float(cafe_row.get("Reviews", 0) or 0)
    tourist_idx  = float(cafe_row.get("tourist_index", 0) or 0)
    pop_density  = float(cafe_row.get("population_density_people_per_sqkm", 0) or 0)
    footfall_raw = float(cafe_row.get("Footfall_Score", 0) or 0)

    
    from xai_engine import _norm
    n_reviews  = _norm(reviews,     "Reviews")
    n_tourist  = _norm(tourist_idx, "tourist_index")
    n_pop      = _norm(pop_density, "population_density_people_per_sqkm")
    n_footfall = _norm(footfall_raw,"Footfall_Score")   # raw footfall signal

  
    components = {
        "Review Activity":        {"normalised": round(n_reviews, 3),  "weight": 0.35},
        "Tourist Density Proxy":  {"normalised": round(n_tourist, 3),  "weight": 0.30},
        "Population Density":     {"normalised": round(n_pop, 3),      "weight": 0.20},
        "Commercial Area Signal": {"normalised": round(n_footfall, 3), "weight": 0.15},
    }
    for k in components:
        components[k]["contribution"] = round(
            components[k]["normalised"] * components[k]["weight"], 4
        )

    total_contrib = sum(c["contribution"] for c in components.values())
    for k in components:
        c = components[k]["contribution"]
        components[k]["pct_of_score"] = round((c / total_contrib * 100), 1) if total_contrib > 0 else 0

    ranked = sorted(components.items(), key=lambda x: x[1]["contribution"], reverse=True)

    return {
        "estimated_footfall_score": footfall_raw,
        "top_signal":    ranked[0][0],
        "components":    dict(ranked),
        "proxy_disclaimer": PROXY_DISCLAIMERS["footfall"],
        "confidence":    "LOW — proxy estimate only",
    }
