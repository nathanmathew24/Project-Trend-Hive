import React, { useState, useEffect, useMemo, useRef } from "react";
import { S } from "../styles/theme.js";
import { HoneycombBg, AppNav, Card, Loader, FinancialNavButton } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import L from "leaflet";

const TIER_COLORS = {
  "Very High": S.green,
  "High": S.green,
  "Medium": S.accent,
  "Low": S.orange,
  "Very Low": S.red,
};

const TIER_TIPS = {
  "Very High": "Top-tier popularity — high ratings + high review volume. These cafes dominate their area.",
  "High": "Strong popularity — above-average ratings and solid review counts.",
  "Medium": "Average popularity — decent ratings or moderate review volume.",
  "Low": "Below-average popularity — fewer reviews or lower ratings than the area median.",
  "Very Low": "Lowest popularity tier — limited reviews, lower ratings, or new/struggling cafe.",
};

export default function MapPage({ navigate }) {
  const [markers, setMarkers] = useState(null);
  const [cells, setCells] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("markers");
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [overview, setOverview] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const heatLayerRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [m, c, o] = await Promise.all([
        api("/map/markers?limit=4000"),
        api("/map/cells?precision=3"),
        api("/overview/cards"),
      ]);
      setMarkers(m);
      setCells(c);
      setOverview(o);
      setLoading(false);
    }
    load();
  }, []);

  const areas = useMemo(() => {
    if (!markers?.markers) return [];
    const set = new Set(markers.markers.map(m => m.area).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [markers]);

  const filtered = useMemo(() => {
    if (!markers?.markers) return [];
    let list = markers.markers;
    if (selectedArea !== "all") list = list.filter(m => m.area === selectedArea);
    if (search) list = list.filter(m => m.name?.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [markers, selectedArea, search]);

  const tierStats = useMemo(() => {
    if (!filtered.length) return {};
    const counts = {};
    filtered.forEach(m => {
      const t = m.predicted_tier || "Unknown";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [filtered]);

  // Initialize Leaflet map
  useEffect(() => {
    if (loading || !mapRef.current || mapInstanceRef.current) return;

    const dubaiBounds = [
      [24.85, 54.95], // southwest
      [25.55, 55.65], // northeast
    ];
    
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      minZoom: 9,
      maxZoom: 19,
      maxBounds: dubaiBounds,
      maxBoundsViscosity: 1.0,
    });
    
    map.fitBounds(dubaiBounds);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    heatLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [loading]);

  // Update markers/heatmap when data or view changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (markersLayerRef.current) markersLayerRef.current.clearLayers();
    if (heatLayerRef.current) heatLayerRef.current.clearLayers();

    if (view === "markers") {
      const displayList = filtered.slice(0, 2000);
      displayList.forEach(m => {
        if (!m.lat || !m.lng) return;
        const color = TIER_COLORS[m.predicted_tier] || "#888";
        const circle = L.circleMarker([m.lat, m.lng], {
          radius: 6,
          fillColor: color,
          color: color,
          weight: 1,
          opacity: 0.8,
          fillOpacity: 0.6,
        });
        circle.bindPopup(
          `<div style="font-family:system-ui;min-width:200px;">` +
          `<strong style="font-size:14px;">${m.name || "Unknown"}</strong><br/>` +
          `<span style="color:#888;font-size:12px;">${m.area || ""}</span>` +
          `<hr style="border:0;border-top:1px solid #ddd;margin:6px 0;"/>` +
          `<div style="font-size:12px;">` +
          (m.predicted_tier ? `<b>Tier:</b> <span style="color:${color};">${m.predicted_tier}</span><br/>` : "") +
          (m.rating ? `<b>Rating:</b> ${Number(m.rating).toFixed(1)} / 5<br/>` : "") +
          (m.reviews ? `<b>Reviews:</b> ${Number(m.reviews).toLocaleString()}<br/>` : "") +
          (m.sentiment !== undefined ? `<b>Sentiment:</b> ${Number(m.sentiment).toFixed(3)}<br/>` : "") +
          (m.confidence ? `<b>Confidence:</b> ${(m.confidence * 100).toFixed(0)}%` : "") +
          `</div></div>`
        );
        circle.addTo(markersLayerRef.current);
      });

      if (displayList.length > 0) {
        const lats = displayList.filter(m => m.lat && m.lng).map(m => [m.lat, m.lng]);
        if (lats.length > 0) {
          mapInstanceRef.current.fitBounds(lats, { padding: [30, 30], maxZoom: 14 });
        }
      }
    } else {
      const cellData = Array.isArray(cells) ? cells : [];
      cellData.forEach(c => {
        if (!c.lat_cell || !c.lng_cell) return;
        const lat = parseFloat(c.lat_cell);
        const lng = parseFloat(c.lng_cell);
        const step = 0.001;
        const intensity = Math.min((c.cafes || 1) / 30, 1);
        const shareHigh = c.share_high || 0;

        const r = Math.round(255 * (1 - shareHigh));
        const g = Math.round(200 * shareHigh + 50);
        const b = 50;
        const color = `rgb(${r},${g},${b})`;

        const rect = L.rectangle(
          [[lat - step, lng - step], [lat + step, lng + step]],
          { color, weight: 0.5, fillColor: color, fillOpacity: 0.15 + intensity * 0.5 }
        );
        rect.bindPopup(
          `<div style="font-family:system-ui;">` +
          `<strong>${c.cafes} cafes</strong> in cell ${c.cell_id}<br/>` +
          `Avg Rating: ${typeof c.avg_rating === "number" ? c.avg_rating.toFixed(2) : "—"}<br/>` +
          `High Tier Share: ${typeof c.share_high === "number" ? (c.share_high * 100).toFixed(1) + "%" : "—"}<br/>` +
          `Avg Sentiment: ${typeof c.avg_sentiment === "number" ? c.avg_sentiment.toFixed(3) : "—"}` +
          `</div>`
        );
        rect.addTo(heatLayerRef.current);
      });
    }
  }, [filtered, cells, view]);

  if (loading) return (
    <>
      <HoneycombBg />
      <AppNav navigate={navigate} currentPage="map" />
      <FinancialNavButton navigate={navigate} currentPage="map" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />
      <Loader label="Loading map data..." />
    </>
  );

  return (
    <>
      <HoneycombBg />
      <AppNav navigate={navigate} currentPage="map" />
      <FinancialNavButton navigate={navigate} currentPage="map" style={{ margin: "12px 32px 0", position: "relative", zIndex: 1 }} />

      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <h1 style={{ color: S.text, fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>
          Cafe Map Intelligence
        </h1>
        <p style={{ color: S.muted, fontSize: 15, margin: "0 0 24px" }}>
          {markers?.total || 0} cafes across Dubai — powered by ML popularity predictions
        </p>

        {/* Overview Cards */}
        {overview && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Cafes", value: overview.total_cafes?.toLocaleString(), color: S.accent, tip: "Total number of cafes with ML-predicted popularity tiers from our 4,200+ cafe database." },
              { label: "Avg Rating", value: overview.avg_rating?.toFixed(2), color: S.green, tip: "Mean Google Maps rating (1-5 stars) across all tracked cafes." },
              { label: "Avg Reviews", value: Math.round(overview.avg_reviews || 0).toLocaleString(), color: S.blue, tip: "Average number of Google reviews per cafe — indicates overall market engagement." },
              { label: "Top Area", value: overview.top_area, color: S.purple, tip: "The Dubai area with the highest number of tracked cafes." },
              { label: "High/Very High", value: overview.share_high_or_very_high ? `${(overview.share_high_or_very_high * 100).toFixed(1)}%` : "N/A", color: S.green, tip: "Percentage of cafes predicted as 'High' or 'Very High' popularity by our Random Forest model (86.5% accuracy)." },
            ].map((c, i) => (
              <Card key={i} title={c.tip}>
                <div style={{ padding: 16 }}>
                  <p style={{ color: S.muted, fontSize: 12, margin: "0 0 4px", textTransform: "uppercase" }}>{c.label}</p>
                  <p style={{ color: c.color, fontSize: 22, fontWeight: 700, margin: 0 }}>{c.value}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["markers", "heatmap"].map(v => (
              <button key={v} onClick={() => setView(v)}
                title={v === "markers" ? "Show individual cafe locations colored by predicted popularity tier." : "Show geographic grid cells colored by density and tier quality."}
                style={{
                  background: view === v ? S.accent : S.card, border: `1px solid ${view === v ? S.accent : S.cardB}`,
                  color: view === v ? "#000" : S.text, fontWeight: 600, fontSize: 13,
                  padding: "8px 18px", borderRadius: 8, cursor: "pointer",
                }}>
                {v === "markers" ? "Cafe Markers" : "Density Heatmap"}
              </button>
            ))}
          </div>
          <input
            placeholder="Search cafes..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              background: S.card, border: `1px solid ${S.cardB}`, color: S.text,
              padding: "8px 14px", borderRadius: 8, fontSize: 14, width: 220, outline: "none",
            }}
          />
          <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
            style={{
              background: S.card, border: `1px solid ${S.cardB}`, color: S.text,
              padding: "8px 14px", borderRadius: 8, fontSize: 14, outline: "none",
            }}>
            {areas.map(a => <option key={a} value={a}>{a === "all" ? "All Areas" : a}</option>)}
          </select>
        
        </div>

        {/* Tier Distribution Bar */}
        {Object.keys(tierStats).length > 0 && (
          <Card style={{ marginBottom: 20, padding: 16 }}>
            <p style={{ color: S.muted, fontSize: 12, margin: "0 0 10px", textTransform: "uppercase", fontWeight: 600 }}
               title="ML-predicted popularity tier distribution. Tiers derived from: popularity_score = log(1 + Reviews) * Rating, classified by Random Forest (86.5% accuracy).">
              Popularity Tier Distribution
            </p>
            <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", height: 32 }}>
              {["Very High", "High", "Medium", "Low", "Very Low"].map(tier => {
                const count = tierStats[tier] || 0;
                const pct = count / Math.max(filtered.length, 1) * 100;
                if (pct < 1) return null;
                return (
                  <div key={tier} title={`${tier}: ${count} cafes (${pct.toFixed(1)}%) — ${TIER_TIPS[tier]}`}
                    style={{
                      width: `${pct}%`, background: TIER_COLORS[tier] || S.dim,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 600, color: "#000", minWidth: pct > 5 ? "auto" : 0,
                    }}>
                    {pct > 8 ? `${tier} ${pct.toFixed(1)}%` : ""}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
              {["Very High", "High", "Medium", "Low", "Very Low"].map(tier => (
                <span key={tier} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: S.muted, cursor: "help" }}
                      title={TIER_TIPS[tier]}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: TIER_COLORS[tier] }} />
                  {tier}: {tierStats[tier] || 0}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Interactive Leaflet Map */}
        <Card style={{ marginBottom: 20, overflow: "hidden" }}>
          <div ref={mapRef} style={{ width: "100%", height: 520, borderRadius: 14 }} />
        </Card>

        {/* Details below map */}
        {view === "markers" ? (
          <div>
            <h2 style={{ color: S.text, fontSize: 18, fontWeight: 600, margin: "0 0 14px" }}>Cafe Details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
              {filtered.slice(0, 100).map((m, i) => (
                <Card key={i} style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: S.text, fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{m.name}</p>
                      <p style={{ color: S.muted, fontSize: 12, margin: "0 0 6px" }}>{m.area}</p>
                    </div>
                    {m.predicted_tier && (
                      <span title={TIER_TIPS[m.predicted_tier]} style={{
                        background: (TIER_COLORS[m.predicted_tier] || S.dim) + "22",
                        color: TIER_COLORS[m.predicted_tier] || S.dim,
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                      }}>
                        {m.predicted_tier}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                    <span title="Google Maps rating (1-5 stars)" style={{ color: S.accent, fontSize: 13, fontWeight: 600 }}>
                      {m.rating ? `${Number(m.rating).toFixed(1)} / 5` : "—"}
                    </span>
                    <span title="Total Google reviews" style={{ color: S.muted, fontSize: 13 }}>
                      {m.reviews ? `${Number(m.reviews).toLocaleString()} reviews` : ""}
                    </span>
                    {m.sentiment !== undefined && (
                      <span title="Sentiment polarity from NLP review analysis (-1 to +1). Positive = favorable."
                            style={{ color: m.sentiment > 0.1 ? S.green : m.sentiment < -0.1 ? S.red : S.muted, fontSize: 13 }}>
                        Sent: {Number(m.sentiment).toFixed(3)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <span title="GPS coordinates (latitude, longitude)" style={{ color: S.dim, fontSize: 11 }}>
                      {m.lat?.toFixed(4)}, {m.lng?.toFixed(4)}
                    </span>
                    {m.confidence && (
                      <span title="Random Forest model prediction confidence for this cafe's tier"
                            style={{ color: S.dim, fontSize: 11 }}>
                        Conf: {(m.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            {filtered.length > 100 && (
              <p style={{ color: S.muted, fontSize: 13, textAlign: "center", marginTop: 16 }}>
                Showing first 100 of {filtered.length} cafes. Use search or area filter to narrow down.
              </p>
            )}
          </div>
        ) : (
          <div>
            <h2 style={{ color: S.text, fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Grid Cell Details</h2>
            <p style={{ color: S.muted, fontSize: 13, marginBottom: 16 }}
               title="Each cell represents a ~100m geographic grid square with aggregated cafe statistics.">
              Grid cells (~100m precision) showing cafe density, average rating, and popularity distribution.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {(Array.isArray(cells) ? cells : []).sort((a, b) => (b.cafes || 0) - (a.cafes || 0)).slice(0, 80).map((c, i) => (
                <Card key={i} style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ color: S.muted, fontSize: 12, fontFamily: "monospace" }}>{c.cell_id}</span>
                    <span style={{
                      background: S.accent + "22", color: S.accent,
                      fontSize: 13, fontWeight: 700, padding: "2px 10px", borderRadius: 6,
                    }}>
                      {c.cafes} cafes
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div title="Average Google rating of cafes in this grid cell">
                      <p style={{ color: S.dim, fontSize: 11, margin: 0 }}>Avg Rating</p>
                      <p style={{ color: S.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                        {typeof c.avg_rating === "number" ? c.avg_rating.toFixed(2) : "—"}
                      </p>
                    </div>
                    <div title="Percentage of cafes in this cell with High or Very High predicted popularity">
                      <p style={{ color: S.dim, fontSize: 11, margin: 0 }}>Share High</p>
                      <p style={{ color: S.green, fontSize: 16, fontWeight: 600, margin: 0 }}>
                        {typeof c.share_high === "number" ? `${(c.share_high * 100).toFixed(1)}%` : "—"}
                      </p>
                    </div>
                    <div title="Average review sentiment polarity (-1 to +1). Positive = favorable opinions.">
                      <p style={{ color: S.dim, fontSize: 11, margin: 0 }}>Avg Sentiment</p>
                      <p style={{ color: c.avg_sentiment > 0.1 ? S.green : c.avg_sentiment < -0.1 ? S.red : S.muted, fontSize: 16, fontWeight: 600, margin: 0 }}>
                        {typeof c.avg_sentiment === "number" ? c.avg_sentiment.toFixed(3) : "—"}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
