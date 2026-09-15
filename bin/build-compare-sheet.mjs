#!/usr/bin/env node
/**
 * Side-by-side fill SVG at 16 / 24 / 32 / 48px.
 *
 * Optional FA sprite columns appear only when leftover sprite files exist.
 *
 * Usage:
 *   node bin/build-compare-sheet.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	CUSTOM_ICON_NAMES,
	FIRST_PASS_ICON_NAMES,
	ICON_SOURCE_ENTRIES,
	PROVE_ICON_NAME,
	SVG_DIR_REL,
	faLookupName,
} from './svg-contract.mjs';

const PLUGIN_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const SVG_DIR = path.join(PLUGIN_ROOT, SVG_DIR_REL);
const OUT = path.join(PLUGIN_ROOT, 'src/icons/compare-sheet.html');
const SOLID = path.join(PLUGIN_ROOT, 'build/icons/sprites/solid.svg');
const REGULAR = path.join(PLUGIN_ROOT, 'build/icons/sprites/regular.svg');
const CUSTOM = path.join(PLUGIN_ROOT, 'build/icons/sprites/custom-icons.svg');

/**
 * @param {string} sprite Sprite markup.
 * @param {string} id     Symbol id.
 * @return {{ viewBox: string, d: string } | null} Path data, or null when missing.
 */
function extractSymbol(sprite, id) {
	const block = sprite.match(
		new RegExp(
			`<symbol\\s+id="${id}"\\s+viewBox="([^"]+)"\\s*>\\s*<path\\s+d="([^"]+)"`,
			's'
		)
	);
	if (!block) {
		return null;
	}
	return { viewBox: block[1], d: block[2] };
}

function esc(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function faSvg(symbol, size) {
	if (!symbol) {
		return `<span class="missing">no FA symbol</span>`;
	}
	return `<svg width="${size}" height="${size}" viewBox="${esc(symbol.viewBox)}" aria-hidden="true"><path fill="currentColor" d="${esc(symbol.d)}"/></svg>`;
}

function prcSvg(markup, size) {
	return markup
		.replace('<svg ', `<svg width="${size}" height="${size}" `)
		.replace(/\n|\t/g, '');
}

function pairCell(name, fa, prc, size, faLabel) {
	return `<div class="pair" data-size="${size}">
		<figure>${faSvg(fa, size)}<figcaption>${esc(faLabel)} ${size}px</figcaption></figure>
		<figure>${prcSvg(prc, size)}<figcaption>PRC ${size}px</figcaption></figure>
	</div>`;
}

function sourceEntry(name) {
	return ICON_SOURCE_ENTRIES.find((item) => item.name === name);
}

function main() {
	const solid = fs.existsSync(SOLID) ? fs.readFileSync(SOLID, 'utf8') : '';
	const regular = fs.existsSync(REGULAR)
		? fs.readFileSync(REGULAR, 'utf8')
		: '';
	const custom = fs.existsSync(CUSTOM) ? fs.readFileSync(CUSTOM, 'utf8') : '';

	const rows = FIRST_PASS_ICON_NAMES.map((name) => {
		const prc = fs.readFileSync(path.join(SVG_DIR, `${name}.svg`), 'utf8');
		const entry = sourceEntry(name);
		const preferCustom = CUSTOM_ICON_NAMES.includes(name);
		const isOutline = entry?.source === 'fa-free-regular';
		const faId = entry ? faLookupName(entry) : name;
		const fa =
			(preferCustom ? extractSymbol(custom, name) : null) ||
			(isOutline ? extractSymbol(regular, faId) : null) ||
			extractSymbol(solid, faId) ||
			extractSymbol(custom, name);
		const faLabel = isOutline ? 'FA regular' : 'FA solid';
		const isProve = name === PROVE_ICON_NAME;
		const outlineNote = isOutline
			? ' <span>(Free Regular outline)</span>'
			: '';
		return `<section class="glyph${isProve ? ' prove' : ''}${isOutline ? ' outline' : ''}" id="${esc(name)}">
			<h2>${esc(name)}${isProve ? ' <span>(prove glyph)</span>' : ''}${outlineNote}</h2>
			<div class="sizes">
				${[16, 24, 32, 48].map((size) => pairCell(name, fa, prc, size, faLabel)).join('\n')}
			</div>
		</section>`;
	});

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8"/>
	<title>PRC fill SVG vs FA — PRC-721</title>
	<style>
		:root { color: #111; background: #f6f6f4; font-family: ui-sans-serif, system-ui, sans-serif; }
		body { margin: 24px; }
		h1 { font-size: 1.25rem; }
		.note { max-width: 52rem; color: #444; }
		.glyph { border-top: 1px solid #ddd; padding: 16px 0; }
		.glyph.prove { background: #fff8d8; margin: 0 -12px; padding: 16px 12px; border: 1px solid #e6d27a; }
		.glyph.outline { background: #f3f7fb; }
		.glyph h2 { font-size: 1rem; margin: 0 0 8px; }
		.glyph h2 span { font-weight: 400; color: #666; }
		.sizes { display: flex; gap: 24px; flex-wrap: wrap; align-items: end; }
		.pair { display: flex; gap: 12px; align-items: end; }
		figure { margin: 0; text-align: center; color: #1a1a1a; }
		figcaption { font-size: 11px; color: #666; margin-top: 4px; }
		svg { display: block; }
		.missing { font-size: 11px; color: #a00; }
		.swatch { background: #fff; padding: 8px; border-radius: 4px; }
	</style>
</head>
<body>
	<h1>PRC fill SVGs vs Font Awesome</h1>
	<p class="note"><code>prc/{name}</code> is FA Free solid. <code>prc/{name}-outline</code> is FA Free Regular, baked with the same 24×24 contain-fit. FA sprites are a local visual reference only — they are not the registry source. The prove glyph is <a href="#${PROVE_ICON_NAME}">${PROVE_ICON_NAME}</a>.</p>
	${rows.join('\n')}
</body>
</html>
`;

	fs.writeFileSync(OUT, html);
	process.stdout.write(`Wrote src/icons/compare-sheet.html\n`);
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
	process.exitCode = 1;
}
