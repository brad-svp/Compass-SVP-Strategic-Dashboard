/**
 * Rebuild the small, reusable runtime brand assets and downloadable ZIP.
 * Run: node artifacts/api-server/scripts/build-compass-brand.mjs
 * Fonts are cached outside Git; all exported wordmarks are outlined.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';
import { zipSync } from 'fflate';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const brand = path.join(root, 'artifacts/svp-os/public/brand');
const cache = path.join(root, 'generated-artifacts/brand-fonts');
await mkdir(cache, { recursive: true });
const fontUrls = {
  Fraunces: 'https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58njr1603gg7S2nfgRYIcaRyjDg.ttf',
  Inter: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
};
const fonts = {};
for (const [name, url] of Object.entries(fontUrls)) {
  const file = path.join(cache, `${name}-600.ttf`);
  let data;
  try { data = await readFile(file); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot fetch ${name}: ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    await writeFile(file, data);
  }
  fonts[name] = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}
const labelPath = (text, x, y, size, spacing, font, color) => {
  let offset = x;
  return [...text].map((char, index, chars) => {
    const glyph = font.charToGlyph(char);
    // Serialize finite coordinates directly. opentype's decimal serializer can
    // turn near-integer IEEE-754 values (270.00000000000006) into "NaN".
    const glyphPath = glyph.getPath(offset, y, size);
    const coordinates = {
      M: ['x', 'y'], L: ['x', 'y'],
      Q: ['x1', 'y1', 'x', 'y'],
      C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'], Z: [],
    };
    const d = glyphPath.commands.map(command => {
      const keys = coordinates[command.type];
      if (!keys) throw new Error(`Unsupported glyph command: ${command.type}`);
      return command.type + keys.map(key => {
        const value = command[key];
        if (!Number.isFinite(value)) throw new Error(`Non-finite coordinate in ${text}`);
        return value.toFixed(3);
      }).join(' ');
    }).join('');
    const result = `<path fill="${color}" d="${d}"/>`;
    const next = chars[index + 1] ? font.charToGlyph(chars[index + 1]) : null;
    offset += ((glyph.advanceWidth ?? 0) + (next ? font.getKerningValue(glyph, next) : 0)) * size / font.unitsPerEm + spacing;
    return result;
  }).join('');
};
const lockups = {};
for (const [variant, mark, titleColor, subtitleColor] of [
  ['', 'svp-compass-mark.svg', '#0A2540', '#006AB6'],
  ['-dark', 'svp-compass-mark-dark.svg', '#F6F3EC', '#8FC6E4'],
  ['-mono-navy', 'svp-compass-mark-mono-navy.svg', '#0A2540', '#0A2540'],
  ['-mono-cream', 'svp-compass-mark-mono-cream.svg', '#F6F3EC', '#F6F3EC'],
]) {
  const shapes = (await readFile(path.join(brand, mark), 'utf8'))
    .replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<title>.*?<\/title>/, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64" role="img" aria-label="SVP Compass, Sacramento"><title>SVP Compass, Sacramento</title>${shapes}${labelPath('SVP Compass', 78, 36, 30, -0.6, fonts.Fraunces, titleColor)}${labelPath('SACRAMENTO', 79, 54, 10.5, 2.4, fonts.Inter, subtitleColor)}</svg>`;
  if (/NaN|Infinity|undefined/.test(svg)) throw new Error(`Invalid lockup: ${variant || 'primary'}`);
  lockups[variant] = svg;
  await writeFile(path.join(brand, `svp-compass-lockup${variant}.svg`), svg);
}
// Embed fonts for a genuinely offline, self-contained guide.
let guide = await readFile(path.join(brand, 'brand-guide.html'), 'utf8');
let lockupIndex = 0;
guide = guide.replace(/<svg\b[^>]*viewBox="0 0 300 64"[^>]*>[\s\S]*?<\/svg>/g, () =>
  lockups[lockupIndex++ === 0 ? '' : '-dark']);
const faces = (await Promise.all(Object.keys(fonts).map(async name =>
  `@font-face{font-family:'${name}';font-style:normal;font-weight:600;src:url(data:font/ttf;base64,${(await readFile(path.join(cache, `${name}-600.ttf`))).toString('base64')}) format('truetype')}`
))).join('');
guide = guide.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/, '');
guide = guide.replace(/<style id="embedded-fonts">[\s\S]*?<\/style>/, '');
guide = guide.replace('</head>', `<style id="embedded-fonts">${faces}</style></head>`);
await writeFile(path.join(brand, 'brand-guide.html'), guide);

for (const file of (await readdir(brand)).filter(name => name.endsWith('.svg'))) {
  const svg = await readFile(path.join(brand, file));
  const isLockup = file.includes('lockup');
  for (const scale of [1, 2, 3]) {
    await sharp(svg).resize(isLockup ? 300 * scale : 128 * scale).png()
      .toFile(path.join(brand, `${file.slice(0, -4)}@${scale}x.png`));
  }
}
const appIcon = await readFile(path.join(brand, 'svp-compass-app-icon.svg'));
for (const size of [16, 32, 48]) {
  await sharp(appIcon).resize(size, size).png().toFile(path.join(brand, `favicon-${size}.png`));
}
await sharp(appIcon).resize(180, 180).png().toFile(path.join(brand, 'apple-touch-icon.png'));
// ICO directory supports PNG payloads (Vista and newer).
const icoImages = await Promise.all([16, 32, 48].map(size => sharp(appIcon).resize(size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * icoImages.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoImages.length, 4);
let offset = header.length;
icoImages.forEach((image, i) => {
  const entry = 6 + i * 16;
  header[entry] = header[entry + 1] = [16, 32, 48][i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(path.join(brand, 'favicon.ico'), Buffer.concat([header, ...icoImages]));
await writeFile(path.join(brand, '../favicon.ico'), Buffer.concat([header, ...icoImages]));
const entries = {};
for (const file of await readdir(brand)) {
  if (!file.endsWith('.zip')) entries[`svp-compass/${file}`] = new Uint8Array(await readFile(path.join(brand, file)));
}
await writeFile(path.join(brand, 'svp-compass-brand-kit.zip'), zipSync(entries, { level: 9 }));
console.info(`Built SVP Compass asset package (${Object.keys(entries).length} files).`);
