import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
DUBAI FOOTFALL SCORE

Uses:
✔ Population Density  → from dubai_cafes_with_population.xlsx
✔ Tourist Score       → from dubai_cafes_with_tourist_proxy.xlsx
✔ Reviews Count       → from dubai_cafes_PRODUCTION.xlsx (Reviews column)

Formula:
  Footfall = (PopNorm × 0.45) + (TouristNorm × 0.40) + (ReviewNorm × 0.15)
*/

console.log("🚀 FOOTFALL SCORE SCRIPT STARTED");

// ── INPUT: tourist proxy file (already has lat/lng + tourist_score)
// ── We also join population from the population file
const INPUT_TOURIST    = path.join(__dirname, "dubai_cafes_with_tourist_proxy.xlsx");
const INPUT_POPULATION = path.join(__dirname, "dubai_cafes_with_population.xlsx");
const OUTPUT_FILE      = path.join(__dirname, "dubai_cafes_FINAL_FOOTFALL.xlsx");

// ---------- HELPERS ----------

function getMinMax(arr) {
  return { min: Math.min(...arr), max: Math.max(...arr) };
}

function normalize(val, min, max) {
  if (max === min) return 0;
  return ((val - min) / (max - min)) * 100;
}

function safeNumber(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  return Number(v) || 0;
}

// ---------- LOAD EXCEL ----------

function loadSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
}

// ---------- MAIN ----------

function run() {
  console.log("📂 Loading tourist proxy data...");
  const touristRows = loadSheet(INPUT_TOURIST);
  console.log(`   ✅ ${touristRows.length} rows loaded`);

  // Build population lookup by Place_ID
  console.log("📂 Loading population density data...");
  const popRows = loadSheet(INPUT_POPULATION);
  const popMap = new Map();
  popRows.forEach(r => {
    const id = r.Place_ID || r.place_id || "";
    if (id) popMap.set(id, safeNumber(r.Population_Density));
  });
  console.log(`   ✅ ${popMap.size} population records loaded\n`);

  // Extract raw values - handle all possible column name variants
  const populations = touristRows.map(r => {
    const id = r.Place_ID || r.place_id || "";
    return popMap.get(id) ??
      safeNumber(r.Population_Density ||
                 r.population_density ||
                 r.population_density_people_per_sqkm || 0);
  });

  const tourists = touristRows.map(r =>
    safeNumber(r.tourist_score || r.Tourist_Score || 0)
  );

  const reviews = touristRows.map(r =>
    safeNumber(r.Reviews ||
               r.reviews ||
               r.userRatingCount ||
               r.review_count ||
               r.Total_Reviews || 0)
  );

  // Log transform reviews to reduce outlier effect
  const reviewsLog = reviews.map(v => Math.log(v + 1));

  // Get ranges for normalization
  const popRange    = getMinMax(populations);
  const touristRange = getMinMax(tourists);
  const reviewRange  = getMinMax(reviewsLog);

  console.log("📊 Value ranges:");
  console.log(`   Population:  ${popRange.min.toFixed(0)} – ${popRange.max.toFixed(0)}`);
  console.log(`   Tourist:     ${touristRange.min} – ${touristRange.max}`);
  console.log(`   Reviews(log):${reviewRange.min.toFixed(2)} – ${reviewRange.max.toFixed(2)}\n`);

  console.log("⚙️  Calculating footfall scores...");

  const output = touristRows.map((r, i) => {
    const popNorm     = normalize(populations[i],   popRange.min,    popRange.max);
    const touristNorm = normalize(tourists[i],       touristRange.min, touristRange.max);
    const reviewNorm  = normalize(reviewsLog[i],     reviewRange.min,  reviewRange.max);

    // ⭐ DUBAI FOOTFALL FORMULA
    const footfallScore =
      (popNorm    * 0.45) +
      (touristNorm * 0.40) +
      (reviewNorm  * 0.15);

    return {
      ...r,
      Population_Density:  populations[i].toFixed(0),
      population_index:    popNorm.toFixed(2),
      tourist_index:       touristNorm.toFixed(2),
      demand_index:        reviewNorm.toFixed(2),
      Footfall_Score:      footfallScore.toFixed(2),
      Footfall_Tier:       footfallTier(footfallScore),
    };
  });

  // Sort by footfall score descending
  output.sort((a, b) => parseFloat(b.Footfall_Score) - parseFloat(a.Footfall_Score));

  // Add rank
  output.forEach((r, i) => { r.Footfall_Rank = i + 1; });

  console.log("💾 Saving final dataset...");
  const newWs = XLSX.utils.json_to_sheet(output);

  // Auto-size columns
  const colWidths = Object.keys(output[0] || {}).map(key => ({
    wch: Math.max(key.length, ...output.map(r => String(r[key] || "").length))
  }));
  newWs["!cols"] = colWidths;

  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, newWs, "Dubai Footfall Final");
  XLSX.writeFile(newWb, OUTPUT_FILE);

  // Summary stats
  const scores = output.map(r => parseFloat(r.Footfall_Score));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  console.log("\n" + "=".repeat(50));
  console.log("📈 FOOTFALL SCORE SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total Cafes:    ${output.length}`);
  console.log(`Avg Score:      ${avg.toFixed(2)}`);
  console.log(`Top Score:      ${scores[0].toFixed(2)}`);
  console.log(`Lowest Score:   ${scores[scores.length - 1].toFixed(2)}`);
  console.log("\nTier Distribution:");
  const tiers = { "🔥 Very High": 0, "⬆️ High": 0, "➡️ Medium": 0, "⬇️ Low": 0, "❄️ Very Low": 0 };
  output.forEach(r => { tiers[r.Footfall_Tier] = (tiers[r.Footfall_Tier] || 0) + 1; });
  Object.entries(tiers).forEach(([t, n]) => console.log(`  ${t}: ${n} cafes`));
  console.log("=".repeat(50));
  console.log(`\n✅ FINAL FILE READY → ${OUTPUT_FILE}`);
}

function footfallTier(score) {
  if (score >= 80) return "🔥 Very High";
  if (score >= 60) return "⬆️ High";
  if (score >= 40) return "➡️ Medium";
  if (score >= 20) return "⬇️ Low";
  return "❄️ Very Low";
}

try {
  run();
} catch (e) {
  console.error("❌ Fatal error:", e);
  process.exit(1);
}
