import fetch from "node-fetch";
import XLSX from "xlsx";

/* ================================
   INLINED CLASSIFIER
   (kept for re-use; production data
    already has cuisine columns too)
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
      if (text.includes(kw)) { matches.push(rule.primary); break; }
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

// ⬇️  Point this at your production Excel (4,221 cafes)
const PRODUCTION_EXCEL = "dubai_cafes_PRODUCTION.xlsx";

const MIN_REVIEWS = 50;

const DETAIL_FIELD_MASK = [
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "id",
  "types",
  "googleMapsUri",
  "reviews",
  "regularOpeningHours",
  "businessStatus"
].join(",");

/* ================================
   HELPERS
================================ */

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function calculateYearsOfOperation(openingDate) {
  if (!openingDate) return null;
  try {
    const opened = new Date(openingDate);
    const now = new Date();
    const years = (now - opened) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(0, parseFloat(years.toFixed(1)));
  } catch { return null; }
}

/* ================================
   LOAD FROM PRODUCTION EXCEL
   Replaces the old runCollector()
================================ */

function loadFromExcel(filePath) {
  console.log(`📂 Loading cafes from: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log(`✅ Loaded ${rows.length} cafes from Excel\n`);

  // Normalise rows into the same shape the rest of the code expects
  return rows.map(row => ({
    id:               row.Place_ID  || "",
    displayName:      { text: row.Name || "" },
    formattedAddress: row.Address   || "",
    rating:           Number(row.Rating)   || 0,
    userRatingCount:  Number(row.Reviews)  || 0,
    location: {
      latitude:  Number(row.Latitude)  || 0,
      longitude: Number(row.Longitude) || 0,
    },
    // Pre-classified cuisine — reused directly in exports
    _cuisinePrimary:    row.Cuisine_Primary    || "Cafe",
    _cuisineSecondary:  row.Cuisine_Secondary  || "",
    _cuisineConfidence: row.Cuisine_Confidence || "Low",
    _fusion:            row.Fusion === "YES",
    // Populated after details fetch
    types:          [],
    googleMapsUri:  "",
    reviews:        [],
    openingDate:    null,
    businessStatus: null,
    reviewsFetched: 0,
  }));
}

/* ================================
   FILTER BY MIN REVIEWS
================================ */

function filterByReviewCount(places, minReviews) {
  console.log(`🔍 Filtering cafes with at least ${minReviews} reviews...`);
  const filtered = places.filter(p => (p.userRatingCount || 0) >= minReviews);
  console.log(`✅ Found ${filtered.length} cafes with ${minReviews}+ reviews`);
  console.log(`   (Filtered out ${places.length - filtered.length} cafes)\n`);
  return filtered;
}

/* ================================
   GET PLACE DETAILS + REVIEWS
================================ */

async function getPlaceDetailsWithReviews(placeId) {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": DETAIL_FIELD_MASK
        }
      }
    );
    if (!res.ok) {
      console.log(`   ⚠️  HTTP ${res.status} for ${placeId}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return null;
  }
}

/* ================================
   FETCH REVIEWS FOR ALL CAFES
================================ */

async function fetchReviewsForCafes(cafes) {
  console.log("📝 Fetching reviews for cafes...\n");
  const cafesWithReviews = [];
  let count = 0;

  for (const cafe of cafes) {
    count++;
    const name = cafe.displayName?.text || "Unknown";
    console.log(`   [${count}/${cafes.length}] ${name} (${cafe.userRatingCount} reviews)`);

    const details = await getPlaceDetailsWithReviews(cafe.id);

    cafesWithReviews.push({
      ...cafe,
      rating:          details?.rating           ?? cafe.rating,
      userRatingCount: details?.userRatingCount   ?? cafe.userRatingCount,
      googleMapsUri:   details?.googleMapsUri     || "",
      types:           details?.types             || [],
      reviews:         details?.reviews           || [],
      openingDate:     details?.regularOpeningHours?.openingDate || null,
      businessStatus:  details?.businessStatus    || null,
      reviewsFetched:  details?.reviews?.length   || 0,
    });

    await sleep(150);

    if (count % 50 === 0) {
      console.log(`\n   ✓ Checkpoint: ${count} / ${cafes.length} processed\n`);
    }
  }

  console.log("\n✅ Review Fetching Complete\n");
  return cafesWithReviews;
}

/* ================================
   EXPORT - CAFE SUMMARY
================================ */

function exportCafeSummary(cafes, filename) {
  console.log("📊 Exporting cafe summary...");

  const rows = cafes.map(p => {
    const yearsOfOperation = calculateYearsOfOperation(p.openingDate);

    // Prefer live types from API; fall back to pre-classified Excel values
    const hasFreshTypes = p.types && p.types.length > 0;
    const cuisine = hasFreshTypes
      ? classifyCuisine(p.types, p.displayName?.text || "")
      : { primary: p._cuisinePrimary, secondary: p._cuisineSecondary || null, confidence: p._cuisineConfidence };

    return {
      Name:               p.displayName?.text   || "",
      Address:            p.formattedAddress     || "",
      Overall_Rating:     p.rating              || 0,
      Total_Reviews:      p.userRatingCount      || 0,
      Reviews_Fetched:    p.reviewsFetched       || 0,
      Latitude:           p.location?.latitude   || "",
      Longitude:          p.location?.longitude  || "",
      Place_ID:           p.id                  || "",
      Opening_Date:       p.openingDate          || "N/A",
      Years_Of_Operation: yearsOfOperation !== null ? yearsOfOperation : "N/A",
      Business_Status:    p.businessStatus       || "N/A",
      Cuisine_Primary:    cuisine.primary,
      Cuisine_Secondary:  cuisine.secondary      || "",
      Cuisine_Confidence: cuisine.confidence,
      Fusion:             isFusion(cuisine)      ? "YES" : "NO",
      Google_Maps_URL:    p.googleMapsUri        || "",
    };
  });

  // Auto-size columns
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] || "").length))
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cafes Summary");
  XLSX.writeFile(wb, filename);
  console.log(`✅ Saved: ${filename} (${rows.length} rows)`);
}

