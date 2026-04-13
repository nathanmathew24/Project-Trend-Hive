import fetch from "node-fetch";
import XLSX from "xlsx";

/* ================================
   INLINED CLASSIFIER
   (no classifer.js needed)
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

function classifyCuisine(types = [], name = "") {
  const text = (name + " " + types.join(" ")).toLowerCase();
  const matches = [];

  for (const rule of CUISINE_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        matches.push(rule.primary);
        break;
      }
    }
  }

  if (matches.length === 0) return { primary: "Cafe", secondary: null, confidence: "Low" };
  if (matches.length === 1) return { primary: matches[0], secondary: null, confidence: "High" };
  return { primary: matches[0], secondary: matches[1], confidence: "Medium" };
}

function isFusion(cuisine) {
  return !!cuisine.secondary;
}

/* ================================
   CONFIG
================================ */

const API_KEY = "AIzaSyAJjeHZOp4spXnn2f4Ds1YMT05KF1Zulp8";
const BASE_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.id",
  "places.types",
  "nextPageToken"
].join(",");

/* ================================
   KEYWORD QUERIES (No Bias)
================================ */

const SEARCH_QUERIES = [
  // By area
  "cafes in Downtown Dubai",
  "cafes in Dubai Marina",
  "cafes in JBR Dubai",
  "cafes in DIFC Dubai",
  "cafes in Business Bay Dubai",
  "cafes in Jumeirah Dubai",
  "cafes in Al Quoz Dubai",
  "cafes in Deira Dubai",
  "cafes in Bur Dubai",
  "cafes in Dubai Hills",
  "cafes in Palm Jumeirah",
  "cafes in JLT Dubai",
  "cafes in Al Barsha Dubai",
  "cafes in Mirdif Dubai",
  "cafes in Karama Dubai",
  "cafes in Silicon Oasis Dubai",
  "cafes in Motor City Dubai",
  "cafes in Arabian Ranches Dubai",
  "cafes in Satwa Dubai",
  "cafes in Oud Metha Dubai",
  "cafes in Al Nahda Dubai",
  "cafes in Muhaisnah Dubai",
  "cafes in International City Dubai",
  "cafes in Discovery Gardens Dubai",
  "cafes in Sports City Dubai",
  "cafes in Nad Al Sheba Dubai",
  "cafes in Creek Harbour Dubai",
  "cafes in Dubai Festival City",
  "cafes in Dubai Hills Mall",
  "cafes in Dubai Mall area",
  "cafes in Mall of the Emirates area",
  "cafes in City Walk Dubai",
  "cafes in La Mer Dubai",
  "cafes in Bluewaters Island Dubai",
  "cafes in Dubai Frame area",
  "cafes in Al Rigga Dubai",
  "cafes in Hor Al Anz Dubai",
  "cafes in Al Mamzar Dubai",

  // By type/concept
  "coffee shop Dubai",
  "specialty coffee Dubai",
  "espresso bar Dubai",
  "coffee roasters Dubai",
  "third wave coffee Dubai",
  "artisan coffee Dubai",
  "brunch cafe Dubai",
  "breakfast cafe Dubai",
  "dessert cafe Dubai",
  "shisha cafe Dubai",
  "bookstore cafe Dubai",
  "pet friendly cafe Dubai",
  "outdoor cafe Dubai",
  "rooftop cafe Dubai",
  "waterfront cafe Dubai",
  "vegan cafe Dubai",
  "healthy cafe Dubai",
  "juice bar Dubai",
  "smoothie bar Dubai",
  "tea house Dubai",
  "bubble tea Dubai",
  "matcha cafe Dubai",
  "french cafe Dubai",
  "italian cafe Dubai",
  "australian cafe Dubai",
  "japanese cafe Dubai",
  "arabic coffee Dubai",
  "turkish coffee Dubai",
  "study cafe Dubai",
  "co-working cafe Dubai",
  "aesthetic cafe Dubai",
  "24 hour cafe Dubai",
  "late night cafe Dubai",

  // Mall-specific
  "cafe in Dubai Mall",
  "cafe in Mall of the Emirates",
  "cafe in Dubai Hills Mall",
  "cafe in Mirdif City Centre",
  "cafe in Deira City Centre",
  "cafe in Ibn Battuta Mall",
  "cafe in Dragon Mart Dubai",
  "cafe in Times Square Dubai",
  "cafe in Al Ghurair Centre",
  "cafe in Wafi Mall Dubai",
  "cafe in BurJuman Dubai",
  "cafe in Mercato Mall Dubai",
  "cafe in Nakheel Mall Dubai",
  "cafe in The Pointe Dubai",
  "cafe in Box Park Dubai",

  // Hotel / resort cafes
  "hotel cafe Dubai",
  "lobby cafe Dubai",
  "resort cafe Dubai",
];

