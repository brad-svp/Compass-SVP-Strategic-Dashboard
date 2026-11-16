import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrandLockup, LogoMark } from '../src/components/brand-logo';

const app = path.join(process.cwd(), 'artifacts/svp-os');
const read = (file: string) => readFileSync(path.join(app, file), 'utf8');

test('light and dark lockups expose the product name and same compass geometry', () => {
  for (const light of [false, true]) {
    const markup = renderToStaticMarkup(<BrandLockup light={light} />);
    assert.match(markup, /aria-label="SVP Compass, Sacramento"/);
    assert.match(markup, /SVP Compass/);
    assert.doesNotMatch(markup, /SVP OS/);
    assert.match(markup, /viewBox="0 0 64 64"/);
    assert.match(markup, /M46.5 17.5 36.6 36.6 27.4 27.4Z/);
    assert.match(markup, new RegExp(light ? '#F6F3EC' : '#0A2540'));
    assert.match(markup, /min-w-0/);
  }
  assert.match(renderToStaticMarkup(<LogoMark className="h-4 w-4" />), /h-4 w-4/);
});

test('metadata and favicon references use Compass and the artifact base prefix', () => {
  const html = read('index.html');
  assert.match(html, /<title>SVP Compass<\/title>/);
  assert.match(html, /property="og:title" content="SVP Compass"/);
  assert.match(html, /name="twitter:title" content="SVP Compass"/);
  assert.doesNotMatch(html, /SVP OS|Update this description/);
  for (const url of [...html.matchAll(/href="%BASE_URL%([^"]+)"/g)]) {
    assert.ok(readFileSync(path.join(app, 'public', url[1])).length > 0);
  }
});

test('exported wordmarks are portable outlined vectors with transparent canvases', () => {
  for (const file of readdirSync(path.join(app, 'public/brand')).filter(name => /^svp-compass-lockup.*\.svg$/.test(name))) {
    const svg = read(`public/brand/${file}`);
    assert.doesNotMatch(svg, /<text|<image|<rect/);
    assert.match(svg, /<path/);
    assert.match(svg, /aria-label="SVP Compass, Sacramento"/);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined|null/, `${file} must not contain non-finite coordinates`);
    for (const [, d] of svg.matchAll(/ d="([^"]*)"/g)) {
      const numbers = d.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
      assert.ok(numbers.every(value => Number.isFinite(Number(value))), `${file} coordinates must be finite`);
      const remainder = d
        .replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, '')
        .replace(/[MmLlHhVvCcSsQqTtAaZz\s,]/g, '');
      assert.equal(remainder, '', `${file} path must contain only SVG commands and numbers`);
    }
  }
});

test('favicon matches the app icon and the offline guide exposes the asset download', () => {
  assert.equal(read('public/favicon.svg').trim(), read('public/brand/svp-compass-app-icon.svg').trim());
  const guide = read('public/brand/brand-guide.html');
  assert.match(guide, /svp-compass-brand-kit\.zip/);
  assert.match(guide, /data:font\/ttf;base64,/);
  assert.doesNotMatch(guide, /https:\/\/fonts\.googleapis/);
  assert.ok(readFileSync(path.join(app, 'public/brand/svp-compass-brand-kit.zip')).length > 100);
});