/* ================================
   EXPORT - ALL REVIEWS
================================ */

function exportAllReviews(cafes, filename) {
  console.log("📊 Exporting all reviews...");
  const reviewRows = [];

  cafes.forEach(cafe => {
    const cafeName    = cafe.displayName?.text || "Unknown";
    const cafeAddress = cafe.formattedAddress  || "";
    const cafeRating  = cafe.rating            || 0;
    const placeId     = cafe.id                || "";

    (cafe.reviews || []).forEach(review => {
      reviewRows.push({
        Cafe_Name:           cafeName,
        Cafe_Address:        cafeAddress,
        Cafe_Overall_Rating: cafeRating,
        Cafe_Total_Reviews:  cafe.userRatingCount || 0,
        Place_ID:            placeId,
        Review_Author:       review.authorAttribution?.displayName || "Anonymous",
        Review_Rating:       review.rating || 0,
        Review_Text:         review.text?.text || review.originalText?.text || "",
        Review_Date:         review.relativePublishTimeDescription || review.publishTime || "",
        Review_Language:     review.text?.languageCode || "",
        Author_Photo_URL:    review.authorAttribution?.photoUri || "",
        Author_Profile_URL:  review.authorAttribution?.uri     || "",
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(reviewRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "All Reviews");
  XLSX.writeFile(wb, filename);
  console.log(`✅ Saved: ${filename}`);
  console.log(`   Total Reviews Exported: ${reviewRows.length}`);
}

/* ================================
   PRINT STATISTICS
================================ */

function printStatistics(cafes) {
  console.log("\n" + "=".repeat(50));
  console.log("📈 COLLECTION STATISTICS");
  console.log("=".repeat(50));

  const totalReviews = cafes.reduce((s, c) => s + (c.userRatingCount || 0), 0);
  const totalFetched = cafes.reduce((s, c) => s + (c.reviewsFetched  || 0), 0);
  const avgRating    = cafes.reduce((s, c) => s + (c.rating          || 0), 0) / cafes.length;
  const withDate     = cafes.filter(c => c.openingDate).length;

  console.log(`Total Cafes Processed:    ${cafes.length}`);
  console.log(`Total Reviews (reported): ${totalReviews.toLocaleString()}`);
  console.log(`Reviews Fetched via API:  ${totalFetched} (max 5 per place)`);
  console.log(`Average Rating:           ${avgRating.toFixed(2)} ⭐`);
  console.log(`Cafes with Opening Date:  ${withDate}`);
  console.log(`Avg Reviews per Cafe:     ${Math.round(totalReviews / cafes.length)}`);

  const buckets = { "4.5+": 0, "4.0-4.5": 0, "3.5-4.0": 0, "Below 3.5": 0 };
  cafes.forEach(c => {
    const r = c.rating || 0;
    if      (r >= 4.5) buckets["4.5+"]++;
    else if (r >= 4.0) buckets["4.0-4.5"]++;
    else if (r >= 3.5) buckets["3.5-4.0"]++;
    else               buckets["Below 3.5"]++;
  });

  console.log("\nRating Distribution:");
  Object.entries(buckets).forEach(([range, n]) => console.log(`  ${range}: ${n} cafes`));
  console.log("=".repeat(50) + "\n");
}

/* ================================
   RUN
================================ */

(async () => {
  try {
    // Step 1: Load 4,221 cafes from production Excel (no API search needed)
    const allPlaces = loadFromExcel(PRODUCTION_EXCEL);

    // Step 2: Filter by minimum review count
    const filteredCafes = filterByReviewCount(allPlaces, MIN_REVIEWS);
    if (filteredCafes.length === 0) {
      console.log("❌ No cafes meet the minimum review count."); return;
    }

    // Step 3: Fetch detailed info + reviews from Google Places API
    const cafesWithReviews = await fetchReviewsForCafes(filteredCafes);

    // Step 4: Export two Excel files
    exportCafeSummary(cafesWithReviews, `dubai_cafes_${MIN_REVIEWS}plus_reviews_SUMMARY.xlsx`);
    exportAllReviews(cafesWithReviews,  `dubai_cafes_${MIN_REVIEWS}plus_reviews_ALL_REVIEWS.xlsx`);

    // Step 5: Stats
    printStatistics(cafesWithReviews);

    console.log("🎉 Complete! Check the generated Excel files.");
  } catch (err) {
    console.error("❌ Fatal Error:", err);
  }
})();
