"""
TrendHive Agentic AI Engine
============================
A full autonomous agent that:
  1. PLANS  — understands user intent and creates an execution plan
  2. EXECUTES — calls multiple TrendHive APIs autonomously
  3. REFLECTS — evaluates if the answer is complete
  4. RETRIES — adjusts plan and fetches more data if needed
  5. SYNTHESIZES — produces a rich, structured response

Supports: OpenAI (gpt-4o/gpt-4o-mini) or Anthropic (Claude) as the LLM backbone.

Run:  uvicorn agentic_ai:agent_app --reload --port 8001
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
import json
import os
import time
import logging
import traceback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentic_ai")



TRENDHIVE_API = os.getenv("TRENDHIVE_API", "http://localhost:8000")
LLM_PROVIDER  = os.getenv("LLM_PROVIDER", "openai")   # "openai" or "anthropic"
OPENAI_KEY    = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_MODEL  = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
MAX_AGENT_STEPS = 8
MAX_RETRIES = 2



TOOLS = [
    {
        "name": "get_all_areas",
        "description": "Get summary metrics for ALL 24 Dubai areas. Returns area name, demand_score, competition_intensity, reputation_strength, growth_momentum, barrier_to_entry, market_positioning, total_cafes, avg_rating, avg_rent, strengths, risks.",
        "parameters": {},
        "endpoint": "/areas",
        "method": "GET"
    },
    {
        "name": "get_area_detail",
        "description": "Get detailed metrics and businesses for a SPECIFIC area. Returns all 38 columns plus list of cafés in that area.",
        "parameters": {"area_name": "string (e.g. 'Downtown Dubai', 'DIFC', 'JBR')"},
        "endpoint": "/areas/{area_name}",
        "method": "GET"
    },
    {
        "name": "get_recommendations",
        "description": "Get ranked area opportunities for a specific investor profile. Profiles: balanced_investor, budget_cautious, growth_hunter, premium_concept, tourist_focused.",
        "parameters": {"profile": "string", "top_n": "integer (default 10)"},
        "endpoint": "/recommend?profile={profile}&top_n={top_n}",
        "method": "GET"
    },
    {
        "name": "get_categories",
        "description": "Get cuisine/category analytics. Returns 9 cuisine types with count, avg_rating, avg_reviews, market_share, avg_sentiment, pct_premium.",
        "parameters": {},
        "endpoint": "/categories",
        "method": "GET"
    },
    {
        "name": "search_business",
        "description": "Search for a specific café/restaurant by name. Returns rating, reviews, price_index, sentiment, growth_class.",
        "parameters": {"name": "string (café name to search)"},
        "endpoint": "/business/{name}",
        "method": "GET"
    },
    {
        "name": "explain_area_scores",
        "description": "XAI: Get explainable AI decomposition of ALL scores (demand, competition, reputation, growth, barrier) for an area. Shows weighted factor contributions, top drivers, confidence levels.",
        "parameters": {"area_name": "string"},
        "endpoint": "/explain/area/{area_name}",
        "method": "GET"
    },
    {
        "name": "explain_opportunity",
        "description": "XAI: Explain WHY an area scored well for a specific investor profile. Returns advantages, concerns, natural-language explanation.",
        "parameters": {"area_name": "string", "profile": "string (default: balanced_investor)"},
        "endpoint": "/explain/opportunity/{area_name}?profile={profile}",
        "method": "GET"
    },
    {
        "name": "forecast_area_demand",
        "description": "LSTM neural network forecast for area demand over future periods. Returns predicted values with confidence intervals (upper/lower bounds).",
        "parameters": {"area_name": "string", "horizon": "integer (default 6)"},
        "endpoint": "/forecast/area/{area_name}?horizon={horizon}",
        "method": "GET"
    },
    {
        "name": "detect_anomalies",
        "description": "LSTM anomaly detection: find unusual demand shifts in an area. Returns anomalies with severity levels and alert narratives.",
        "parameters": {"area_name": "string"},
        "endpoint": "/forecast/anomaly/{area_name}",
        "method": "GET"
    },
    {
        "name": "predict_growth",
        "description": "ML growth classifier: predict if a specific café is GROWING, STABLE, or DECLINING. Uses Random Forest + SHAP. Requires place_id.",
        "parameters": {"place_id": "string (Google Place ID)"},
        "endpoint": "/predict/growth/{place_id}",
        "method": "GET"
    },
    {
        "name": "get_investor_profiles",
        "description": "List all 5 investor profiles with their scoring weights and descriptions.",
        "parameters": {},
        "endpoint": "/explain/profiles",
        "method": "GET"
    },
    {
        "name": "compare_areas",
        "description": "Compare two or more areas side by side. Fetches detailed data for each area specified. Pass comma-separated area names.",
        "parameters": {"area_names": "string (comma-separated, e.g. 'DIFC,JBR,Downtown Dubai')"},
        "endpoint": "_custom_compare",
        "method": "CUSTOM"
    }
]

TOOL_DESCRIPTIONS = "\n".join([
    f"  - {t['name']}: {t['description']} | Params: {json.dumps(t['parameters']) if t['parameters'] else 'none'}"
    for t in TOOLS
])



SYSTEM_PROMPT = f"""You are the TrendHive Agentic AI — an autonomous market intelligence analyst for Dubai's café and F&B industry.

