#!/usr/bin/env node
/**
 * Scan first-party PHP/JS/patterns for saved icon refs (no WP-CLI).
 *
 * Usage:
 *   node plugins/prc-icon-library/bin/scan-repo-icon-refs.mjs
 *   node plugins/prc-icon-library/bin/scan-repo-icon-refs.mjs --output docs/plugins/prc-icon-library/audit/prc-725-used-glyphs.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIRST_PASS_ICON_NAMES } from './svg-contract.mjs';

const PLUGIN_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const REPO_ROOT = path.resolve(PLUGIN_ROOT, '../..');
const BRANDS_PATH = path.join(PLUGIN_ROOT, 'includes/approved-brands.json');

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
]);

function parseArgs(argv) {
	const outputIndex = argv.indexOf('--output');
	return {
		output:
			outputIndex >= 0 && argv[outputIndex + 1]
				? argv[outputIndex + 1]
				: '',
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
		if (entry.isDirectory()) {
			if (SKIP_DIR.has(entry.name)) {
				continue;
			}
			walk(path.join(dir, entry.name), files);
			continue;
		}
		if (/\.(php|js|jsx|ts|tsx|html|md)$/.test(entry.name)) {
			files.push(path.join(dir, entry.name));
		}
	}
	return files;
}

function splitNamespaced(icon) {
	if (!icon.includes('/')) {
		return null;
	}
	const [collection, name] = icon.split('/', 2);
	if (!collection || !name) {
		return null;
	}
	return { collection, name };
}

function classify(library, icon, curated, brands) {
	const trimmed = icon.trim();
	if (!trimmed) {
		return 'unregistered';
	}
	let lib = (library || 'solid').toLowerCase();
	let name = trimmed;
	const namespaced = splitNamespaced(name);
	if (namespaced) {
		lib = namespaced.collection;
		name = namespaced.name;
	}
	if (lib === 'core') {
		return 'core-registry';
	}
	if (lib === 'brands') {
		return brands.includes(name) ? 'approved-brand' : 'unregistered';
	}
	return curated.includes(name) ? 'curated' : 'unregistered';
}

function htmlAttr(markup, attr, fallback) {
	const match = markup.match(new RegExp(`${attr}=["']([^"']*)["']`, 'i'));
	return match ? match[1] : fallback;
}

function extractBalancedJson(text, start) {
	if (text[start] !== '{') {
		return null;
	}
	let depth = 0;
	let inString = false;
	let escape = false;
	for (let i = start; i < text.length; i++) {
		const ch = text[i];
		if (inString) {
			if (escape) {
				escape = false;
				continue;
			}
			if (ch === '\\') {
				escape = true;
				continue;
			}
			if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{') {
			depth += 1;
		} else if (ch === '}') {
			depth -= 1;
			if (depth === 0) {
				return text.slice(start, i + 1);
			}
		}
	}
	return null;
}

function scanText(text) {
	const rows = [];
	const startRe = /<!--\s+wp:([a-z0-9\-\/]+)/g;
	let match;
	while ((match = startRe.exec(text))) {
		const rawName = match[1];
		const blockName =
			rawName === 'icon' || rawName === 'button'
				? `core/${rawName}`
				: rawName;
		let cursor = match.index + match[0].length;
		while (cursor < text.length && /\s/.test(text[cursor])) {
			cursor += 1;
		}
		let attrs = {};
		if (text[cursor] === '{') {
			const json = extractBalancedJson(text, cursor);
			if (json) {
				try {
					attrs = JSON.parse(json);
				} catch {
					attrs = {};
				}
				cursor += json.length;
			}
		}
		startRe.lastIndex = cursor;
		if (blockName === 'core/icon') {
			const icon = typeof attrs.icon === 'string' ? attrs.icon : '';
			if (icon) {
				const parts = splitNamespaced(icon);
				rows.push({
					source: 'core/icon',
					library: parts?.collection ?? 'prc',
					icon: parts?.name ?? icon,
				});
			}
		} else if (blockName === 'prc-block/icon') {
			rows.push({
				source: 'prc-block/icon',
				library:
					typeof attrs.library === 'string' ? attrs.library : 'solid',
				icon: typeof attrs.icon === 'string' ? attrs.icon : '',
			});
		} else if (blockName === 'prc-block/social-share-sheet') {
			rows.push({
				source: 'social-share-sheet',
				library:
					typeof attrs.iconLibrary === 'string'
						? attrs.iconLibrary
						: 'solid',
				icon:
					typeof attrs.iconName === 'string'
						? attrs.iconName
						: 'share',
			});
		} else if (blockName === 'core/button' && attrs.iconName) {
			rows.push({
				source: 'core/button',
				library:
					typeof attrs.iconLibrary === 'string'
						? attrs.iconLibrary
						: 'solid',
				icon: attrs.iconName,
			});
		}
	}

	const spanRe =
		/<span\b[^>]*data-prc-block-bit=["']prc-block-bits\/icon-span["'][^>]*>/gi;
	for (const span of text.matchAll(spanRe)) {
		rows.push({
			source: 'prc-block-bits/icon-span',
			library: htmlAttr(span[0], 'data-icon-library', 'solid'),
			icon: htmlAttr(span[0], 'data-icon-name', ''),
		});
	}

	return rows.filter((row) => row.icon);
}

function summarize(rows) {
	const byStatus = {
		curated: 0,
		'approved-brand': 0,
		'core-registry': 0,
		unregistered: 0,
	};
	const grouped = new Map();
	for (const row of rows) {
		byStatus[row.status] = (byStatus[row.status] || 0) + 1;
		const key = `${row.library}\0${row.icon}\0${row.status}`;
		if (!grouped.has(key)) {
			grouped.set(key, {
				library: row.library,
				icon: row.icon,
				status: row.status,
				count: 0,
				sources: new Set(),
				files: new Set(),
			});
		}
		const entry = grouped.get(key);
		entry.count += 1;
		entry.sources.add(row.source);
		if (row.file) {
			entry.files.add(row.file);
		}
	}
	const byIcon = [...grouped.values()]
		.map((entry) => ({
			library: entry.library,
			icon: entry.icon,
			status: entry.status,
			count: entry.count,
			sources: [...entry.sources].sort(),
			files: [...entry.files].sort(),
		}))
		.sort((a, b) => b.count - a.count || a.icon.localeCompare(b.icon));
	return { total: rows.length, byStatus, byIcon };
}

function markdownFromReport(report) {
	const { summary, generatedAt, source, notes } = report;
	const lines = [
		'---',
		"title: 'PRC-725 used-glyph report'",
		'---',
		'',
		'Repo scan of first-party serialized icon refs.',
		'',
		`Generated: \`${generatedAt}\` (${source}).`,
		'',
		'## Counts',
		'',
		`| Status | Count |`,
		`| --- | ---: |`,
		`| Total refs | ${summary.total} |`,
		`| curated | ${summary.byStatus.curated} |`,
		`| approved-brand | ${summary.byStatus['approved-brand']} |`,
		`| core-registry | ${summary.byStatus['core-registry']} |`,
		`| unregistered | ${summary.byStatus.unregistered} |`,
		'',
		'## Fill extras added this slice',
		'',
		'From the closed #3832 extras list, the fill-set expansion, and report-materials icons, these names join the curated fill set so constrained pickers can still select glyphs used in first-party patterns:',
		'',
		'| Name | Why |',
		'| --- | --- |',
		'| `share-nodes` | Quiz share buttons |',
		'| `arrow-right-long` | RLS editor + legacy `core/button` icon style |',
		'| `circle-check` | Quiz answers + bits e2e |',
		'| `circle-x` | Roper question-search (`light/circle-x`) |',
		'| `graduation-cap` | Button patterns |',
		'| `arrows-rotate` | Design pass for the #3832 extras list |',
		'| `up-right-and-down-left-from-center` | Design pass for the #3832 extras list |',
		'| `search` | FA alias of magnifying-glass; saved `light/search` |',
		'| `star` | Default `prc-block/icon` and leftover `prc/star` |',
		'| `download` | Report materials dataset |',
		'| `file` | Report materials default / press / report |',
		'| `video` | Report materials video |',
		'| `clipboard` | Report materials questionnaire / topline |',
		'| `link` | Report materials link |',
		'| `presentation-screen` | Report materials presentation |',
		'| `pdf` | Picker glyph for authors (report-materials still maps `report` to `file`) |',
		'| `upload` | Picker glyph; pair of `download` |',
		'',
		'## How to run',
		'',
		'```bash',
		'npm run icons:audit-repo -w @prc/icon-library -- --output docs/plugins/prc-icon-library/audit/prc-725-used-glyphs.json',
		'wp prc icon-library audit --sleep=0 --format=summary',
		'```',
		'',
		'## Top glyphs',
		'',
		'| Glyph | Status | Count | Sources |',
		'| --- | --- | ---: | --- |',
	];

	for (const entry of summary.byIcon.slice(0, 40)) {
		lines.push(
			`| \`${entry.library}/${entry.icon}\` | ${entry.status} | ${entry.count} | ${entry.sources.join(', ')} |`
		);
	}

	const unregistered = summary.byIcon.filter(
		(entry) => entry.status === 'unregistered'
	);
	lines.push('', '## Unregistered (picker will not offer these)', '');
	if (unregistered.length === 0) {
		lines.push('None in this repo scan.');
	} else {
		lines.push('| Glyph | Count | Example files |', '| --- | ---: | --- |');
		for (const entry of unregistered.slice(0, 30)) {
			const files = (entry.files || []).slice(0, 3).join(', ');
			lines.push(
				`| \`${entry.library}/${entry.icon}\` | ${entry.count} | ${files} |`
			);
		}
	}

	lines.push('', '## Notes', '');
	for (const note of notes) {
		lines.push(`- ${note}`);
	}
	lines.push('');
	return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
	const { output } = parseArgs(argv);
	const brands = JSON.parse(fs.readFileSync(BRANDS_PATH, 'utf8'));
	const pluginRoot = path.join(REPO_ROOT, 'plugins');
	const themeRoot = path.join(REPO_ROOT, 'themes');
	const roots = [
		...fs
			.readdirSync(pluginRoot, { withFileTypes: true })
			.filter(
				(entry) => entry.isDirectory() && entry.name.startsWith('prc-')
			)
			.map((entry) => path.join(pluginRoot, entry.name)),
		...fs
			.readdirSync(themeRoot, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isDirectory() &&
					(entry.name.startsWith('prc-') ||
						entry.name === 'docspress')
			)
			.map((entry) => path.join(themeRoot, entry.name)),
		path.join(REPO_ROOT, 'tests'),
	];
	const files = roots.flatMap((root) => walk(root));
	const rows = [];
	for (const file of files) {
		if (file.includes(`${path.sep}gutenberg${path.sep}`)) {
			continue;
		}
		if (file.includes(`${path.sep}wpo365-`)) {
			continue;
		}
		const rel = path.relative(REPO_ROOT, file);
		const text = fs.readFileSync(file, 'utf8');
		for (const row of scanText(text)) {
			const namespaced = splitNamespaced(row.icon);
			const library = namespaced?.collection ?? row.library;
			const icon = namespaced?.name ?? row.icon;
			rows.push({
				source: row.source,
				library,
				icon,
				status: classify(library, icon, FIRST_PASS_ICON_NAMES, brands),
				file: rel,
			});
		}
	}

	const summary = summarize(rows);
	const report = {
		generatedAt: new Date().toISOString(),
		source: 'repo-scan',
		summary,
		notes: [
			'Repo scan of first-party patterns, fixtures, and serialized block comments.',
			'Live network content requires: wp prc icon-library audit',
		],
	};

	const json = `${JSON.stringify(report, null, '\t')}\n`;
	if (output) {
		const dest = path.isAbsolute(output)
			? output
			: path.join(REPO_ROOT, output);
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.writeFileSync(dest, json);
		process.stdout.write(`Wrote ${path.relative(REPO_ROOT, dest)}\n`);
		if (dest.endsWith('.json')) {
			const mdDest = dest.replace(/\.json$/, '.md');
			fs.writeFileSync(mdDest, markdownFromReport(report));
			process.stdout.write(`Wrote ${path.relative(REPO_ROOT, mdDest)}\n`);
		}
	} else {
		process.stdout.write(json);
	}
	process.stdout.write(
		`Refs: ${summary.total} curated=${summary.byStatus.curated} brands=${summary.byStatus['approved-brand']} core=${summary.byStatus['core-registry']} unregistered=${summary.byStatus.unregistered}\n`
	);
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
	process.exitCode = 1;
}
