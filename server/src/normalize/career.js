/**
 * Career/aggregate stats (dataset 2). The payload is
 *   { data: { "30-days": {...}, "all-time": {...}, "match-categories": [...] },
 *     updatedAt, ingestedAt }
 * fetched per `matchCategory` (Regular, Calamari, ...). The category isn't in the
 * body, so the caller passes it. See docs/api-contract.md.
 */

export const WINDOWS = ['30-days', 'all-time'];
export const ROLES = ['killers', 'survivors', 'general'];

export function normalizeCareer(category, rawBody) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const data = body?.data;
  if (!data || !data['all-time']) {
    throw new Error('career payload missing data.all-time');
  }
  return {
    category,
    bhvrUpdatedAt: body.updatedAt ?? null,
    bhvrIngestedAt: body.ingestedAt ?? null,
    data,
  };
}

/** data → { window: { role: {..stats} } } flattened for storage/serving. */
export function careerWindows(data) {
  const out = {};
  for (const w of WINDOWS) {
    out[w] = {};
    for (const r of ROLES) out[w][r] = data?.[w]?.global?.[r] ?? null;
  }
  return out;
}

/** Which categories a payload says currently have stats. */
export function availableCategories(data) {
  return (data?.['match-categories'] ?? [])
    .filter((c) => c.stats && c.name !== 'Total')
    .map((c) => c.name);
}
