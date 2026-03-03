// generate.js
// Reads src/assets/images/, builds optimized <img> tags with srcset,
// then rewrites the gallery section of index.html.
//
// New images (not seen before) are placed at the TOP, shuffled among
// themselves. Known images keep their previous order.
//
// Usage: node generate.js

import fs from 'fs';

const IMG_DIR  = 'src/assets/images';
const INDEX    = 'index.html';
const MANIFEST = 'image-order.json';

// ─── 1. Read & group images by hash ID ───────────────────────────────────────

const files = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.webp'));

// Map: hashId → { base: filename|null, variants: [{file, width}] }
const map = new Map();

for (const file of files) {
  const id        = file.split('_')[0];
  const sizeMatch = file.match(/-p-(\d+)/);

  if (!map.has(id)) map.set(id, { base: null, variants: [] });
  const entry = map.get(id);

  if (sizeMatch) {
    entry.variants.push({ file, width: parseInt(sizeMatch[1]) });
  } else {
    entry.base = file;
  }
}

for (const entry of map.values()) {
  entry.variants.sort((a, b) => a.width - b.width);
}

// ─── 2. Build image metadata keyed by ID ─────────────────────────────────────

const byId = new Map();

for (const [id, entry] of map) {
  const { base, variants } = entry;
  const srcFile = base ?? variants.at(-1)?.file;
  if (!srcFile) continue;

  const srcset = variants
    .map(v => `src/assets/images/${v.file} ${v.width}w`)
    .join(',\n             ');

  const alt = srcFile
    .replace(/^[^_]+_/, '')
    .replace(/(-p-\d+)?\.webp$/, '')
    .replace(/[-_%]/g, ' ')
    .replace(/%2C/gi, ',')
    .replace(/%20/gi, ' ')
    .trim();

  byId.set(id, { src: `src/assets/images/${srcFile}`, srcset, alt });
}

// ─── 3. Order: new images first (shuffled), then known images (saved order) ──

const currentIds  = new Set(byId.keys());
const savedOrder  = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  : [];

// IDs in the saved order that still exist on disk
const knownIds = savedOrder.filter(id => currentIds.has(id));

// IDs on disk that weren't in the saved order → new arrivals
const newIds = [...currentIds].filter(id => !savedOrder.includes(id));

// Shuffle new arrivals (Fisher-Yates)
for (let i = newIds.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [newIds[i], newIds[j]] = [newIds[j], newIds[i]];
}

const orderedIds = [...newIds, ...knownIds];

// Save updated manifest
fs.writeFileSync(MANIFEST, JSON.stringify(orderedIds, null, 2));

// Build final image list
const images = orderedIds.map(id => byId.get(id));

// ─── 4. Generate gallery HTML ─────────────────────────────────────────────────

const SIZES = '(max-width: 540px) 100vw, (max-width: 900px) 50vw, 33vw';

let galleryHTML = '    <section class="gallery">\n\n';

for (let i = 0; i < images.length; i += 3) {
  const chunk   = images.slice(i, i + 3);
  const isFirst = i === 0;

  galleryHTML += '      <div class="gallery-row">\n';

  chunk.forEach((img, j) => {
    const lazy   = isFirst && j < 3 ? 'eager' : 'lazy';
    const prio   = isFirst && j < 3 ? '\n          fetchpriority="high"' : '';
    const srcset = img.srcset
      ? `\n          srcset="${img.srcset}"\n          sizes="${SIZES}"`
      : '';

    galleryHTML +=
      `        <div class="img">\n` +
      `          <img src="${img.src}"${srcset}\n` +
      `          alt="${img.alt}"\n` +
      `          loading="${lazy}"${prio}\n` +
      `          decoding="async">\n` +
      `        </div>\n`;
  });

  galleryHTML += '      </div>\n\n';
}

galleryHTML += '    </section>';

// ─── 5. Splice into index.html ────────────────────────────────────────────────

let html = fs.readFileSync(INDEX, 'utf8');

html = html.replace(
  /<section class="gallery">[\s\S]*?<\/section>/,
  galleryHTML
);

fs.writeFileSync(INDEX, html);

const newCount = newIds.length;
const msg = newCount > 0
  ? `${newCount} new image${newCount > 1 ? 's' : ''} added at the top — `
  : 'No new images — ';
console.log(`✓ ${msg}${images.length} total across ${Math.ceil(images.length / 3)} rows.`);
