// ---------------------------------------------------------------------------
// Club shop: reading and writing store data in Supabase. Used only by
// components/Store.jsx. Every call runs as the logged-in staff member, so
// the row-level security in migrations/2026-09-store-drop1.sql decides
// what each role can do (Admin, Treasurer and Chairman can manage the
// store; everyone else gets nothing back).
// ---------------------------------------------------------------------------

import { supabase } from "../supabaseClient";
import { fromDbProduct, photoTargetSize, photoPath, PHOTO_MAX_DIMENSION } from "./store.js";

export const PHOTO_BUCKET = "store-photos";

/** Loads every product (with sizes) and the store settings. */
export async function loadStore() {
  const [productsRes, settingsRes] = await Promise.all([
    supabase
      .from("store_products")
      .select("*, store_product_sizes(*)")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (productsRes.error) throw productsRes.error;
  if (settingsRes.error) throw settingsRes.error;
  return {
    products: (productsRes.data || []).map(fromDbProduct),
    settings: settingsRes.data || null,
  };
}

/** Public web address of a product photo (the bucket is public). */
export function photoUrl(path) {
  if (!path) return "";
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file couldn’t be opened as a photo. Try a JPG or PNG.")); };
    img.src = url;
  });
}

/**
 * Shrinks a photo to fit within 1200 x 1200 and converts it to JPEG, so a
 * 6 MB phone photo uploads as roughly 150-300 KB. Transparent PNGs get a
 * white background. Browsers apply the photo's rotation automatically.
 */
export async function preparePhoto(file) {
  const img = await loadImage(file);
  const { width, height } = photoTargetSize(img.naturalWidth, img.naturalHeight, PHOTO_MAX_DIMENSION);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("That photo couldn’t be processed. Try a different one.");
  return { blob, previewUrl: URL.createObjectURL(blob) };
}

/** Uploads a prepared photo for a product and returns its storage path. */
export async function uploadPhoto(productId, blob) {
  const path = photoPath(productId);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Removes a photo. Failures are ignored: a leftover file is harmless. */
export async function removePhoto(path) {
  if (!path) return;
  try {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Couldn't remove old store photo", path, e);
  }
}

/**
 * Saves a product and its sizes in one database transaction.
 * product: the validated fields from validateProduct(), plus id, is_new,
 * expected_updated_at (for existing products) and photo_path.
 */
export async function saveProduct(product, sizes) {
  const { data, error } = await supabase.rpc("save_store_product", {
    p_product: product,
    p_sizes: sizes || [],
  });
  if (error) throw error;
  return data;
}

export async function deleteProduct(product) {
  const { error } = await supabase.from("store_products").delete().eq("id", product.id);
  if (error) throw error;
  await removePhoto(product.photoPath);
}

export async function moveProduct(id, direction) {
  const { error } = await supabase.rpc("move_store_product", { p_id: id, p_direction: direction });
  if (error) throw error;
}

export async function setProductVisible(id, visible) {
  const { error } = await supabase.from("store_products").update({ visible }).eq("id", id);
  if (error) throw error;
}

/** Saves the validated settings from validateSettings(). Returns the saved row. */
export async function saveSettings(settings) {
  const { data, error } = await supabase
    .from("store_settings")
    .update(settings)
    .eq("id", 1)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
