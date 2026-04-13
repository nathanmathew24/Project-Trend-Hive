import fetch from "node-fetch";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("🚗 PARKING ENRICHER STARTED");

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "AIzaSyA7v3FbaJ2bvlNQlOCFa-Iv4Jrn02v-wPE";

const INPUT_FILE  = path.join(__dirname, "dubai_cafes_PRODUCTION.xlsx");
const OUTPUT_FILE = path.join(__dirname, "dubai_cafes_with_parking.xlsx");
const CHECKPOINT_FILE = path.join(__dirname, "parking_checkpoint.json");

const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const FIELD_MASK  = ["id", "displayName", "parkingOptions"].join(",");

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function readExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function writeExcel(filePath, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Parking");
  XLSX.writeFile(wb, filePath);
}

// Save progress so we can resume if interrupted
function saveCheckpoint(completedRows, lastIndex) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex, completedRows }));
}

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
    console.log(`📂 Resuming from row ${data.lastIndex + 1}...`);
    return data;
  }
  return null;
}

async function getParking(placeId) {
  const res = await fetch(`${DETAILS_URL}${encodeURIComponent(placeId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": FIELD_MASK
    }
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Details ${res.status}: ${JSON.stringify(data)}`);
  }

  const po = data.parkingOptions || {};

  return {
    name:               data.displayName?.text || "",
    free_parking_lot:   po.freeParkingLot      ?? "",
    paid_parking_lot:   po.paidParkingLot      ?? "",
    free_street_parking:po.freeStreetParking   ?? "",
    paid_street_parking:po.paidStreetParking   ?? "",
    valet_parking:      po.valetParking        ?? "",
    parking_garage:     po.parkingGarage       ?? ""
  };
}

async function run() {
  const cafes = readExcel(INPUT_FILE);

  const cols     = cafes.length ? Object.keys(cafes[0]) : [];
  const placeKey = cols.find(k => k.toLowerCase() === "place_id") ||
                   cols.find(k => k.toLowerCase().includes("place"));

  if (!placeKey) {
    console.log("❌ Could not find Place_ID column. Columns:", cols);
    return;
  }

  console.log(`📊 Total rows: ${cafes.length}`);
  console.log(`🔑 Using Place ID column: "${placeKey}"`);

  // Load checkpoint if exists
  const checkpoint = loadCheckpoint();
  let startIndex   = checkpoint ? checkpoint.lastIndex + 1 : 0;
  let out          = checkpoint ? checkpoint.completedRows  : [];

  const startTime = Date.now();

  for (let i = startIndex; i < cafes.length; i++) {
    const row     = cafes[i];
    const placeId = row[placeKey];

    // Progress + ETA
    const done    = i + 1;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate    = (done - startIndex) / elapsed;
    const remaining = Math.round((cafes.length - done) / (rate || 1));
    const eta     = rate > 0 ? `ETA ~${Math.floor(remaining / 60)}m ${remaining % 60}s` : "";
    process.stdout.write(`\r[${done}/${cafes.length}] ${eta}    `);

    if (!placeId) {
      out.push({ ...row, parking_error: "Missing Place_ID" });
      continue;
    }

    try {
      const parking = await getParking(placeId);
      out.push({
        ...row,
        Name:               parking.name || row.Name || "",
        free_parking_lot:   parking.free_parking_lot,
        paid_parking_lot:   parking.paid_parking_lot,
        free_street_parking:parking.free_street_parking,
        paid_street_parking:parking.paid_street_parking,
        valet_parking:      parking.valet_parking,
        parking_garage:     parking.parking_garage
      });
      await sleep(120);
    } catch (e) {
      out.push({ ...row, parking_error: String(e.message || e) });
      await sleep(200);
    }

    // Save checkpoint every 100 rows
    if ((i + 1) % 100 === 0) {
      saveCheckpoint(out, i);
      console.log(`\n💾 Checkpoint saved at row ${i + 1}`);
    }
  }

  console.log(`\n✅ Saving: ${OUTPUT_FILE}`);
  writeExcel(OUTPUT_FILE, out);

  // Clean up checkpoint file on success
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log("🗑️  Checkpoint cleared.");
  }

  console.log("🎉 Done! Total rows processed:", out.length);
}

run().catch(err => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
