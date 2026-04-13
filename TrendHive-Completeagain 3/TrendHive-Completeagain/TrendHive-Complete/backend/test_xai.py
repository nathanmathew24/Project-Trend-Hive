"""
test_xai.py
TrendHive — XAI Engine Unit Tests

Run from the project root:
    python test_xai.py

Tests verify:
  - Score decompositions are deterministic
  - Factor percentages sum to 100%
  - All expected keys are present in outputs
  - Confidence annotations are attached
  - NL explanations contain required disclaimer text
  - Real data from area_metrics.csv and cleaned_business_level.csv loads correctly
"""

import sys
import unittest
import pandas as pd
import numpy as np
import os



sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from xai_engine import ScoreDecomposer, SentimentExplainer, OpportunityExplainer, NLExplanationGenerator
from xai_confidence import (
    get_field_confidence, get_score_confidence,
    compute_composite_confidence, annotate_xai_output,
    PROXY_DISCLAIMERS, DATA_CONFIDENCE,
)




def _load_data():
    """Load real pipeline outputs for testing."""
    base = os.path.dirname(os.path.abspath(__file__))
    area_path = os.path.join(base, "outputs", "area_metrics.csv")
    biz_path  = os.path.join(base, "outputs", "cleaned_business_level.csv")
    opp_path  = os.path.join(base, "outputs", "opportunity_metrics.csv")

    area_df = pd.read_csv(area_path) if os.path.exists(area_path) else pd.DataFrame()
    biz_df  = pd.read_csv(biz_path)  if os.path.exists(biz_path)  else pd.DataFrame()
    opp_df  = pd.read_csv(opp_path)  if os.path.exists(opp_path)  else pd.DataFrame()
    return area_df, biz_df, opp_df


_area_df, _biz_df, _opp_df = _load_data()


_MOCK_AREA_ROW = {
    "area":                    "Downtown Dubai",
    "total_reviews":           85000.0,
    "avg_footfall":            38.5,
    "avg_pop_density":         3200.0,
    "avg_tourist_index":       95.0,
    "total_cafes":             35.0,
    "competitor_density_norm": 0.75,
    "saturation_index":        1.2,
    "avg_rating":              4.6,
    "avg_sentiment":           0.78,
    "avg_positive_ratio":      0.89,
    "pct_growing":             0.72,
    "avg_momentum":            1.8,
    "avg_rent":                250.0,
    "avg_utility_cost":        1600.0,
    "demand_score":            0.85,
    "competition_intensity":   0.45,
    "reputation_strength":     0.80,
    "growth_momentum":         0.75,
    "barrier_to_entry":        0.90,
    "market_positioning":      "Saturated High-Demand",
    "market_balance":          0.62,
    "strengths":               "High consumer demand; Tourist-heavy traffic",
    "risks":                   "High competition density; High rent & utility costs",
}

_MOCK_CAFE_ROW = {
    "Name":              "Joe's Café Dubai",
    "area":              "Downtown Dubai",
    "Rating":            4.9,
    "Reviews":           24431,
    "Footfall_Score":    40.0,
    "tourist_index":     100.0,
    "population_density_people_per_sqkm": 3354.6,
    "competitors_within_500m": 44,
    "sentiment_mean":    1.0,
    "sentiment_std":     0.0,
    "positive_ratio":    1.0,
    "negative_ratio":    0.0,
    "review_momentum":   2.0,
    "growth_class":      "GROWING",
    "avg_commercial_rent_aed_sqft_year": 250.0,
    "utility_cost_aed_month": 1788.0,
    "Cuisine_Primary":   "cafe",
    "price_index":       2.0,
    "Place_ID":          "ChIJAQAAMChoXz4RuJzcBOap9Mk",
}


def _get_area_row(area_name="Downtown Dubai"):
    """Return a real area row or fall back to mock."""
    if not _area_df.empty:
        m = _area_df[_area_df["area"].str.lower() == area_name.lower()]
        if not m.empty:
            return m.iloc[0].to_dict()
    return _MOCK_AREA_ROW.copy()


def _get_opp_row(area_name="Downtown Dubai", profile="balanced_investor"):
    """Return real opportunity row merged with area row."""
    area_row = _get_area_row(area_name)
    if not _opp_df.empty:
        m = _opp_df[
            (_opp_df["area"].str.lower() == area_name.lower()) &
            (_opp_df["profile"] == profile)
        ]
        if not m.empty:
            return {**area_row, **m.iloc[0].to_dict()}
    area_row["opportunity_score"] = 75.0
    return area_row


def _get_cafe_row():
    """Return first real cafe row or fall back to mock."""
    if not _biz_df.empty:
        return _biz_df.iloc[0].to_dict()
    return _MOCK_CAFE_ROW.copy()




