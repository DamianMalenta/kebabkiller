/** One-time deterministic metadata for assets — no vision API per chat turn. */

export function buildDeterministicAssetMetadata({ asset, label, filename }) {
  const typeHints = {
    character: 'Postać',
    location: 'Lokacja / tło',
    prop: 'Rekwizyt',
    detail: 'Detal',
  };

  const parts = [
    typeHints[asset?.type] || 'Asset',
    asset?.name,
    label,
    asset?.description_pl,
  ].filter(Boolean);

  return {
    description: parts.join(' — ').slice(0, 280) || filename || 'Obraz referencyjny',
    asset_type: asset?.type || 'unknown',
    analyzed_at: new Date().toISOString(),
    source: 'deterministic',
  };
}
