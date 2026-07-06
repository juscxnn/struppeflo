/**
 * Tiny deterministic text pipeline for the local "AI": tokenize → TF-IDF
 * vectors → cosine similarity. No randomness, no time — byte-identical
 * output for identical input.
 */

const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an",
  "and", "any", "are", "as", "at", "be", "because", "been", "before",
  "being", "below", "between", "both", "but", "by", "can", "cannot",
  "could", "did", "do", "does", "doing", "down", "during", "each", "few",
  "for", "from", "further", "had", "has", "have", "having", "he", "her",
  "here", "hers", "herself", "him", "himself", "his", "how", "i", "if",
  "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most",
  "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
  "same", "she", "should", "so", "some", "such", "than", "that", "the",
  "their", "theirs", "them", "themselves", "then", "there", "these",
  "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "we", "were", "what", "when", "where", "which", "while",
  "who", "whom", "why", "will", "with", "would", "you", "your", "yours",
  "yourself", "yourselves",
]);

/** Strip one suffix only when the remaining stem keeps ≥ 4 chars. */
function stem(word: string): string {
  if (word.endsWith("ing") && word.length - 3 >= 4) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length - 2 >= 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length - 1 >= 4) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!cleaned) return [];
  const out: string[] = [];
  for (const word of cleaned.split(/\s+/)) {
    if (STOPWORDS.has(word)) continue;
    out.push(stem(word));
  }
  return out;
}

/**
 * TF·IDF vectors keyed by doc id; idf = ln(1 + N/df). Title weighting is the
 * caller's job (repeat title tokens in the doc text).
 */
export function buildVectors(
  docs: Array<{ id: string; text: string }>,
): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();
  for (const doc of docs) {
    const tf = new Map<string, number>();
    for (const term of tokenize(doc.text)) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }
    counts.set(doc.id, tf);
    for (const term of tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const n = docs.length;
  const vectors = new Map<string, Map<string, number>>();
  for (const [id, tf] of counts) {
    const vec = new Map<string, number>();
    for (const [term, count] of tf) {
      vec.set(term, count * Math.log(1 + n / (df.get(term) ?? 1)));
    }
    vectors.set(id, vec);
  }
  return vectors;
}

export function cosine(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, w] of small) {
    const w2 = large.get(term);
    if (w2 !== undefined) dot += w * w2;
  }
  if (dot === 0) return 0;
  let na = 0;
  for (const w of a.values()) na += w * w;
  let nb = 0;
  for (const w of b.values()) nb += w * w;
  return dot / Math.sqrt(na * nb);
}

/** Terms appearing in at most `maxDf` docs — distinctive vocabulary. */
export function rareTerms(
  docs: Array<{ id: string; text: string }>,
  maxDf = 2,
): Set<string> {
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(tokenize(doc.text))) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const rare = new Set<string>();
  for (const [term, count] of df) {
    if (count <= maxDf) rare.add(term);
  }
  return rare;
}
