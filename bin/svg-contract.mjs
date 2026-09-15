/**
 * WP 7.1 icon sanitizer contract for PRC fill SVGs.
 *
 * Allowlist matches Gutenberg WP_Icons_Registry::sanitize_icon_content():
 * svg (xmlns, viewBox, width, height, class, aria-hidden, role, focusable),
 * path (fill, fill-rule, d, transform),
 * polygon (fill, fill-rule, points, transform, focusable).
 * Stroke and every other element/attribute are stripped.
 */

import iconSourceMap from '../src/icons/icon-source-map.json' with { type: 'json' };

export const VIEWBOX = '0 0 24 24';
export const FILL = 'currentColor';
export const SVG_DIR_REL = 'src/icons/prc';
export const BRANDS_SVG_DIR_REL = 'src/icons/brands';

/** @type {{ name: string, source: 'fa-free-solid'|'fa-free-regular'|'custom', faName?: string }[]} */
export const ICON_SOURCE_ENTRIES = iconSourceMap.icons;

export const FIRST_PASS_ICON_NAMES = ICON_SOURCE_ENTRIES.map(
	(entry) => entry.name
);

export const FA_FREE_SOLID_NAMES = ICON_SOURCE_ENTRIES.filter(
	(entry) => entry.source === 'fa-free-solid'
).map((entry) => entry.name);

export const FA_FREE_REGULAR_NAMES = ICON_SOURCE_ENTRIES.filter(
	(entry) => entry.source === 'fa-free-regular'
).map((entry) => entry.name);

export const KEEP_CUSTOM_NAMES = ICON_SOURCE_ENTRIES.filter(
	(entry) => entry.source === 'custom'
).map((entry) => entry.name);

/**
 * FortAwesome kebab name for a source-map row.
 *
 * @param {{ name: string, faName?: string }} entry Source-map row.
 * @return {string} FA icon name (no `-outline` suffix).
 */
export function faLookupName(entry) {
	if (entry.faName) {
		return entry.faName;
	}
	if (entry.name.endsWith('-outline')) {
		return entry.name.slice(0, -'-outline'.length);
	}
	return entry.name;
}

export const CUSTOM_ICON_NAMES = [];

export const PROVE_ICON_NAME = 'circle-plus';

const FORBIDDEN_TAG =
	/<\/?(defs|g|circle|rect|ellipse|line|polyline|use|clipPath|mask|style|linearGradient|radialGradient|filter|title|desc|symbol|image|text)\b/i;

const FORBIDDEN_ATTR =
	/\s(stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-dasharray|class|id|style|clip-rule|vector-effect)=/i;

const HARDCODED_COLOR =
	/(?:fill|stop-color)\s*=\s*["'](?!currentColor)[^"']+["']|#(?:[0-9a-fA-F]{3,8})\b|\brgba?\(|\bhsla?\(/;

const SVG_OPEN =
	/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24">\n/;

/**
 * @param {string} svg    Markup to check.
 * @param {string} [name] Glyph name for error prefixes.
 * @return {string[]} Contract error messages (empty when valid).
 */
export function collectContractErrors(svg, name = '') {
	const prefix = name ? `${name}: ` : '';
	const errors = [];
	const text = svg.replace(/\r\n/g, '\n');

	if (!SVG_OPEN.test(text)) {
		errors.push(
			`${prefix}root must be xmlns + viewBox="${VIEWBOX}" (no fill/stroke/style on svg)`
		);
	}
	if (!text.trimEnd().endsWith('</svg>')) {
		errors.push(`${prefix}file must end with </svg>`);
	}
	if (FORBIDDEN_TAG.test(text)) {
		errors.push(`${prefix}contains a tag the WP 7.1 sanitizer strips`);
	}
	if (FORBIDDEN_ATTR.test(text)) {
		errors.push(
			`${prefix}contains a forbidden attribute (stroke/class/id/style/clip-rule)`
		);
	}
	if (HARDCODED_COLOR.test(text)) {
		errors.push(
			`${prefix}contains a hardcoded color (use fill="currentColor")`
		);
	}
	if (/stroke/i.test(text)) {
		errors.push(`${prefix}contains stroke (sanitizer strips it)`);
	}

	const shapes = [...text.matchAll(/<(path|polygon)\b([^>]*)\/?>/g)];
	if (shapes.length === 0) {
		errors.push(`${prefix}needs at least one path or polygon`);
	}
	for (const match of shapes) {
		const [, tag, attrs] = match;
		if (!/\bfill="currentColor"/.test(attrs)) {
			errors.push(`${prefix}<${tag}> must set fill="currentColor"`);
		}
		if (tag === 'path' && !/\bd="[^"]+"/.test(attrs)) {
			errors.push(`${prefix}<path> is missing d`);
		}
		if (tag === 'polygon' && !/\bpoints="[^"]+"/.test(attrs)) {
			errors.push(`${prefix}<polygon> is missing points`);
		}
	}

	const inner = text
		.replace(/^<svg[^>]*>\n?/, '')
		.replace(/\n?<\/svg>\s*$/, '');
	const stripped = inner.replace(/<(path|polygon)\b[^>]*\/?>\n?/g, '').trim();
	if (stripped.length > 0) {
		errors.push(`${prefix}contains markup other than path/polygon`);
	}

	return errors;
}

/**
 * @param {Array<{ type?: string, d?: string, points?: string, fillRule?: string, transform?: string }>} shapes Shape list.
 * @return {string} Fill SVG markup that meets the WP 7.1 contract.
 */
export function serializeFillSvg(shapes) {
	const body = shapes
		.map((shape) => {
			const fillRule = shape.fillRule
				? ` fill-rule="${shape.fillRule}"`
				: '';
			const transform = shape.transform
				? ` transform="${shape.transform}"`
				: '';
			if (shape.type === 'polygon') {
				return `\t<polygon fill="${FILL}"${fillRule}${transform} points="${shape.points}" />`;
			}
			return `\t<path fill="${FILL}"${fillRule}${transform} d="${shape.d}" />`;
		})
		.join('\n');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">\n${body}\n</svg>\n`;
}

/**
 * @param {string} kebab Kebab-case icon name.
 * @return {string} Title-case label.
 */
export function labelFromName(kebab) {
	return kebab
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