You have access to a comprehensive analytics platform with 24 Dubai areas, 349 cafés, 9 cuisine types, 5 investor profiles, LSTM demand forecasting, XAI score decomposition, and ML growth classification.

## YOUR TOOLS
{TOOL_DESCRIPTIONS}

## HOW YOU WORK
You operate in a PLAN → EXECUTE → REFLECT loop:

1. **PLAN**: Analyze the user's question. Determine which tools to call and in what order.
2. **EXECUTE**: Call tools one at a time. Each tool returns real data from the TrendHive API.
3. **REFLECT**: After each tool call, evaluate: Do I have enough data to answer comprehensively? If not, plan the next tool call.
4. **SYNTHESIZE**: Once you have sufficient data, produce a rich, well-structured answer.

## RESPONSE FORMAT
When you want to call a tool, respond with EXACTLY this JSON format (no other text):
{{"action": "tool_call", "tool": "<tool_name>", "params": {{"key": "value"}}, "reasoning": "Why I'm calling this tool"}}

When you have enough data to answer, respond with EXACTLY this JSON format:
{{"action": "final_answer", "answer": "<your comprehensive answer in markdown>", "tools_used": ["tool1", "tool2"], "confidence": "high/medium/low"}}

## IMPORTANT RULES
- Always call at least one tool before giving a final answer (you must use real data).
- For comparisons, fetch data for ALL areas being compared.
- For "best" or "recommend" questions, use get_recommendations with the appropriate profile.
- For "why" questions, use the XAI explain tools.
- For "forecast" or "future" questions, use forecast_area_demand.
- For general overviews, start with get_all_areas to see the full landscape.
- Keep final answers concise but data-rich. Use specific numbers.
- Always mention data confidence and proxy disclaimers where relevant.
- Maximum {MAX_AGENT_STEPS} tool calls per query.
"""



async def call_llm(messages: list, provider: str = None) -> str:
    """Call the LLM with conversation history, return response text."""
    provider = provider or LLM_PROVIDER

    async with httpx.AsyncClient(timeout=60.0) as client:
        if provider == "openai":
            if not OPENAI_KEY:
                raise HTTPException(500, "OPENAI_API_KEY not set")
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"},
                json={
                    "model": OPENAI_MODEL,
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 2000,
                }
            )
            if resp.status_code != 200:
                logger.error(f"OpenAI error: {resp.status_code} {resp.text}")
                raise HTTPException(502, f"LLM error: {resp.status_code}")
            return resp.json()["choices"][0]["message"]["content"]

        elif provider == "anthropic":
            if not ANTHROPIC_KEY:
                raise HTTPException(500, "ANTHROPIC_API_KEY not set")
            # Extract system message
            system_msg = ""
            user_messages = []
            for m in messages:
                if m["role"] == "system":
                    system_msg = m["content"]
                else:
                    user_messages.append(m)
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": ANTHROPIC_MODEL,
                    "system": system_msg,
                    "messages": user_messages,
                    "temperature": 0.3,
                    "max_tokens": 2000,
                }
            )
            if resp.status_code != 200:
                logger.error(f"Anthropic error: {resp.status_code} {resp.text}")
                raise HTTPException(502, f"LLM error: {resp.status_code}")
            content = resp.json().get("content", [])
            return content[0]["text"] if content else ""

        else:
            raise HTTPException(400, f"Unknown LLM provider: {provider}")




async def execute_tool(tool_name: str, params: dict) -> dict:
    """Execute a tool by calling the TrendHive backend API."""
    tool = next((t for t in TOOLS if t["name"] == tool_name), None)
    if not tool:
        return {"error": f"Unknown tool: {tool_name}"}

    try:
        # Handle custom compare tool
        if tool_name == "compare_areas":
            area_names = [a.strip() for a in params.get("area_names", "").split(",")]
            results = {}
            async with httpx.AsyncClient(timeout=15.0) as client:
                for area in area_names:
                    resp = await client.get(f"{TRENDHIVE_API}/areas/{area}")
                    if resp.status_code == 200:
                        results[area] = resp.json()
                    else:
                        results[area] = {"error": f"Not found: {area}"}
            return {"comparison": results, "areas_compared": len(results)}

        
        endpoint = tool["endpoint"]
        for key, value in params.items():
            endpoint = endpoint.replace(f"{{{key}}}", str(value))

        
        import re
        endpoint = re.sub(r'\{[^}]+\}', '', endpoint)
        endpoint = endpoint.replace('?&', '?').rstrip('?&')

        url = f"{TRENDHIVE_API}{endpoint}"
        logger.info(f"🔧 Tool [{tool_name}] → {url}")

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                # Truncate large responses for LLM context
                text = json.dumps(data, default=str)
                if len(text) > 4000:
                    if isinstance(data, list):
                        data = data[:5]  # Limit array results
                        data.append({"_note": f"Showing 5 of {len(resp.json())} results"})
                    elif isinstance(data, dict) and "businesses" in data:
                        data["businesses"] = data["businesses"][:5]
                        data["_businesses_note"] = "Showing top 5 businesses"
                return data
            else:
                return {"error": f"API returned {resp.status_code}", "detail": resp.text[:200]}

    except httpx.TimeoutException:
        return {"error": f"Tool {tool_name} timed out (15s)"}
    except Exception as e:
        logger.error(f"Tool execution error: {e}")
        return {"error": str(e)}




async def run_agent(user_query: str, conversation_history: list = None) -> dict:
    """
    Main agent loop. Returns:
    {
        "answer": str,           # Final synthesized answer
        "steps": [...],          # Each step the agent took
        "tools_used": [...],     # Which tools were called
        "total_time": float,     # Total execution time
        "confidence": str,       # Agent's confidence level
    }
    """
    start_time = time.time()
    steps = []
    tools_used = []

    
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    
    if conversation_history:
        for msg in conversation_history[-6:]:  # Last 3 exchanges
            messages.append(msg)

    messages.append({"role": "user", "content": user_query})

    for step_num in range(MAX_AGENT_STEPS):
        logger.info(f"━━━ Agent Step {step_num + 1} ━━━")

        
        try:
            llm_response = await call_llm(messages)
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return {
                "answer": f"I encountered an error communicating with the AI model: {str(e)}",
                "steps": steps,
                "tools_used": tools_used,
                "total_time": time.time() - start_time,
                "confidence": "low"
            }

        logger.info(f"LLM response: {llm_response[:200]}...")

        
        try:
            
            clean = llm_response.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
                clean = clean.rsplit("```", 1)[0]
            parsed = json.loads(clean)
        except json.JSONDecodeError:
            # LLM didn't return valid JSON — treat as final answer
            logger.warning("LLM returned non-JSON, treating as final answer")
            return {
                "answer": llm_response,
                "steps": steps,
                "tools_used": tools_used,
                "total_time": time.time() - start_time,
                "confidence": "medium"
            }

        action = parsed.get("action")

        if action == "tool_call":
            tool_name = parsed.get("tool", "")
            tool_params = parsed.get("params", {})
            reasoning = parsed.get("reasoning", "")

            
            logger.info(f"🔧 Calling tool: {tool_name} with {tool_params}")
            tool_result = await execute_tool(tool_name, tool_params)

            step = {
                "step": step_num + 1,
                "action": "tool_call",
                "tool": tool_name,
                "params": tool_params,
                "reasoning": reasoning,
                "result_preview": json.dumps(tool_result, default=str)[:500],
            }
            steps.append(step)
            tools_used.append(tool_name)

            
            messages.append({"role": "assistant", "content": llm_response})
            messages.append({
                "role": "user",
                "content": f"Tool result for {tool_name}:\n{json.dumps(tool_result, default=str)[:3000]}\n\nReflect: Do you have enough data to answer the user's question comprehensively? If not, call another tool. If yes, provide your final_answer."
            })

        elif action == "final_answer":
            answer = parsed.get("answer", "")
            confidence = parsed.get("confidence", "medium")

            steps.append({
                "step": step_num + 1,
                "action": "final_answer",
                "confidence": confidence,
            })

            return {
                "answer": answer,
                "steps": steps,
                "tools_used": list(set(tools_used)),
                "total_time": round(time.time() - start_time, 2),
                "confidence": confidence,
            }

        else:
            
            messages.append({"role": "assistant", "content": llm_response})
            messages.append({
                "role": "user",
                "content": "Please respond with either a tool_call or final_answer in the required JSON format."
            })

    
    return {
        "answer": "I reached my maximum analysis depth. Here's what I found so far based on the data I gathered.",
        "steps": steps,
        "tools_used": list(set(tools_used)),
        "total_time": round(time.time() - start_time, 2),
        "confidence": "low",
    }




agent_app = FastAPI(title="TrendHive Agentic AI", version="2.0.0")
agent_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None
    provider: Optional[str] = None  # "openai" or "anthropic"


class ChatResponse(BaseModel):
    answer: str
    steps: List[Dict[str, Any]]
    tools_used: List[str]
    total_time: float
    confidence: str


@agent_app.get("/health")
def health():
    return {
        "status": "ok",
        "agent": "TrendHive Agentic AI v2.0",
        "llm_provider": LLM_PROVIDER,
        "llm_model": OPENAI_MODEL if LLM_PROVIDER == "openai" else ANTHROPIC_MODEL,
        "openai_configured": bool(OPENAI_KEY),
        "anthropic_configured": bool(ANTHROPIC_KEY),
        "max_steps": MAX_AGENT_STEPS,
        "tools_available": len(TOOLS),
        "trendhive_api": TRENDHIVE_API,
    }


@agent_app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Main agentic chat endpoint."""
    if not req.message.strip():
        raise HTTPException(400, "Message cannot be empty")

    
    global LLM_PROVIDER
    if req.provider:
        LLM_PROVIDER = req.provider

    logger.info(f"📨 New query: {req.message[:100]}...")
    result = await run_agent(req.message, req.conversation_history)
    logger.info(f"✅ Agent completed in {result['total_time']}s with {len(result['steps'])} steps")
    return result


@agent_app.get("/tools")
def list_tools():
    """List all available tools the agent can use."""
    return [
        {"name": t["name"], "description": t["description"], "parameters": t["parameters"]}
        for t in TOOLS
    ]



@agent_app.on_event("startup")
async def startup():
    logger.info("🤖 TrendHive Agentic AI starting...")
    logger.info(f"   LLM Provider: {LLM_PROVIDER}")
    logger.info(f"   OpenAI configured: {bool(OPENAI_KEY)}")
    logger.info(f"   Anthropic configured: {bool(ANTHROPIC_KEY)}")
    logger.info(f"   TrendHive API: {TRENDHIVE_API}")
    logger.info(f"   Tools available: {len(TOOLS)}")

    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{TRENDHIVE_API}/health")
            if resp.status_code == 200:
                logger.info(f"   ✅ TrendHive backend connected: {resp.json()}")
            else:
                logger.warning(f"   ⚠ TrendHive backend returned {resp.status_code}")
    except Exception as e:
        logger.warning(f"   ⚠ Cannot reach TrendHive backend: {e}")
        logger.warning("   Make sure dubai_cafe_api is running on port 8000")

    logger.info("🤖 Agentic AI ready!")