class TestConfidenceModule(unittest.TestCase):

    def test_all_key_fields_registered(self):
        """Every major TrendHive column should have a confidence entry."""
        required = [
            "Rating", "Reviews", "Footfall_Score", "tourist_index",
            "population_density_people_per_sqkm", "avg_commercial_rent_aed_sqft_year",
            "utility_cost_aed_month", "sentiment_mean",
        ]
        for field in required:
            self.assertIn(field, DATA_CONFIDENCE,
                          f"Missing confidence entry for '{field}'")

    def test_field_confidence_returns_dict(self):
        conf = get_field_confidence("Rating")
        self.assertIn("level", conf)
        self.assertIn("source", conf)
        self.assertEqual(conf["level"], "HIGH")

    def test_unknown_field_returns_safe_default(self):
        conf = get_field_confidence("nonexistent_column_xyz")
        self.assertEqual(conf["level"], "UNKNOWN")

    def test_composite_confidence_low_when_two_low_fields(self):
        result = compute_composite_confidence(
            ["Footfall_Score", "population_density_people_per_sqkm", "Rating"]
        )
        self.assertEqual(result, "LOW",
                         f"Expected LOW with two proxy fields, got {result}")

    def test_composite_confidence_high_for_live_fields(self):
        result = compute_composite_confidence(["Rating", "Reviews", "utility_cost_aed_month"])
        self.assertIn(result, ["HIGH", "MEDIUM-HIGH"])

    def test_annotate_xai_output_adds_confidence_key(self):
        output = {"score": 0.8}
        annotated = annotate_xai_output(output, ["Rating", "Reviews"], "demand")
        self.assertIn("confidence", annotated)
        self.assertIn("overall_level", annotated["confidence"])
        self.assertIn("field_annotations", annotated["confidence"])

    def test_proxy_disclaimers_present(self):
        for key in ["footfall", "demand", "opportunity", "sentiment", "growth", "rent"]:
            self.assertIn(key, PROXY_DISCLAIMERS)
            self.assertGreater(len(PROXY_DISCLAIMERS[key]), 20)




class TestScoreDecomposer(unittest.TestCase):

    def setUp(self):
        self.decomposer = ScoreDecomposer()
        self.area_row   = _get_area_row("Downtown Dubai")

    def test_demand_decomposition_keys(self):
        result = self.decomposer.decompose(self.area_row, "demand")
        self.assertIn("factors", result)
        self.assertIn("top_driver", result)
        self.assertIn("bottom_driver", result)
        self.assertIn("score_type", result)
        self.assertEqual(result["score_type"], "demand")

    def test_demand_factors_sum_to_100_pct(self):
        result = self.decomposer.decompose(self.area_row, "demand",
                                            add_confidence=False)
        total_pct = sum(f["pct_of_score"] for f in result["factors"].values())
        self.assertAlmostEqual(total_pct, 100.0, delta=1.0,
                               msg=f"Factor percentages should sum to ~100, got {total_pct}")

    def test_competition_decomposition_keys(self):
        result = self.decomposer.decompose(self.area_row, "competition")
        factors = result["factors"]
        expected = {"Total Cafes in Area", "Competitor Density 500m", "Saturation Index"}
        self.assertTrue(expected.issubset(set(factors.keys())))

    def test_reputation_decomposition_keys(self):
        result = self.decomposer.decompose(self.area_row, "reputation")
        factors = result["factors"]
        expected = {"Average Rating", "Sentiment Score", "Positive Review %"}
        self.assertTrue(expected.issubset(set(factors.keys())))

    def test_growth_decomposition_keys(self):
        result = self.decomposer.decompose(self.area_row, "growth")
        factors = result["factors"]
        expected = {"% Growing Businesses", "Review Momentum"}
        self.assertTrue(expected.issubset(set(factors.keys())))

    def test_barrier_decomposition_keys(self):
        result = self.decomposer.decompose(self.area_row, "barrier")
        factors = result["factors"]
        expected = {"Commercial Rent", "Utility Costs"}
        self.assertTrue(expected.issubset(set(factors.keys())))

    def test_invalid_score_type_raises(self):
        with self.assertRaises(ValueError):
            self.decomposer.decompose(self.area_row, "nonexistent_score")

    def test_confidence_block_attached(self):
        result = self.decomposer.decompose(self.area_row, "demand", add_confidence=True)
        self.assertIn("confidence", result)

    def test_no_confidence_when_disabled(self):
        result = self.decomposer.decompose(self.area_row, "demand", add_confidence=False)
        self.assertNotIn("confidence", result)

    def test_decompose_all_returns_five_scores(self):
        result = self.decomposer.decompose_all(self.area_row)
        expected_keys = {"demand", "competition", "reputation", "growth", "barrier"}
        self.assertEqual(set(result.keys()), expected_keys)

    def test_deterministic(self):
        """Same input always produces same output."""
        r1 = self.decomposer.decompose(self.area_row, "demand", add_confidence=False)
        r2 = self.decomposer.decompose(self.area_row, "demand", add_confidence=False)
        self.assertEqual(r1["top_driver"], r2["top_driver"])
        self.assertAlmostEqual(r1["total_score"], r2["total_score"], places=6)

    def test_all_areas_in_dataset(self):
        """Run decomposer on every real area row without errors."""
        if _area_df.empty:
            self.skipTest("No area_metrics.csv found")
        errors = []
        for _, row in _area_df.iterrows():
            try:
                self.decomposer.decompose_all(row.to_dict())
            except Exception as e:
                errors.append(f"{row['area']}: {e}")
        self.assertEqual(errors, [], f"Decomposition failed for: {errors}")




