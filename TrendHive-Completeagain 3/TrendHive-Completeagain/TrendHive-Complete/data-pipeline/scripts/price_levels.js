import fetch from "node-fetch";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(" PRICE LEVELS SCRIPT STARTED");

const API_KEY = "AIzaSyAJjeHZOp4spXnn2f4Ds1YMT05KF1Zulp8";
const INPUT_FILE = path.join(__dirname, "dubai_cafes_PRODUCTION.xlsx");
const OUTPUT_FILE = path.join(__dirname, "dubai_cafes_price_levels.xlsx");

const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const FIELD_MASK = ["displayName", "priceLevel", "rating", "userRatingCount"].join(",");

function decodePriceLevel(level) {
  // String enums from API
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE": return "$";
    case "PRICE_LEVEL_MODERATE": return "$$";
    case "PRICE_LEVEL_EXPENSIVE": return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE": return "$$$$";
    default: break;
  }
  // Numeric from API (0 = free, 1 = $, 2 = $$, 3 = $$$, 4 = $$$$)
  const n = Number(level);
  if (n === 0) return "";  // free / inexpensive → blank
  if (n === 1) return "$";
  if (n === 2) return "$$";
  if (n === 3) return "$$$";
  if (n === 4) return "$$$$";
  return "";
}

function priceLabel(level) {
  if (level === 0) return "Free";
  if (level === 1) return "Cheap";
  if (level === 2) return "Moderate";
  if (level === 3) return "Expensive";
  if (level === 4) return "Very Expensive";
  return "";
}

async function run() {
  // 1) Read your existing cafes sheet
  const wb = XLSX.readFile(INPUT_FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const cafes = XLSX.utils.sheet_to_json(sheet);

  if (!cafes.length) {
    console.log(" No rows found in Excel. Make sure the first sheet has data.");
    return;
  }

  // 2) Detect Place_ID column
  const sampleKeys = Object.keys(cafes[0]);
  const placeIdKey =
    sampleKeys.find((k) => k.toLowerCase() === "place_id") ||
    sampleKeys.find((k) => k.toLowerCase().includes("place"));

  if (!placeIdKey) {
    console.log(" Could not find Place_ID column. Your Excel must have a Place_ID column.");
    console.log("Found columns:", sampleKeys);
    return;
  }

  console.log(` Using Place ID column: ${placeIdKey}`);
  console.log(` Rows to process: ${cafes.length}`);

  const results = [];

  // 3) For each cafe, call Places Details and grab priceLevel
  for (let i = 0; i < cafes.length; i++) {
    const placeId = cafes[i][placeIdKey];

    if (!placeId) continue;

    console.log(` ${i + 1}/${cafes.length} Price lookup...`);

    try {
      const res = await fetch(`${DETAILS_URL}${placeId}`, {
        headers: {
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": FIELD_MASK,
        },
      });

      const data = await res.json();

      const rawLevel = data.priceLevel ?? "";
      const price = decodePriceLevel(rawLevel);
      const hasPrice = rawLevel !== "" && rawLevel !== undefined && rawLevel !== null;

      results.push({
        Cafe: data.displayName?.text || cafes[i].Name || "",
        Price: price,
        Price_Source: hasPrice ? "Google" : "Not available",
        Place_ID: placeId,
        Name: data.displayName?.text || cafes[i].Name || "",
        Price_Level_Number: rawLevel,
        Price_Level_Label: priceLabel(rawLevel),
        Rating: data.rating ?? "",
        Reviews_Count: data.userRatingCount ?? "",
      });

      // small delay (reduces random throttling)
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      results.push({
        Cafe: cafes[i].Name || "",
        Price: "",
        Price_Source: "Error",
        Place_ID: placeId,
        Name: cafes[i].Name || "",
        Price_Level_Number: "",
        Price_Level_Label: "",
        Rating: "",
        Reviews_Count: "",
      });
    }
  }

  // 4) Summary: how many had price from Google?
  const withPrice = results.filter((r) => r.Price !== "").length;
  const withoutPrice = results.length - withPrice;
  console.log(` Price levels: ${withPrice} from Google, ${withoutPrice} blank (Google has no data for those places)`);

  // 5) Export to new Excel
  const ws = XLSX.utils.json_to_sheet(results);
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, ws, "Price Levels");
  XLSX.writeFile(outWb, OUTPUT_FILE);

  console.log(` Done. Saved: ${OUTPUT_FILE}`);
  if (withoutPrice > 0) {
    console.log(` Blanks = Google doesn't provide price level for that cafe (optional field). You can filter by "Price_Source" column.`);
  }
}

run().catch((e) => {
  console.error(" Fatal error:", e);
  process.exit(1);
});