import { describe, it, expect } from "vitest";
import {
  parsePrice, parsePercent, validateProduct, stockSummary, availability, storeStats,
  adminFee, validateSettings, policySections, photoTargetSize, photoPath, fromDbProduct,
  friendlyStoreError, blankProduct,
} from "./store.js";

describe("parsePrice", () => {
  it("reads the ways staff type prices", () => {
    expect(parsePrice("450")).toBe(450);
    expect(parsePrice("450.00")).toBe(450);
    expect(parsePrice("450,50")).toBe(450.5);
    expect(parsePrice("R 1 200")).toBe(1200);
    expect(parsePrice("R1,200.00")).toBe(1200);
    expect(parsePrice(" 95.5 ")).toBe(95.5);
  });
  it("rejects anything unclear", () => {
    for (const bad of ["", "abc", "4.505", "-10", "1.2.3", "12,34,5", "R"]) expect(parsePrice(bad), bad).toBeNull();
  });
});

describe("parsePercent", () => {
  it("reads percentages", () => {
    expect(parsePercent("3.5")).toBe(3.5);
    expect(parsePercent("3,5%")).toBe(3.5);
    expect(parsePercent("0")).toBe(0);
    expect(parsePercent("abc")).toBeNull();
    expect(parsePercent("-1")).toBeNull();
  });
});

describe("adminFee", () => {
  it("works in cents and rounds to the nearest cent", () => {
    expect(adminFee(450, 3.5)).toBe(15.75);
    expect(adminFee(85, 3.5)).toBe(2.98);      // 297.5 cents rounds up
    expect(adminFee(1350, 3.5)).toBe(47.25);
    expect(adminFee(0.1 + 0.2, 10)).toBe(0.03);
    expect(adminFee(100, 0)).toBe(0);
    expect(adminFee(0, 3.5)).toBe(0);
  });
});

describe("validateProduct", () => {
  const base = { ...blankProduct(), name: "Home jersey", price: "450" };
  it("accepts a simple in-stock product", () => {
    const r = validateProduct({ ...base, stock: "12" });
    expect(r.ok).toBe(true);
    expect(r.product).toMatchObject({ name: "Home jersey", price: "450.00", sale_mode: "stock", has_sizes: false, stock: "12" });
    expect(r.sizes).toEqual([]);
  });
  it("needs a name, a price above zero and whole-number stock", () => {
    const r = validateProduct({ ...blankProduct(), name: " ", price: "0", stock: "1.5" });
    expect(r.ok).toBe(false);
    expect(r.errors.name).toBeTruthy();
    expect(r.errors.price).toBeTruthy();
    expect(r.errors.stock).toBeTruthy();
  });
  it("checks sizes", () => {
    expect(validateProduct({ ...base, hasSizes: true, sizes: [] }).errors.sizes).toMatch(/at least one size/);
    expect(validateProduct({ ...base, hasSizes: true, sizes: [{ label: "S", stock: "1" }, { label: " s ", stock: "2" }] }).errors.sizes).toMatch(/listed twice/);
    expect(validateProduct({ ...base, hasSizes: true, sizes: [{ label: "", stock: "1" }] }).errors.sizes).toMatch(/every size a name/);
    expect(validateProduct({ ...base, hasSizes: true, sizes: [{ label: "M", stock: "" }] }).errors.sizes).toMatch(/stock for size M/);
    const ok = validateProduct({ ...base, hasSizes: true, sizes: [{ id: "a", label: " S ", stock: "2" }, { label: "M", stock: "0" }] });
    expect(ok.ok).toBe(true);
    expect(ok.sizes).toEqual([{ id: "a", label: "S", stock: "2" }, { id: "", label: "M", stock: "0" }]);
    expect(ok.product.stock).toBeNull();
  });
  it("pre-orders don't need stock", () => {
    const r = validateProduct({ ...base, saleMode: "preorder", hasSizes: true, stock: "", sizes: [{ label: "S", stock: "" }], preorderClosesOn: "2026-10-15", preorderExpected: " Mid-November " });
    expect(r.ok).toBe(true);
    expect(r.sizes[0].stock).toBeNull();
    expect(r.product).toMatchObject({ sale_mode: "preorder", stock: null, preorder_closes_on: "2026-10-15", preorder_expected: "Mid-November" });
  });
});

