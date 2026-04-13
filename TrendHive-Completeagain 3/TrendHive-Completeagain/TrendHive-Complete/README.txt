# TrendHive — AI-Powered F&B Market Intelligence

> Real-time area scoring, explainable AI insights, and demand forecasting for Dubai's café market — built for investors and café owners.

**CSIT321 Capstone Project · University of Wollongong in Dubai · AUT'25**  
**Team Grande** — Nathan Mathew, Inara Fatima, Arya Sunil, Arvinder Singh, Asil Habib, Asrar Ahmed

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [API Reference](#api-reference)
- [AI & ML Models](#ai--ml-models)
- [Data](#data)

---

## Overview

TrendHive is a full-stack market intelligence platform that processes over **500,000 customer reviews** across **24 Dubai areas** and **4,200+ cafés** through a 5-layer AI pipeline — delivering explainable investment insights, demand forecasts, and autonomous AI-powered analysis via a clean React dashboard.

The platform is built around three core principles:
- **Explainability** — every score traces back to real data via SHAP values
- **Forecasting** — LSTM neural networks project 6-month area demand with confidence intervals
- **Autonomy** — an agentic AI Copilot answers open-ended market questions using multi-tool reasoning

---

## Features

| Feature | Description |
|---|---|
| **XAI Score Breakdown** | SHAP-powered decomposition of every area score into demand, competition, reputation, and growth factors |
| **6-Month Demand Forecast** | 2-layer LSTM with Monte Carlo Dropout, 90% confidence intervals, 19.9% MAPE |
| **Investor Profile Rankings** | 5 profiles (Balanced, Budget-Cautious, Growth Hunter, Premium Concept, Tourist-Focused) with custom-weighted opportunity scores |
| **Anomaly Alerts** | Real-time detection of demand pattern shifts across all 24 areas |
| **AI Narrative Engine** | DistilGPT-2 (82M params) generates plain-English area summaries from structured scores |
| **Agentic AI Copilot** | Plan → Execute → Reflect loop with 12 integrated tools powered by GPT-4o-mini / Claude |
| **Interactive Map** | Leaflet-based café map with marker clusters, heatmap density cells, and tier overlays |
| **Financial Analysis** | Rent benchmarks, utility costs, and barrier-to-entry scoring per area |

---

## Tech Stack

### Frontend
| Tech | Version | Purpose |
|---|---|---|
| React | 18.2 | UI framework |
| React Router DOM | 6.26 | Client-side routing |
| Recharts | 2.12 | Data visualisation |
| Leaflet | 1.9.4 | Interactive maps |
| Vite | 5.1 | Build tool (dev server on port 5173) |
| Tailwind CSS | 3.4 | Utility styling |

### Backend
| Tech | Purpose |
|---|---|
| FastAPI | REST API server (port 8000) |
| Pandas / NumPy | Data processing |
| Scikit-learn | Random Forest classifiers |
| SHAP | Explainable AI attribution |
| TensorFlow / Keras | LSTM demand forecasting |
| DistilGPT-2 | Natural language narrative generation |
| Joblib | Model serialisation |
| Uvicorn | ASGI server |

---

## Project Structure

```
TrendHive-Complete/
├── frontend/
│   ├── src/
│   │   ├── pages/          # All page components (Dashboard, Map, Copilot, etc.)
│   │   ├── components/
│   │   │   └── ui.jsx      # Shared UI components (Nav, Card, Button, etc.)
│   │   ├── lib/
│   │   │   ├── api.js       # Centralised API helper
│   │   │   └── auth.js      # localStorage auth + page tracking
│   │   ├── styles/
│   │   │   └── theme.js     # Design tokens (colours, shadows, gradients)
│   │   ├── App.jsx          # Router, auth context, protected routes
│   │   └── main.jsx         # React entry point
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── main.py              # FastAPI app, core endpoints, ML model loading
│   ├── routes/
│   │   ├── xai_api_routes.py       # XAI + SHAP explanation endpoints
│   │   └── lstm_slm_api_routes.py  # LSTM forecast + DistilGPT-2 narrative endpoints
│   ├── models/
│   │   ├── trendhive_growth_classifier.pkl
│   │   ├── trendhive_growth_label_encoder.pkl
│   │   ├── trendhive_growth_features.json
│   │   ├── popularity_rf.joblib
│   │   ├── popularity_rf_features.json
│   │   └── popularity_rf_classes.json
│   └── data/
│       └── outputs/
│           ├── area_metrics.csv
│           ├── category_metrics.csv
│           ├── opportunity_metrics.csv
│           ├── cleaned_business_level.csv
│           ├── cafes_with_predictions.csv
│           └── grid_cells.csv
│
└── ml/                      # Jupyter notebooks + model training scripts
```

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm 9+

---

### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. (Optional) Train models if .pkl / .joblib files are not present
python ml/train_popularity_model.py

# 4. Start the API server
python3 -m uvicorn main:app --reload --port 8000
# Windows: python -m uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs (Swagger UI): `http://localhost:8000/docs`

> **Note:** The backend requires the `data/outputs/` CSV files to be present. If they are missing, the API will start but return empty responses.

---

### AI Copilot Setup

The AI Copilot is a separate agentic service that runs on port 8001.

#### 1. Create a `.env` file inside `backend/`

```env
OPENAI_API_KEY=your-openai-api-key-here
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
TRENDHIVE_API=http://localhost:8000
```

Get your API key at: https://platform.openai.com/api-keys

#### 2. Start the AI Copilot server

**Mac/Linux:**
```bash
cd backend/agentic_ai
export $(cat ../.env | xargs) && python3 -m uvicorn agentic_ai:agent_app --reload --port 8001
```

**Windows (PowerShell):**
```powershell
cd backend\agentic_ai
Get-Content ..\.env | ForEach-Object { if ($_ -match '^(.+)=(.+)$') { [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2]) } }
python -m uvicorn agentic_ai:agent_app --reload --port 8001
```

---

### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will open at `http://localhost:5173`.

#### Environment Variables (optional)

Create a `.env` file in the `frontend/` directory to override the default API URL:

```env
VITE_API_URL=http://localhost:8000
```

---

### Running All Services

You need **3 terminals** running simultaneously:

| Terminal | Command | Port |
|---|---|---|
| 1 — Main Backend | `cd backend && python3 -m uvicorn main:app --reload --port 8000` | 8000 |
| 2 — AI Copilot | `cd backend/agentic_ai && python3 -m uvicorn agentic_ai:agent_app --reload --port 8001` | 8001 |
| 3 — Frontend | `cd frontend && npm run dev` | 5173 |

> Windows users: use `python` instead of `python3`, and load the `.env` file using the PowerShell command above before starting each backend service.

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server status, area count, business count |
| `GET` | `/areas` | List all 24 Dubai areas with metrics |
| `GET` | `/areas/{area_name}` | Single area detail with café list |
| `GET` | `/recommend` | Investment recommendations by investor profile |
| `GET` | `/categories` | Market breakdown by cuisine type |
| `GET` | `/business/{name}` | Search cafés by name |

### ML Prediction Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/predict/growth/{place_id}` | Growth tier prediction + SHAP drivers |
| `GET` | `/predict/popularity/{place_id}` | Popularity tier (Very Low → Very High) |
| `GET` | `/predict/popularity/search/{name}` | Search cafés and return tier predictions |

### Analytics Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/overview/cards` | Dashboard KPI cards (total cafés, avg rating, top area) |
| `GET` | `/analytics/area-summary` | Per-area aggregated stats from full predictions dataset |
| `GET` | `/analytics/opportunity-ranking` | Z-score based opportunity ranking |

### Map Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/map/markers` | Café coordinates with rating, tier, sentiment (up to 3000) |
| `GET` | `/map/cells` | Grid heatmap cells for density visualisation |

### XAI Endpoints (`xai_api_routes.py`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/explain/area/{area_name}` | SHAP-based score explanation for an area |
| `GET` | `/explain/profiles` | List of investor profiles with descriptions |

### LSTM + Narrative Endpoints (`lstm_slm_api_routes.py`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/forecast/{area_name}` | 6-month LSTM demand forecast with confidence intervals |
| `GET` | `/forecast/anomaly/{area_name}` | Anomaly detection on demand time series |
| `GET` | `/narrative/{area_name}` | DistilGPT-2 plain-English area summary |

---

## AI & ML Models

### 1. Growth Classifier (Random Forest + SHAP)
- **Task:** Predicts growth tier for individual cafés
- **Input:** 38 engineered features (reviews, ratings, competition, rent, sentiment, etc.)
- **Output:** Growth class + confidence % + top 5 SHAP feature drivers
- **File:** `models/trendhive_growth_classifier.pkl`

### 2. Popularity Tier Classifier (Random Forest)
- **Task:** Predicts popularity tier — Very Low / Low / Medium / High / Very High
- **Formula:** `popularity_score = log(1 + Reviews) × Rating`
- **Accuracy:** 87% (5-fold cross-validation)
- **File:** `models/popularity_rf.joblib`

### 3. Demand Forecaster (LSTM)
- **Architecture:** 2-layer LSTM with Monte Carlo Dropout
- **Output:** 6-month forward demand projection with 90% confidence intervals
- **Error rate:** 19.9% MAPE

### 4. Narrative Engine (DistilGPT-2)
- **Architecture:** 82M parameter Small Language Model
- **Method:** Template-conditioned text generation
- **Output:** Plain-English area summaries from structured score inputs

### 5. XAI Engine
- **Method:** SHAP (SHapley Additive exPlanations) via `TreeExplainer`
- **Output:** Per-feature contribution scores, direction (positive/negative), human-readable explanation text

---

## Data

| Dataset | Records | Description |
|---|---|---|
| `area_metrics.csv` | 24 areas | Aggregated area-level scores and metrics |
| `cleaned_business_level.csv` | 349 cafés | ML-analysed café dataset with full feature set |
| `cafes_with_predictions.csv` | 4,200+ cafés | Full market dataset with predicted tiers |
| `category_metrics.csv` | 9 cuisines | Market share, avg rating, sentiment by cuisine |
| `opportunity_metrics.csv` | — | Pre-computed investor profile opportunity scores |
| `grid_cells.csv` | — | Pre-computed heatmap grid cells |

**Raw data sources:** Google Places API · Google Trends · Geospatial coordinates · Commercial rent benchmarks · 500,000+ customer reviews

---

## Authentication

TrendHive uses a client-side localStorage auth system for the prototype. User accounts are stored in the browser — no backend auth server is required.

```js
// Register
saveUser(email, name, password)   // stored in localStorage

// Login
checkUser(email, password)        // returns "ok" | "no_account" | "wrong_pass"
```

>  This is a prototype authentication system intended for academic demonstration only. It is not suitable for production use.

---

## Available Scripts

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port 5173 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

### Backend

| Command | Description |
|---|---|
| `python3 -m uvicorn main:app --reload --port 8000` | Start main API server with hot reload |
| `python3 -m uvicorn agentic_ai:agent_app --reload --port 8001` | Start AI Copilot service |
| `python ml/train_popularity_model.py` | Train/retrain the popularity classifier |

---

*TrendHive v2.0.0 — CSIT321 Capstone · University of Wollongong in Dubai*