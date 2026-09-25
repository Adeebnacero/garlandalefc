// ---------------------------------------------------------------------------
// Club shop: rules and calculations with no database or screen code, so
// they can be unit-tested (see store.test.js). Used by components/Store.jsx
// in Club Management. Drop 2 (the Player Portal shop) will use the same
// admin fee and stock rules on the server.
//
// The database enforces the same limits (see
// migrations/2026-09-store-drop1.sql), so these checks exist to give staff
// clear messages, not as the only line of defence.
// ---------------------------------------------------------------------------

export const SIZE_PRESETS = {
  kidsAdult: ["7–8", "9–10", "11–12", "S", "M", "L", "XL"],
  juniorSenior: ["Junior", "Senior"],
};

export const LOW_STOCK_AT = 2;          // "Low stock" when 1-2 left
export const MAX_PRICE = 100000;
export const MAX_STOCK = 100000;
export const MAX_ADMIN_FEE_PERCENT = 20;
export const PHOTO_MAX_DIMENSION = 1200; // photos are shrunk to fit this before upload
export const PHOTO_MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** Turns a store_products row (with store_product_sizes embedded) into the app's shape. */
export function fromDbProduct(row) {
  const sizes = (row.store_product_sizes || [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s) => ({ id: s.id, label: s.label, stock: s.stock }));
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    price: Number(row.price) || 0,
    saleMode: row.sale_mode === "preorder" ? "preorder" : "stock",
    hasSizes: !!row.has_sizes,
    stock: row.stock ?? null,
    preorderClosesOn: row.preorder_closes_on || "",
    preorderExpected: row.preorder_expected || "",
    visible: !!row.visible,
    photoPath: row.photo_path || "",
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at || null,
    sizes,
  };
}

/** A blank product for the "Add product" form. */
export function blankProduct() {
  return {
    id: null,
    name: "",
    description: "",
    price: "",
    saleMode: "stock",
    hasSizes: false,
    stock: "0",
    preorderClosesOn: "",
    preorderExpected: "",
    visible: true,
    photoPath: "",
    updatedAt: null,
    sizes: [],
  };
}

/**
 * Reads a price typed by staff: "450", "450.00", "450,50", "R 1 200" or
 * "R1,200.00". Returns a number with at most 2 decimals, or null if the
 * text isn't a clear price.
 */
export function parsePrice(input) {
  let s = String(input ?? "").trim().replace(/^R\s*/i, "").replace(/\s/g, "");
  if (!s) return null;
  // "1,200.50" -> thousands comma; "450,50" -> decimal comma.
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100) / 100;
}

