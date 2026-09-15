#!/usr/bin/env node
/**
 * Scan plugin icon.js / icon.jsx / icon.tsx files and map each chrome glyph.
 *
 * Preference: @wordpress/icons (clear match) → FA Free solid → keep-sprite.
 * Brands stay on the brands sprite. Inline SVGs stay custom.
 *
 * Usage:
 *   node bin/map-chrome-icons.mjs
 *   node bin/map-chrome-icons.mjs --check
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as freeSolidIcons from '@fortawesome/free-solid-svg-icons';

import { kebabToFaExportName } from './fill-icon-catalog.mjs';
import { FIRST_PASS_ICON_NAMES, KEEP_CUSTOM_NAMES } from './svg-contract.mjs';

const PLUGIN_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const REPO_ROOT = path.resolve(PLUGIN_ROOT, '../..');
const OUT_REL = 'src/icons/chrome-icon-map.json';
const OUT_PATH = path.join(PLUGIN_ROOT, OUT_REL);
const WP_LIBRARY_DIR = path.join(
	REPO_ROOT,
	'node_modules/@wordpress/icons/src/library'
);

const SKIP_DIR = new Set([
	'node_modules',
	'vendor',
	'dist',
	'build',
	'.git',
	'gutenberg',
]);

const SKIP_FILES = new Set([
	'plugins/prc-scripts/includes/scripts/src/@prc/icons/src/icon.js',
]);

/**
 * Chrome names whose Gutenberg match is not the same kebab slug.
 * Only list matches a reviewer can re-run without guessing.
 */
const WP_SEMANTIC = {
	'list-tree': 'listView',
	'rectangle-code': 'code',
	'editor-table': 'table',
};

const ICON_ATTR_RE = /\bicon\s*=\s*(?:\{\s*)?["']([a-z0-9-]+)["'](?:\s*\})?/g;

function parseArgs(argv) {
	return { check: argv.includes('--check') };
}

function walk(dir, files = []) {
	if (!fs.existsSync(dir)) {
		return files;
	}
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith('.')) {
			continue;
		}
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (SKIP_DIR.has(entry.name)) {
				continue;
			}
			walk(full, files);
			continue;
		}
		if (/^icon\.(js|jsx|tsx)$/.test(entry.name)) {
			files.push(full);
		}
	}
	return files;
}