describe("stockSummary and availability", () => {
  const sized = { saleMode: "stock", hasSizes: true, visible: true, sizes: [{ label: "S", stock: 0 }, { label: "M", stock: 2 }, { label: "L", stock: 9 }] };
  it("summarises sized stock", () => {
    const s = stockSummary(sized);
    expect(s.total).toBe(11);
    expect(s.anySizeOut).toBe(true);
    expect(s.low).toBe(true);
    expect(s.parts.map((p) => p.level)).toEqual(["zero", "low", "ok"]);
  });
  it("labels what guardians would see", () => {
    expect(availability(sized, "2026-09-25").tone).toBe("instock");
    expect(availability({ ...sized, visible: false }).tone).toBe("hidden");
    expect(availability({ saleMode: "stock", hasSizes: false, stock: 0, visible: true }).tone).toBe("soldout");
    const pre = { saleMode: "preorder", visible: true, preorderClosesOn: "2026-10-15" };
    expect(availability(pre, "2026-09-25", () => "15 Oct").text).toBe("Pre-order, closes 15 Oct");
    expect(availability(pre, "2026-10-16").tone).toBe("closed");
  });
  it("counts stats", () => {
    const stats = storeStats([
      sized,
      { saleMode: "stock", hasSizes: false, stock: 0, visible: true, sizes: [] },
      { saleMode: "preorder", visible: true, preorderClosesOn: "", sizes: [] },
      { saleMode: "stock", hasSizes: false, stock: 5, visible: false, sizes: [] },
    ], "2026-09-25");
    expect(stats).toEqual({ shown: 3, low: 1, soldOut: 2, preordersOpen: 1 });
  });
});

describe("validateSettings", () => {
  it("accepts good settings", () => {
    const r = validateSettings({ shopOpen: false, adminFeePercent: "3.5", contactEmail: "shop@club.co.za", contactPhone: "021 000 0000", policyText: "Hi" });
    expect(r.ok).toBe(true);
    expect(r.settings.admin_fee_percent).toBe(3.5);
  });
  it("rejects a fee over 20% and a bad email", () => {
    const r = validateSettings({ adminFeePercent: "25", contactEmail: "nope" });
    expect(r.errors.fee).toBeTruthy();
    expect(r.errors.email).toBeTruthy();
  });
});

describe("policySections", () => {
  it("uses the first line of a multi-line block as its heading", () => {
    expect(policySections("Intro line\n\nCollection\nAt the clubhouse.\nBring your number.\r\n\r\n\n")).toEqual([
      { heading: "", body: "Intro line" },
      { heading: "Collection", body: "At the clubhouse.\nBring your number." },
    ]);
  });
});

describe("photos", () => {
  it("shrinks but never enlarges", () => {
    expect(photoTargetSize(4032, 3024)).toEqual({ width: 1200, height: 900 });
    expect(photoTargetSize(3024, 4032)).toEqual({ width: 900, height: 1200 });
    expect(photoTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("builds a path the database accepts", () => {
    const p = photoPath("11111111-1111-1111-1111-111111111111", 1727250000000);
    expect(p).toBe("11111111-1111-1111-1111-111111111111/1727250000000.jpg");
    expect(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,100}$/.test(p)).toBe(true);
  });
});

describe("fromDbProduct", () => {
  it("sorts sizes and maps fields", () => {
    const p = fromDbProduct({ id: "x", name: "Cap", price: "150.00", sale_mode: "stock", has_sizes: true, visible: true,
      store_product_sizes: [{ id: "b", label: "M", stock: 3, sort_order: 2 }, { id: "a", label: "S", stock: 1, sort_order: 1 }] });
    expect(p.price).toBe(150);
    expect(p.sizes.map((s) => s.label)).toEqual(["S", "M"]);
  });
});

describe("friendlyStoreError", () => {
  it("explains common failures", () => {
    expect(friendlyStoreError({ code: "40001", message: "x" })).toMatch(/changed while you were editing/);
    expect(friendlyStoreError({ code: "42501" })).toMatch(/permission/);
    expect(friendlyStoreError({ message: 'duplicate key value violates unique constraint "store_product_sizes_label_uq"' })).toMatch(/only be listed once/);
    expect(friendlyStoreError({ message: "TypeError: Failed to fetch" })).toMatch(/connection/);
  });
});