function parseWholeNumber(input) {
  const s = String(input ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n <= MAX_STOCK ? n : null;
}

/**
 * Checks the product form. Returns { ok, errors, product, sizes }, where
 * product and sizes are ready for the save_store_product database function.
 * errors has a message per field: name, price, stock, sizes, closes,
 * expected, description.
 */
export function validateProduct(draft) {
  const errors = {};
  const name = String(draft.name || "").trim();
  if (!name) errors.name = "Enter a product name.";
  else if (name.length > 120) errors.name = "Keep the name to 120 characters or fewer.";

  const description = String(draft.description || "");
  if (description.length > 2000) errors.description = "Keep the description to 2,000 characters or fewer.";

  const price = parsePrice(draft.price);
  if (price === null) errors.price = "Enter a price in rand, e.g. 450 or 450.00.";
  else if (price <= 0) errors.price = "Enter a price above R0.";
  else if (price > MAX_PRICE) errors.price = "That price looks too high. The maximum is R100,000.";

  const saleMode = draft.saleMode === "preorder" ? "preorder" : "stock";
  const hasSizes = !!draft.hasSizes;

  let stock = null;
  if (saleMode === "stock" && !hasSizes) {
    stock = parseWholeNumber(draft.stock);
    if (stock === null) errors.stock = "Enter the number in stock as a whole number (0 or more).";
  }

  const sizes = [];
  if (hasSizes) {
    const rows = draft.sizes || [];
    const seen = new Set();
    if (rows.length === 0) errors.sizes = "Add at least one size, or untick “Sold in sizes”.";
    for (const row of rows) {
      const label = String(row.label || "").trim();
      if (!label) { errors.sizes = "Give every size a name, or remove the empty row."; break; }
      if (label.length > 20) { errors.sizes = `“${label.slice(0, 20)}…” is too long. Keep size names to 20 characters.`; break; }
      const key = label.toLowerCase();
      if (seen.has(key)) { errors.sizes = `“${label}” is listed twice. Each size can only appear once.`; break; }
      seen.add(key);
      let sizeStock = null;
      if (saleMode === "stock") {
        sizeStock = parseWholeNumber(row.stock);
        if (sizeStock === null) { errors.sizes = `Enter the stock for size ${label} as a whole number (0 or more).`; break; }
      }
      sizes.push({ id: row.id || "", label, stock: sizeStock === null ? null : String(sizeStock) });
    }
  }

  let closes = "";
  let expected = "";
  if (saleMode === "preorder") {
    closes = String(draft.preorderClosesOn || "").trim();
    if (closes && !/^\d{4}-\d{2}-\d{2}$/.test(closes)) errors.closes = "Choose a closing date, or leave it empty.";
    expected = String(draft.preorderExpected || "").trim();
    if (expected.length > 120) errors.expected = "Keep this to 120 characters or fewer.";
  }

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    product: ok ? {
      name,
      description,
      price: price.toFixed(2),
      sale_mode: saleMode,
      has_sizes: hasSizes,
      stock: stock === null ? null : String(stock),
      preorder_closes_on: closes,
      preorder_expected: expected,
      visible: !!draft.visible,
    } : null,
    sizes: ok ? sizes : null,
  };
}

/**
 * Stock at a glance. parts lists each size (or the single stock figure)
 * with level "zero", "low" or "ok".
 */
export function stockSummary(product) {
  if (product.saleMode === "preorder") return { kind: "preorder", total: null, soldOut: false, anySizeOut: false, low: false, parts: [] };
  const level = (n) => (n === 0 ? "zero" : n <= LOW_STOCK_AT ? "low" : "ok");
  if (product.hasSizes) {
    const parts = product.sizes.map((s) => ({ label: s.label, stock: Number(s.stock) || 0, level: level(Number(s.stock) || 0) }));
    const total = parts.reduce((a, p) => a + p.stock, 0);
    return {
      kind: "sizes",
      total,
      soldOut: total === 0,
      anySizeOut: parts.some((p) => p.stock === 0),
      low: parts.some((p) => p.level === "low"),
      parts,
    };
  }
  const n = Number(product.stock) || 0;
  return { kind: "single", total: n, soldOut: n === 0, anySizeOut: n === 0, low: level(n) === "low", parts: [{ label: "", stock: n, level: level(n) }] };
}

/**
 * What guardians would see. today is "YYYY-MM-DD"; formatDate formats the
 * closing date for display. Returns { tone, text }
 * where tone is one of hidden, preorder, closed, soldout, instock.
 */
export function availability(product, today, formatDate = (d) => d) {
  if (!product.visible) return { tone: "hidden", text: "Hidden" };
  if (product.saleMode === "preorder") {
    if (product.preorderClosesOn && today && product.preorderClosesOn < today) return { tone: "closed", text: "Pre-orders closed" };
    return { tone: "preorder", text: product.preorderClosesOn ? `Pre-order, closes ${formatDate(product.preorderClosesOn)}` : "Pre-order" };
  }
  return stockSummary(product).soldOut ? { tone: "soldout", text: "Sold out" } : { tone: "instock", text: "In stock" };
}

