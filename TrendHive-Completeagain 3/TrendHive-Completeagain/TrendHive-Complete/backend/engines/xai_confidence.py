"""
xai_confidence.py
TrendHive — Data Source Confidence & Proxy Annotation Layer

Every data source in TrendHive has a different reliability level.
This module makes that uncertainty explicit in every XAI output.
"""



DATA_CONFIDENCE = {
    
    "Rating": {
        "level": "HIGH",
        "source": "Google Places API (live)",
        "note": "Real-time crowd-sourced rating. High validity.",
    },
    "Reviews": {
        "level": "HIGH",
        "source": "Google Places API (live)",
        "note": "Live review count. Reliable engagement signal.",
    },
    "total_reviews": {
        "level": "HIGH",
        "source": "Google Places API (aggregated)",
        "note": "Sum of live review counts across cafes in area.",
    },
    "avg_rating": {
        "level": "HIGH",
        "source": "Google Places API (aggregated)",
        "note": "Area-level average of live Google ratings.",
    },
    "utility_cost_aed_month": {
        "level": "HIGH",
        "source": "DEWA official tariff schedule",
        "note": "Calculated from published electricity & water tariffs. Deterministic.",
    },
    "avg_utility_cost": {
        "level": "HIGH",
        "source": "DEWA official tariff schedule (aggregated)",
        "note": "Area-level average of tariff-based utility estimates.",
    },

    
    "sentiment_mean": {
        "level": "MEDIUM",
        "source": "Lexicon-based NLP on Google reviews",
        "note": "Estimated from review text using domain-tuned word lists. "
                "Not a verified customer satisfaction score.",
    },
    "avg_sentiment": {
        "level": "MEDIUM",
        "source": "Lexicon-based NLP (aggregated)",
        "note": "Area-level average of lexicon sentiment scores.",
    },
    "positive_ratio": {
        "level": "MEDIUM",
        "source": "Lexicon-based NLP classification",
        "note": "Proportion of reviews classified as positive by lexicon model.",
    },
    "avg_positive_ratio": {
        "level": "MEDIUM",
        "source": "Lexicon-based NLP classification (aggregated)",
        "note": "Area-level average positive review proportion.",
    },
    "tourist_index": {
        "level": "MEDIUM",
        "source": "POI density proxy (hotels, attractions, malls within 1,500m)",
        "note": "Proxy for tourism intensity. High POI density correlates with "
                "tourist presence but does not directly measure visitor counts.",
    },
    "avg_tourist_index": {
        "level": "MEDIUM",
        "source": "POI density proxy (aggregated)",
        "note": "Area-level average tourism intensity proxy.",
    },
    "avg_commercial_rent_aed_sqft_year": {
        "level": "MEDIUM",
        "source": "Real estate market report benchmark",
        "note": "Area-level benchmark rent. Not a per-unit lease quote. "
                "Actual rent will vary by property, size, and negotiation.",
    },
    "avg_rent": {
        "level": "MEDIUM",
        "source": "Real estate market report benchmark (aggregated)",
        "note": "Area-level average commercial rent estimate.",
    },
    "Cuisine_Primary": {
        "level": "MEDIUM",
        "source": "Rule-based classification from name/category tags",
        "note": "Deterministic mapping with fallback logic. "
                "May misclassify ambiguous or multi-cuisine businesses.",
    },
    "competitors_within_500m": {
        "level": "MEDIUM",
        "source": "Google Places spatial query (500m radius)",
        "note": "Count of other cafe-type businesses within 500m. "
                "Reflects Google data coverage, which may be incomplete.",
    },

    
    "Footfall_Score": {
        "level": "LOW",
        "source": "Composite proxy model (review count + tourist density "
                  "+ population density + commercial area weighting)",
        "note": "PROXY ESTIMATE. No direct footfall measurement was available. "
                "This score is derived from observable correlated signals. "
                "Treat as a relative ranking indicator, not an absolute count.",
    },
    "avg_footfall": {
        "level": "LOW",
        "source": "Composite proxy model (aggregated)",
        "note": "PROXY ESTIMATE. Area-level average of footfall proxy scores.",
    },
    "population_density_people_per_sqkm": {
        "level": "LOW",
        "source": "Static raster population dataset",
        "note": "Static baseline. Does not reflect real-time population movement "
                "or time-of-day variation. Used as a structural demand indicator.",
    },
    "avg_pop_density": {
        "level": "LOW",
        "source": "Static raster population dataset (aggregated)",
        "note": "Area-level average of static population density.",
    },
    "review_momentum": {
        "level": "LOW",
        "source": "Derived ratio (recent vs. older review counts)",
        "note": "Proxy for business growth trend. Based on relative review "
                "velocity from relative date strings, not absolute timestamps.",
    },
    "growth_class": {
        "level": "LOW",
        "source": "Review momentum classification (GROWING / STABLE / DECLINING)",
        "note": "Proxy classification. Reflects review activity pattern, "
                "not verified sales or revenue growth.",
    },
}



