/**
 * Cuisine classifier for dubai_cafes_PRODUCTION.xlsx
 * 
 * Classification pipeline (in order):
 *   1. Google Places API  → types array
 *   2. OpenStreetMap Overpass API → cuisine tag (free, open, no key needed)
 *   3. Name-based keyword matching (always runs as final fallback)
 */

import fetch from "node-fetch";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ================================
   INLINED CLASSIFIER
================================ */

const CUISINE_RULES = [
  { primary: "Japanese",         keywords: ["japanese", "sushi", "ramen", "matcha", "wagyu", "tempura", "udon", "izakaya"] },
  { primary: "Italian",          keywords: ["italian", "pizza", "pasta", "espresso", "gelato", "trattoria", "ristorante"] },
  { primary: "French",           keywords: ["french", "patisserie", "boulangerie", "crepe", "croissant", "bistro", "brasserie"] },
  { primary: "Australian",       keywords: ["australian", "aussie", "flat white", "brunch"] },
  { primary: "American",         keywords: ["american", "diner", "bagel", "pancake", "waffle"] },
  { primary: "Arabic",           keywords: ["arabic", "arab", "arabian", "middle east", "levant", "shisha", "qahwa", "karak"] },
  { primary: "Turkish",          keywords: ["turkish", "turkey", "ottoman", "baklava"] },
  { primary: "Indian",           keywords: ["indian", "chai", "masala", "biryani", "curry"] },
  { primary: "Korean",           keywords: ["korean", "korea", "boba", "k-cafe", "k-coffee"] },
  { primary: "Chinese",          keywords: ["chinese", "china", "dim sum", "bubble tea", "hong kong"] },
  { primary: "Specialty Coffee", keywords: ["specialty", "third wave", "roaster", "roastery", "pour over", "filter coffee", "cold brew", "single origin"] },
  { primary: "Dessert",          keywords: ["dessert", "cake", "sweet", "pastry", "chocolate", "ice cream", "waffle", "crepe"] },
  { primary: "Healthy",          keywords: ["healthy", "vegan", "organic", "green", "juice", "smoothie", "acai", "superfood"] },
  { primary: "Cafe",             keywords: ["cafe", "coffee", "coffeehouse", "coffee shop", "kiosk"] },
];

// OSM cuisine tag → our primary label
const OSM_CUISINE_MAP = {
  japanese: "Japanese", sushi: "Japanese", ramen: "Japanese", udon: "Japanese",
  italian: "Italian", pizza: "Italian", pasta: "Italian",
  french: "French", crepe: "French", croissant: "French",
  australian: "Australian",
  american: "American", burger: "American", diner: "American",
  arabic: "Arabic", middle_eastern: "Arabic", lebanese: "Arabic",
  turkish: "Turkish", baklava: "Turkish",
  indian: "Indian", curry: "Indian",
  korean: "Korean",
  chinese: "Chinese", dim_sum: "Chinese", cantonese: "Chinese",
  coffee_shop: "Cafe", cafe: "Cafe", tea: "Cafe",
  ice_cream: "Dessert", cake: "Dessert", dessert: "Dessert",
  vegan: "Healthy", vegetarian: "Healthy", juice: "Healthy",
};

function classifyCuisine(types = [], name = "", osmCuisine = "") {
  // 1. Try OSM cuisine tag first (most specific)
  if (osmCuisine) {
    const osm = osmCuisine.toLowerCase().trim();
    for (const [tag, label] of Object.entries(OSM_CUISINE_MAP)) {
      if (osm.includes(tag)) {
        return { primary: label, secondary: null, confidence: "High", source: "OSM" };
      }
    }
  }

  // 2. Keyword match on Google types + name
  const text = (name + " " + types.join(" ")).toLowerCase();
  const matches = [];
  for (const rule of CUISINE_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) { matches.push(rule.primary); break; }
    }
  }

  if (matches.length === 0) return { primary: "Cafe", secondary: null, confidence: "Low", source: "Fallback" };
  if (matches.length === 1) return { primary: matches[0], secondary: null, confidence: "High", source: "Name/Types" };
  return { primary: matches[0], secondary: matches[1], confidence: "Medium", source: "Name/Types" };
}

function isFusion(cuisine) { return !!cuisine.secondary; }

/* ================================
   CONFIG
================================ */

const API_KEY = "AIzaSyAJjeHZOp4spXnn2f4Ds1YMT05KF1Zulp8";
const INPUT_FILE  = path.join(__dirname, "dubai_cafes_PRODUCTION.xlsx");
const OUTPUT_FILE = path.join(__dirname, "dubai_cafes_with_cuisine.xlsx");

const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const GOOGLE_FIELD_MASK = ["displayName", "types"].join(",");

// OpenStreetMap Overpass API (free, open, no key needed)
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ================================
   GOOGLE PLACES - GET TYPES
================================ */

