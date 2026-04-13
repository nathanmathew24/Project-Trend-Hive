"""
xai_engine.py
TrendHive — Explainable AI Engine

Four classes that decompose and explain every score TrendHive produces.
Drop this file next to dubai_market_intelligence.py and dubai_cafe_api.py.

No ML retraining required. Works directly with:
  - outputs/area_metrics.csv
  - outputs/opportunity_metrics.csv
  - outputs/cleaned_business_level.csv
"""

import re
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple

from xai_confidence import (
    annotate_xai_output,
    PROXY_DISCLAIMERS,
    SCORE_CONFIDENCE,
)




def _safe_norm(value: float, min_val: float, max_val: float) -> float:
    """Normalise a value to [0, 1] using known dataset min/max."""
    if max_val - min_val < 1e-9:
        return 0.5
    return float(np.clip((value - min_val) / (max_val - min_val), 0.0, 1.0))



_AREA_RANGES = {
    "total_reviews":    (58.0,    123987.0),
    "avg_footfall":     (18.667,  40.0),
    "avg_pop_density":  (2678.7,  3355.6),
    "avg_tourist_index":(46.667,  100.0),
    "total_cafes":      (1.0,     60.0),      # approximate
    "competitor_density_norm": (0.0, 1.0),
    "saturation_index": (0.0,     3.0),
    "avg_rating":       (4.19,    4.80),
    "avg_sentiment":    (0.0,     1.0),
    "avg_positive_ratio": (0.5,   1.0),
    "pct_growing":      (0.0,     1.0),
    "avg_momentum":     (0.0,     3.0),
    "avg_rent":         (70.0,    300.0),
    "avg_utility_cost": (834.4,   1788.0),
    # Business-level
    "Reviews":          (0.0,     28873.0),
    "Footfall_Score":   (0.0,     40.0),
    "population_density_people_per_sqkm": (125.9, 3649.96),
    "tourist_index":    (0.0,     100.0),
    "avg_commercial_rent_aed_sqft_year": (70.0, 300.0),
    "utility_cost_aed_month": (834.4, 1788.0),
}

def _norm(value: float, field: str) -> float:
    lo, hi = _AREA_RANGES.get(field, (0.0, 1.0))
    return _safe_norm(value, lo, hi)




class ScoreDecomposer:
    """
    Decomposes TrendHive area-level composite scores into their weighted
    factor contributions.

    All weights are copied exactly from compute_area_performance() in
    dubai_market_intelligence.py so the decomposition is always consistent
    with how the score was actually computed.
    """

    

    DEMAND_FACTORS = {
        "Review Volume":      ("total_reviews",    0.40),
        "Footfall Proxy":     ("avg_footfall",     0.30),
        "Population Density": ("avg_pop_density",  0.20),
        "Tourist Index":      ("avg_tourist_index",0.10),
    }
    COMPETITION_FACTORS = {
        "Total Cafes in Area":     ("total_cafes",             0.40),
        "Competitor Density 500m": ("competitor_density_norm", 0.35),
        "Saturation Index":        ("saturation_index",        0.25),
    }
    REPUTATION_FACTORS = {
        "Average Rating":       ("avg_rating",         0.40),
        "Sentiment Score":      ("avg_sentiment",      0.35),
        "Positive Review %":    ("avg_positive_ratio", 0.25),
    }
    GROWTH_FACTORS = {
        "% Growing Businesses": ("pct_growing",   0.50),
        "Review Momentum":      ("avg_momentum",  0.50),
    }
    BARRIER_FACTORS = {
        "Commercial Rent":  ("avg_rent",          0.60),
        "Utility Costs":    ("avg_utility_cost",  0.40),
    }

    SCORE_MAP = {
        "demand":      DEMAND_FACTORS,
        "competition": COMPETITION_FACTORS,
        "reputation":  REPUTATION_FACTORS,
        "growth":      GROWTH_FACTORS,
        "barrier":     BARRIER_FACTORS,
    }

    def decompose(self, area_row: dict, score_type: str,
                  add_confidence: bool = True) -> dict:
        """
        Decompose a composite score for one area row.

        Args:
            area_row:       One row from area_metrics.csv as a dict.
            score_type:     One of: 'demand', 'competition', 'reputation',
                            'growth', 'barrier'.
            add_confidence: If True, attach confidence annotations.

        Returns:
            Dict with 'factors', 'top_driver', 'bottom_driver', 'score_type',
            and optional 'confidence' block.
        """
        factor_map = self.SCORE_MAP.get(score_type)
        if factor_map is None:
            raise ValueError(
                f"Unknown score_type '{score_type}'. "
                f"Choose from: {list(self.SCORE_MAP.keys())}"
            )

        factors = {}
        for label, (col, weight) in factor_map.items():
            raw = float(area_row.get(col, 0) or 0)
            norm = _norm(raw, col)
            weighted = weight * norm
            factors[label] = {
                "raw_value":      round(raw, 3),
                "normalised":     round(norm, 3),
                "weight":         weight,
                "contribution":   round(weighted, 4),
                "data_column":    col,
            }

        
        total_contribution = sum(f["contribution"] for f in factors.values())
        for label in factors:
            c = factors[label]["contribution"]
            factors[label]["pct_of_score"] = (
                round((c / total_contribution * 100), 1)
                if total_contribution > 0 else 0.0
            )

        
        ranked = sorted(factors.items(),
                        key=lambda x: x[1]["contribution"], reverse=True)

        result = {
            "score_type":     score_type,
            "area":           area_row.get("area", "Unknown"),
            "total_score":    round(total_contribution, 4),
            "factors":        dict(ranked),
            "top_driver":     ranked[0][0],
            "second_driver":  ranked[1][0] if len(ranked) > 1 else None,
            "bottom_driver":  ranked[-1][0],
        }

        if add_confidence:
            fields = [col for _, (col, _) in factor_map.items()]
            result = annotate_xai_output(result, fields, score_type=score_type)

        return result

    def decompose_all(self, area_row: dict) -> dict:
        """Decompose all five scores for a single area in one call."""
        return {
            score_type: self.decompose(area_row, score_type, add_confidence=True)
            for score_type in self.SCORE_MAP
        }



