#!/usr/bin/env node
/**
 * Write 24×24 fill SVGs for the PRC set and approved brand marks.
 *
 * UI glyphs come from fill-icon-catalog.mjs (`@fortawesome/free-solid-svg-icons`
 * and `@fortawesome/free-regular-svg-icons` baked into 24×24, plus keep-custom
 * masters listed in icon-source-map.json). `prc/{name}` is solid;
 * `prc/{name}-outline` is Free Regular when that glyph exists, or a custom
 * fill when Free Regular lacks the solid.
 * Approved brands bake from `@fortawesome/free-brands-svg-icons` into
 * `src/icons/brands/{name}.svg`.
 *
 * Usage:
 *   node bin/build-fill-svgs.mjs
 *   node bin/build-fill-svgs.mjs --check
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	BRAND_ICON_CATALOG,
	FILL_ICON_CATALOG,
	assertFaFreeBrandCoverage,
	assertFaFreeRegularOutlineCoverage,
} from './fill-icon-catalog.mjs';
import {
	BRANDS_SVG_DIR_REL,
	CUSTOM_ICON_NAMES,
	FIRST_PASS_ICON_NAMES,
	SVG_DIR_REL,
	collectContractErrors,
	serializeFillSvg,
} from './svg-contract.mjs';

const PLUGIN_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const SVG_DIR = path.join(PLUGIN_ROOT, SVG_DIR_REL);
const BRANDS_SVG_DIR = path.join(PLUGIN_ROOT, BRANDS_SVG_DIR_REL);
const CUSTOM_SPRITE = path.join(
	PLUGIN_ROOT,
	'build/icons/sprites/custom-icons.svg'
);

function parseArgs(argv) {
	return { check: argv.includes('--check') };
}

/**
 * @param {string} sprite Sprite markup.
 * @param {string} id     Symbol id.
 * @return {{ viewBox: string, d: string }} Path and viewBox from the symbol.
 */
function extractSymbol(sprite, id) {
	const block = sprite.match(
		new RegExp(
			`<symbol\\s+id="${id}"\\s+viewBox="([^"]+)"\\s*>\\s*<path\\s+d="([^"]+)"`,
			's'
		)
	);
	if (!block) {
		throw new Error(`Missing <symbol id="${id}"> in custom-icons.svg`);
	}
	return { viewBox: block[1], d: block[2] };
}

/**
 * Fit a source viewBox into 24×24 with 2px optical padding.
 *
 * @param {string} viewBox Source viewBox.
 * @return {{ transform: string }} Translate/scale to the 24 grid.
 */
function fitTransform(viewBox) {
	const parts = viewBox.split(/[\s,]+/).map(Number);
	if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
		throw new Error(`Invalid viewBox "${viewBox}"`);
	}
	const [, , vbW, vbH] = parts;
	const pad = 2;
	const inner = 24 - pad * 2;
	const scale = inner / Math.max(vbW, vbH);
	const tx = (24 - vbW * scale) / 2;
	const ty = (24 - vbH * scale) / 2;
	const round = (n) => Number(n.toFixed(4));
	return {
		transform: `translate(${round(tx)} ${round(ty)}) scale(${round(scale)})`,
	};
}

function shapesForCustom(name, sprite) {
	const { viewBox, d } = extractSymbol(sprite, name);
	const { transform } = fitTransform(viewBox);
	return [{ d, transform }];
}

function buildSvgMap() {
	/** @type {Map<string, string>} */
	const files = new Map();
	let customSprite = '';
	if (fs.existsSync(CUSTOM_SPRITE)) {
		customSprite = fs.readFileSync(CUSTOM_SPRITE, 'utf8');
	}

	for (const name of FIRST_PASS_ICON_NAMES) {
		let shapes;
		if (CUSTOM_ICON_NAMES.includes(name)) {
			if (!customSprite) {
				throw new Error(
					`Need ${CUSTOM_SPRITE} to build ${name}.svg (PRC custom glyph)`
				);
			}
			shapes = shapesForCustom(name, customSprite);
		} else {
			const entry = FILL_ICON_CATALOG[name];
			if (!entry) {
				throw new Error(`Catalog is missing ${name}`);
			}
			shapes = entry.shapes;
		}
		const svg = serializeFillSvg(shapes);
		const errors = collectContractErrors(svg, name);
		if (errors.length > 0) {
			throw new Error(errors.join('\n'));
		}
		files.set(`${name}.svg`, svg);
	}
	return files;
}

