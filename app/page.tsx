"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScanRangePreset, ScanRequest, ScanResponse, WardrobeItem } from "@/lib/types";

type SessionInfo = {
  connected: boolean;
  connectedEmail?: string;
};

const progressMessages = [
  "Opening your purchase timeline...",
  "Scanning retailer orders & receipts...",
  "Extracting item details and images...",
  "Grouping orders and tracking journeys...",
  "Preparing your wardrobe preview..."
];

const rangeOptions: Array<{ value: ScanRangePreset; label: string }> = [
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
  { value: "24m", label: "2 years" },
  { value: "5y", label: "5 years" },
  { value: "custom", label: "Custom" }
];

const CATEGORY_ORDER = ["Tops", "Bottoms", "Shoes", "Outerwear", "Dresses", "Accessories", "Other"];

function currency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function buildMap(items: WardrobeItem[], pick: (item: WardrobeItem) => string): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = pick(item) || "Unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function timeline(items: WardrobeItem[]): Array<[string, number]> {
  const buckets = new Map<string, number>();
  for (const item of items) {
    if (!item.purchaseDate || typeof item.price !== "number") continue;
    const date = new Date(item.purchaseDate);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + item.price);
  }
  return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
}

const statusLabels: Record<string, string> = {
  purchased: "Purchased",
  in_transit: "In Transit",
  returned: "Returned"
};

function HangerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7l7 5.2a2 2 0 0 1-1.18 3.8H5.18A2 2 0 0 1 4 12.2L11 7V5.73A2 2 0 0 1 12 2z" />
      <path d="M3 21h18" />
    </svg>
  );
}