_POSITIVE_WORDS = set(
    "amazing awesome beautiful best brilliant calm charming clean cozy comfortable "
    "creative crispy decent delicious delightful divine elegant excellent exceptional "
    "exquisite fabulous fantastic favorite fine flavorful fluffy fragrant fresh friendly "
    "fulfilling generous genuine glorious good gorgeous gracious great happy hearty heavenly "
    "helpful honest incredible inviting irresistible juicy kind legendary lively love lovely "
    "luxurious magnificent marvelous memorable modern neat nice outstanding paradise peaceful "
    "perfect phenomenal pleasant polite premium professional pure quality recommended refined "
    "refreshing relaxing remarkable rich romantic satisfied savory scrumptious sensational "
    "smooth sophisticated sparkling special spectacular splendid stellar stunning sublime "
    "succulent superb superior supreme sweet tasty tender terrific thoughtful tremendous "
    "unforgettable unique vibrant warm welcoming wholesome wonderful yummy".split()
)
_NEGATIVE_WORDS = set(
    "abysmal annoying appalling atrocious awful bad bitter bland boring broken burnt cheap "
    "cold confusing crowded dangerous dark dated depressing dirty disappointing disgusting "
    "disorganized dreadful dry dull dusty expensive faded filthy flavorless freezing greasy "
    "grim gross horrible horrid icy ignorant impolite inadequate inedible inferior irritating "
    "lackluster mediocre messy moldy nasty neglected noisy obnoxious offensive old overcooked "
    "overpriced pathetic pitiful plain poor rancid raw revolting rotten rude salty shabby "
    "shady shameful shoddy sick slippery slow sloppy smelly soggy sour spoiled stale stingy "
    "stressful subpar tasteless terrible thick thin tired tough ugly unacceptable undercooked "
    "unfriendly unpleasant unsanitary unwelcoming vile vulgar watery weak worse worst".split()
)
_INTENSIFIERS = {
    "very": 1.5, "really": 1.4, "extremely": 1.8, "absolutely": 1.7,
    "incredibly": 1.6, "highly": 1.5, "super": 1.4, "so": 1.3,
    "too": 1.3, "most": 1.4, "totally": 1.4, "truly": 1.5,
}
_NEGATORS = {
    "not", "no", "never", "neither", "nor", "hardly", "barely",
    "don't", "doesn't", "didn't", "won't", "wouldn't", "couldn't",
    "shouldn't", "isn't", "aren't", "wasn't", "weren't",
}