async function getGoogleTypes(placeId) {
  try {
    const res = await fetch(`${DETAILS_URL}${placeId}`, {
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
    });
    if (!res.ok) return { types: [], name: "" };
    const data = await res.json();
    return {
      types: data.types || [],
      name:  data.displayName?.text || "",
    };
  } catch {
    return { types: [], name: "" };
  }
}

/* ================================
   OSM OVERPASS - GET CUISINE TAG
   (free fallback — queries by lat/lng)
================================ */

async function getOSMCuisine(lat, lng, name = "") {
  if (!lat || !lng) return "";

  // Search within 80m radius of coordinates
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"~"cafe|restaurant|bar|fast_food"](around:80,${lat},${lng});
      way["amenity"~"cafe|restaurant|bar|fast_food"](around:80,${lat},${lng});
    );
    out body;
  `;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return "";
    const data = await res.json();

    if (!data.elements || data.elements.length === 0) return "";

    // Try to match by name first, then just take the first result
    const nameLower = name.toLowerCase();
    const match =
      data.elements.find(e => e.tags?.name?.toLowerCase().includes(nameLower.slice(0, 6))) ||
      data.elements[0];

    return match?.tags?.cuisine || "";
  } catch {
    return "";
  }
}

/* ================================
   MAIN
================================ */

async function run() {
  console.log("🚀 Cuisine Classifier Starting...\n");

  const wb = XLSX.readFile(INPUT_FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const cafes = XLSX.utils.sheet_to_json(sheet);

  if (!cafes.length) { console.log("❌ No rows found."); return; }

  const keys = Object.keys(cafes[0]);
  const placeIdKey =
    keys.find(k => k.toLowerCase() === "place_id") ||
    keys.find(k => k.toLowerCase().includes("place"));

  if (!placeIdKey) { console.log("❌ No Place_ID column found:", keys); return; }

  console.log(`📋 Place ID column : ${placeIdKey}`);
  console.log(`📊 Cafes to process: ${cafes.length}\n`);

  // Counters
  let fromGoogle = 0, fromOSM = 0, fromName = 0, fromFallback = 0;

  const rows = [];

  for (let i = 0; i < cafes.length; i++) {
    const cafe    = cafes[i];
    const placeId = cafe[placeIdKey];
    const name    = cafe.Name || cafe.name || "";
    const lat     = parseFloat(cafe.Latitude  || cafe.latitude  || 0);
    const lng     = parseFloat(cafe.Longitude || cafe.longitude || 0);

    console.log(`🔎 [${i + 1}/${cafes.length}] ${name || placeId}`);

    if (!placeId) {
      rows.push({ ...cafe, Cuisine_Primary: "Unknown", Cuisine_Secondary: "", Cuisine_Confidence: "Low", Cuisine_Source: "None", Fusion: "NO" });
      continue;
    }

    // ── Step 1: Google Places ───────────────────────────────────
    const { types, name: googleName } = await getGoogleTypes(placeId);
    await sleep(120);

    // ── Step 2: OSM fallback (only if Google gave no useful types) ──
    let osmCuisine = "";
    const usefulTypes = types.filter(t => !["establishment", "point_of_interest", "food"].includes(t));
    if (usefulTypes.length === 0) {
      osmCuisine = await getOSMCuisine(lat, lng, name);
      await sleep(300); // OSM rate limit — be polite
    }

    // ── Step 3: Classify ────────────────────────────────────────
    const displayName = googleName || name;
    const cuisine = classifyCuisine(types, displayName, osmCuisine);

    // Track source stats
    if (cuisine.source === "OSM")        fromOSM++;
    else if (usefulTypes.length > 0)     fromGoogle++;
    else if (cuisine.source === "Name/Types") fromName++;
    else                                 fromFallback++;

    rows.push({
      ...cafe,
      Cuisine_Primary:    cuisine.primary,
      Cuisine_Secondary:  cuisine.secondary || "",
      Cuisine_Confidence: cuisine.confidence,
      Cuisine_Source:     cuisine.source,
      Fusion:             isFusion(cuisine) ? "YES" : "NO",
    });

    if ((i + 1) % 100 === 0) {
      console.log(`\n✓ Checkpoint: ${i + 1} / ${cafes.length} processed\n`);
    }
  }

  // ── Export ──────────────────────────────────────────────────
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] || "").length))
  }));
  ws["!cols"] = colWidths;

  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, ws, "Dubai Cafes");
  XLSX.writeFile(outWb, OUTPUT_FILE);

  // ── Summary ─────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("📈 CLASSIFICATION SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total Cafes:      ${rows.length}`);
  console.log(`From Google types:${fromGoogle}`);
  console.log(`From OSM cuisine: ${fromOSM}`);
  console.log(`From name/keyword:${fromName}`);
  console.log(`Fallback (Cafe):  ${fromFallback}`);
  console.log("=".repeat(50));
  console.log(`\n✅ Done. Saved: ${OUTPUT_FILE}`);
}

run().catch(e => { console.error("❌ Fatal:", e); process.exit(1); });
