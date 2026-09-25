import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { T } from "../theme.js";
import { fmtMoney, fmtDate, todayISO } from "../lib/format.js";
import {
  blankProduct, validateProduct, stockSummary, availability, storeStats, adminFee,
  validateSettings, policySections, friendlyStoreError, SIZE_PRESETS, PHOTO_MAX_INPUT_BYTES,
} from "../lib/store.js";
import {
  loadStore, photoUrl, preparePhoto, uploadPhoto, removePhoto, saveProduct,
  deleteProduct, moveProduct, setProductVisible, saveSettings,
} from "../lib/storeApi.js";

// ---------------------------------------------------------------------------
// Store tab (Club Management). Drop 1: products, sizes, stock, photos,
// admin fee and store policy. Guardians can't see any of this until the
// Player Portal shop (Drop 2) is installed and the shop is switched on.
//
// This tab loads and saves its own data through lib/storeApi.js rather
// than through App.jsx, so the store stays self-contained.
// ---------------------------------------------------------------------------

const STORE_CSS = `
.st-tabs { display: flex; gap: 4px; border-bottom: 2px solid ${T.line}; margin: -6px 0 22px; flex-wrap: wrap; }
.st-tab { background: none; border: 0; padding: 10px 16px; font: 700 13.5px 'Karla', sans-serif; color: ${T.inkSoft}; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; }
.st-tab.on { color: ${T.indigo}; border-bottom-color: ${T.gold}; }
.st-tab:focus-visible, .st-arrow:focus-visible, tr.st-row:focus-visible { outline: 3px solid ${T.gold}; outline-offset: 2px; }
.st-scroll { overflow-x: auto; }
.st-thumb { width: 40px; height: 40px; border-radius: 8px; background: ${T.paperDim}; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex: 0 0 auto; margin-right: 10px; }
.st-thumb img { width: 100%; height: 100%; object-fit: cover; }
.st-thumb svg { width: 60%; height: 60%; }
.st-prod { display: flex; align-items: center; font-weight: 700; }
.st-muted { color: ${T.inkSoft}; font-size: 12px; font-weight: 500; }
.st-stock { font-size: 12px; line-height: 1.6; }
.st-stock .zero { color: ${T.danger}; font-weight: 700; }
.st-stock .low { color: ${T.amber}; font-weight: 700; }
.st-money { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; white-space: nowrap; }
.st-switch { position: relative; width: 38px; height: 22px; display: inline-block; flex: 0 0 auto; vertical-align: middle; }
.st-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.st-switch span { position: absolute; inset: 0; background: #d9d1bd; border-radius: 999px; transition: background .15s; cursor: pointer; }
.st-switch span::after { content: ""; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: transform .15s; }
.st-switch input:checked + span { background: ${T.green}; }
.st-switch input:checked + span::after { transform: translateX(16px); }
.st-switch input:focus-visible + span { outline: 3px solid ${T.gold}; outline-offset: 2px; }
.st-switch input:disabled + span { opacity: .5; cursor: wait; }
@media (prefers-reduced-motion: reduce) { .st-switch span, .st-switch span::after { transition: none; } }
.st-arrows { display: inline-flex; flex-direction: column; gap: 2px; }
.st-arrow { background: none; border: 1px solid ${T.line}; border-radius: 5px; width: 26px; height: 20px; font-size: 10px; color: ${T.indigo}; cursor: pointer; padding: 0; line-height: 1; }
.st-arrow:disabled { opacity: .3; cursor: default; }
.st-radio-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.st-radio { border: 1.5px solid ${T.line}; border-radius: 10px; padding: 10px 12px; cursor: pointer; font-size: 13px; display: flex; gap: 8px; align-items: flex-start; background: #fff; }
.st-radio input { margin-top: 2px; accent-color: ${T.indigo}; }
.st-radio b { display: block; font-size: 13px; }
.st-radio small { color: ${T.inkSoft}; font-size: 11.5px; }
.st-radio.on { border-color: ${T.indigo}; background: #f8f6fc; }
.st-photo { border: 2px dashed #d9d1bd; border-radius: 10px; padding: 12px; display: flex; gap: 12px; align-items: center; background: #faf8f2; margin-bottom: 14px; }
.st-photo .st-thumb { width: 72px; height: 72px; margin: 0; }
.st-sizes { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
.st-sizes th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: ${T.inkSoft}; padding: 4px 6px; }
.st-sizes td { padding: 4px 6px; }
.st-x { background: none; border: 0; color: ${T.danger}; font-size: 18px; cursor: pointer; padding: 0 6px; }
.st-err { color: ${T.danger}; font-size: 12px; font-weight: 700; margin-top: 4px; }
.st-hint { font-size: 11.5px; color: ${T.inkSoft}; margin-top: 4px; }
.st-check { display: flex; gap: 8px; align-items: center; font-size: 13px; margin: 8px 0 12px; cursor: pointer; }
.gfc-modal.st-wide { max-width: 720px; }
.st-policy-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; }
.st-preview { background: #F7F5EF; border: 1px solid ${T.line}; border-radius: 16px; padding: 18px 20px; font-size: 13.5px; line-height: 1.6; max-height: 720px; overflow: auto; }
.st-preview-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: ${T.inkSoft}; font-weight: 700; margin-bottom: 8px; }
.st-preview-title { font-family: 'Anton', sans-serif; font-size: 22px; text-transform: uppercase; margin-bottom: 4px; color: ${T.ink}; }
.st-preview h4 { margin: 14px 0 2px; font-size: 14px; }
.st-preview p { margin: 0; white-space: pre-wrap; }
.st-fee-example { background: #faf8f2; border: 1px solid ${T.line}; border-radius: 10px; padding: 10px 12px; font-size: 12.5px; margin-top: 8px; line-height: 1.6; }
.st-banner { border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin-bottom: 18px; }
.st-banner.info { background: #ecebf8; color: #3b2f86; }
.st-banner.err { background: ${T.dangerSoft}; color: ${T.danger}; font-weight: 600; }
.st-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: ${T.ink}; color: ${T.paper}; padding: 10px 18px; border-radius: 999px; font: 700 13px 'Karla', sans-serif; z-index: 100; }
tr.st-row { cursor: pointer; }
tr.st-row:hover td { background: ${T.paperDim}; }
@media (max-width: 980px) { .st-policy-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .st-radio-row { grid-template-columns: 1fr; } }
`;

