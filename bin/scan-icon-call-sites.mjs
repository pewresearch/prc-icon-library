#!/usr/bin/env node
/* eslint-disable max-lines -- parse, classify, apply, and report stay in one inventory CLI */
/**
 * Inventory first-party JS/PHP icon rendering call sites.
 *
 * Classifies each hit as curated-prc | approved-brand | keep-sprite | core |
 * unregistered | dynamic. `--check` fails when a non-excepted call still
 * passes a Font Awesome Pro library (solid/regular/light/…) or a remapped
 * source name (globe-pointer, chart-bar, …). Font Awesome Pro sprites are
 * not shipped.
 *
 * Usage:
 *   node bin/scan-icon-call-sites.mjs
 *   node bin/scan-icon-call-sites.mjs --write
 *   node bin/scan-icon-call-sites.mjs --check
 *   node bin/scan-icon-call-sites.mjs --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import curatedPrcIcons from '../../prc-scripts/includes/scripts/src/@prc/icons/src/curated-prc-icons.json' with { type: 'json' };
import {
	PRC_LIBRARY,
	BRANDS_LIBRARY,
	resolveIconName,
} from '../../prc-scripts/includes/scripts/src/@prc/icons/src/resolve-icon-source.js';
import remapDoc from '../src/icons/call-site-remap.json' with { type: 'json' };
import exceptionsDoc from '../src/icons/call-site-exceptions.json' with { type: 'json' };

const PLUGIN_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const REPO_ROOT = path.resolve(PLUGIN_ROOT, '../..');
const REPORT_REL = 'docs/plugins/prc-icon-library/audit/call-sites.json';
const CSV_REL = 'docs/plugins/prc-icon-library/audit/call-sites.csv';
const MD_REL = 'docs/plugins/prc-icon-library/audit/call-sites.md';

const SKIP_DIR = new Set([
	'node_modules',
	'vendor',
	'dist',
	'build',
	'.git',
	'gutenberg',
	'wpo365-integrate',
	'wpo365-login',
	'wpo365-mail',
	'legacy-content',
	'prc-legacy-content',
	'assets',
]);

const SKIP_FILES = new Set([
	'plugins/prc-scripts/includes/scripts/src/@prc/icons/src/icon.js',
	'plugins/prc-scripts/includes/scripts/src/@prc/icons/src/resolve-icon-source.js',
	'plugins/prc-scripts/includes/scripts/src/@prc/icons/src/icon-library-index.json',
	'plugins/prc-icon-library/bin/scan-icon-call-sites.mjs',
	'plugins/prc-icon-library/bin/scan-repo-icon-refs.mjs',
	'plugins/prc-icon-library/bin/map-chrome-icons.mjs',
	'plugins/prc-icon-library/bin/check-fa-pro-gone.mjs',
]);

const FA_PRO_LIBRARIES = [
	'solid',
	'regular',
	'light',
	'thin',
	'duotone',
	'sharp',
	'sharp-solid',
	'sharp-regular',
	'sharp-light',
	'sharp-thin',
	'sharp-duotone-solid',
	'custom-icons',
	'classic',
];
const FA_PRO = new Set(FA_PRO_LIBRARIES);
const CURATED = new Set(curatedPrcIcons.prc);
const BRANDS = new Set(curatedPrcIcons.brands);
const KEEP_SPRITE = new Set(exceptionsDoc.keepSprite);
const REMAPS = remapDoc.remaps;
const WP_CHROME = remapDoc.wordpressChrome;
const WP_RUNTIME = remapDoc.wordpressRuntime;

const PHP_CALL_RE =
	/(?:\\PRC\\Platform\\Icons\\|Icons\\)(render|Render|get_icon_as_svg|get_icon_as_url|get_icon_as_data_uri)\s*\(/g;

function parseArgs(argv) {
	return {
		check: argv.includes('--check'),
		write: argv.includes('--write'),
		apply: argv.includes('--apply'),
	};
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
		if (/\.(php|js|jsx|ts|tsx)$/.test(entry.name)) {
			files.push(full);
		}
	}
	return files;
}

function collectRoots() {
	const pluginRoot = path.join(REPO_ROOT, 'plugins');
	const themeRoot = path.join(REPO_ROOT, 'themes');
	const plugins = fs
		.readdirSync(pluginRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith('prc-'))
		.map((entry) => path.join(pluginRoot, entry.name));
	const themes = fs.existsSync(themeRoot)
		? fs
				.readdirSync(themeRoot, { withFileTypes: true })
				.filter(
					(entry) =>
						entry.isDirectory() && entry.name.startsWith('prc-')
				)
				.map((entry) => path.join(themeRoot, entry.name))
		: [];
	return [...plugins, ...themes];
}

function isSkippedRel(rel) {
	if (SKIP_FILES.has(rel)) {
		return true;
	}
	if (rel.startsWith('tests/')) {
		return true;
	}
	if (rel.includes('/bin/')) {
		return true;
	}
	return false;
}

function readStringLiteral(text, start) {
	const quote = text[start];
	if (quote !== "'" && quote !== '"' && quote !== '`') {
		return null;
	}
	let i = start + 1;
	let value = '';
	while (i < text.length) {
		const ch = text[i];
		if (ch === '\\') {
			value += text[i + 1] ?? '';
			i += 2;
			continue;
		}
		if (ch === quote) {
			return { value, end: i + 1 };
		}
		value += ch;
		i += 1;
	}
	return null;
}

function skipWs(text, i) {
	while (i < text.length && /\s/.test(text[i])) {
		i += 1;
	}
	return i;
}

function parsePhpCallArgs(text, openParen) {
	let i = openParen + 1;
	const args = [];
	let depth = 1;
	let current = '';
	while (i < text.length && depth > 0) {
		const ch = text[i];
		if (ch === "'" || ch === '"' || ch === '`') {
			const lit = readStringLiteral(text, i);
			if (!lit) {
				break;
			}
			current += text.slice(i, lit.end);
			i = lit.end;
			continue;
		}
		if (ch === '(' || ch === '[' || ch === '{') {
			depth += 1;
			current += ch;
			i += 1;
			continue;
		}
		if (ch === ')' || ch === ']' || ch === '}') {
			depth -= 1;
			if (depth === 0) {
				args.push(current.trim());
				return { args, end: i + 1 };
			}
			current += ch;
			i += 1;
			continue;
		}
		if (ch === ',' && depth === 1) {
			args.push(current.trim());
			current = '';
			i += 1;
			continue;
		}
		current += ch;
		i += 1;
	}
	return { args, end: i };
}

function classifyPhpArg(raw) {
	if (!raw) {
		return { dynamic: true, value: '' };
	}
	const trimmed = raw.trim();
	const lit = readStringLiteral(trimmed, 0);
	if (lit && skipWs(trimmed, lit.end) === trimmed.length) {
		return { dynamic: false, value: lit.value };
	}
	return { dynamic: true, value: trimmed };
}

function parseJsxTag(text, start) {
	let i = start;
	let depth = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === '{') {
			depth += 1;
			i += 1;
			continue;
		}
		if (ch === '}' && depth > 0) {
			depth -= 1;
			i += 1;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === '`') {
			const lit = readStringLiteral(text, i);
			if (!lit) {
				break;
			}
			i = lit.end;
			continue;
		}
		if (depth === 0 && ch === '>') {
			return { attrs: text.slice(start, i), end: i + 1 };
		}
		i += 1;
	}
	return null;
}

function jsxAttr(attrs, name) {
	const re = new RegExp(`\\b${name}\\s*=\\s*`);
	const match = re.exec(attrs);
	if (!match) {
		return { present: false, dynamic: false, value: '' };
	}
	const idx = match.index + match[0].length;
	if (attrs[idx] === '{') {
		let depth = 0;
		let i = idx;
		while (i < attrs.length) {
			if (attrs[i] === '{') {
				depth += 1;
			} else if (attrs[i] === '}') {
				depth -= 1;
				if (depth === 0) {
					const inner = attrs.slice(idx + 1, i).trim();
					const lit = readStringLiteral(inner, 0);
					if (lit && skipWs(inner, lit.end) === inner.length) {
						return {
							present: true,
							dynamic: false,
							value: lit.value,
						};
					}
					return { present: true, dynamic: true, value: inner };
				}
			}
			i += 1;
		}
		return { present: true, dynamic: true, value: attrs.slice(idx) };
	}
	const lit = readStringLiteral(attrs, idx);
	if (lit) {
		return { present: true, dynamic: false, value: lit.value };
	}
	return { present: true, dynamic: true, value: attrs.slice(idx) };
}

function fileImportsPrcIcon(text) {
	return /from\s+['"]@prc\/icons['"]/.test(text);
}

/**
 * Local JSX names bound to `@prc/icons` `Icon` (including `as` aliases).
 *
 * @param {string} text File contents.
 * @return {Set<string>} Tag names to scan.
 */