class SentimentExplainer:
    """
    Explains what specific words drove the sentiment score for a review
    or for a whole cafe's review set.

    Works with the lexicon-based model already in TrendHive — no new
    dependencies required.
    """

    def score_with_explanation(self, text: str) -> dict:
        """
        Re-runs the lexicon sentiment scorer with full word-level tracking.
        Returns the score AND the per-word contributions.

        This is a drop-in replacement for lightweight_sentiment() that
        also returns the explanation data.
        """
        if not isinstance(text, str) or len(text.strip()) < 3:
            return {"score": 0.0, "word_contributions": [], "word_count": 0}

        words = re.findall(r"[\w'-]+", text.lower())
        score = 0.0
        word_contributions = []

        for i, w in enumerate(words):
            val = 0.0
            if w in _POSITIVE_WORDS:
                val = 1.0
            elif w in _NEGATIVE_WORDS:
                val = -1.0
            else:
                continue

            
            intensifier_used = None
            for j in range(max(0, i - 2), i):
                if words[j] in _INTENSIFIERS:
                    intensifier_used = words[j]
                    val *= _INTENSIFIERS[words[j]]
                    break

            
            negator_used = None
            for j in range(max(0, i - 3), i):
                if words[j] in _NEGATORS:
                    negator_used = words[j]
                    val *= -0.75
                    break

            score += val
            word_contributions.append({
                "word":         w,
                "base_polarity": "positive" if val > 0 else "negative",
                "contribution": round(val, 3),
                "intensifier":  intensifier_used,
                "negator":      negator_used,
            })

        
        word_contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)

        count = len(word_contributions)
        final_score = max(-1.0, min(1.0, score / count)) if count > 0 else 0.0

        return {
            "score":             round(final_score, 3),
            "word_contributions": word_contributions,
            "word_count":        count,
            "top_positive":      [x["word"] for x in word_contributions if x["contribution"] > 0][:3],
            "top_negative":      [x["word"] for x in word_contributions if x["contribution"] < 0][:3],
        }

    def explain_review(self, review_text: str, review_rating: float = None) -> dict:
        """
        Full explanation for a single review — text analysis + star context.
        """
        analysis = self.score_with_explanation(review_text)
        blended = analysis["score"]

        if review_rating is not None:
            star_sent = (review_rating - 3) / 2
            if len(review_text.strip()) > 20:
                blended = round(0.6 * analysis["score"] + 0.4 * star_sent, 3)
            else:
                blended = round(star_sent, 3)

        label = ("positive" if blended > 0.2
                 else "negative" if blended < -0.2
                 else "neutral")

        result = {
            "review_snippet":    review_text[:150].strip() + ("..." if len(review_text) > 150 else ""),
            "blended_score":     blended,
            "sentiment_label":   label,
            "text_score":        analysis["score"],
            "star_rating":       review_rating,
            "top_positive_words": analysis["top_positive"],
            "top_negative_words": analysis["top_negative"],
            "words_analyzed":    analysis["word_count"],
            "method":            "60% lexicon NLP + 40% star rating" if review_rating else "lexicon NLP only",
            "proxy_note":        PROXY_DISCLAIMERS["sentiment"],
        }
        return result

    def explain_cafe_sentiment(self, cafe_row: dict) -> dict:
        """
        Aggregate sentiment explanation for a whole cafe using pre-computed
        sentiment columns from cleaned_business_level.csv.
        """
        name          = cafe_row.get("Name", "Unknown")
        score         = float(cafe_row.get("sentiment_mean", 0) or 0)
        positive_pct  = float(cafe_row.get("positive_ratio", 0.5) or 0.5) * 100
        negative_pct  = float(cafe_row.get("negative_ratio", 0) or 0) * 100
        review_count  = int(cafe_row.get("Reviews", 0) or 0)
        std           = float(cafe_row.get("sentiment_std", 0) or 0)

        label = ("positive" if score > 0.2
                 else "negative" if score < -0.2
                 else "neutral")

        consistency = ("highly consistent" if std < 0.15
                       else "mostly consistent" if std < 0.35
                       else "mixed / polarised")

        result = {
            "cafe":                name,
            "overall_label":       label,
            "sentiment_score":     round(score, 3),
            "positive_review_pct": round(positive_pct, 1),
            "negative_review_pct": round(negative_pct, 1),
            "review_consistency":  consistency,
            "reviews_analyzed":    review_count,
            "proxy_note":          PROXY_DISCLAIMERS["sentiment"],
        }
        return annotate_xai_output(result, ["sentiment_mean", "positive_ratio"],
                                   score_type="sentiment_score")




