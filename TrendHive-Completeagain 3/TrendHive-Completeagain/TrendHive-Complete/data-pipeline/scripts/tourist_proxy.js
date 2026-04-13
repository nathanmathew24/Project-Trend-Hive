import fetch from "node-fetch";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * TOURIST PROXY BUILDER (Dubai cafés)
 * - Reads cafes from an Excel file (must include Place_ID; lat/lng optional)
 * - For each cafe, calls Places Nearby Search to count:
 *     hotels, attractions, malls within radius
 * - Exports a new Excel with those columns
 */

console.log(" TOURIST PROXY SCRIPT STARTED");

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "AIzaSyAJjeHZOp4spXnn2f4Ds1YMT05KF1Zulp8";

// Input / Output (paths relative to script so it works from any cwd)
const INPUT_XLSX = path.join(__dirname, "dubai_cafes_PRODUCTION.xlsx");
const OUTPUT_XLSX = path.join(__dirname, "dubai_cafes_with_tourist_proxy.xlsx");

// Places endpoints
const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";

// Tuning
const RADIUS_METERS = 1500;          // try 1000, 1500, 2000
const MAX_RESULTS = 20;              // Nearby max results to return
const SLEEP_MS = 250;                // keep gentle to avoid rate issues
const CONCURRENCY = 5;               // parallel cafes processed

// Field masks
const NEARBY_FIELD_MASK = [
  "places.id",
  "places.types"
].join(",");

// If you don't already have lat/lng in your Excel, we fetch it here:
const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "location"
].join(",");

// Tourist proxy categories (includedTypes uses Google place types)
const HOTEL_TYPES = ["lodging"]; // lodging is the broad umbrella (hotels, etc.)
const ATTRACTION_TYPES = [
  "tourist_attraction",
  "museum",
  "amusement_park",
  "art_gallery",
  "zoo",
  "aquarium"
];
const MALL_TYPES = ["shopping_mall"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function placesNearbyCount(lat, lng, includedTypes) {
  const body = {
    includedTypes,
    maxResultCount: MAX_RESULTS,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: RADIUS_METERS
      }
    }
  };

  const res = await fetch(NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": NEARBY_FIELD_MASK
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Nearby error ${res.status}: ${JSON.stringify(data)}`);
  }

  return (data.places || []).length;
}

async function getLatLngFromPlaceId(placeId) {
  const url = `${DETAILS_URL}${encodeURIComponent(placeId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Details error ${res.status}: ${JSON.stringify(data)}`);
  }

  const lat = data?.location?.latitude;
  const lng = data?.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }
  return { lat, lng };
}

function readExcelRows(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function writeExcelRows(path, rows, sheetName = "Tourist Proxy") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, path);
}

async function processOneCafe(row) {
  const placeId = row.Place_ID || row.place_id || row.placeId;
  if (!placeId) return { ...row, tourist_error: "Missing Place_ID" };

  // use existing lat/lng if present
  let lat = Number(row.Latitude || row.latitude);
  let lng = Number(row.Longitude || row.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const loc = await getLatLngFromPlaceId(placeId);
    if (!loc) return { ...row, tourist_error: "No lat/lng from details" };
    lat = loc.lat;
    lng = loc.lng;
  }

  // 3 nearby calls (hotels, attractions, malls)
  const hotels = await placesNearbyCount(lat, lng, HOTEL_TYPES);
  await sleep(SLEEP_MS);

  const attractions = await placesNearbyCount(lat, lng, ATTRACTION_TYPES);
  await sleep(SLEEP_MS);

  const malls = await placesNearbyCount(lat, lng, MALL_TYPES);
  await sleep(SLEEP_MS);

  // Simple score (edit weights if you want)
  const touristScore = (hotels * 2) + (attractions * 3) + (malls * 2);

  return {
    ...row,
    Latitude: lat,
    Longitude: lng,
    hotels_1500m: hotels,
    attractions_1500m: attractions,
    malls_1500m: malls,
    tourist_score: touristScore
  };
}

async function run() {
  console.log("Loading Excel:", INPUT_XLSX);
  const rows = readExcelRows(INPUT_XLSX);

  console.log("Rows:", rows.length);
  const out = [];

  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= rows.length) break;
      const r = rows[idx];
      try {
        const updated = await processOneCafe(r);
        out[idx] = updated;
        if ((idx + 1) % 25 === 0) {
          console.log(`Processed ${idx + 1}/${rows.length}`);
        }
      } catch (e) {
        out[idx] = { ...r, tourist_error: String(e.message || e) };
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log("📁 Writing:", OUTPUT_XLSX);
  writeExcelRows(OUTPUT_XLSX, out);
  console.log(" Done.");
}

run().catch((e) => {
  console.error(" Fatal:", e);
  process.exit(1);
});
