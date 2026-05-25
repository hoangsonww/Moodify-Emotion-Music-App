// Recency-preserving dedupe.
//
// Walks the input newest-first (assumes append-only history with the
// oldest entry at index 0) and keeps the first occurrence of each
// distinct key. The output is newest-first, so render code can drop
// its previous `.reverse()`.

/**
 * @template T
 * @param {T[]} items                 append-only history (oldest first).
 * @param {(item: T) => string} [key] collapse key. Defaults to identity.
 * @returns {T[]}                     deduped, newest first.
 */
export function uniqRecent(items, key = (x) => x) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const k = String(key(item)).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