/* ================================
   AREA BIASES (Location-Pinned)
================================ */

const AREA_BIASES = [
  { name: "Downtown Dubai",    lat: 25.1972, lng: 55.2744 },
  { name: "Dubai Marina",      lat: 25.0805, lng: 55.1403 },
  { name: "DIFC",              lat: 25.2048, lng: 55.2708 },
  { name: "Deira",             lat: 25.2697, lng: 55.3095 },
  { name: "Jumeirah",          lat: 25.2048, lng: 55.2400 },
  { name: "JLT",               lat: 25.0686, lng: 55.1373 },
  { name: "Al Barsha",         lat: 25.1095, lng: 55.1992 },
  { name: "Business Bay",      lat: 25.1850, lng: 55.2650 },
  { name: "Bur Dubai",         lat: 25.2578, lng: 55.2980 },
  { name: "Palm Jumeirah",     lat: 25.1120, lng: 55.1390 },
  { name: "Mirdif",            lat: 25.2206, lng: 55.4233 },
  { name: "Silicon Oasis",     lat: 25.1177, lng: 55.3803 },
  { name: "Al Quoz",           lat: 25.1463, lng: 55.2211 },
  { name: "Karama",            lat: 25.2440, lng: 55.3070 },
  { name: "Satwa",             lat: 25.2260, lng: 55.2640 },
  { name: "Al Nahda",          lat: 25.3010, lng: 55.3740 },
  { name: "Creek Harbour",     lat: 25.2100, lng: 55.3490 },
  { name: "Discovery Gardens", lat: 25.0480, lng: 55.1390 },
  { name: "International City",lat: 25.1653, lng: 55.4139 },
  { name: "Motor City",        lat: 25.0490, lng: 55.2370 },
  { name: "Sports City",       lat: 25.0440, lng: 55.2240 },
  { name: "Arabian Ranches",   lat: 25.0612, lng: 55.2758 },
  { name: "La Mer",            lat: 25.2313, lng: 55.2700 },
  { name: "City Walk",         lat: 25.2016, lng: 55.2370 },
  { name: "Bluewaters",        lat: 25.0815, lng: 55.1190 },
  { name: "Festival City",     lat: 25.2239, lng: 55.3521 },
  { name: "Nad Al Sheba",      lat: 25.1608, lng: 55.3227 },
  { name: "Al Mamzar",         lat: 25.2990, lng: 55.3460 },
];

const BROAD_QUERIES = [
  "cafe",
  "coffee shop",
  "espresso bar",
  "coffee",
  "brunch spot",
];

/* ================================
   HELPERS
================================ */

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let totalApiCalls = 0;

async function searchQuery(query, bias, uniquePlaces) {
  const label = bias ? `${query} [${bias.name}]` : query;
  console.log(`🔎 ${label}`);

  let nextPageToken = null;
  let page = 0;

  do {
    try {
      const body = {
        textQuery: query,
        pageSize: 20,
        pageToken: nextPageToken || undefined,
      };

      if (bias) {
        body.locationBias = {
          circle: {
            center: { latitude: bias.lat, longitude: bias.lng },
            radius: 2000.0
          }
        };
      }

      const res = await fetch(BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": FIELD_MASK
        },
        body: JSON.stringify(body)
      });

      totalApiCalls++;
      const data = await res.json();

      if (data.error) {
        console.log(`   ⚠️  API Error: ${data.error.message}`);
        break;
      }

      if (data.places) {
        let newCount = 0;
        data.places.forEach(p => {
          if (!uniquePlaces.has(p.id)) {
            uniquePlaces.set(p.id, p);
            newCount++;
          }
        });
        console.log(`   Page ${page} → +${newCount} new | Total Unique: ${uniquePlaces.size}`);
      }

      nextPageToken = data.nextPageToken;
      if (nextPageToken) await sleep(2000);
      page++;

    } catch (err) {
      console.log(`   ❌ Fetch Error: ${err.message}`);
      break;
    }

  } while (nextPageToken);

  await sleep(1200);
}

/* ================================
   MAIN COLLECTOR
================================ */