/* ── Compact card for carousel ── */
function CompactCard({ item, selected, onToggle, onOpen }: {
  item: WardrobeItem;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`compact-card${selected ? " selected" : ""}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
    >
      <div className="compact-image-wrap">
        {item.imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="compact-image"
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="compact-placeholder">
            <HangerIcon />
          </div>
        )}
        <span className={`status-badge compact-badge ${item.status}`}>
          {statusLabels[item.status] ?? item.status}
        </span>
        {selected && <span className="compact-check">&#10003;</span>}
      </div>
      <div className="compact-body">
        <div className="compact-name">{item.name}</div>
        <div className="compact-brand">{item.brand}</div>
        {typeof item.price === "number" && (
          <div className="compact-price">{currency(item.price)}</div>
        )}
      </div>
    </div>
  );
}

/* ── Product detail bottom sheet ── */
function ProductDetailModal({ item, selected, onToggle, onClose }: {
  item: WardrobeItem;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onClose: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-image-wrap">
          {item.imageUrl && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="modal-image"
              src={item.imageUrl}
              alt={item.name}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="modal-placeholder">
              <HangerIcon />
              <span>No image found</span>
            </div>
          )}
          <span className={`status-badge ${item.status}`}>
            {statusLabels[item.status] ?? item.status}
          </span>
        </div>

        <div className="modal-body">
          <div className="product-category">{item.category}</div>
          <h2 className="modal-name">{item.name}</h2>
          <p className="modal-brand">{item.brand}</p>

          <div className="modal-details">
            {item.size && <span className="modal-detail-chip">Size: {item.size}</span>}
            {item.color && <span className="modal-detail-chip">Color: {item.color}</span>}
            {item.quantity && item.quantity > 1 && <span className="modal-detail-chip">Qty: {item.quantity}</span>}
          </div>

          <div className="product-price" style={{ marginBottom: 16 }}>
            {typeof item.price === "number" ? currency(item.price) : (
              <span className="product-price-unknown">Price unknown</span>
            )}
          </div>

          {(item.orderNumber || item.purchaseDate) && (
            <div className="order-info">
              {item.orderNumber && <div className="order-number">Order #{item.orderNumber}</div>}
              {item.purchaseDate && (
                <div className="order-date">
                  {new Date(item.purchaseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
              {item.orderJourney && (
                <div className="order-journey">
                  {item.orderJourney.split(" -> ").map((step, i) => (
                    <span key={`${step}-${i}`} className="journey-step">
                      {i > 0 && <span className="journey-arrow">&rarr;</span>}
                      <span className="journey-dot" />
                      <span>{step.replace(/_/g, " ")}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {item.attachments && item.attachments.length > 0 && (
            <div className="attachments" style={{ marginTop: 14 }}>
              {item.attachments.map((att, i) => (
                <span key={`${att.filename}-${i}`} className="attachment-chip">
                  <span style={{ fontSize: "0.75rem" }}>&#128206;</span>
                  {att.filename.length > 24 ? `${att.filename.slice(0, 21)}...` : att.filename}
                </span>
              ))}
            </div>
          )}

          <div className="select-row" style={{ marginTop: 20 }}>
            <span className="select-label">Keep in wardrobe</span>
            <input
              type="checkbox"
              className="toggle"
              checked={selected}
              onChange={(e) => onToggle(e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [session, setSession] = useState<SessionInfo>({ connected: false });
  const [loadingSession, setLoadingSession] = useState(true);
  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(progressMessages[0]);
  const [rangePreset, setRangePreset] = useState<ScanRangePreset>("12m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [review, setReview] = useState<Record<string, boolean>>({});
  const [importedItems, setImportedItems] = useState<WardrobeItem[]>([]);
  const [detailItem, setDetailItem] = useState<WardrobeItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setScanError(`Auth error: ${decodeURIComponent(error)}`);
    }
  }, []);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = (await response.json()) as SessionInfo;
        setSession(data);
      } catch {
        setSession({ connected: false });
      } finally {
        setLoadingSession(false);
      }
    }
    void loadSession();
  }, []);

  const stagedItems = useMemo(() => (scanData?.items ?? []).filter((item) => item.status !== "returned"), [scanData]);
  const returnedCount = useMemo(() => (scanData?.items ?? []).filter((item) => item.status === "returned").length, [scanData]);
  const selectedItems = useMemo(() => stagedItems.filter((item) => review[item.id]), [stagedItems, review]);
  const stagedBrands = new Set(stagedItems.map((item) => item.brand)).size;
  const auditRows = scanData?.diagnostics?.audit ?? [];

  const categoryGroups = useMemo(() => {
    const groups = new Map<string, WardrobeItem[]>();
    for (const item of stagedItems) {
      const cat = CATEGORY_ORDER.includes(item.category) ? item.category : "Other";
      const list = groups.get(cat) ?? [];
      list.push(item);
      groups.set(cat, list);
    }
    return CATEGORY_ORDER.filter((cat) => groups.has(cat)).map((cat) => ({ category: cat, items: groups.get(cat)! }));
  }, [stagedItems]);

  const availableCategories = useMemo(() => ["All", ...categoryGroups.map((g) => g.category)], [categoryGroups]);

  const filteredItems = useMemo(() => {
    if (activeCategory === "All") return stagedItems;
    return stagedItems.filter((item) => {
      const cat = CATEGORY_ORDER.includes(item.category) ? item.category : "Other";
      return cat === activeCategory;
    });
  }, [stagedItems, activeCategory]);

  const categoryMix = useMemo(() => buildMap(importedItems, (item) => item.category).slice(0, 6), [importedItems]);
  const brandMix = useMemo(() => buildMap(importedItems, (item) => item.brand).slice(0, 8), [importedItems]);
  const sizeMix = useMemo(() => buildMap(importedItems, (item) => item.size ?? "Unknown").slice(0, 6), [importedItems]);
  const spendTimeline = useMemo(() => timeline(importedItems), [importedItems]);

  const importedSpend = importedItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const inTransit = importedItems.filter((item) => item.status === "in_transit").length;

  const showBottomBar = scanData && selectedItems.length > 0 && importedItems.length === 0;

  async function runScan() {
    if (rangePreset === "custom" && !customFrom && !customTo) {
      setScanError("Choose at least one custom date.");
      return;
    }

    setScanError(null);
    setIsScanning(true);
    let step = 0;
    const timer = setInterval(() => {
      step = (step + 1) % progressMessages.length;
      setProgress(progressMessages[step]);
    }, 1100);

    try {
      const payload: ScanRequest = {
        rangePreset,
        customFrom: rangePreset === "custom" ? customFrom || undefined : undefined,
        customTo: rangePreset === "custom" ? customTo || undefined : undefined
      };

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as ScanResponse | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Scan failed");
      }

      setScanData(data);
      setImportedItems([]);
      setReview(
        Object.fromEntries(
          data.items.map((item) => [item.id, item.status !== "returned"])
        )
      );
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed");
    } finally {
      clearInterval(timer);
      setIsScanning(false);
    }
  }

  function importSelected() {
    setImportedItems(selectedItems);
  }

  async function disconnect() {
    await fetch("/api/logout", { method: "POST" });
    setSession({ connected: false });
    setScanData(null);
    setReview({});
    setImportedItems([]);
  }

  if (loadingSession) {
    return (
      <div className="app">
        <div className="scan-overlay">
          <div className="scan-dots">
            <span className="scan-dot" />
            <span className="scan-dot" />
            <span className="scan-dot" />
          </div>
          <p className="scan-text">Preparing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app${showBottomBar ? " has-bottom-bar" : ""}`}>
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div>
            <div className="brand-mark">D<span>r</span>ape</div>
            {session.connected && (
              <div className="connected-email">{session.connectedEmail ?? "Connected"}</div>
            )}
          </div>
          {session.connected && (
            <button type="button" className="btn btn-sm btn-secondary" onClick={disconnect}>
              Disconnect
            </button>
          )}
        </div>
      </header>

      {/* Landing */}
      {!session.connected && (
        <div className="landing">
          <div className="landing-icon">
            <HangerIcon />
          </div>
          <h1 className="landing-title">Your wardrobe,<br />digitized</h1>
          <p className="landing-subtitle">
            Connect Gmail to scan purchase receipts and build your digital wardrobe automatically.
          </p>
          <div className="landing-badge">
            <span className="landing-badge-dot" />
            Read-only access
          </div>
          <a href="/api/auth/google/start" className="btn btn-primary">
            Connect Gmail
          </a>
        </div>
      )}

      {/* Scan config */}
      {session.connected && !isScanning && !scanData && (
        <div className="section" style={{ marginTop: 32 }}>
          <h2 className="section-title">Scan your inbox</h2>
          <p className="section-subtitle">
            Choose a time range and we&apos;ll find your clothing purchases, shipping updates, returns, and refunds.
          </p>

          <div className="range-grid">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`range-chip${rangePreset === opt.value ? " active" : ""}`}
                onClick={() => setRangePreset(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {rangePreset === "custom" && (
            <div className="date-grid">
              <label className="date-label">
                From
                <input type="date" className="date-input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </label>
              <label className="date-label">
                To
                <input type="date" className="date-input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </label>
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-primary btn-block" onClick={runScan}>
              Scan Gmail
            </button>
          </div>
        </div>
      )}

      {/* Scanning */}
      {isScanning && (
        <div className="scan-overlay">
          <div className="scan-dots">
            <span className="scan-dot" />
            <span className="scan-dot" />
            <span className="scan-dot" />
          </div>
          <p className="scan-text">{progress}</p>
          <p className="scan-subtext">Scanning your selected timeframe</p>
        </div>
      )}

      {/* Error */}
      {scanError && (
        <div className="section">
          <div className="error-card">
            <p className="error-text">{scanError}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {scanData && !isScanning && (
        <>
          <div className="section">
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Emails matched</div>
                <div className="stat-value">{scanData.meta.candidateEmails}</div>
                <div className="stat-detail">from purchase &amp; update categories</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Order emails</div>
                <div className="stat-value">{scanData.meta.transactionalEmails}</div>
                <div className="stat-detail">{scanData.meta.excludedPromotional} promo excluded</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Items found</div>
                <div className="stat-value">{scanData.summary.dedupedItems}</div>
                <div className="stat-detail">{scanData.summary.extractedItems} before dedup</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Brands</div>
                <div className="stat-value">{stagedBrands}</div>
                <div className="stat-detail">{returnedCount > 0 ? `${returnedCount} returned hidden` : `${scanData.meta.schemaEmails} with structured data`}</div>
              </div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Review items</h2>
            <p className="section-subtitle">
              Tap a card to see details. Selected items will be imported.
            </p>

            <div className="category-pills">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-pill${activeCategory === cat ? " active" : ""}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                  {cat !== "All" && (
                    <span className="pill-count">
                      {categoryGroups.find((g) => g.category === cat)?.items.length ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="items-grid">
              {filteredItems.map((item) => (
                <CompactCard
                  key={item.id}
                  item={item}
                  selected={Boolean(review[item.id])}
                  onToggle={() => setReview((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  onOpen={() => setDetailItem(item)}
                />
              ))}
            </div>
          </div>

          <div className="section" style={{ textAlign: "center", paddingBottom: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={runScan} disabled={isScanning}>
              Re-scan
            </button>
          </div>

          {showBottomBar && (
            <div className="bottom-bar">
              <button type="button" className="btn btn-accent btn-block" onClick={importSelected}>
                Import {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}
              </button>
            </div>
          )}

          {importedItems.length > 0 && (
            <div className="section">
              <div className="import-banner" style={{ marginBottom: 16 }}>
                <p className="import-banner-text">
                  {importedItems.length} item{importedItems.length !== 1 ? "s" : ""} imported to your wardrobe
                </p>
              </div>

              <h2 className="section-title">Your wardrobe</h2>
              <p className="section-subtitle">{scanData.meta.rangeLabel}</p>

              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Items</div>
                  <div className="stat-value">{importedItems.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Brands</div>
                  <div className="stat-value">{new Set(importedItems.map((x) => x.brand)).size}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Spend</div>
                  <div className="stat-value">{currency(importedSpend)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">In transit</div>
                  <div className="stat-value">{inTransit}</div>
                </div>
              </div>

              {categoryMix.length > 0 && (
                <div className="dash-card">
                  <h3 className="dash-title">Category Mix</h3>
                  {categoryMix.map(([name, count]) => (
                    <div key={name} className="bar-row">
                      <span className="bar-label">{name}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.round((count / Math.max(1, importedItems.length)) * 100)}%` }} />
                      </div>
                      <span className="bar-value">{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {brandMix.length > 0 && (
                <div className="dash-card">
                  <h3 className="dash-title">Brands</h3>
                  <div className="brand-pills">
                    {brandMix.map(([brand, count]) => (
                      <span key={brand} className="pill">{brand} ({count})</span>
                    ))}
                  </div>
                </div>
              )}

              {sizeMix.length > 0 && (
                <div className="dash-card">
                  <h3 className="dash-title">Size Signal</h3>
                  <div className="brand-pills">
                    {sizeMix.map(([size, count]) => (
                      <span key={size} className="pill">{size} ({count})</span>
                    ))}
                  </div>
                </div>
              )}

              {spendTimeline.length > 0 && (
                <div className="dash-card">
                  <h3 className="dash-title">Spend Timeline</h3>
                  {spendTimeline.map(([month, spend]) => (
                    <div key={month} className="timeline-row">
                      <span className="timeline-month">{month}</span>
                      <span className="timeline-amount">{currency(spend)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="section">
            <details>
              <summary className="section-title" style={{ fontSize: "1.1rem" }}>
                Scan log
              </summary>
              <div style={{ marginTop: 10 }}>
                {scanData.logs.map((log, i) => (
                  <div key={`log-${i}`} className="log-entry">{log}</div>
                ))}
              </div>
            </details>
          </div>

          <div className="section" style={{ paddingBottom: 40 }}>
            <details>
              <summary className="section-title" style={{ fontSize: "1.1rem" }}>
                Diagnostics ({auditRows.length})
              </summary>
              <div className="audit-wrap" style={{ marginTop: 10 }}>
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Inc</th>
                      <th>Reason</th>
                      <th>Type</th>
                      <th>From</th>
                      <th>Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((row) => (
                      <tr key={row.messageId}>
                        <td className={row.included ? "audit-included" : "audit-excluded"}>
                          {row.included ? "\u2713" : "\u2014"}
                        </td>
                        <td>{row.reason}</td>
                        <td>{row.classification}</td>
                        <td>{row.fromDomain}</td>
                        <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {row.subject}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </>
      )}

      {/* Detail modal */}
      {detailItem && (
        <ProductDetailModal
          item={detailItem}
          selected={Boolean(review[detailItem.id])}
          onToggle={(checked) => setReview((prev) => ({ ...prev, [detailItem.id]: checked }))}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}