SCORE_CONFIDENCE = {
    "demand_score": {
        "level": "MEDIUM",
        "composition": "40% review volume (HIGH) + 30% footfall proxy (LOW) "
                       "+ 20% population density (LOW) + 10% tourist index (MEDIUM)",
        "caveat": "Demand score is pulled downward in reliability by the proxy-based "
                  "footfall and population components.",
    },
    "competition_intensity": {
        "level": "MEDIUM",
        "composition": "40% total cafes (HIGH) + 35% competitor density 500m (MEDIUM) "
                       "+ 25% saturation index (MEDIUM)",
        "caveat": "Saturation index is derived from review-share vs. cafe-share ratio, "
                  "which is a proxy for market efficiency, not a direct measure.",
    },
    "reputation_strength": {
        "level": "MEDIUM-HIGH",
        "composition": "40% avg rating (HIGH) + 35% sentiment score (MEDIUM) "
                       "+ 25% positive review ratio (MEDIUM)",
        "caveat": "Strongest composite score — anchored by live Google ratings.",
    },
    "growth_momentum": {
        "level": "LOW-MEDIUM",
        "composition": "50% pct_growing (LOW) + 50% avg_momentum (LOW)",
        "caveat": "Both components are derived from review date proxies. "
                  "Treat as directional indicator, not a verified growth measurement.",
    },
    "barrier_to_entry": {
        "level": "MEDIUM",
        "composition": "60% avg rent (MEDIUM) + 40% avg utility cost (HIGH)",
        "caveat": "Rent component is a market benchmark, not a guaranteed lease rate.",
    },
    "opportunity_score": {
        "level": "MEDIUM",
        "composition": "Weighted combination of all 6 composite scores per investor profile",
        "caveat": "Final opportunity score inherits the uncertainty of all component "
                  "scores. Treat as a comparative ranking tool, not an absolute measure.",
    },
    "sentiment_score": {
        "level": "MEDIUM",
        "composition": "Blended: 60% lexicon NLP + 40% star rating signal",
        "caveat": "Lexicon model uses curated word lists. Does not capture sarcasm, "
                  "context, or non-English reviews.",
    },
}



PROXY_DISCLAIMERS = {
    "footfall": (
        "⚠ Proxy Estimate: Footfall score is derived from observable correlated "
        "signals (review activity, tourism POI density, population statistics). "
        "No direct foot traffic measurement was used."
    ),
    "demand": (
        "⚠ Proxy Estimate: Demand score incorporates proxy-based footfall and "
        "population signals. It reflects relative demand potential, not absolute "
        "customer volume."
    ),
    "opportunity": (
        "⚠ Composite Estimate: Opportunity score is a weighted combination of "
        "proxy-derived sub-scores. Use as a comparative ranking tool. "
        "Validate against field observations before making investment decisions."
    ),
    "sentiment": (
        "⚠ Proxy NLP Estimate: Sentiment is derived from review text using a lexicon-based "
        "model. It reflects written review tone and may not capture the full customer "
        "experience."
    ),
    "growth": (
        "⚠ Proxy Signal: Growth classification is based on relative review velocity, "
        "not verified revenue or transaction data."
    ),
    "rent": (
        "⚠ Benchmark Estimate: Rent figures are area-level market benchmarks. "
        "Actual lease rates will vary by property specifications and negotiations."
    ),
}




def get_field_confidence(field_name: str) -> dict:
    """Returns confidence metadata for a specific data field."""
    return DATA_CONFIDENCE.get(field_name, {
        "level": "UNKNOWN",
        "source": "Unknown",
        "note": "No confidence metadata available for this field.",
    })


def get_score_confidence(score_name: str) -> dict:
    """Returns confidence metadata for a composite TrendHive score."""
    return SCORE_CONFIDENCE.get(score_name, {
        "level": "UNKNOWN",
        "composition": "Unknown",
        "caveat": "No confidence metadata available for this score.",
    })


def compute_composite_confidence(field_list: list) -> str:
    """
    Given a list of field names used in a score, compute an overall
    confidence level based on the weakest links.

    Returns: 'HIGH', 'MEDIUM-HIGH', 'MEDIUM', 'LOW-MEDIUM', or 'LOW'
    """
    level_scores = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "UNKNOWN": 0}
    levels = []
    for f in field_list:
        conf = DATA_CONFIDENCE.get(f, {})
        lvl = conf.get("level", "UNKNOWN")
        # Handle compound levels like 'MEDIUM-HIGH'
        if "-" in lvl:
            parts = lvl.split("-")
            scores = [level_scores.get(p, 0) for p in parts]
            levels.append(sum(scores) / len(scores))
        else:
            levels.append(level_scores.get(lvl, 0))

    if not levels:
        return "UNKNOWN"

    avg = sum(levels) / len(levels)
    low_count = sum(1 for l in levels if l <= 1)

    if low_count >= 2:
        return "LOW"
    if avg >= 2.7:
        return "HIGH"
    if avg >= 2.3:
        return "MEDIUM-HIGH"
    if avg >= 1.7:
        return "MEDIUM"
    return "LOW-MEDIUM"


def annotate_xai_output(xai_output: dict, fields_used: list,
                         score_type: str = None) -> dict:
    """
    Attaches confidence annotations to any XAI output dictionary.

    Args:
        xai_output:   The XAI result dict to annotate.
        fields_used:  List of field/column names that went into this output.
        score_type:   Optional — the composite score name (for SCORE_CONFIDENCE lookup).

    Returns:
        The same dict with 'confidence' key added.
    """
    field_annotations = {
        f: get_field_confidence(f) for f in fields_used if f in DATA_CONFIDENCE
    }
    overall = compute_composite_confidence(fields_used)

    confidence_block = {
        "overall_level": overall,
        "field_annotations": field_annotations,
    }
    if score_type:
        confidence_block["score_metadata"] = get_score_confidence(score_type)

    xai_output["confidence"] = confidence_block
    return xai_output
