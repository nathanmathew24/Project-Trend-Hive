"""
lstm_forecasting.py
TrendHive — LSTM Time-Series Forecasting Engine

Provides demand and trend forecasting using Long Short-Term Memory (LSTM)
neural networks. This module generates 30-day popularity and demand
forecasts for each Dubai area, trained on Google Trends time-series data
and area-level metric history.

Architecture:
  - Univariate LSTM for Google Trends keyword forecasting
  - Multivariate LSTM for area-level demand score projection
  - Sliding window approach with configurable lookback
  - Confidence intervals via Monte Carlo Dropout

Drop this file next to dubai_cafe_api.py and the other backend modules.

Dependencies:
  pip install tensorflow numpy pandas scikit-learn
"""

import numpy as np
import pandas as pd
import warnings
import logging
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

warnings.filterwarnings("ignore")
log = logging.getLogger("TrendHive.LSTM")



LSTM_CONFIG = {
    "lookback_window": 12,       # number of past time steps to use
    "forecast_horizon": 6,       # steps ahead to predict (each ~1 month in trends)
    "epochs": 50,
    "batch_size": 8,
    "lstm_units": 64,
    "dropout_rate": 0.2,
    "learning_rate": 0.001,
    "validation_split": 0.15,
    "mc_dropout_passes": 30,     # Monte Carlo passes for uncertainty
    "confidence_level": 0.90,    # 90% prediction interval
}




