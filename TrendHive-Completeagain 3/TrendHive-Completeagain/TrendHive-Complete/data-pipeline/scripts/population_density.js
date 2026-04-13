/**
 * Population Density Enrichment
 * 
 * Reads UAE_population_density.tif (local GeoTIFF, no API needed)
 * and adds a Population_Density column to each cafe using its lat/lng.
 * 
 * Install: npm install geotiff xlsx
 * Run:     node population_density.js
 */

import { fromFile } from "geotiff";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INPUT_CAFES  = path.join(__dirname, "dubai_cafes_PRODUCTION.xlsx");
const INPUT_TIFF   = path.join(__dirname, "UAE_population_density.tif");
const OUTPUT_FILE  = path.join(__dirname, "dubai_cafes_with_population.xlsx");

/* ================================
   GeoTIFF metadata (pre-parsed)
   Origin top-left corner + pixel size
================================ */
const ORIGIN_LON = 51.11541646787961;
const ORIGIN_LAT = 26.082916759919883;
const PIXEL_SIZE = 0.0083333333; // degrees per pixel (~1 km)
const RASTER_W   = 632;
const RASTER_H   = 430;
const NODATA     = -1; // treat negatives as no data

/* ================================
   Convert lat/lng → pixel row/col
================================ */
function latlngToPixel(lat, lng) {
  const col = Math.floor((lng - ORIGIN_LON) / PIXEL_SIZE);
  const row = Math.floor((ORIGIN_LAT - lat) / PIXEL_SIZE);
  return { row, col };
}

/* ================================
   Density label
================================ */
function densityLabel(value) {
  if (value === null || value < 0)  return "No Data";
  if (value === 0)                  return "Uninhabited";
  if (value < 500)                  return "Very Low";
  if (value < 2000)                 return "Low";
  if (value < 5000)                 return "Medium";
  if (value < 15000)                return "High";
  return "Very High";
}

/* ================================
   MAIN
================================ */
async function run() {
  console.log("🚀 Population Density Enrichment Starting...\n");

  // ── Load GeoTIFF ──────────────────────────────────────────
  console.log(`📂 Loading raster: ${INPUT_TIFF}`);
  const tiff   = await fromFile(INPUT_TIFF);
  const image  = await tiff.getImage();
  const raster = await image.readRasters({ interleave: true });
  // raster is a flat Float32Array — index = row * width + col
  console.log(`✅ Raster loaded (${RASTER_W} x ${RASTER_H} pixels)\n`);

  // ── Load cafes ────────────────────────────────────────────
  console.log(`📂 Loading cafes: ${INPUT_CAFES}`);
  const wb    = XLSX.readFile(INPUT_CAFES);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const cafes = XLSX.utils.sheet_to_json(sheet);
  console.log(`✅ Loaded ${cafes.length} cafes\n`);

  // ── Enrich each cafe ──────────────────────────────────────
  let found = 0, nodata = 0, outOfBounds = 0;
  const rows = [];

  for (let i = 0; i < cafes.length; i++) {
    const cafe = cafes[i];
    const lat  = parseFloat(cafe.Latitude  || cafe.latitude  || 0);
    const lng  = parseFloat(cafe.Longitude || cafe.longitude || 0);
    const name = cafe.Name || cafe.name || "";

    if ((i + 1) % 500 === 0) {
      console.log(`   ✓ Processing ${i + 1} / ${cafes.length}...`);
    }

    let densityValue = null;
    let densityRaw   = null;

    if (lat && lng) {
      const { row, col } = latlngToPixel(lat, lng);

      if (row >= 0 && row < RASTER_H && col >= 0 && col < RASTER_W) {
        const idx = row * RASTER_W + col;
        densityRaw = raster[idx];

        if (densityRaw !== undefined && densityRaw >= 0) {
          densityValue = Math.round(densityRaw);
          found++;
        } else {
          nodata++;
        }
      } else {
        outOfBounds++;
      }
    }

    rows.push({
      ...cafe,
      Population_Density:       densityValue !== null ? densityValue : "N/A",
      Population_Density_Label: densityLabel(densityValue),
    });
  }

  // ── Export ────────────────────────────────────────────────
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] || "").length))
  }));
  ws["!cols"] = colWidths;

  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, ws, "Dubai Cafes");
  XLSX.writeFile(outWb, OUTPUT_FILE);

  // ── Summary ───────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("📈 POPULATION DENSITY SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total Cafes:         ${cafes.length}`);
  console.log(`With density data:   ${found}`);
  console.log(`No data (raster):    ${nodata}`);
  console.log(`Out of bounds:       ${outOfBounds}`);
  console.log("=".repeat(50));

  // Density distribution
  const dist = { "Uninhabited": 0, "Very Low": 0, "Low": 0, "Medium": 0, "High": 0, "Very High": 0, "No Data": 0 };
  rows.forEach(r => { dist[r.Population_Density_Label] = (dist[r.Population_Density_Label] || 0) + 1; });
  console.log("\nDensity Distribution:");
  Object.entries(dist).forEach(([label, count]) => console.log(`  ${label}: ${count} cafes`));

  console.log(`\n✅ Done. Saved: ${OUTPUT_FILE}`);
}

run().catch(e => { console.error("❌ Fatal:", e); process.exit(1); });