function kebabToCamel(kebab) {
	return kebab.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function loadWordpressExports() {
	/** @type {Set<string>} */
	const files = new Set();
	/** @type {Set<string>} */
	const camels = new Set();
	if (!fs.existsSync(WP_LIBRARY_DIR)) {
		return { files, camels };
	}
	for (const name of fs.readdirSync(WP_LIBRARY_DIR)) {
		if (!name.endsWith('.tsx') && !name.endsWith('.js')) {
			continue;
		}
		const slug = name.replace(/\.(tsx|js)$/, '');
		files.add(slug);
		camels.add(kebabToCamel(slug));
	}
	return { files, camels };
}

function faFreeLookup(name) {
	const def = freeSolidIcons[kebabToFaExportName(name)];
	if (!def || !Array.isArray(def.icon)) {
		return null;
	}
	return def.iconName || name;
}

function classifyGlyph(name, wp) {
	if (KEEP_CUSTOM_NAMES.includes(name)) {
		return {
			source: 'custom',
			reason: 'curated keep-custom master',
		};
	}
	if (WP_SEMANTIC[name]) {
		return {
			source: 'wordpress-icons',
			wpExport: WP_SEMANTIC[name],
			reason: 'semantic Gutenberg match',
		};
	}
	const camel = kebabToCamel(name);
	if (wp.files.has(name) || wp.camels.has(camel)) {
		return {
			source: 'wordpress-icons',
			wpExport: camel,
			reason: 'exact @wordpress/icons export',
		};
	}
	const faName = faFreeLookup(name);
	if (faName) {
		return {
			source: 'fa-free-solid',
			faName,
			reason: FIRST_PASS_ICON_NAMES.includes(name)
				? 'curated FA Free bake'
				: 'baked FA Free solid into prc/',
		};
	}
	return {
		source: 'keep-sprite',
		reason: 'not in FA Free solid or @wordpress/icons',
	};
}

function reasonForEmptyGlyph(source) {
	if (source === 'wordpress-icons') {
		return 'already imports @wordpress/icons';
	}
	if (source === 'inline-svg') {
		return 'inline SVG chrome';
	}
	return 'no icon= attribute';
}

function scanFile(filePath, wp) {
	const rel = path.relative(REPO_ROOT, filePath);
	const text = fs.readFileSync(filePath, 'utf8');

	/** @type {string[]} */
	const names = [];
	ICON_ATTR_RE.lastIndex = 0;
	let match = ICON_ATTR_RE.exec(text);
	while (match) {
		names.push(match[1]);
		match = ICON_ATTR_RE.exec(text);
	}

	if (names.length === 0) {
		const wpImport = /from\s+['"]@wordpress\/icons['"]/.test(text);
		const inlineSvg = /<(?:svg|SVG)\b/.test(text);
		let source = 'other';
		if (wpImport) {
			source = 'wordpress-icons';
		} else if (inlineSvg) {
			source = 'inline-svg';
		}
		return [
			{
				name: null,
				file: rel,
				source,
				reason: reasonForEmptyGlyph(source),
			},
		];
	}

	const brands = /library=["']brands["']/.test(text);
	return names.map((name) => {
		if (brands) {
			return {
				name,
				file: rel,
				source: 'brands-sprite',
				reason: 'approved or vendor brand mark',
			};
		}
		const classified = classifyGlyph(name, wp);
		return { name, file: rel, ...classified };
	});
}

function buildMap() {
	const wp = loadWordpressExports();
	const files = walk(path.join(REPO_ROOT, 'plugins'))
		.map((file) => path.relative(REPO_ROOT, file))
		.filter((rel) => !SKIP_FILES.has(rel))
		.sort();

	/** @type {Record<string, { source: string, wpExport?: string, faName?: string, reason: string, files: string[] }>} */
	const glyphs = {};
	/** @type {object[]} */
	const fileRows = [];

	for (const rel of files) {
		const rows = scanFile(path.join(REPO_ROOT, rel), wp);
		for (const row of rows) {
			fileRows.push(row);
			if (!row.name) {
				continue;
			}
			if (!glyphs[row.name]) {
				glyphs[row.name] = {
					source: row.source,
					reason: row.reason,
					files: [],
				};
				if (row.wpExport) {
					glyphs[row.name].wpExport = row.wpExport;
				}
				if (row.faName) {
					glyphs[row.name].faName = row.faName;
				}
			}
			if (!glyphs[row.name].files.includes(rel)) {
				glyphs[row.name].files.push(rel);
			}
		}
	}

	const summary = {
		files: files.length,
		uniqueGlyphs: Object.keys(glyphs).length,
		bySource: {},
	};
	for (const glyph of Object.values(glyphs)) {
		summary.bySource[glyph.source] =
			(summary.bySource[glyph.source] || 0) + 1;
	}

	return {
		$comment:
			'Block-inserter chrome map. Re-run: npm run icons:map-chrome -w @prc/icon-library',
		summary,
		glyphs: Object.fromEntries(
			Object.keys(glyphs)
				.sort()
				.map((name) => [name, glyphs[name]])
		),
		filesWithoutGlyphAttr: fileRows
			.filter((row) => !row.name)
			.map((row) => ({
				file: row.file,
				source: row.source,
				reason: row.reason,
			})),
	};
}

function serialize(map) {
	const raw = `${JSON.stringify(map, null, '\t')}\n`;
	try {
		return execFileSync('npx', ['prettier', '--stdin-filepath', OUT_REL], {
			input: raw,
			encoding: 'utf8',
			cwd: PLUGIN_ROOT,
		});
	} catch {
		return raw;
	}
}

function main(argv = process.argv.slice(2)) {
	const { check } = parseArgs(argv);
	const json = serialize(buildMap());
	if (check) {
		if (!fs.existsSync(OUT_PATH)) {
			throw new Error(`Missing ${OUT_REL}. Run icons:map-chrome.`);
		}
		const current = fs
			.readFileSync(OUT_PATH, 'utf8')
			.replace(/\r\n/g, '\n');
		if (current !== json) {
			throw new Error(
				`${OUT_REL} is stale. Run: npm run icons:map-chrome -w @prc/icon-library`
			);
		}
		process.stdout.write(`OK ${OUT_REL}\n`);
		return;
	}
	fs.writeFileSync(OUT_PATH, json);
	process.stdout.write(`Wrote ${OUT_REL}\n`);
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
	process.exitCode = 1;
}