function parsePrcIconImportNames(text) {
	const names = new Set();
	const importRe = /import\s+([\s\S]*?)\s+from\s+['"]@prc\/icons['"]/g;
	let match = importRe.exec(text);
	while (match) {
		const clause = match[1].trim();
		if (clause.startsWith('{')) {
			const close = clause.lastIndexOf('}');
			const inner =
				close === -1 ? clause.slice(1) : clause.slice(1, close);
			for (const part of inner.split(',')) {
				const token = part.trim();
				if (!token) {
					continue;
				}
				const asAlias = /^Icon\s+as\s+(\w+)$/.exec(token);
				if (asAlias) {
					names.add(asAlias[1]);
					continue;
				}
				if (token === 'Icon') {
					names.add('Icon');
				}
			}
		} else if (!clause.startsWith('*')) {
			const def = /^(\w+)/.exec(clause);
			if (def) {
				names.add(def[1]);
			}
		}
		match = importRe.exec(text);
	}
	return names;
}

function isPhpCommentCall(text, index) {
	const lineStart = text.lastIndexOf('\n', index - 1) + 1;
	const prefix = text.slice(lineStart, index);
	return /^\s*(?:\/\/|#|\*|\/\*)/.test(prefix);
}

function remapName(icon) {
	return REMAPS[icon]?.to || resolveIconName(icon);
}

function classify({ library, icon, dynamicLibrary, dynamicIcon }) {
	if (dynamicLibrary) {
		return 'dynamic';
	}
	const lib = (library || PRC_LIBRARY).toLowerCase();
	const rawIcon = icon || '';
	if (lib === BRANDS_LIBRARY) {
		if (dynamicIcon) {
			return 'dynamic';
		}
		return BRANDS.has(rawIcon) ? 'approved-brand' : 'unapproved-brand';
	}
	if (dynamicIcon) {
		return 'dynamic';
	}
	if (KEEP_SPRITE.has(rawIcon)) {
		return 'keep-sprite';
	}
	if (WP_CHROME[rawIcon] || WP_RUNTIME[rawIcon]) {
		return 'core';
	}
	const resolved = remapName(rawIcon);
	if (CURATED.has(resolved) || lib === PRC_LIBRARY) {
		return 'curated-prc';
	}
	return 'unregistered';
}

function scanPhp(text, rel) {
	const rows = [];
	PHP_CALL_RE.lastIndex = 0;
	let match = PHP_CALL_RE.exec(text);
	while (match) {
		const fn = match[1];
		const parsed = parsePhpCallArgs(
			text,
			match.index + match[0].length - 1
		);
		const libArg = classifyPhpArg(parsed.args[0] || '');
		const iconArg = classifyPhpArg(parsed.args[1] || '');
		const emptyCall = parsed.args.every((arg) => arg === '');
		if (isPhpCommentCall(text, match.index) || emptyCall) {
			PHP_CALL_RE.lastIndex = parsed.end;
			match = PHP_CALL_RE.exec(text);
			continue;
		}
		rows.push({
			file: rel,
			source: `php:${fn}`,
			snippet: text.slice(match.index, parsed.end).replace(/\s+/g, ' '),
			library: libArg.dynamic ? '' : libArg.value,
			icon: iconArg.dynamic ? '' : iconArg.value,
			dynamicLibrary: libArg.dynamic,
			dynamicIcon: iconArg.dynamic,
			start: match.index,
			end: parsed.end,
		});
		PHP_CALL_RE.lastIndex = parsed.end;
		match = PHP_CALL_RE.exec(text);
	}
	return rows;
}

function scanJsx(text, rel) {
	const aliases = parsePrcIconImportNames(text);
	if (aliases.size === 0 && !fileImportsPrcIcon(text)) {
		return [];
	}
	const tagNames = aliases.size > 0 ? [...aliases] : ['Icon'];
	const re = new RegExp(`<(?:${tagNames.join('|')})\\b`, 'g');
	const rows = [];
	let match = re.exec(text);
	while (match) {
		const tagName = match[0].slice(1);
		const tag = parseJsxTag(text, match.index + match[0].length);
		if (!tag) {
			break;
		}
		const iconAttr = jsxAttr(tag.attrs, 'icon');
		const libraryAttr = jsxAttr(tag.attrs, 'library');
		rows.push({
			file: rel,
			source: `js:${tagName}`,
			snippet: text.slice(match.index, tag.end).replace(/\s+/g, ' '),
			library:
				libraryAttr.present && !libraryAttr.dynamic
					? libraryAttr.value
					: '',
			icon: iconAttr.present && !iconAttr.dynamic ? iconAttr.value : '',
			dynamicLibrary: libraryAttr.present && libraryAttr.dynamic,
			dynamicIcon: !iconAttr.present || iconAttr.dynamic,
			libraryPresent: libraryAttr.present,
			start: match.index,
			end: tag.end,
		});
		re.lastIndex = tag.end;
		match = re.exec(text);
	}
	return rows;
}

function resolvedLibraryFor(status, row) {
	if (status === 'approved-brand' || status === 'unapproved-brand') {
		return BRANDS_LIBRARY;
	}
	if (status === 'keep-sprite') {
		return row.library || 'solid';
	}
	if (status === 'core') {
		return 'core';
	}
	if (status === 'curated-prc') {
		return PRC_LIBRARY;
	}
	return row.library || '';
}

function scanFile(filePath) {
	const rel = path.relative(REPO_ROOT, filePath);
	if (isSkippedRel(rel)) {
		return [];
	}
	const text = fs.readFileSync(filePath, 'utf8');
	const ext = path.extname(filePath);
	/** @type {object[]} */
	let rows = [];
	if (ext === '.php') {
		rows = scanPhp(text, rel);
	} else {
		rows = scanJsx(text, rel);
	}
	return rows.map((row) => {
		const status = classify(row);
		const resolvedIcon = row.icon ? remapName(row.icon) : row.icon;
		return {
			...row,
			status,
			resolvedIcon,
			resolvedLibrary: resolvedLibraryFor(status, row),
		};
	});
}

function isFaProLibrary(library) {
	return FA_PRO.has((library || '').toLowerCase());
}

function violationFor(row) {
	if (row.status === 'dynamic' || row.status === 'keep-sprite') {
		return null;
	}
	if (row.status === 'approved-brand') {
		return null;
	}
	if (REMAPS[row.icon]) {
		return `remap ${row.icon} → ${REMAPS[row.icon].to}`;
	}
	if (row.status === 'core') {
		const spec = WP_CHROME[row.icon] || WP_RUNTIME[row.icon];
		return spec
			? `use @wordpress/icons ${spec.wpExport}`
			: 'use @wordpress/icons';
	}
	if (row.status === 'curated-prc' && isFaProLibrary(row.library)) {
		return `library ${row.library} → prc`;
	}
	if (row.status === 'unregistered' && isFaProLibrary(row.library)) {
		return `unregistered ${row.library}/${row.icon}`;
	}
	if (row.status === 'unapproved-brand') {
		return `unapproved brand ${row.icon}`;
	}
	return null;
}

function collectRows() {
	const files = collectRoots().flatMap((root) => walk(root));
	return files.flatMap((file) => scanFile(file));
}

function summarize(rows) {
	const byStatus = {};
	const byIcon = new Map();
	for (const row of rows) {
		byStatus[row.status] = (byStatus[row.status] || 0) + 1;
		const key = `${row.library || '(default)'}/${row.icon || '(dynamic)'}/${row.status}`;
		if (!byIcon.has(key)) {
			byIcon.set(key, {
				library: row.library || '(default)',
				icon: row.icon || '(dynamic)',
				status: row.status,
				resolvedIcon: row.resolvedIcon || '',
				count: 0,
				files: new Set(),
			});
		}
		const entry = byIcon.get(key);
		entry.count += 1;
		entry.files.add(row.file);
	}
	return {
		total: rows.length,
		byStatus,
		byIcon: [...byIcon.values()]
			.map((entry) => ({
				...entry,
				files: [...entry.files].sort(),
			}))
			.sort((a, b) => b.count - a.count || a.icon.localeCompare(b.icon)),
	};
}

function csvEscape(value) {
	const text = String(value ?? '');
	if (/[",\n]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

function buildCsv(rows) {
	const header = [
		'file',
		'source',
		'library',
		'icon',
		'status',
		'resolvedIcon',
		'resolvedLibrary',
		'snippet',
	];
	const lines = [header.join(',')];
	for (const row of rows) {
		lines.push(
			[
				row.file,
				row.source,
				row.library,
				row.icon,
				row.status,
				row.resolvedIcon,
				row.resolvedLibrary,
				row.snippet,
			]
				.map(csvEscape)
				.join(',')
		);
	}
	return `${lines.join('\n')}\n`;
}

function buildMarkdown(report) {
	const { summary, violations, exceptions } = report;
	const lines = [
		'---',
		"title: 'Icon call-site inventory'",
		'---',
		'',
		'First-party JS/PHP icon rendering call sites. Curated names must use `prc` (or omit library). Brands stay on the brands sprite.',
		'',
		`Generated: \`${report.generatedAt}\`.`,
		'',
		'## Counts',
		'',
		'| Status | Count |',
		'| --- | ---: |',
		`| Total | ${summary.total} |`,
	];
	for (const status of [
		'curated-prc',
		'approved-brand',
		'keep-sprite',
		'core',
		'dynamic',
		'unregistered',
		'unapproved-brand',
	]) {
		lines.push(`| ${status} | ${summary.byStatus[status] || 0} |`);
	}
	lines.push(
		'',
		'## How to run',
		'',
		'```bash',
		'npm run icons:scan-call-sites -w @prc/icon-library -- --write',
		'npm run icons:scan-call-sites -w @prc/icon-library -- --check',
		'```',
		'',
		'## Remaining exceptions',
		''
	);
	if (exceptions.length === 0) {
		lines.push('None.');
	} else {
		lines.push(
			'| File | Icon | Status | Reason |',
			'| --- | --- | --- | --- |'
		);
		for (const item of exceptions) {
			lines.push(
				`| \`${item.file}\` | \`${item.icon}\` | ${item.status} | ${item.reason} |`
			);
		}
	}
	lines.push('', '## Check', '');
	if (violations.length === 0) {
		lines.push('`--check` is clean.');
	} else {
		lines.push(`${violations.length} violation(s):`);
		for (const item of violations.slice(0, 40)) {
			lines.push(
				`- \`${item.file}\`: ${item.reason} (\`${item.snippet}\`)`
			);
		}
	}
	lines.push('');
	return `${lines.join('\n')}\n`;
}

function exceptionReason(row) {
	if (row.status === 'keep-sprite') {
		return 'FA Pro glyph; no FA Free / @wordpress/icons bake (do not invent remaps)';
	}
	if (row.status === 'dynamic') {
		return 'Library or icon name comes from saved attributes / runtime props';
	}
	if (row.status === 'approved-brand') {
		return 'Approved brand sprite';
	}
	return row.status;
}

function buildReport(rows) {
	const violations = [];
	const exceptions = [];
	for (const row of rows) {
		const reason = violationFor(row);
		if (reason) {
			violations.push({
				file: row.file,
				icon: row.icon,
				library: row.library,
				reason,
				snippet: row.snippet,
			});
			continue;
		}
		if (
			row.status === 'keep-sprite' ||
			row.status === 'dynamic' ||
			row.status === 'unregistered' ||
			row.status === 'unapproved-brand'
		) {
			exceptions.push({
				file: row.file,
				icon: row.icon || '(dynamic)',
				library: row.library || '(default)',
				status: row.status,
				reason: exceptionReason(row),
				snippet: row.snippet,
			});
		}
	}
	return {
		generatedAt: new Date().toISOString(),
		source: 'call-site-scan',
		summary: summarize(rows),
		violations,
		exceptions,
		notes: exceptionsDoc.notes,
	};
}

function applyPhpRow(text, row) {
	if (row.status !== 'curated-prc' && !REMAPS[row.icon]) {
		return text;
	}
	if (row.dynamicLibrary) {
		return text;
	}
	let slice = text.slice(row.start, row.end);
	if (REMAPS[row.icon] && !row.dynamicIcon) {
		slice = slice.replace(
			new RegExp(`(['"])${row.icon}\\1`),
			`$1${REMAPS[row.icon].to}$1`
		);
	}
	if (isFaProLibrary(row.library)) {
		slice = slice.replace(
			new RegExp(`(['"])${row.library}\\1`),
			`$1${PRC_LIBRARY}$1`
		);
	}
	return text.slice(0, row.start) + slice + text.slice(row.end);
}

function applyJsxRow(text, row) {
	if (WP_CHROME[row.icon] || WP_RUNTIME[row.icon]) {
		return text;
	}
	if (row.status === 'keep-sprite' || row.status === 'approved-brand') {
		return text;
	}
	if (row.status !== 'curated-prc' && !REMAPS[row.icon]) {
		return text;
	}
	let slice = text.slice(row.start, row.end);
	if (REMAPS[row.icon] && !row.dynamicIcon) {
		slice = slice.replace(
			new RegExp(`(icon\\s*=\\s*(?:\\{\\s*)?)(['"])${row.icon}\\2`),
			`$1$2${REMAPS[row.icon].to}$2`
		);
	}
	if (isFaProLibrary(row.library)) {
		slice = slice.replace(
			new RegExp(`(library\\s*=\\s*(?:\\{\\s*)?)(['"])${row.library}\\2`),
			`$1$2${PRC_LIBRARY}$2`
		);
	}
	return text.slice(0, row.start) + slice + text.slice(row.end);
}

function applyMigrations(rows) {
	const byFile = new Map();
	for (const row of rows) {
		if (!byFile.has(row.file)) {
			byFile.set(row.file, []);
		}
		byFile.get(row.file).push(row);
	}
	let changed = 0;
	for (const [rel, fileRows] of byFile) {
		const abs = path.join(REPO_ROOT, rel);
		let text = fs.readFileSync(abs, 'utf8');
		const original = text;
		const ordered = [...fileRows].sort((a, b) => b.start - a.start);
		for (const row of ordered) {
			text = rel.endsWith('.php')
				? applyPhpRow(text, row)
				: applyJsxRow(text, row);
		}
		if (text !== original) {
			fs.writeFileSync(abs, text);
			changed += 1;
		}
	}
	return changed;
}

function writeReport(report, rows) {
	const jsonPath = path.join(REPO_ROOT, REPORT_REL);
	const csvPath = path.join(REPO_ROOT, CSV_REL);
	const mdPath = path.join(REPO_ROOT, MD_REL);
	fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
	fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, '\t')}\n`);
	fs.writeFileSync(csvPath, buildCsv(rows));
	fs.writeFileSync(mdPath, buildMarkdown(report));
	process.stdout.write(`Wrote ${REPORT_REL}\n`);
	process.stdout.write(`Wrote ${CSV_REL}\n`);
	process.stdout.write(`Wrote ${MD_REL}\n`);
}

function main(argv = process.argv.slice(2)) {
	const { check, write, apply } = parseArgs(argv);
	let rows = collectRows();
	if (apply) {
		const files = applyMigrations(rows);
		process.stdout.write(
			`Applied library/name rewrites in ${files} file(s)\n`
		);
		rows = collectRows();
	}
	const report = buildReport(rows);
	if (write || apply) {
		writeReport(report, rows);
	}
	process.stdout.write(
		`Call sites: ${report.summary.total} curated=${report.summary.byStatus['curated-prc'] || 0} brands=${report.summary.byStatus['approved-brand'] || 0} keep-sprite=${report.summary.byStatus['keep-sprite'] || 0} core=${report.summary.byStatus.core || 0} dynamic=${report.summary.byStatus.dynamic || 0} unregistered=${report.summary.byStatus.unregistered || 0} unapproved-brand=${report.summary.byStatus['unapproved-brand'] || 0} violations=${report.violations.length}\n`
	);
	if (check) {
		if (report.violations.length > 0) {
			for (const item of report.violations) {
				process.stderr.write(
					`${item.file}: ${item.reason} — ${item.snippet}\n`
				);
			}
			throw new Error(
				`${report.violations.length} icon call site(s) still use FA Pro libraries or remapped source names. Run icons:scan-call-sites --apply or fix by hand.`
			);
		}
		process.stdout.write('OK icon call-site inventory --check\n');
	} else if (!write && !apply) {
		process.stdout.write(`${JSON.stringify(report, null, '\t')}\n`);
	}
}

const invokedDirectly =
	Boolean(process.argv[1]) &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
	try {
		main();
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : error}\n`
		);
		process.exitCode = 1;
	}
}

export { main, collectRows, buildReport, violationFor };