async function runCollector() {
  const uniquePlaces = new Map();

  console.log("🚀 Starting Dubai Cafe Collection — Target: 3,000–4,000\n");
  console.log("=".repeat(60));

  // ── PASS 1: Keyword queries (no bias) ────────────────────────
  console.log("\n📍 PASS 1: Keyword Queries (Unbiased)\n");
  for (const query of SEARCH_QUERIES) {
    await searchQuery(query, null, uniquePlaces);
  }
  console.log(`\n✅ After Pass 1: ${uniquePlaces.size} unique cafes`);

  // ── PASS 2: Broad queries × every area bias ──────────────────
  console.log("\n📍 PASS 2: Area-Biased Queries\n");
  for (const bias of AREA_BIASES) {
    for (const query of BROAD_QUERIES) {
      await searchQuery(query, bias, uniquePlaces);
    }
    console.log(`   📌 ${bias.name} done → Running total: ${uniquePlaces.size}\n`);
  }
  console.log(`\n✅ After Pass 2: ${uniquePlaces.size} unique cafes`);

  // ── PASS 3: Wide-radius sweeps ───────────────────────────────
  console.log("\n📍 PASS 3: Wide-Radius Sweep (5 km)\n");

  const WIDE_SWEEP_CENTERS = [
    { name: "Dubai North",  lat: 25.3000, lng: 55.3500 },
    { name: "Dubai South",  lat: 25.0000, lng: 55.1700 },
    { name: "Dubai East",   lat: 25.2000, lng: 55.4500 },
    { name: "Dubai West",   lat: 25.1000, lng: 55.1000 },
    { name: "Dubai Center", lat: 25.2000, lng: 55.2700 },
  ];

  const WIDE_QUERIES = ["cafe", "coffee shop", "coffee", "espresso"];

  for (const center of WIDE_SWEEP_CENTERS) {
    for (const query of WIDE_QUERIES) {
      console.log(`🔎 ${query} [Wide: ${center.name}]`);
      let nextPageToken = null;
      let page = 0;

      do {
        try {
          const res = await fetch(BASE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": API_KEY,
              "X-Goog-FieldMask": FIELD_MASK
            },
            body: JSON.stringify({
              textQuery: query + " in Dubai",
              pageSize: 20,
              pageToken: nextPageToken || undefined,
              locationBias: {
                circle: {
                  center: { latitude: center.lat, longitude: center.lng },
                  radius: 5000.0
                }
              }
            })
          });

          totalApiCalls++;
          const data = await res.json();

          if (data.error) {
            console.log(`   ⚠️  API Error: ${data.error.message}`);
            break;
          }

          if (data.places) {
            let newCount = 0;
            data.places.forEach(p => {
              if (!uniquePlaces.has(p.id)) {
                uniquePlaces.set(p.id, p);
                newCount++;
              }
            });
            console.log(`   Page ${page} → +${newCount} new | Total Unique: ${uniquePlaces.size}`);
          }

          nextPageToken = data.nextPageToken;
          if (nextPageToken) await sleep(2000);
          page++;

        } catch (err) {
          console.log(`   ❌ Fetch Error: ${err.message}`);
          break;
        }

      } while (nextPageToken);

      await sleep(1200);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🏁 COLLECTION COMPLETE");
  console.log(`⭐ Total Unique Cafes: ${uniquePlaces.size}`);
  console.log(`📡 Total API Calls Made: ${totalApiCalls}`);
  console.log("=".repeat(60));

  return Array.from(uniquePlaces.values());
}

/* ================================
   EXPORT TO EXCEL
================================ */

function exportToExcel(places) {
  console.log("\n📁 Exporting to Excel...");

  const rows = places.map(p => {
    const cuisine = classifyCuisine(p.types || [], p.displayName?.text || "");
    return {
      Name:               p.displayName?.text || "",
      Address:            p.formattedAddress || "",
      Rating:             p.rating || "",
      Reviews:            p.userRatingCount || "",
      Latitude:           p.location?.latitude || "",
      Longitude:          p.location?.longitude || "",
      Place_ID:           p.id || "",
      Cuisine_Primary:    cuisine.primary,
      Cuisine_Secondary:  cuisine.secondary || "",
      Cuisine_Confidence: cuisine.confidence,
      Fusion:             isFusion(cuisine) ? "YES" : "NO",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] || "").length))
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dubai Cafes");
  XLSX.writeFile(wb, "dubai_cafes_PRODUCTION.xlsx");

  console.log(`✅ Excel Saved: dubai_cafes_PRODUCTION.xlsx (${rows.length} rows)`);
}

/* ================================
   RUN
================================ */

(async () => {
  try {
    const places = await runCollector();
    exportToExcel(places);
  } catch (err) {
    console.error("❌ Fatal Error:", err);
  }
})();