function buildBrandSvgMap() {
	/** @type {Map<string, string>} */
	const files = new Map();
	for (const [name, entry] of Object.entries(BRAND_ICON_CATALOG)) {
		const svg = serializeFillSvg(entry.shapes);
		const errors = collectContractErrors(svg, name);
		if (errors.length > 0) {
			throw new Error(errors.join('\n'));
		}
		files.set(`${name}.svg`, svg);
	}
	return files;
}

/**
 * @param {Map<string, string>} files Filename → SVG map.
 * @param {string}              dir   Absolute output directory.
 * @param {string}              rel   Plugin-relative directory for errors.
 * @param {boolean}             check Compare committed files instead of writing.
 * @return {string[]} Check error messages.
 */
function syncSvgDir(files, dir, rel, check) {
	if (check) {
		const missing = [];
		const stale = [];
		for (const [filename, svg] of files) {
			const dest = path.join(dir, filename);
			if (!fs.existsSync(dest)) {
				missing.push(filename);
				continue;
			}
			const current = fs
				.readFileSync(dest, 'utf8')
				.replace(/\r\n/g, '\n');
			if (current !== svg) {
				stale.push(filename);
			}
		}
		const extras = fs.existsSync(dir)
			? fs
					.readdirSync(dir)
					.filter(
						(existing) =>
							existing.endsWith('.svg') && !files.has(existing)
					)
			: [];
		return [
			missing.length ? `Missing ${rel} SVGs: ${missing.join(', ')}` : '',
			stale.length ? `Stale ${rel} SVGs: ${stale.join(', ')}` : '',
			extras.length ? `Unexpected ${rel} SVGs: ${extras.join(', ')}` : '',
		].filter(Boolean);
	}

	fs.mkdirSync(dir, { recursive: true });
	for (const [filename, svg] of files) {
		fs.writeFileSync(path.join(dir, filename), svg);
	}
	if (fs.existsSync(dir)) {
		for (const existing of fs.readdirSync(dir)) {
			if (existing.endsWith('.svg') && !files.has(existing)) {
				fs.unlinkSync(path.join(dir, existing));
			}
		}
	}
	return [];
}

function main(argv = process.argv.slice(2)) {
	const { check } = parseArgs(argv);
	assertFaFreeRegularOutlineCoverage();
	assertFaFreeBrandCoverage();
	const files = buildSvgMap();
	const brandFiles = buildBrandSvgMap();

	if (check) {
		const errors = [
			...syncSvgDir(files, SVG_DIR, SVG_DIR_REL, true),
			...syncSvgDir(brandFiles, BRANDS_SVG_DIR, BRANDS_SVG_DIR_REL, true),
		];
		if (errors.length) {
			throw new Error(
				[
					...errors,
					'Run: npm run build:fill-svgs -w @prc/icon-library',
				].join('\n')
			);
		}
		process.stdout.write(
			`OK ${files.size} fill SVGs and ${brandFiles.size} brand SVGs match the catalog/custom sprite.\n`
		);
		return;
	}

	syncSvgDir(files, SVG_DIR, SVG_DIR_REL, false);
	syncSvgDir(brandFiles, BRANDS_SVG_DIR, BRANDS_SVG_DIR_REL, false);
	process.stdout.write(`Wrote ${files.size} SVGs to ${SVG_DIR_REL}/\n`);
	process.stdout.write(
		`Wrote ${brandFiles.size} SVGs to ${BRANDS_SVG_DIR_REL}/\n`
	);
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
	process.exitCode = 1;
}