class TestSentimentExplainer(unittest.TestCase):

    def setUp(self):
        self.explainer = SentimentExplainer()

    def test_positive_review_positive_score(self):
        result = self.explainer.score_with_explanation(
            "Absolutely amazing coffee, incredibly warm and welcoming atmosphere!"
        )
        self.assertGreater(result["score"], 0.0)
        self.assertGreater(len(result["top_positive"]), 0)

    def test_negative_review_negative_score(self):
        result = self.explainer.score_with_explanation(
            "Terrible service, cold food, very dirty tables. Awful experience."
        )
        self.assertLess(result["score"], 0.0)
        self.assertGreater(len(result["top_negative"]), 0)

    def test_negator_flips_polarity(self):
        pos = self.explainer.score_with_explanation("The coffee was good.")
        neg = self.explainer.score_with_explanation("The coffee was not good.")
        # 'not good' should score lower than 'good'
        self.assertGreater(pos["score"], neg["score"])

    def test_empty_text_returns_zero(self):
        result = self.explainer.score_with_explanation("")
        self.assertEqual(result["score"], 0.0)

    def test_explain_review_keys(self):
        result = self.explainer.explain_review(
            "Delicious pastries and great coffee.", review_rating=5.0
        )
        for key in ["review_snippet", "blended_score", "sentiment_label",
                    "top_positive_words", "proxy_note"]:
            self.assertIn(key, result)

    def test_explain_review_label_positive(self):
        result = self.explainer.explain_review(
            "Superb coffee and excellent service!", review_rating=5.0
        )
        self.assertEqual(result["sentiment_label"], "positive")

    def test_explain_cafe_sentiment_keys(self):
        cafe_row = _get_cafe_row()
        result = self.explainer.explain_cafe_sentiment(cafe_row)
        for key in ["cafe", "overall_label", "sentiment_score",
                    "positive_review_pct", "proxy_note", "confidence"]:
            self.assertIn(key, result)

    def test_proxy_disclaimer_in_output(self):
        cafe_row = _get_cafe_row()
        result = self.explainer.explain_cafe_sentiment(cafe_row)
        self.assertIn("Proxy", result["proxy_note"],
                      "Proxy disclaimer missing from sentiment output")

    def test_all_real_cafes(self):
        """Run sentiment explainer on all real cafe rows."""
        if _biz_df.empty:
            self.skipTest("No cleaned_business_level.csv found")
        errors = []
        for _, row in _biz_df.iterrows():
            try:
                self.explainer.explain_cafe_sentiment(row.to_dict())
            except Exception as e:
                errors.append(f"{row.get('Name', '?')}: {e}")
        self.assertEqual(errors, [], f"Sentiment failed for: {errors[:5]}")




class TestOpportunityExplainer(unittest.TestCase):

    def setUp(self):
        self.explainer  = OpportunityExplainer()
        self.area_row   = _get_opp_row("Downtown Dubai", "balanced_investor")

    def test_explain_keys_present(self):
        result = self.explainer.explain(self.area_row, "balanced_investor")
        for key in ["area", "profile", "profile_label", "opportunity_score",
                    "top_advantages", "top_concerns", "full_breakdown",
                    "proxy_note"]:
            self.assertIn(key, result)

    def test_advantages_all_positive_impact(self):
        result = self.explainer.explain(self.area_row, "balanced_investor")
        for adv in result["top_advantages"]:
            self.assertEqual(adv["impact"], "advantage")

    def test_concerns_all_negative_impact(self):
        result = self.explainer.explain(self.area_row, "balanced_investor")
        for con in result["top_concerns"]:
            self.assertEqual(con["impact"], "concern")

    def test_invalid_profile_raises(self):
        with self.assertRaises(ValueError):
            self.explainer.explain(self.area_row, "nonexistent_profile")

    def test_all_profiles_work(self):
        area_row = _get_area_row("Downtown Dubai")
        errors = []
        for profile_name in self.explainer.PROFILES:
            opp_row = _get_opp_row("Downtown Dubai", profile_name)
            try:
                self.explainer.explain(opp_row, profile_name)
            except Exception as e:
                errors.append(f"{profile_name}: {e}")
        self.assertEqual(errors, [])

    def test_confidence_attached(self):
        result = self.explainer.explain(self.area_row, "balanced_investor",
                                         add_confidence=True)
        self.assertIn("confidence", result)

    def test_tourist_focused_has_extra_boost(self):
        """tourist_focused profile should have an extra boost factor."""
        opp_row = _get_opp_row("JBR", "tourist_focused")
        result  = self.explainer.explain(opp_row, "tourist_focused")
        labels  = [b["label"] for b in result["full_breakdown"]]
        self.assertIn("Tourist Traffic Boost", labels,
                      "tourist_focused profile missing extra boost factor")