class TimeSeriesPreprocessor:
    """
    Prepares raw time-series data (Google Trends CSV or area metric history)
    into scaled sliding-window tensors for LSTM training and inference.
    """

    def __init__(self, lookback: int = LSTM_CONFIG["lookback_window"]):
        self.lookback = lookback
        self.scaler_params = {}   # {column: (min, max)} for manual MinMax

    def fit_scale(self, series: np.ndarray, name: str = "default") -> np.ndarray:
        """Fit MinMax scaling on training data and return scaled series."""
        smin, smax = float(series.min()), float(series.max())
        if smax - smin < 1e-9:
            smax = smin + 1.0
        self.scaler_params[name] = (smin, smax)
        return (series - smin) / (smax - smin)

    def transform_scale(self, series: np.ndarray, name: str = "default") -> np.ndarray:
        """Scale using previously fitted params."""
        smin, smax = self.scaler_params.get(name, (0.0, 1.0))
        return (series - smin) / (smax - smin)

    def inverse_scale(self, scaled: np.ndarray, name: str = "default") -> np.ndarray:
        """Reverse the scaling to original range."""
        smin, smax = self.scaler_params.get(name, (0.0, 1.0))
        return scaled * (smax - smin) + smin

    def create_sequences(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sliding window sequences for LSTM.

        Args:
            data: 1D or 2D array of scaled values

        Returns:
            X: (samples, lookback, features)
            y: (samples,) — next step target
        """
        if data.ndim == 1:
            data = data.reshape(-1, 1)

        X, y = [], []
        for i in range(self.lookback, len(data)):
            X.append(data[i - self.lookback:i])
            y.append(data[i, 0])  # predict first feature (target)

        return np.array(X), np.array(y)




class LSTMForecaster:
    """
    Builds, trains, and runs inference with an LSTM forecasting model.

    Supports:
      - Univariate (single keyword trend) and multivariate (area metrics)
      - Monte Carlo Dropout for prediction uncertainty estimation
      - Rolling multi-step forecasting
    """

    def __init__(self, config: dict = None):
        self.config = config or LSTM_CONFIG
        self.model = None
        self.preprocessor = TimeSeriesPreprocessor(
            lookback=self.config["lookback_window"]
        )
        self.is_trained = False
        self.training_history = None

    def _build_model(self, input_shape: Tuple[int, int]):
        """
        Constructs a 2-layer LSTM with dropout for time-series forecasting.

        Architecture:
          Input → LSTM(64, return_sequences=True) → Dropout(0.2)
                → LSTM(32) → Dropout(0.2)
                → Dense(16, ReLU) → Dense(1, Linear)

        Dropout is applied at both training and inference time (for MC Dropout).
        """
        try:
            import tensorflow as tf
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import LSTM as KerasLSTM, Dense, Dropout
            from tensorflow.keras.optimizers import Adam

            model = Sequential([
                KerasLSTM(
                    self.config["lstm_units"],
                    return_sequences=True,
                    input_shape=input_shape,
                    name="lstm_layer_1"
                ),
                Dropout(self.config["dropout_rate"], name="dropout_1"),
                KerasLSTM(
                    self.config["lstm_units"] // 2,
                    return_sequences=False,
                    name="lstm_layer_2"
                ),
                Dropout(self.config["dropout_rate"], name="dropout_2"),
                Dense(16, activation="relu", name="dense_hidden"),
                Dense(1, activation="linear", name="output"),
            ])

            model.compile(
                optimizer=Adam(learning_rate=self.config["learning_rate"]),
                loss="mse",
                metrics=["mae"],
            )

            self.model = model
            log.info(f"LSTM model built: input_shape={input_shape}, "
                     f"params={model.count_params():,}")
            return model

        except ImportError:
            log.warning("TensorFlow not available. Using fallback statistical forecaster.")
            return None

    def train(self, series: np.ndarray, series_name: str = "target") -> dict:
        """
        Train the LSTM on a 1D time series.

        Args:
            series:       1D numpy array of the time-series values
            series_name:  Name for scaler tracking

        Returns:
            Training summary dict with loss history and metrics
        """
        
        scaled = self.preprocessor.fit_scale(series, name=series_name)

        
        X, y = self.preprocessor.create_sequences(scaled)
        if len(X) < 10:
            log.warning(f"Insufficient data for LSTM training ({len(X)} samples). "
                        f"Need at least 10.")
            return {"status": "insufficient_data", "samples": len(X)}

        
        if self.model is None:
            built = self._build_model(input_shape=(X.shape[1], X.shape[2]))
            if built is None:
                return self._fallback_train(series, series_name)

        
        try:
            import tensorflow as tf
            history = self.model.fit(
                X, y,
                epochs=self.config["epochs"],
                batch_size=self.config["batch_size"],
                validation_split=self.config["validation_split"],
                verbose=0,
                callbacks=[
                    tf.keras.callbacks.EarlyStopping(
                        monitor="val_loss", patience=8, restore_best_weights=True
                    )
                ],
            )

            self.is_trained = True
            self.training_history = {
                "final_loss": float(history.history["loss"][-1]),
                "final_val_loss": float(history.history["val_loss"][-1]),
                "final_mae": float(history.history["mae"][-1]),
                "epochs_trained": len(history.history["loss"]),
                "total_samples": len(X),
            }
            log.info(f"LSTM trained: {self.training_history['epochs_trained']} epochs, "
                     f"val_loss={self.training_history['final_val_loss']:.4f}")
            return {"status": "trained", **self.training_history}

        except Exception as e:
            log.error(f"LSTM training failed: {e}")
            return self._fallback_train(series, series_name)

    def forecast(self, series: np.ndarray, horizon: int = None,
                 series_name: str = "target") -> dict:
        """
        Generate multi-step forecast with uncertainty bounds.

        Args:
            series:       Full original (unscaled) time series
            horizon:      Steps to forecast (default from config)
            series_name:  Name for scaler lookup

        Returns:
            Dict with predictions, confidence intervals, and metadata
        """
        horizon = horizon or self.config["forecast_horizon"]

        if self.model is None or not self.is_trained:
            return self._fallback_forecast(series, horizon, series_name)

        try:
            return self._lstm_forecast(series, horizon, series_name)
        except Exception as e:
            log.warning(f"LSTM forecast failed ({e}), using fallback")
            return self._fallback_forecast(series, horizon, series_name)

    def _lstm_forecast(self, series: np.ndarray, horizon: int,
                       series_name: str) -> dict:
        """LSTM-based rolling forecast with Monte Carlo Dropout uncertainty."""
        import tensorflow as tf

        scaled = self.preprocessor.transform_scale(series, name=series_name)
        lookback = self.config["lookback_window"]
        mc_passes = self.config["mc_dropout_passes"]

        
        all_forecasts = []
        for _ in range(mc_passes):
            current_input = scaled[-lookback:].reshape(1, lookback, 1)
            step_preds = []
            for _ in range(horizon):
                # training=True keeps dropout active for MC
                pred = self.model(current_input, training=True).numpy()[0, 0]
                step_preds.append(pred)
                # Roll window forward
                current_input = np.append(
                    current_input[0, 1:, :], [[pred]], axis=0
                ).reshape(1, lookback, 1)
            all_forecasts.append(step_preds)

        all_forecasts = np.array(all_forecasts)  

        
        mean_forecast = all_forecasts.mean(axis=0)
        std_forecast = all_forecasts.std(axis=0)

        alpha = 1 - self.config["confidence_level"]
        from scipy.stats import norm
        z = norm.ppf(1 - alpha / 2)

        lower_bound = mean_forecast - z * std_forecast
        upper_bound = mean_forecast + z * std_forecast

        
        mean_original = self.preprocessor.inverse_scale(mean_forecast, series_name)
        lower_original = self.preprocessor.inverse_scale(
            np.clip(lower_bound, 0, 1), series_name
        )
        upper_original = self.preprocessor.inverse_scale(
            np.clip(upper_bound, 0, 1), series_name
        )

        
        if len(mean_original) >= 2:
            slope = (mean_original[-1] - mean_original[0]) / len(mean_original)
            if slope > 0.5:
                trend = "RISING"
            elif slope < -0.5:
                trend = "DECLINING"
            else:
                trend = "STABLE"
        else:
            trend = "STABLE"

        return {
            "method": "LSTM_MC_Dropout",
            "horizon_steps": horizon,
            "predictions": [round(float(v), 2) for v in mean_original],
            "lower_bound": [round(float(v), 2) for v in lower_original],
            "upper_bound": [round(float(v), 2) for v in upper_original],
            "uncertainty_std": [round(float(v), 4) for v in std_forecast],
            "trend_direction": trend,
            "confidence_level": self.config["confidence_level"],
            "mc_passes": mc_passes,
            "model_info": self.training_history,
        }

    

    def _fallback_train(self, series: np.ndarray, series_name: str) -> dict:
        """Simple exponential smoothing as fallback."""
        self.preprocessor.fit_scale(series, name=series_name)
        self._fallback_series = series.copy()
        self._fallback_name = series_name
        self.is_trained = True
        log.info("Using fallback exponential smoothing (TensorFlow not available)")
        return {
            "status": "trained_fallback",
            "method": "exponential_smoothing",
            "samples": len(series),
        }

    def _fallback_forecast(self, series: np.ndarray, horizon: int,
                           series_name: str) -> dict:
        """
        Exponential smoothing forecast as fallback.
        Uses Holt's linear trend method for extrapolation.
        """
        n = len(series)
        if n < 3:
            return {
                "method": "fallback_constant",
                "predictions": [round(float(series[-1]), 2)] * horizon,
                "lower_bound": [round(float(series[-1] * 0.8), 2)] * horizon,
                "upper_bound": [round(float(series[-1] * 1.2), 2)] * horizon,
                "trend_direction": "STABLE",
                "confidence_level": 0.90,
            }

        
        alpha, beta = 0.3, 0.1
        level = float(series[0])
        trend_val = float(series[1] - series[0])

        for t in range(1, n):
            new_level = alpha * series[t] + (1 - alpha) * (level + trend_val)
            trend_val = beta * (new_level - level) + (1 - beta) * trend_val
            level = new_level

        predictions = []
        for h in range(1, horizon + 1):
            predictions.append(level + h * trend_val)

        predictions = np.array(predictions)
        residuals = []
        temp_level = float(series[0])
        temp_trend = float(series[1] - series[0])
        for t in range(1, n):
            forecast_t = temp_level + temp_trend
            residuals.append(series[t] - forecast_t)
            new_level = alpha * series[t] + (1 - alpha) * (temp_level + temp_trend)
            temp_trend = beta * (new_level - temp_level) + (1 - beta) * temp_trend
            temp_level = new_level

        residual_std = np.std(residuals) if residuals else 1.0
        from scipy.stats import norm
        z = norm.ppf(0.95)

        lower = predictions - z * residual_std * np.sqrt(np.arange(1, horizon + 1))
        upper = predictions + z * residual_std * np.sqrt(np.arange(1, horizon + 1))

        direction = "RISING" if trend_val > 0.5 else ("DECLINING" if trend_val < -0.5 else "STABLE")

        return {
            "method": "holts_linear_trend",
            "horizon_steps": horizon,
            "predictions": [round(float(v), 2) for v in predictions],
            "lower_bound": [round(float(v), 2) for v in lower],
            "upper_bound": [round(float(v), 2) for v in upper],
            "trend_direction": direction,
            "confidence_level": 0.90,
            "note": "Statistical fallback — LSTM model unavailable.",
        }




class TrendForecaster:
    """
    High-level interface for forecasting Google Trends keywords.

    Loads time-series CSVs, trains per-keyword LSTM models, and produces
    forecasts with confidence intervals for the TrendHive dashboard.
    """

    TREND_CATEGORIES = {
        "core_demand": {
            "file": "data/googletrend/Core demand/"
                    "time_series_AE_20210207-1607_20260207-1607.csv",
            "label": "Core Demand (coffee, café, tea, latte, espresso)",
        },
        "premium_segment": {
            "file": "data/googletrend/Premium/"
                    "time_series_AE_20210207-1613_20260207-1613.csv",
            "label": "Premium Segment (specialty, artisan, matcha, cold brew)",
        },
        "trending_beverages": {
            "file": "data/googletrend/trends/"
                    "time_series_AE_20210207-1616_20260207-1616.csv",
            "label": "Trending Beverages (bubble tea, iced coffee, açaí)",
        },
    }

    def __init__(self):
        self.models: Dict[str, LSTMForecaster] = {}
        self.keyword_data: Dict[str, pd.DataFrame] = {}

    def load_trends_data(self, category: str = None) -> dict:
        """Load and parse Google Trends time-series CSVs."""
        loaded = {}
        categories = {category: self.TREND_CATEGORIES[category]} if category else self.TREND_CATEGORIES

        for cat_key, cat_info in categories.items():
            filepath = Path(cat_info["file"])
            if not filepath.exists():
                log.warning(f"Trends file not found: {filepath}")
                continue
            try:
                # Try loading with and without skiprows
                # Google Trends CSVs sometimes have a metadata header row
                df = pd.read_csv(filepath)

                # Detect if first row is metadata (no numeric data)
                first_col = df.columns[0]
                if first_col.startswith("Category") or first_col.startswith("Search"):
                    df = pd.read_csv(filepath, skiprows=1)

                # Find the date column (could be Time, Week, Month, or Date)
                date_col = None
                for candidate in ["Time", "Week", "Month", "Date"]:
                    if candidate in df.columns:
                        date_col = candidate
                        break

                if date_col:
                    df[date_col] = pd.to_datetime(df[date_col])
                    df = df.sort_values(date_col).reset_index(drop=True)
                self.keyword_data[cat_key] = df
                loaded[cat_key] = {
                    "rows": len(df),
                    "columns": list(df.columns),
                    "label": cat_info["label"],
                }
                log.info(f"Loaded trends: {cat_key} ({len(df)} rows)")
            except Exception as e:
                log.warning(f"Failed to load {cat_key}: {e}")

        return loaded

    def forecast_keyword(self, category: str, keyword: str,
                         horizon: int = 6) -> dict:
        """
        Train LSTM on a specific keyword's time series and forecast.

        Args:
            category:  One of 'core_demand', 'premium_segment', 'trending_beverages'
            keyword:   Column name in the trends CSV
            horizon:   Number of future periods to forecast

        Returns:
            Forecast dict with predictions, bounds, and trend direction
        """
        df = self.keyword_data.get(category)
        if df is None:
            return {"error": f"Category '{category}' not loaded"}

        if keyword not in df.columns:
            date_cols = {"Time", "Week", "Month", "Date"}
            available = [c for c in df.columns if c not in date_cols]
            return {"error": f"Keyword '{keyword}' not found. Available: {available}"}

        series = df[keyword].values.astype(float)
        series = np.nan_to_num(series, nan=0.0)

        model_key = f"{category}__{keyword}"
        if model_key not in self.models:
            self.models[model_key] = LSTMForecaster()

        forecaster = self.models[model_key]
        train_result = forecaster.train(series, series_name=model_key)

        if train_result.get("status") == "insufficient_data":
            return {
                "keyword": keyword,
                "category": category,
                "error": "Insufficient data points for forecasting",
                **train_result,
            }

        forecast = forecaster.forecast(series, horizon=horizon,
                                       series_name=model_key)

        return {
            "keyword": keyword,
            "category": category,
            "category_label": self.TREND_CATEGORIES.get(category, {}).get("label", ""),
            "historical_last_5": [round(float(v), 1) for v in series[-5:]],
            "training": train_result,
            "forecast": forecast,
        }

    def forecast_all_keywords(self, category: str = None,
                              horizon: int = 6) -> List[dict]:
        """Forecast all keywords in a category (or all categories)."""
        results = []
        categories = [category] if category else list(self.keyword_data.keys())

        for cat in categories:
            df = self.keyword_data.get(cat)
            if df is None:
                continue
            keywords = [c for c in df.columns if c not in ("Week", "Month", "Time", "Date")]
            for kw in keywords:
                result = self.forecast_keyword(cat, kw, horizon)
                results.append(result)

        return results




class AreaDemandForecaster:
    """
    Forecasts area-level demand metrics using historical snapshots.

    Since TrendHive currently operates on a single snapshot of area_metrics,
    this class simulates historical demand trajectories using the available
    growth momentum and trend signals, then applies LSTM forecasting to
    project future demand conditions.

    In production, this would be replaced with actual time-series data
    from periodic pipeline runs.
    """

    def __init__(self):
        self.area_models: Dict[str, LSTMForecaster] = {}

    def _synthesize_history(self, area_row: dict, periods: int = 24) -> np.ndarray:
        """
        Synthesize plausible historical demand trajectory from current snapshot.

        Uses growth momentum and current demand score to reverse-engineer
        an approximate historical path. This is a bootstrap method for
        demonstration — production would use actual stored snapshots.
        """
        current_demand = float(area_row.get("demand_score", 0.5))
        momentum = float(area_row.get("avg_momentum", 1.0))
        growth = float(area_row.get("growth_momentum", 0.5))

        # Determine trend slope from momentum
        if momentum > 1.5:
            monthly_change = 0.015  # rising demand
        elif momentum < 0.7:
            monthly_change = -0.012  # declining demand
        else:
            monthly_change = np.random.normal(0, 0.005)  # stable with noise

        # Build backward from current value
        history = np.zeros(periods)
        history[-1] = current_demand
        for t in range(periods - 2, -1, -1):
            noise = np.random.normal(0, 0.008)
            history[t] = history[t + 1] - monthly_change + noise

        # Clip to valid range and add seasonal component
        seasonal = 0.02 * np.sin(np.linspace(0, 4 * np.pi, periods))
        history = np.clip(history + seasonal, 0.01, 0.99)

        return history

    def forecast_area(self, area_name: str, area_row: dict,
                      horizon: int = 6) -> dict:
        """
        Generate demand forecast for a specific area.

        Returns predictions, confidence bounds, and trend analysis.
        """
        history = self._synthesize_history(area_row)

        model_key = f"area_{area_name}"
        if model_key not in self.area_models:
            self.area_models[model_key] = LSTMForecaster()

        forecaster = self.area_models[model_key]
        train_result = forecaster.train(history, series_name=model_key)
        forecast = forecaster.forecast(history, horizon=horizon,
                                       series_name=model_key)

        current_demand = float(area_row.get("demand_score", 0))
        positioning = area_row.get("market_positioning", "Unknown")

        return {
            "area": area_name,
            "current_demand_score": round(current_demand, 3),
            "market_positioning": positioning,
            "synthetic_history_note": (
                "Historical trajectory synthesized from current snapshot metrics. "
                "Production deployment should use actual periodic pipeline snapshots."
            ),
            "training": train_result,
            "forecast": forecast,
        }




class LSTMAnomalyDetector:
    """
    Detects anomalies in time-series data by analyzing LSTM prediction
    residuals. Points where actual values deviate significantly from
    LSTM predictions are flagged as anomalies.

    Uses a trained LSTM model's reconstruction error as the anomaly signal.
    """

    def __init__(self, threshold_std: float = 2.5):
        self.threshold_std = threshold_std
        self.forecaster = LSTMForecaster()

    def detect(self, series: np.ndarray, series_name: str = "anomaly") -> dict:
        """
        Train on the series and flag points where residual > threshold.

        Returns:
            Dict with anomaly indices, scores, and summary statistics
        """
        if len(series) < 20:
            return {"status": "insufficient_data", "anomalies": []}

        # Train model
        self.forecaster.train(series, series_name=series_name)

        if self.forecaster.model is None:
            return self._fallback_detect(series)

        try:
            return self._lstm_detect(series, series_name)
        except Exception:
            return self._fallback_detect(series)

    def _lstm_detect(self, series: np.ndarray, series_name: str) -> dict:
        """Use LSTM prediction errors to detect anomalies."""
        scaled = self.forecaster.preprocessor.transform_scale(series, series_name)
        lookback = self.forecaster.config["lookback_window"]

        X, y_true = self.forecaster.preprocessor.create_sequences(scaled)
        y_pred = self.forecaster.model.predict(X, verbose=0).flatten()

        residuals = np.abs(y_true - y_pred)
        mean_res = residuals.mean()
        std_res = residuals.std()
        threshold = mean_res + self.threshold_std * std_res

        anomaly_indices = np.where(residuals > threshold)[0]
        anomaly_indices_original = anomaly_indices + lookback  # offset for window

        anomalies = []
        for idx in anomaly_indices:
            orig_idx = int(idx + lookback)
            anomalies.append({
                "index": orig_idx,
                "actual_value": round(float(series[orig_idx]) if orig_idx < len(series) else 0, 3),
                "expected_value": round(float(
                    self.forecaster.preprocessor.inverse_scale(
                        np.array([y_pred[idx]]), series_name
                    )[0]
                ), 3),
                "anomaly_score": round(float(residuals[idx]), 4),
                "severity": "HIGH" if residuals[idx] > mean_res + 3 * std_res else "MEDIUM",
            })

        return {
            "method": "LSTM_residual_analysis",
            "total_points": len(series),
            "anomalies_detected": len(anomalies),
            "threshold_used": round(float(threshold), 4),
            "mean_residual": round(float(mean_res), 4),
            "anomalies": anomalies,
            "f1_note": "Anomaly threshold set at μ + 2.5σ of reconstruction error.",
        }

    def _fallback_detect(self, series: np.ndarray) -> dict:
        """Z-score based anomaly detection as fallback."""
        from scipy.stats import zscore
        z_scores = np.abs(zscore(series))
        anomaly_mask = z_scores > self.threshold_std

        anomalies = []
        for idx in np.where(anomaly_mask)[0]:
            anomalies.append({
                "index": int(idx),
                "actual_value": round(float(series[idx]), 3),
                "anomaly_score": round(float(z_scores[idx]), 4),
                "severity": "HIGH" if z_scores[idx] > 3.5 else "MEDIUM",
            })

        return {
            "method": "z_score_fallback",
            "total_points": len(series),
            "anomalies_detected": len(anomalies),
            "anomalies": anomalies,
        }
