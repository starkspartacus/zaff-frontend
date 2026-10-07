import type { DeviceCatalog, ReferenceCategory } from '@/lib/queries';

/** Ce qu'on devine d'un nom de fichier (ex. « Samsung_Galaxy-A55-5G_bleu.jpg ») */
export interface PhotoGuess {
  brand: string;
  model: string;
  color: string;
  category: string;
}

const norm = (v: string) =>
  ` ${v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

const has = (hay: string, needle: string) => needle.trim().length > 0 && hay.includes(norm(needle));

const COMMON_COLORS = ['Noir', 'Blanc', 'Gris', 'Argent', 'Bleu', 'Vert', 'Rouge', 'Or', 'Violet', 'Rose', 'Jaune', 'Orange', 'Titane'];

/**
 * Devine marque, modèle, couleur et catégorie à partir du nom du fichier en s'appuyant sur le
 * catalogue des appareils connus (le plus long modèle reconnu gagne). Tout reste modifiable.
 */
export function guessFromFilename(filename: string, devices?: DeviceCatalog, reference: ReferenceCategory[] = []): PhotoGuess {
  const name = norm(filename);
  const out: PhotoGuess = { brand: '', model: '', color: '', category: '' };
  let colors: string[] = [];

  // 1. Modèle connu (toutes marques) : « iphone 15 pro max » l'emporte sur « iphone 15 »
  let best = '';
  for (const [category, brands] of Object.entries(devices?.models || {})) {
    for (const [brand, models] of Object.entries(brands)) {
      for (const m of models) {
        if (has(name, m.name) && m.name.length > best.length) {
          best = m.name;
          Object.assign(out, { brand, model: m.name, category });
          colors = m.colors || devices?.profiles[category]?.colors || [];
        }
      }
    }
  }

  // 2. Sinon la marque seule, et le reste du nom comme modèle
  if (!out.brand) {
    const brands = [...new Set([...Object.values(devices?.models || {}).flatMap((b) => Object.keys(b)), ...reference.flatMap((r) => r.brands)])];
    const brand = brands.filter((b) => has(name, b)).sort((a, b) => b.length - a.length)[0];
    if (brand) {
      out.brand = brand;
      out.category = reference.find((r) => r.brands.some((b) => norm(b) === norm(brand)))?.slug || '';
      const rest = name.replace(norm(brand), ' ').trim();
      out.model = rest
        .split(' ')
        .filter((w) => w && !COMMON_COLORS.some((c) => norm(c).trim() === w))
        .map((w) => (/\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
    }
  }

  // 3. Couleur : celles du modèle, de la catégorie, puis les plus courantes
  const candidates = [...colors, ...(out.category ? devices?.profiles[out.category]?.colors || [] : []), ...COMMON_COLORS];
  out.color = candidates.filter((c) => has(name, c)).sort((a, b) => b.length - a.length)[0] || '';
  return out;
}