class TestNLExplanationGenerator(unittest.TestCase):

    def setUp(self):
        self.decomposer = ScoreDecomposer()
        self.opp_exp    = OpportunityExplainer()
        self.nl_gen     = NLExplanationGenerator()
        self.area_row   = _get_area_row("Downtown Dubai")
        self.cafe_row   = _get_cafe_row()

    def test_area_summary_is_string(self):
        result = self.nl_gen.area_summary("Downtown Dubai", self.area_row)
        self.assertIsInstance(result, str)
        self.assertGreater(len(result), 50)

    def test_area_summary_contains_proxy_disclaimer(self):
        result = self.nl_gen.area_summary("Downtown Dubai", self.area_row)
        self.assertIn("proxy", result.lower(),
                      "Area summary must contain proxy disclaimer")

    def test_area_summary_contains_area_name(self):
        result = self.nl_gen.area_summary("JBR", _get_area_row("JBR"))
        self.assertIn("JBR", result)

    def test_cafe_summary_is_string(self):
        result = self.nl_gen.cafe_summary("Joe's Café", self.cafe_row)
        self.assertIsInstance(result, str)

    def test_cafe_summary_contains_footfall_note(self):
        result = self.nl_gen.cafe_summary("Joe's Café", self.cafe_row)
        self.assertIn("proxy", result.lower(),
                      "Cafe summary must mention proxy footfall estimate")

    def test_opportunity_summary_is_string(self):
        opp_row = _get_opp_row("Downtown Dubai", "balanced_investor")
        opp_xai = self.opp_exp.explain(opp_row, "balanced_investor")
        result  = self.nl_gen.opportunity_summary("Downtown Dubai", opp_xai)
        self.assertIsInstance(result, str)

    def test_opportunity_summary_contains_score(self):
        opp_row = _get_opp_row("Downtown Dubai", "balanced_investor")
        opp_xai = self.opp_exp.explain(opp_row, "balanced_investor")
        result  = self.nl_gen.opportunity_summary("Downtown Dubai", opp_xai)
        score   = str(int(opp_xai["opportunity_score"]))
        self.assertIn(score, result, f"Score {score} missing from summary")

    def test_chatbot_response_contains_area_name(self):
        demand_xai = self.decomposer.decompose(self.area_row, "demand")
        opp_row    = _get_opp_row("Downtown Dubai", "balanced_investor")
        opp_xai    = self.opp_exp.explain(opp_row, "balanced_investor")
        result     = self.nl_gen.chatbot_area_response(
            "Downtown Dubai", self.area_row, demand_xai, opp_xai, "balanced_investor"
        )
        self.assertIn("Downtown Dubai", result)

    def test_chatbot_response_contains_disclaimer(self):
        demand_xai = self.decomposer.decompose(self.area_row, "demand")
        opp_row    = _get_opp_row("Downtown Dubai", "balanced_investor")
        opp_xai    = self.opp_exp.explain(opp_row, "balanced_investor")
        result     = self.nl_gen.chatbot_area_response(
            "Downtown Dubai", self.area_row, demand_xai, opp_xai, "balanced_investor"
        )
        self.assertIn("Proxy", result,
                      "Chatbot response must include proxy disclaimer")




if __name__ == "__main__":
    
    print("=" * 65)
    print("  TrendHive XAI Engine — Unit Tests")
    print("=" * 65)

    data_status = []
    data_status.append(f"  area_metrics.csv:          {'✓ loaded' if not _area_df.empty else '✗ not found (using mock data)'}")
    data_status.append(f"  cleaned_business_level.csv:{'✓ loaded' if not _biz_df.empty else '✗ not found (using mock data)'}")
    data_status.append(f"  opportunity_metrics.csv:   {'✓ loaded' if not _opp_df.empty else '✗ not found (using mock data)'}")
    print("\n".join(data_status))
    print("=" * 65 + "\n")

    unittest.main(verbosity=2)
