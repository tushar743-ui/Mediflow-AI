import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./InventoryPage.css";

const PLACEHOLDER_IMG = "/placeholder-product.png";

// Optional: add a 2nd placeholder if you have one
const FALLBACK_IMG = "/placeholder-product.png";

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `$${num.toFixed(2)}`;
}

function safeEncodePath(p) {
  try {
    // encodeURI keeps "/" intact but encodes spaces etc.
    return encodeURI(p);
  } catch {
    return p;
  }
}

function buildImageCandidates(imageUrl) {
  if (!imageUrl) return [];

  let url = String(imageUrl).trim();

  // normalize slashes (sometimes DB has backslashes)
  url = url.replace(/\\/g, "/");

  // If full URL (http/https) -> use as-is
  if (/^https?:\/\//i.test(url)) {
    return [safeEncodePath(url)];
  }

  // If already a site-absolute path like "/product-images/a.png"
  if (url.startsWith("/")) {
    return [safeEncodePath(url)];
  }

  // Otherwise it's likely just a filename: "abc.png"
  // Try common locations in Vite public/
  const filename = encodeURIComponent(url);

  return [
    `/product-images/${filename}`,
    `/images/${filename}`,
    `/${filename}`,
  ];
}

export default function InventoryPage({ apiBaseUrl }) {
  const BASE = (apiBaseUrl || "").replace(/\/+$/, "");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rxFilter, setRxFilter] = useState("all"); // all | rx | otc
  const [sortBy, setSortBy] = useState("name"); // name | priceLow | priceHigh

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${BASE}/api/medicines`);
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Inventory load failed:", e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [BASE]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = items;

    if (query) {
      list = list.filter((m) => {
        const name = (m.medicine_name || "").toLowerCase();
        const gen = (m.generic_name || "").toLowerCase();
        const de = (m.description_de || "").toLowerCase();
        const pzn = (m.pzn || "").toLowerCase();
        return (
          name.includes(query) ||
          gen.includes(query) ||
          de.includes(query) ||
          pzn.includes(query)
        );
      });
    }

    if (rxFilter === "rx") {
      list = list.filter((m) => m.prescription_required === true);
    } else if (rxFilter === "otc") {
      list = list.filter((m) => m.prescription_required === false);
    }

    const getPrice = (m) => {
      const v = m.price_rec ?? m.price;
      const n = Number(v);
      return Number.isNaN(n) ? Infinity : n;
    };

    if (sortBy === "priceLow") {
      list = [...list].sort((a, b) => getPrice(a) - getPrice(b));
    } else if (sortBy === "priceHigh") {
      list = [...list].sort((a, b) => getPrice(b) - getPrice(a));
    } else {
      list = [...list].sort((a, b) =>
        String(a.medicine_name || "").localeCompare(String(b.medicine_name || ""))
      );
    }

    return list;
  }, [items, q, rxFilter, sortBy]);

  return (
    <div className="inv-page">
      <div className="inv-card">
        <div className="inv-header">
          <div>
            <h2 className="inv-title">Inventory</h2>
            <p className="inv-subtitle">All the available products </p>
          </div>

          <div className="inv-controls">
            <div className="inv-search">
              <span className="inv-search-icon">🔎</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search medicine, generic, PZN, description..."
              />
            </div>

            <select
              className="inv-select"
              value={rxFilter}
              onChange={(e) => setRxFilter(e.target.value)}
              title="Prescription filter"
            >
              <option value="all">All</option>
              <option value="rx">Prescription required</option>
              <option value="otc">No prescription</option>
            </select>

            <select
              className="inv-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              title="Sort"
            >
              <option value="name">Sort: Name</option>
              <option value="priceLow">Sort: Price (Low)</option>
              <option value="priceHigh">Sort: Price (High)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="inv-loading">Loading products…</div>
        ) : filtered.length === 0 ? (
          <div className="inv-empty">No products found. Try a different search.</div>
        ) : (
          <div className="inv-grid">
            {filtered.map((m) => {
              const price = m.price_rec ?? m.price;
              const candidates = buildImageCandidates(m.image_url);

              return (
                <div className="inv-product" key={m.id}>
                  <div className="inv-img-wrap">
                    <img
                      src={candidates[0] || PLACEHOLDER_IMG}
                      alt={m.medicine_name || "Medicine"}
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        const curr = img.getAttribute("data-idx") || "0";
                        const idx = Number(curr);

                        const nextIdx = idx + 1;
                        if (candidates[nextIdx]) {
                          img.setAttribute("data-idx", String(nextIdx));
                          img.src = candidates[nextIdx];
                          return;
                        }

                        console.warn("Image missing for:", {
                          id: m.id,
                          name: m.medicine_name,
                          image_url: m.image_url,
                          tried: candidates,
                        });

                        img.onerror = null;
                        img.src = FALLBACK_IMG;
                      }}
                      data-idx="0"
                    />
                    <div className={`inv-badge ${m.prescription_required ? "rx" : "otc"}`}>
                      {m.prescription_required ? "Rx" : "OTC"}
                    </div>
                  </div>

                  <div className="inv-body">
                    <div className="inv-name" title={m.medicine_name}>
                      {m.medicine_name || "-"}
                    </div>

                    {(m.package_size || m.pzn) && (
                      <div className="inv-meta">
                        {m.package_size ? <span>{m.package_size}</span> : null}
                        {m.package_size && m.pzn ? <span>•</span> : null}
                        {m.pzn ? <span>PZN: {m.pzn}</span> : null}
                      </div>
                    )}

                    <div className="inv-desc" title={m.description_de || ""}>
                      {m.description_de || "—"}
                    </div>

                    <div className="inv-bottom">
                      <div className="inv-price">{formatPrice(price)}</div>

                      <button
                        className="inv-btn"
                        onClick={() => alert(`Selected: ${m.medicine_name}`)}
                      >
                        View
                      </button>
                    </div>

                    {m.prescription_required && (
                      <div className="inv-note">Prescription required to purchase.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}