/** Figures for the stat cards above the products list. */
export function storeStats(products, today) {
  const stats = { shown: 0, low: 0, soldOut: 0, preordersOpen: 0 };
  for (const p of products) {
    if (p.visible) stats.shown++;
    const s = stockSummary(p);
    if (s.kind !== "preorder") {
      if (s.low) stats.low++;
      if (s.anySizeOut) stats.soldOut++;
    } else if (p.visible && availability(p, today).tone === "preorder") {
      stats.preordersOpen++;
    }
  }
  return stats;
}

/**
 * The admin fee on an order, in rand, rounded to the nearest cent
 * (half a cent rounds up). Worked out in cents to avoid floating-point
 * surprises, e.g. 3.5% of R450.00 = R15.75.
 */
export function adminFee(subtotal, percent) {
  const cents = Math.round(Number(subtotal) * 100);
  const pct = Number(percent);
  if (!(cents > 0) || !(pct > 0)) return 0;
  return Math.round((cents * pct) / 100) / 100;
}

/** Reads a fee percentage typed by staff: "3.5", "3,5" or "3.5%". */
export function parsePercent(input) {
  const s = String(input ?? "").trim().replace(/%$/, "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

/** Checks the Store settings form. Returns { ok, errors, settings }. */
export function validateSettings(form) {
  const errors = {};
  const fee = parsePercent(form.adminFeePercent);
  if (fee === null) errors.fee = "Enter the admin fee as a percentage, e.g. 3.5.";
  else if (fee > MAX_ADMIN_FEE_PERCENT) errors.fee = `The admin fee can’t be more than ${MAX_ADMIN_FEE_PERCENT}%.`;

  const email = String(form.contactEmail || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address, or leave it empty.";
  if (email.length > 200) errors.email = "That email address is too long.";

  const phone = String(form.contactPhone || "").trim();
  if (phone.length > 40) errors.phone = "Keep the phone number to 40 characters or fewer.";

  const policy = String(form.policyText || "");
  if (policy.length > 20000) errors.policy = "The policy is too long. Keep it under 20,000 characters.";

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    settings: ok ? {
      shop_open: !!form.shopOpen,
      admin_fee_percent: fee,
      contact_email: email,
      contact_phone: phone,
      policy_text: policy,
    } : null,
  };
}

/**
 * Splits the policy text into sections for display. Blocks are separated
 * by a blank line; a block with more than one line uses its first line as
 * the heading.
 */
export function policySections(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      return lines.length > 1
        ? { heading: lines[0].trim(), body: lines.slice(1).join("\n").trim() }
        : { heading: "", body: lines[0].trim() };
    });
}

/** Scales a photo down (never up) to fit within max x max. */
export function photoTargetSize(width, height, max = PHOTO_MAX_DIMENSION) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Storage path for a product photo. Matches the database's photo_path rule. */
export function photoPath(productId, now = Date.now()) {
  return `${productId}/${now}.jpg`;
}

/** Turns database errors into messages staff can act on. */
export function friendlyStoreError(err) {
  const msg = String(err?.message || err || "");
  const code = err?.code || "";
  if (code === "40001" || /changed while you were editing/i.test(msg)) {
    return "This product was changed while you were editing it (possibly by a sale). Close it, reopen it and make your change again.";
  }
  if (code === "42501" || /permission/i.test(msg)) return "You don’t have permission to manage the store.";
  if (/store_product_sizes_label_uq/.test(msg)) return "Each size can only be listed once.";
  if (/store_products_price_check/.test(msg)) return "Enter a price between R0.01 and R100,000.";
  if (/store_settings_fee_check/.test(msg)) return `The admin fee must be between 0% and ${MAX_ADMIN_FEE_PERCENT}%.`;
  if (/check constraint/i.test(msg)) return "Something in this form isn’t valid. Check the fields and try again.";
  if (/no longer exists/i.test(msg)) return "This product no longer exists. It may have been deleted by someone else.";
  if (/at least one size|stock number/i.test(msg)) return msg;
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Couldn’t reach the server. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}