class OpportunityExplainer:
    """
    Produces per-profile, per-area opportunity score breakdowns.

    Weights are copied exactly from OpportunityScorer.PROFILES in
    dubai_market_intelligence.py so the explanations are always
    consistent with the actual scores.
    """

    PROFILES = {
        "budget_cautious": {
            "label":       "Budget-Conscious, Low-Competition Seeker",
            "description": "Affordable areas with low competition and manageable startup costs.",
            "weights": {
                "demand_score":        0.20,
                "competition_intensity": -0.30,
                "price_level_index":   -0.15,
                "reputation_strength":  0.10,
                "growth_momentum":      0.10,
                "barrier_to_entry":    -0.15,
            },
        },
        "premium_concept": {
            "label":       "Premium Concept in High-Demand Area",
            "description": "High-end concept thriving in prestigious, high-foot-traffic areas.",
            "weights": {
                "demand_score":          0.30,
                "competition_intensity": -0.10,
                "price_level_index":      0.15,
                "reputation_strength":    0.20,
                "growth_momentum":        0.15,
                "barrier_to_entry":      -0.10,
            },
        },
        "growth_hunter": {
            "label":       "Trend-Driven High-Growth Seeker",
            "description": "Emerging areas with strong growth trajectory and room to grow.",
            "weights": {
                "demand_score":          0.15,
                "competition_intensity": -0.15,
                "price_level_index":      0.00,
                "reputation_strength":    0.15,
                "growth_momentum":        0.35,
                "barrier_to_entry":      -0.20,
            },
        },
        "balanced_investor": {
            "label":       "Balanced Risk-Return Investor",
            "description": "Well-rounded opportunity with moderate risk.",
            "weights": {
                "demand_score":          0.25,
                "competition_intensity": -0.20,
                "price_level_index":      0.00,
                "reputation_strength":    0.20,
                "growth_momentum":        0.20,
                "barrier_to_entry":      -0.15,
            },
        },
        "tourist_focused": {
            "label":       "Tourist-Traffic Focused Concept",
            "description": "Targeting tourists and visitors; foot traffic is king.",
            "weights": {
                "demand_score":          0.25,
                "competition_intensity": -0.05,
                "price_level_index":      0.10,
                "reputation_strength":    0.15,
                "growth_momentum":        0.10,
                "barrier_to_entry":      -0.10,
            },
            
            "extra_boost": {"avg_tourist_index": 0.25},
        },
    }

    
    DIMENSION_LABELS = {
        "demand_score":          "Market Demand",
        "competition_intensity": "Competition Level",
        "price_level_index":     "Price Positioning",
        "reputation_strength":   "Area Reputation",
        "growth_momentum":       "Growth Momentum",
        "barrier_to_entry":      "Cost of Entry (Rent + Utilities)",
    }

    def explain(self, area_row: dict, profile_name: str,
                add_confidence: bool = True) -> dict:
        """
        Full opportunity score explanation for one area + investor profile.

        Args:
            area_row:       Row from area_metrics or opportunity_metrics as dict.
            profile_name:   One of the five profile keys.
            add_confidence: Attach confidence annotations if True.

        Returns:
            Structured explanation with factor breakdown, top advantages,
            top concerns, and natural-language summary.
        """
        if profile_name not in self.PROFILES:
            raise ValueError(
                f"Unknown profile '{profile_name}'. "
                f"Choose from: {list(self.PROFILES.keys())}"
            )

        profile = self.PROFILES[profile_name]
        weights = profile["weights"]
        area    = area_row.get("area", "Unknown")

        breakdown = []
        for dim, weight in weights.items():
            val  = float(area_row.get(dim, 0) or 0)
            contrib = weight * val
            breakdown.append({
                "dimension":       dim,
                "label":           self.DIMENSION_LABELS.get(dim, dim),
                "raw_score":       round(val, 3),
                "profile_weight":  weight,
                "contribution":    round(contrib, 4),
                "impact":          "advantage" if contrib > 0 else "concern",
                "impact_str":      (f"+{contrib:.3f}" if contrib >= 0
                                    else f"{contrib:.3f}"),
            })

        
        if "extra_boost" in profile:
            for raw_col, boost_weight in profile["extra_boost"].items():
                raw_val = float(area_row.get(raw_col, 0) or 0)
                norm_val = _norm(raw_val, raw_col)
                contrib  = norm_val * boost_weight
                breakdown.append({
                    "dimension":      raw_col,
                    "label":          "Tourist Traffic Boost",
                    "raw_score":      round(raw_val, 3),
                    "profile_weight": boost_weight,
                    "contribution":   round(contrib, 4),
                    "impact":         "advantage" if contrib > 0 else "concern",
                    "impact_str":     f"+{contrib:.3f}",
                    "note":           "Extra boost applied for tourist-focused profile",
                })

        breakdown.sort(key=lambda x: abs(x["contribution"]), reverse=True)

        advantages = [b for b in breakdown if b["impact"] == "advantage"]
        concerns   = [b for b in breakdown if b["impact"] == "concern"]

        result = {
            "area":              area,
            "profile":           profile_name,
            "profile_label":     profile["label"],
            "profile_description": profile["description"],
            "opportunity_score": round(float(area_row.get("opportunity_score", 0) or 0), 1),
            "market_positioning": area_row.get("market_positioning", "N/A"),
            "top_advantages":    advantages[:3],
            "top_concerns":      concerns[:3],
            "full_breakdown":    breakdown,
            "strengths_text":    area_row.get("strengths", ""),
            "risks_text":        area_row.get("risks", ""),
            "proxy_note":        PROXY_DISCLAIMERS["opportunity"],
        }

        if add_confidence:
            fields = list(weights.keys()) + ["avg_tourist_index"]
            result = annotate_xai_output(result, fields, score_type="opportunity_score")

        return result