const NO_PHOTO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#b8b09a" strokeWidth="1.6" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 7" />
  </svg>
);

function Thumb({ src }) {
  return <span className="st-thumb">{src ? <img src={src} alt="" /> : NO_PHOTO_ICON}</span>;
}

function Stat({ color, label, value }) {
  return (
    <div className="gfc-stat">
      <div className="gfc-stat-accent" style={{ background: color }} />
      <div className="gfc-stat-label">{label}</div>
      <div className="gfc-stat-value gfc-mono">{value}</div>
    </div>
  );
}

function AvailabilityBadge({ product, today }) {
  const a = availability(product, today, fmtDate);
  const cls = {
    hidden: "gfc-badge gfc-badge-neutral",
    preorder: "gfc-badge gfc-badge-neutral",
    closed: "gfc-badge gfc-badge-amber",
    soldout: "gfc-badge gfc-badge-red",
    instock: "gfc-badge gfc-badge-green",
  }[a.tone];
  const style = a.tone === "preorder" ? { background: "#ecebf8", color: "#3b2f86" } : undefined;
  return <span className={cls} style={style}>{a.text}</span>;
}

function StockCell({ product }) {
  const s = stockSummary(product);
  if (s.kind === "preorder") return <span className="st-stock st-muted">No stock limit</span>;
  if (s.kind === "single") {
    const p = s.parts[0];
    return <span className="st-stock"><span className={p.level}>{p.stock} in stock</span></span>;
  }
  return (
    <span className="st-stock">
      {s.parts.map((p, i) => (
        <React.Fragment key={p.label}>
          {i > 0 && " · "}
          <span className={p.level}>{p.label}&nbsp;{p.stock}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="st-toast" role="status" aria-live="polite">{message}</div>;
}

/* ================================ Main view ================================ */

export function StoreView({ role }) {
  const [tab, setTab] = useState("products");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [editing, setEditing] = useState(null); // product object, "new", or null
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const refresh = useCallback(async () => {
    try {
      const data = await loadStore();
      setProducts(data.products);
      setSettings(data.settings);
      setLoadError("");
    } catch (e) {
      setLoadError(friendlyStoreError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const today = todayISO();
  const stats = useMemo(() => storeStats(products, today), [products, today]);

  async function toggleVisible(p) {
    setBusyId(p.id);
    setActionError("");
    try {
      await setProductVisible(p.id, !p.visible);
      await refresh();
      showToast(!p.visible ? `${p.name} is now shown in the shop` : `${p.name} is now hidden`);
    } catch (e) {
      setActionError(friendlyStoreError(e));
    } finally {
      setBusyId("");
    }
  }

  async function move(p, direction) {
    setBusyId(p.id);
    setActionError("");
    try {
      await moveProduct(p.id, direction);
      await refresh();
    } catch (e) {
      setActionError(friendlyStoreError(e));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <style>{STORE_CSS}</style>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Store</div>
          <div className="gfc-page-sub">Products, admin fee and store policy for the Player Portal shop</div>
        </div>
        {tab === "products" && !loadError && (
          <button className="gfc-btn gfc-btn-primary" onClick={() => setEditing("new")} disabled={loading}>+ Add product</button>
        )}
      </div>

      <div className="st-tabs" role="tablist">
        <button className={`st-tab ${tab === "products" ? "on" : ""}`} role="tab" aria-selected={tab === "products"} onClick={() => setTab("products")}>Products</button>
        <button className={`st-tab ${tab === "settings" ? "on" : ""}`} role="tab" aria-selected={tab === "settings"} onClick={() => setTab("settings")}>Store settings</button>
      </div>

      {loading ? (
        <div className="gfc-empty">Loading the store…</div>
      ) : loadError ? (
        <div className="st-banner err">
          Couldn’t load the store: {loadError}{" "}
          <button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={() => { setLoading(true); refresh(); }}>Try again</button>
        </div>
      ) : tab === "products" ? (
        <>
          {settings && !settings.shop_open && (
            <div className="st-banner info">
              The shop is switched off, so guardians can’t see it. Add your products, then turn the shop on in Store settings when you’re ready.
            </div>
          )}
          {actionError && <div className="st-banner err">{actionError}</div>}
          <div className="gfc-stat-row">
            <Stat color={T.indigo} label="Shown in the shop" value={stats.shown} />
            <Stat color={T.amber} label="Low stock (1-2 left)" value={stats.low} />
            <Stat color={T.danger} label="Sold out (product or size)" value={stats.soldOut} />
            <Stat color="#6b5cc4" label="Pre-orders open" value={stats.preordersOpen} />
          </div>
          <div className="gfc-panel">
            <div className="gfc-panel-head"><div className="gfc-panel-title">Products ({products.length})</div></div>
            {products.length === 0 ? (
              <div className="gfc-empty">
                <div className="gfc-empty-title gfc-display">No products yet</div>
                Add your first product: kit, supporters’ gear or anything else the club sells.
              </div>
            ) : (
              <div className="st-scroll">
                <table className="gfc-table">
                  <thead>
                    <tr><th style={{ width: 40 }}>Order</th><th>Product</th><th>Price</th><th>Availability</th><th>Stock</th><th>Shown</th></tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr
                        key={p.id}
                        className="st-row"
                        tabIndex={0}
                        onClick={() => setEditing(p)}
                        onKeyDown={(e) => { if (e.key === "Enter") setEditing(p); }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <span className="st-arrows">
                            <button className="st-arrow" aria-label={`Move ${p.name} up`} disabled={i === 0 || !!busyId} onClick={() => move(p, -1)}>▲</button>
                            <button className="st-arrow" aria-label={`Move ${p.name} down`} disabled={i === products.length - 1 || !!busyId} onClick={() => move(p, 1)}>▼</button>
                          </span>
                        </td>
                        <td><div className="st-prod"><Thumb src={photoUrl(p.photoPath)} />{p.name}</div></td>
                        <td className="st-money">{fmtMoney(p.price)}</td>
                        <td><AvailabilityBadge product={p} today={today} /></td>
                        <td style={{ maxWidth: 300 }}><StockCell product={p} /></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <label className="st-switch">
                            <input type="checkbox" checked={p.visible} disabled={busyId === p.id} onChange={() => toggleVisible(p)} aria-label={`Show ${p.name} in the shop`} />
                            <span />
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="st-hint" style={{ marginTop: 10 }}>Products appear in the shop in this order. Use the arrows to move them.</div>
        </>
      ) : (
        <SettingsPanel settings={settings} onSaved={(row) => { setSettings(row); showToast("Store settings saved"); }} />
      )}

      {editing && (
        <ProductModal
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => { setEditing(null); await refresh(); showToast(msg); }}
          onDeleted={async (msg) => { setEditing(null); await refresh(); showToast(msg); }}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}

/* ============================== Product form ============================== */

function toForm(product) {
  if (!product) return { ...blankProduct(), sizes: [] };
  return {
    ...product,
    price: product.price ? product.price.toFixed(2) : "",
    stock: product.stock === null || product.stock === undefined ? "0" : String(product.stock),
    sizes: product.sizes.map((s) => ({ id: s.id, label: s.label, stock: s.stock === null ? "0" : String(s.stock) })),
  };
}

function ProductModal({ product, onClose, onSaved, onDeleted }) {
  const initial = useMemo(() => toForm(product), [product]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null); // { blob, previewUrl } for a newly chosen photo
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.previewUrl); }, [photo]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || !!photo || photoRemoved;

  // Which error message each field's edits should clear.
  const ERROR_FOR = { name: "name", price: "price", stock: "stock", description: "description",
    preorderClosesOn: "closes", preorderExpected: "expected", hasSizes: "sizes", saleMode: "sizes" };
  function clearError(key) {
    if (!key) return;
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setSaveError("");
  }
  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    clearError(ERROR_FOR[field]);
  }
  function updateSize(i, field, value) {
    setForm((f) => ({ ...f, sizes: f.sizes.map((s, j) => (j === i ? { ...s, [field]: value } : s)) }));
    clearError("sizes");
  }
  function setSizes(sizes) {
    setForm((f) => ({ ...f, sizes }));
    clearError("sizes");
  }
  function applyPreset(labels) {
    // Keep ids and stock of sizes that already exist with the same label.
    const byLabel = new Map(form.sizes.map((s) => [s.label.trim().toLowerCase(), s]));
    setSizes(labels.map((label) => byLabel.get(label.toLowerCase()) || { id: "", label, stock: "0" }));
  }

  function requestClose() {
    if (busy) return;
    if (dirty && !window.confirm("Discard your changes to this product?")) return;
    onClose();
  }

  async function choosePhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) { setSaveError("Choose a photo (JPG, PNG or WebP)."); return; }
    if (file.size > PHOTO_MAX_INPUT_BYTES) { setSaveError("That photo is over 15 MB. Choose a smaller one."); return; }
    setPhotoBusy(true);
    setSaveError("");
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      setPhotoRemoved(false);
    } catch (err) {
      setSaveError(err.message || "That photo couldn’t be used.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSave() {
    const result = validateProduct(form);
    setErrors(result.errors);
    if (!result.ok) { setSaveError("Check the highlighted fields."); return; }
    setBusy(true);
    setSaveError("");
    const isNew = !product;
    const id = product ? product.id : crypto.randomUUID();
    const oldPath = product?.photoPath || "";
    let uploadedPath = "";
    try {
      if (photo) uploadedPath = await uploadPhoto(id, photo.blob);
      const finalPath = uploadedPath || (photoRemoved ? "" : oldPath);
      const payload = {
        ...result.product,
        id,
        is_new: isNew,
        photo_path: finalPath,
        // Lets the database refuse this save if the product changed
        // (e.g. a sale reduced stock) after this form was opened.
        ...(isNew ? {} : { expected_updated_at: product.updatedAt }),
      };
      await saveProduct(payload, result.sizes);
      if (oldPath && oldPath !== finalPath) await removePhoto(oldPath);
      onSaved(isNew ? `${result.product.name} added` : "Product saved");
    } catch (err) {
      if (uploadedPath) await removePhoto(uploadedPath);
      setSaveError(friendlyStoreError(err));
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${product.name}? This can’t be undone. To take it out of the shop for now, hide it instead.`)) return;
    setBusy(true);
    setSaveError("");
    try {
      await deleteProduct(product);
      onDeleted(`${product.name} deleted`);
    } catch (err) {
      setSaveError(friendlyStoreError(err));
      setBusy(false);
    }
  }

  const currentPhoto = photo ? photo.previewUrl : photoRemoved ? "" : photoUrl(form.photoPath);
  const isPre = form.saleMode === "preorder";

  return (
    <div className="gfc-modal-backdrop" onClick={requestClose}>
      <div className="gfc-modal st-wide" role="dialog" aria-modal="true" aria-label={product ? "Edit product" : "Add product"} onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">{product ? "Edit product" : "Add product"}</div>
          <button className="gfc-modal-close" onClick={requestClose} aria-label="Close">×</button>
        </div>

        <div className="st-photo">
          <Thumb src={currentPhoto} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Product photo</div>
            <div className="st-hint" style={{ margin: "2px 0 8px" }}>One photo. Square photos look best. Large photos are shrunk automatically.</div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} hidden />
            <button type="button" className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={photoBusy || busy}>
              {photoBusy ? "Preparing…" : currentPhoto ? "Replace photo" : "Upload photo"}
            </button>
            {currentPhoto && (
              <button type="button" className="gfc-btn gfc-btn-ghost gfc-btn-sm" style={{ marginLeft: 6 }} disabled={busy}
                onClick={() => { setPhoto(null); setPhotoRemoved(true); }}>
                Remove photo
              </button>
            )}
          </div>
        </div>

        <div className="gfc-row2">
          <div className="gfc-field">
            <label className="gfc-label" htmlFor="sp-name">Name</label>
            <input className="gfc-input" id="sp-name" value={form.name} maxLength={120} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Home jersey 2026" />
            {errors.name && <div className="st-err">{errors.name}</div>}
          </div>
          <div className="gfc-field">
            <label className="gfc-label" htmlFor="sp-price">Price (R)</label>
            <input className="gfc-input" id="sp-price" inputMode="decimal" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="450.00" />
            {errors.price && <div className="st-err">{errors.price}</div>}
          </div>
        </div>
        <div className="gfc-field">
          <label className="gfc-label" htmlFor="sp-desc">Description</label>
          <textarea className="gfc-textarea" id="sp-desc" rows={2} maxLength={2000} value={form.description} onChange={(e) => update("description", e.target.value)} />
          {errors.description && <div className="st-err">{errors.description}</div>}
        </div>

        <div className="gfc-label" style={{ marginBottom: 6 }}>How it’s sold</div>
        <div className="st-radio-row" role="radiogroup">
          <label className={`st-radio ${!isPre ? "on" : ""}`}>
            <input type="radio" name="sp-mode" checked={!isPre} onChange={() => update("saleMode", "stock")} />
            <span><b>In stock</b><small>Limited to the quantity you have. Shows “Sold out” at zero.</small></span>
          </label>
          <label className={`st-radio ${isPre ? "on" : ""}`}>
            <input type="radio" name="sp-mode" checked={isPre} onChange={() => update("saleMode", "preorder")} />
            <span><b>Pre-order</b><small>No stock limit. Guardians pay now; you order from the supplier later.</small></span>
          </label>
        </div>

        {isPre && (
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label" htmlFor="sp-closes">Pre-orders close</label>
              <input className="gfc-input" type="date" id="sp-closes" value={form.preorderClosesOn} onChange={(e) => update("preorderClosesOn", e.target.value)} />
              {errors.closes ? <div className="st-err">{errors.closes}</div> : <div className="st-hint">Optional. The product leaves the shop after this date.</div>}
            </div>
            <div className="gfc-field">
              <label className="gfc-label" htmlFor="sp-exp">Expected arrival (shown to guardians)</label>
              <input className="gfc-input" id="sp-exp" maxLength={120} value={form.preorderExpected} onChange={(e) => update("preorderExpected", e.target.value)} placeholder="e.g. Expected mid-November" />
              {errors.expected && <div className="st-err">{errors.expected}</div>}
            </div>
          </div>
        )}

        <label className="st-check">
          <input type="checkbox" checked={form.hasSizes} onChange={(e) => {
            const on = e.target.checked;
            setForm((f) => ({ ...f, hasSizes: on, sizes: on && f.sizes.length === 0 ? [{ id: "", label: "", stock: "0" }] : f.sizes }));
            clearError("sizes");
            clearError("stock");
          }} />
          <span><b>Sold in sizes</b> <span className="st-muted">{isPre ? "(guardians choose a size)" : "(each size has its own stock)"}</span></span>
        </label>

        {form.hasSizes ? (
          <>
            <table className="st-sizes">
              <thead><tr><th>Size</th>{!isPre && <th style={{ width: 120 }}>In stock</th>}<th style={{ width: 30 }} /></tr></thead>
              <tbody>
                {form.sizes.map((s, i) => (
                  <tr key={s.id || `new-${i}`}>
                    <td><input className="gfc-input" value={s.label} maxLength={20} placeholder="e.g. M" aria-label={`Size ${i + 1} name`} onChange={(e) => updateSize(i, "label", e.target.value)} /></td>
                    {!isPre && (
                      <td><input className="gfc-input" type="number" min="0" step="1" value={s.stock} aria-label={`Stock for size ${s.label || i + 1}`} onChange={(e) => updateSize(i, "stock", e.target.value)} /></td>
                    )}
                    <td><button type="button" className="st-x" aria-label={`Remove size ${s.label || i + 1}`} onClick={() => setSizes(form.sizes.filter((_, j) => j !== i))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {errors.sizes && <div className="st-err" style={{ marginBottom: 8 }}>{errors.sizes}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={() => setSizes([...form.sizes, { id: "", label: "", stock: "0" }])}>+ Add size</button>
              <button type="button" className="gfc-btn gfc-btn-ghost gfc-btn-sm" onClick={() => applyPreset(SIZE_PRESETS.kidsAdult)}>Use kids + adult sizes</button>
              <button type="button" className="gfc-btn gfc-btn-ghost gfc-btn-sm" onClick={() => applyPreset(SIZE_PRESETS.juniorSenior)}>Use Junior / Senior</button>
            </div>
          </>
        ) : !isPre ? (
          <div className="gfc-field" style={{ maxWidth: 200 }}>
            <label className="gfc-label" htmlFor="sp-stock">In stock</label>
            <input className="gfc-input" id="sp-stock" type="number" min="0" step="1" value={form.stock} onChange={(e) => update("stock", e.target.value)} />
            {errors.stock && <div className="st-err">{errors.stock}</div>}
          </div>
        ) : null}

        <label className="st-check">
          <span className="st-switch">
            <input type="checkbox" checked={form.visible} onChange={(e) => update("visible", e.target.checked)} />
            <span />
          </span>
          <b>Show in the Player Portal shop</b>
        </label>

        {saveError && <div className="st-banner err" style={{ marginBottom: 0 }}>{saveError}</div>}

        <div className="gfc-modal-actions">
          {product && (
            <button type="button" className="gfc-btn gfc-btn-danger" style={{ marginRight: "auto" }} onClick={handleDelete} disabled={busy}>Delete</button>
          )}
          <button type="button" className="gfc-btn gfc-btn-ghost" onClick={requestClose} disabled={busy}>Cancel</button>
          <button type="button" className="gfc-btn gfc-btn-primary" onClick={handleSave} disabled={busy || photoBusy}>
            {busy ? "Saving…" : product ? "Save changes" : "Add product"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== Store settings ============================== */

function settingsToForm(s) {
  return {
    shopOpen: !!s?.shop_open,
    adminFeePercent: s ? String(Number(s.admin_fee_percent)) : "3.5",
    contactEmail: s?.contact_email || "",
    contactPhone: s?.contact_phone || "",
    policyText: s?.policy_text || "",
  };
}

function SettingsPanel({ settings, onSaved }) {
  const [form, setForm] = useState(() => settingsToForm(settings));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setForm(settingsToForm(settings)); }, [settings]);

  if (!settings) {
    return <div className="st-banner err">Store settings are missing. Run the store migration in Supabase, then reload this page.</div>;
  }

  const SETTINGS_ERROR_FOR = { adminFeePercent: "fee", contactEmail: "email", contactPhone: "phone", policyText: "policy" };
  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    const key = SETTINGS_ERROR_FOR[field];
    if (key) setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setSaveError("");
  };
  const feeCheck = validateSettings(form);
  const feePct = feeCheck.errors.fee ? null : Number(String(form.adminFeePercent).replace(",", ".").replace("%", ""));
  const sections = policySections(form.policyText);

  async function handleSave() {
    const result = validateSettings(form);
    setErrors(result.errors);
    if (!result.ok) { setSaveError("Check the highlighted fields."); return; }
    if (result.settings.shop_open && !settings.shop_open &&
        !window.confirm("Turn the shop on? Guardians will be able to see and buy visible products once the Player Portal shop is installed.")) return;
    setBusy(true);
    setSaveError("");
    try {
      const row = await saveSettings(result.settings);
      onSaved(row);
    } catch (e) {
      setSaveError(friendlyStoreError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="st-policy-grid">
      <div>
        <div className="gfc-panel" style={{ padding: 18, marginBottom: 18 }}>
          <div className="gfc-panel-title" style={{ marginBottom: 12 }}>Shop</div>
          <label className="st-check" style={{ margin: "0 0 4px" }}>
            <span className="st-switch">
              <input type="checkbox" checked={form.shopOpen} onChange={(e) => update("shopOpen", e.target.checked)} />
              <span />
            </span>
            <b>Shop is open to guardians</b>
          </label>
          <div className="st-hint" style={{ marginBottom: 16 }}>
            When off, guardians can’t see the shop at all. The Player Portal shop arrives in the next update, so this has no visible effect yet.
          </div>

          <div className="gfc-field" style={{ maxWidth: 220, marginBottom: 0 }}>
            <label className="gfc-label" htmlFor="ss-fee">Admin fee (% of each order)</label>
            <input className="gfc-input" id="ss-fee" inputMode="decimal" value={form.adminFeePercent} onChange={(e) => update("adminFeePercent", e.target.value)} />
            {errors.fee && <div className="st-err">{errors.fee}</div>}
          </div>
          <div className="st-fee-example">
            {feePct === null ? (
              "Enter a percentage to see an example."
            ) : feePct === 0 ? (
              "No admin fee: guardians pay the product prices only."
            ) : (
              <>
                On a {fmtMoney(450)} order, guardians pay {fmtMoney(450)} + {fmtMoney(adminFee(450, feePct))} admin fee = <b>{fmtMoney(450 + adminFee(450, feePct))}</b>.<br />
                <span className="st-muted">Shown as its own line in the cart and at checkout. Changing it only affects new orders.</span>
              </>
            )}
          </div>
        </div>

        <div className="gfc-panel" style={{ padding: 18 }}>
          <div className="gfc-panel-title" style={{ marginBottom: 4 }}>Store policy</div>
          <div className="st-hint" style={{ marginBottom: 14 }}>
            Guardians see this in the shop and confirm they’ve read it at checkout.
            {settings.updated_at && ` Last saved ${fmtDate(settings.updated_at)}${settings.updated_by_email ? ` by ${settings.updated_by_email}` : ""}.`}
          </div>
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label" htmlFor="ss-email">Store contact email</label>
              <input className="gfc-input" id="ss-email" type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} placeholder="shop@garlandalefc.co.za" />
              {errors.email && <div className="st-err">{errors.email}</div>}
            </div>
            <div className="gfc-field">
              <label className="gfc-label" htmlFor="ss-phone">Store contact number</label>
              <input className="gfc-input" id="ss-phone" value={form.contactPhone} maxLength={40} onChange={(e) => update("contactPhone", e.target.value)} placeholder="021 000 0000" />
              {errors.phone && <div className="st-err">{errors.phone}</div>}
            </div>
          </div>
          <div className="gfc-field">
            <label className="gfc-label" htmlFor="ss-policy">Policy text</label>
            <textarea className="gfc-textarea" id="ss-policy" rows={18} value={form.policyText} onChange={(e) => update("policyText", e.target.value)} style={{ lineHeight: 1.5 }} />
            {errors.policy ? <div className="st-err">{errors.policy}</div> : (
              <div className="st-hint">Leave a blank line between sections. The first line of a section becomes its heading. The admin fee and contact details are added automatically.</div>
            )}
          </div>
          {saveError && <div className="st-banner err">{saveError}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="gfc-btn gfc-btn-primary" onClick={handleSave} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
          </div>
        </div>
      </div>

      <div className="st-preview" aria-label="Policy preview">
        <div className="st-preview-label">How guardians will see it</div>
        <div className="st-preview-title">Store policy</div>
        {sections.map((s, i) => (
          <div key={i}>
            {s.heading && <h4>{s.heading}</h4>}
            <p style={s.heading ? undefined : { marginTop: 10 }}>{s.body}</p>
          </div>
        ))}
        {feePct !== null && feePct > 0 && (
          <div>
            <h4>Admin fee</h4>
            <p>An admin fee of {feePct}% of the order value is added at checkout to cover card processing costs. It’s shown in your cart before you pay.</p>
          </div>
        )}
        {(form.contactEmail.trim() || form.contactPhone.trim()) && (
          <div>
            <h4>Contact</h4>
            <p>{[form.contactEmail.trim(), form.contactPhone.trim()].filter(Boolean).join(" · ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