class NLExplanationGenerator:
    """
    Generates natural-language explanations from structured XAI breakdowns.

    All output text explicitly acknowledges proxy-based estimates.
    Intended for: dashboard tooltips, Aria chatbot, PDF report summaries.
    """

    
    @staticmethod
    def _score_label(score: float) -> str:
        if score >= 0.75: return "very high"
        if score >= 0.55: return "high"
        if score >= 0.40: return "moderate"
        if score >= 0.25: return "low"
        return "very low"

    @staticmethod
    def _rent_label(rent_aed: float) -> str:
        if rent_aed >= 250: return f"premium (AED {rent_aed:.0f}/sqft/yr)"
        if rent_aed >= 150: return f"moderate (AED {rent_aed:.0f}/sqft/yr)"
        return f"affordable (AED {rent_aed:.0f}/sqft/yr)"

    def area_summary(self, area_name: str, area_row: dict,
                     demand_xai: dict = None,
                     opp_xai: dict = None) -> str:
        """
        1–3 sentence summary of an area for dashboard tooltip or chatbot response.
        """
        positioning = area_row.get("market_positioning", "N/A")
        demand      = float(area_row.get("demand_score", 0) or 0)
        competition = float(area_row.get("competition_intensity", 0) or 0)
        rep         = float(area_row.get("reputation_strength", 0) or 0)
        rent        = float(area_row.get("avg_rent", 0) or 0)
        total_cafes = int(area_row.get("total_cafes", 0) or 0)

        d_label = self._score_label(demand)
        c_label = self._score_label(competition)
        r_label = self._score_label(rep)

        text = (
            f"{area_name} is classified as a '{positioning}' market. "
            f"It has {d_label} consumer demand and {c_label} competition intensity "
            f"across {total_cafes} cafes. "
            f"Area reputation is {r_label} based on ratings and customer sentiment. "
        )

        if rent > 0:
            text += f"Commercial rent is {self._rent_label(rent)}. "

        if demand_xai:
            driver = demand_xai.get("top_driver", "")
            if driver:
                text += f"Demand is primarily driven by {driver.lower()}. "

        text += PROXY_DISCLAIMERS["demand"]
        return text

    def opportunity_summary(self, area_name: str, opp_xai: dict) -> str:
        """
        Explanation of an opportunity score for a specific investor profile.
        """
        score      = opp_xai.get("opportunity_score", 0)
        profile    = opp_xai.get("profile_label", "your selected profile")
        positioning = opp_xai.get("market_positioning", "N/A")
        advantages = opp_xai.get("top_advantages", [])
        concerns   = opp_xai.get("top_concerns", [])

        text = (
            f"{area_name} scores {score:.1f}/100 for the '{profile}' profile. "
            f"The area's market classification is '{positioning}'. "
        )

        if advantages:
            adv_str = ", ".join(a["label"] for a in advantages[:2])
            text += f"Key advantages: {adv_str}. "

        if concerns:
            con_str = ", ".join(c["label"] for c in concerns[:2])
            text += f"Main concerns: {con_str}. "

        text += "\n" + PROXY_DISCLAIMERS["opportunity"]
        return text

    def cafe_summary(self, cafe_name: str, cafe_row: dict) -> str:
        """
        1–2 sentence summary of a single cafe for the business detail page.
        """
        rating      = float(cafe_row.get("Rating", 0) or 0)
        reviews     = int(cafe_row.get("Reviews", 0) or 0)
        sentiment   = float(cafe_row.get("sentiment_mean", 0) or 0)
        footfall    = float(cafe_row.get("Footfall_Score", 0) or 0)
        competitors = int(cafe_row.get("competitors_within_500m", 0) or 0)
        growth      = str(cafe_row.get("growth_class", "UNKNOWN"))
        cuisine     = str(cafe_row.get("Cuisine_Primary", ""))

        s_label = ("positive" if sentiment > 0.2
                   else "negative" if sentiment < -0.2
                   else "neutral")

        growth_phrases = {
            "GROWING":  "showing growing review momentum",
            "STABLE":   "showing stable review activity",
            "DECLINING":"showing declining review activity",
            "UNKNOWN":  "with unknown trend data",
        }
        growth_text = growth_phrases.get(growth, growth)

        text = (
            f"{cafe_name} is a {cuisine} cafe with a Google rating of "
            f"{rating}/5 from {reviews:,} reviews, and {s_label} customer "
            f"sentiment. "
            f"It operates in an area with {competitors} competitors within 500m, "
            f"{growth_text}. "
            f"Estimated footfall score: {footfall:.0f}/100 "
            f"(proxy-based estimate, not a direct measurement)."
        )
        return text

    def sentiment_summary(self, cafe_name: str, sent_xai: dict) -> str:
        """
        Explains the sentiment score for a cafe with word-level attribution.
        """
        label    = sent_xai.get("overall_label", "neutral")
        score    = sent_xai.get("sentiment_score", 0)
        pos_pct  = sent_xai.get("positive_review_pct", 50)
        pos_words = sent_xai.get("top_positive_words", [])  # from review-level
        neg_words = sent_xai.get("top_negative_words", [])
        reviews  = sent_xai.get("reviews_analyzed", 0)

        text = (
            f"{cafe_name} has {label} customer sentiment "
            f"(score: {score:.2f}/1.0) across {reviews:,} reviewed interactions. "
            f"{pos_pct:.0f}% of analyzed reviews are classified as positive. "
        )
        if pos_words:
            text += f"Positive signals driven by words like: {', '.join(pos_words)}. "
        if neg_words:
            text += f"Negative signals include: {', '.join(neg_words)}. "
        text += "\n" + PROXY_DISCLAIMERS["sentiment"]
        return text

    def chatbot_area_response(self, area_name: str, area_row: dict,
                               demand_xai: dict, opp_xai: dict,
                               profile_name: str) -> str:
        """
        Full chatbot-style response about an area — used by Aria.
        """
        opp_score   = opp_xai.get("opportunity_score", 0)
        positioning = area_row.get("market_positioning", "N/A")
        advantages  = opp_xai.get("top_advantages", [])
        concerns    = opp_xai.get("top_concerns", [])
        demand_driver = demand_xai.get("top_driver", "review volume")
        total_cafes = int(area_row.get("total_cafes", 0) or 0)
        avg_rating  = float(area_row.get("avg_rating", 0) or 0)
        avg_rent    = float(area_row.get("avg_rent", 0) or 0)
        avg_footfall = float(area_row.get("avg_footfall", 0) or 0)

        lines = [
            f"📍 {area_name} — Market Analysis",
            f"",
            f"Classification: {positioning}",
            f"Opportunity Score: {opp_score:.1f}/100 ({profile_name.replace('_', ' ').title()} profile)",
            f"",
            f"WHY THIS SCORE?",
        ]

        if advantages:
            lines.append("✅ Works in your favour:")
            for a in advantages[:3]:
                lines.append(
                    f"   • {a['label']} (weight: {abs(a['profile_weight']):.0%}) "
                    f"→ score {a['raw_score']:.2f}"
                )

        if concerns:
            lines.append("❌ Works against:")
            for c in concerns[:3]:
                lines.append(
                    f"   • {c['label']} (weight: {abs(c['profile_weight']):.0%}) "
                    f"→ score {c['raw_score']:.2f}"
                )

        lines += [
            "",
            f"KEY METRICS:",
            f"   • Cafes in area: {total_cafes}",
            f"   • Avg Google rating: {avg_rating:.1f}/5",
            f"   • Est. avg footfall score: {avg_footfall:.0f}/100",
            f"   • Commercial rent: AED {avg_rent:.0f}/sqft/yr",
            f"   • Demand driven by: {demand_driver}",
            "",
            PROXY_DISCLAIMERS["demand"],
        ]

        return "\n".join(lines)
