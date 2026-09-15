/**
 * PRC fill glyphs (24×24, path/polygon, fill=currentColor).
 *
 * Font Awesome Free 6 solid, regular, and brands are imported from
 * `@fortawesome/free-solid-svg-icons`, `@fortawesome/free-regular-svg-icons`,
 * and `@fortawesome/free-brands-svg-icons` (icon[0] width, icon[1] height,
 * icon[4] path). Bake uses contain-fit: s = 24 / max(W, H), tx/ty center
 * the glyph. License: CC BY 4.0. Do not copy Font Awesome Pro path data
 * into this set.
 *
 * Naming: `prc/{name}` is Free solid; `prc/{name}-outline` is Free Regular
 * when that Regular glyph exists. Keep-custom replacements stay in
 * KEEP_CUSTOM_CATALOG and do not get outlines. Custom `{name}-outline`
 * companions are allowed when Free Regular lacks the solid. Names come
 * from src/icons/icon-source-map.json.
 */

import * as freeBrandsIcons from '@fortawesome/free-brands-svg-icons';
import * as freeRegularIcons from '@fortawesome/free-regular-svg-icons';
import * as freeSolidIcons from '@fortawesome/free-solid-svg-icons';

import approvedBrandsJson from '../includes/approved-brands.json' with { type: 'json' };

import {
	FA_FREE_REGULAR_NAMES,
	FA_FREE_SOLID_NAMES,
	ICON_SOURCE_ENTRIES,
	KEEP_CUSTOM_NAMES,
	faLookupName,
	labelFromName,
} from './svg-contract.mjs';

/** @typedef {{ type?: 'path'|'polygon', d?: string, points?: string, fillRule?: string, transform?: string }} Shape */
/** @typedef {{ width: number, height: number, d: string|string[], fillRule?: string }} FaFreeSolidSource */

/**
 * Format scale/translate numbers for SVG transform.
 *
 * @param {number} n Number.
 * @return {string} Compact decimal string.
 */
export function formatFaScaleNumber(n) {
	if (Object.is(n, -0) || Math.abs(n) < 1e-12) {
		return '0';
	}
	return String(Number(n.toFixed(7)));
}

/**
 * FortAwesome export name for a kebab-case icon (`arrow-right` → `faArrowRight`).
 *
 * @param {string} kebab Kebab-case name.
 * @return {string} Package export.
 */
export function kebabToFaExportName(kebab) {
	return `fa${kebab
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')}`;
}

/**
 * Look up a Free solid icon definition.
 *
 * @param {string} kebab Kebab-case name or FA alias.
 * @return {Object} FortAwesome icon definition.
 */
export function lookupFaFreeSolidIcon(kebab) {
	const exportName = kebabToFaExportName(kebab);
	const def = freeSolidIcons[exportName];
	if (!def || !Array.isArray(def.icon)) {
		throw new Error(
			`@fortawesome/free-solid-svg-icons has no ${exportName} (${kebab})`
		);
	}
	return def;
}

/**
 * Look up a Free Regular icon definition.
 *
 * @param {string} kebab Kebab-case name or FA alias.
 * @return {Object} FortAwesome icon definition.
 */
export function lookupFaFreeRegularIcon(kebab) {
	const exportName = kebabToFaExportName(kebab);
	const def = freeRegularIcons[exportName];
	if (!def || !Array.isArray(def.icon)) {
		throw new Error(
			`@fortawesome/free-regular-svg-icons has no ${exportName} (${kebab})`
		);
	}
	return def;
}

/**
 * Whether Free Regular includes this FA kebab name.
 *
 * @param {string} kebab Kebab-case FA name (no `-outline` suffix).
 * @return {boolean} True when the public Regular pack has the glyph.
 */
export function hasFaFreeRegularIcon(kebab) {
	const exportName = kebabToFaExportName(kebab);
	const def = freeRegularIcons[exportName];
	return Boolean(def && Array.isArray(def.icon));
}

/**
 * Extract width/height/path from a FortAwesome icon definition.
 *
 * @param {Object} def Icon definition with `.icon`.
 * @return {FaFreeSolidSource} Source for bakeFaFreeSolidShape.
 */
export function faDefinitionToSource(def) {
	const [width, height, , , pathData] = def.icon;
	return {
		width,
		height,
		d: pathData,
	};
}

/**
 * Official FA Free solid source for a curated name (honors faName overrides).
 *
 * @param {string} name Curated kebab-case name.
 * @return {FaFreeSolidSource} Width, height, path data.
 */
export function getFaFreeSolidSource(name) {
	const entry = ICON_SOURCE_ENTRIES.find((item) => item.name === name);
	if (!entry || entry.source !== 'fa-free-solid') {
		throw new Error(`${name} is not a fa-free-solid source-map row`);
	}
	return faDefinitionToSource(lookupFaFreeSolidIcon(faLookupName(entry)));
}

/**
 * Official FA Free Regular source for a curated `{name}-outline` fill.
 *
 * @param {string} name Curated kebab-case name (`bookmark-outline`).
 * @return {FaFreeSolidSource} Width, height, path data.
 */
export function getFaFreeRegularSource(name) {
	const entry = ICON_SOURCE_ENTRIES.find((item) => item.name === name);
	if (!entry || entry.source !== 'fa-free-regular') {
		throw new Error(`${name} is not a fa-free-regular source-map row`);
	}
	return faDefinitionToSource(lookupFaFreeRegularIcon(faLookupName(entry)));
}

/**
 * Bake a Font Awesome Free path (solid or Regular) into the 24×24 fill contract.
 *
 * @param {FaFreeSolidSource} source Original FA viewBox size and path.
 * @return {Shape} Contract shape with translate(tx ty) scale(s).
 */
export function bakeFaFreeSolidShape(source) {
	const d = Array.isArray(source.d) ? source.d[0] : source.d;
	const s = 24 / Math.max(source.width, source.height);
	const tx = (24 - source.width * s) / 2;
	const ty = (24 - source.height * s) / 2;
	/** @type {Shape} */
	const shape = {
		transform: `translate(${formatFaScaleNumber(tx)} ${formatFaScaleNumber(ty)}) scale(${formatFaScaleNumber(s)})`,
		d,
	};
	if (source.fillRule) {
		shape.fillRule = source.fillRule;
	}
	return shape;
}

/**
 * Bake every FA path (icon[4] may be a string or an array of strings).
 *
 * @param {FaFreeSolidSource} source Original FA viewBox size and path(s).
 * @return {Shape[]} Contract shapes.
 */
export function bakeFaFreeSolidShapes(source) {
	const paths = Array.isArray(source.d) ? source.d : [source.d];
	return paths.map((d) => bakeFaFreeSolidShape({ ...source, d }));
}

/**
 * Picker label for a curated fill name.
 *
 * @param {string} name Curated kebab-case name.
 * @return {string} Title-case label.
 */
function labelForCatalogName(name) {
	if (name === 'file-pdf') {
		return 'File PDF';
	}
	if (name === 'file-pdf-outline') {
		return 'File PDF Outline';
	}
	return labelFromName(name);
}

function faFreeCatalog() {
	/** @type {Record<string, { label: string, shapes: Shape[] }>} */
	const catalog = {};
	for (const name of FA_FREE_SOLID_NAMES) {
		catalog[name] = {
			label: labelForCatalogName(name),
			shapes: bakeFaFreeSolidShapes(getFaFreeSolidSource(name)),
		};
	}
	for (const name of FA_FREE_REGULAR_NAMES) {
		catalog[name] = {
			label: labelForCatalogName(name),
			shapes: bakeFaFreeSolidShapes(getFaFreeRegularSource(name)),
		};
	}
	return catalog;
}

/**
 * Every Free solid that has a Free Regular glyph must ship `{name}-outline`.
 * Keep-custom replacements never get outlines. Custom `{name}-outline`
 * companions are allowed only when Free Regular lacks the solid. Regular
 * rows must exist in the public pack.
 */
export function assertFaFreeRegularOutlineCoverage() {
	const errors = [];
	const outlineNames = new Set(FA_FREE_REGULAR_NAMES);
	const allNames = new Set(ICON_SOURCE_ENTRIES.map((item) => item.name));
	for (const entry of ICON_SOURCE_ENTRIES) {
		if (entry.source === 'fa-free-solid') {
			const lookup = faLookupName(entry);
			const outlineName = `${entry.name}-outline`;
			const hasRegular = hasFaFreeRegularIcon(lookup);
			if (hasRegular && !outlineNames.has(outlineName)) {
				errors.push(
					`${entry.name} has Free Regular ${lookup} but no ${outlineName}`
				);
			}
			if (!hasRegular && outlineNames.has(outlineName)) {
				errors.push(
					`${outlineName} exists but Free Regular ${lookup} is missing`
				);
			}
		}
		if (entry.source === 'fa-free-regular') {
			if (!entry.name.endsWith('-outline')) {
				errors.push(
					`${entry.name} is fa-free-regular but is not named *-outline`
				);
			}
			const solidName = entry.name.endsWith('-outline')
				? entry.name.slice(0, -'-outline'.length)
				: entry.name;
			const solid = ICON_SOURCE_ENTRIES.find(
				(item) =>
					item.name === solidName && item.source === 'fa-free-solid'
			);
			if (!solid) {
				errors.push(
					`${entry.name} has no matching fa-free-solid ${solidName}`
				);
			}
			if (!hasFaFreeRegularIcon(faLookupName(entry))) {
				errors.push(
					`${entry.name} lookup ${faLookupName(entry)} is not in free-regular`
				);
			}
		}
		if (entry.source === 'custom') {
			if (entry.name.endsWith('-outline')) {
				const solidName = entry.name.slice(0, -'-outline'.length);
				const solid = ICON_SOURCE_ENTRIES.find(
					(item) =>
						item.name === solidName &&
						item.source === 'fa-free-solid'
				);
				if (!solid) {
					errors.push(
						`${entry.name} has no matching fa-free-solid ${solidName}`
					);
				} else if (hasFaFreeRegularIcon(faLookupName(solid))) {
					errors.push(
						`${entry.name} should be fa-free-regular; Free Regular ${faLookupName(solid)} exists`
					);
				}
			} else if (
				outlineNames.has(`${entry.name}-outline`) ||
				allNames.has(`${entry.name}-outline`)
			) {
				errors.push(`custom ${entry.name} must not have an outline`);
			}
		}
	}
	if (errors.length > 0) {
		throw new Error(errors.join('\n'));
	}
}

/**
 * Approved brand names from includes/approved-brands.json.
 *
 * @type {string[]}
 */
export const APPROVED_BRAND_NAMES = Array.isArray(approvedBrandsJson)
	? approvedBrandsJson.filter((name) => typeof name === 'string')
	: [];

/**
 * Closest Free Brands kebab name when the approved slug is missing.
 * Keys are approved names; values are Free Brands lookups. Empty unless a
 * miss needs a documented alias. Do not point at Font Awesome Pro.
 * Do not alias `twitter` onto `x-twitter` (or the reverse): they are
 * separate Free Brands glyphs.
 *
 * @type {Record<string, string>}
 */
export const BRAND_FA_ALIASES = {};

/**
 * Picker labels that need brand capitalization.
 *
 * @type {Record<string, string>}
 */
const BRAND_LABELS = {
	github: 'GitHub',
	linkedin: 'LinkedIn',
	youtube: 'YouTube',
	whatsapp: 'WhatsApp',
	tiktok: 'TikTok',
	'x-twitter': 'X Twitter',
	'sticker-mule': 'Sticker Mule',
};

/**
 * Look up a Free Brands icon definition, or null when missing.
 *
 * @param {string} kebab Kebab-case name or FA alias.
 * @return {Object|null} FortAwesome icon definition, or null.
 */
export function lookupFaFreeBrandIcon(kebab) {
	const exportName = kebabToFaExportName(kebab);
	const def = freeBrandsIcons[exportName];
	if (!def || !Array.isArray(def.icon)) {
		return null;
	}
	return def;
}

/**
 * Whether Free Brands includes this FA kebab name.
 *
 * @param {string} kebab Kebab-case FA name.
 * @return {boolean} True when the public Brands pack has the glyph.
 */
export function hasFaFreeBrandIcon(kebab) {
	return lookupFaFreeBrandIcon(kebab) !== null;
}

/**
 * FortAwesome kebab name for an approved brand (honors BRAND_FA_ALIASES).
 *
 * @param {string} name Approved brand slug.
 * @return {string} Free Brands lookup name.
 */
export function brandFaLookupName(name) {
	return BRAND_FA_ALIASES[name] || name;
}

/**
 * Official FA Free Brands source for an approved name.
 *
 * @param {string} name Approved kebab-case name.
 * @return {FaFreeSolidSource} Width, height, path data.
 */
export function getFaFreeBrandSource(name) {
	const lookup = brandFaLookupName(name);
	const def = lookupFaFreeBrandIcon(lookup);
	if (!def) {
		throw new Error(
			`@fortawesome/free-brands-svg-icons has no ${kebabToFaExportName(lookup)} (${name})`
		);
	}
	return faDefinitionToSource(def);
}

/**
 * Split approved brands into bakeable names vs documented skips.
 *
 * @return {{ registered: {name: string, faName?: string}[], skipped: {name: string, reason: string}[] }} Bakeable names and documented skips.
 */
export function resolveApprovedBrands() {
	/** @type {{name: string, faName?: string}[]} */
	const registered = [];
	/** @type {{name: string, reason: string}[]} */
	const skipped = [];
	for (const name of APPROVED_BRAND_NAMES) {
		const lookup = brandFaLookupName(name);
		if (!hasFaFreeBrandIcon(lookup)) {
			skipped.push({
				name,
				reason: `@fortawesome/free-brands-svg-icons has no ${kebabToFaExportName(lookup)} (${lookup}). Left off the brands registry; sprite fallback remains. Do not copy Font Awesome Pro path data.`,
			});
			continue;
		}
		/** @type {{name: string, faName?: string}} */
		const entry = { name };
		if (lookup !== name) {
			entry.faName = lookup;
		}
		registered.push(entry);
	}
	return { registered, skipped };
}

/**
 * Approved brand names that exist in Free Brands and should bake.
 *
 * @type {string[]}
 */
export const BRAND_ICON_NAMES = resolveApprovedBrands().registered.map(
	(entry) => entry.name
);

/**
 * Picker label for an approved brand name.
 *
 * @param {string} name Approved kebab-case name.
 * @return {string} Display label.
 */
function labelForBrandName(name) {
	return BRAND_LABELS[name] || labelFromName(name);
}

function brandsCatalog() {
	/** @type {Record<string, { label: string, shapes: Shape[] }>} */
	const catalog = {};
	for (const { name } of resolveApprovedBrands().registered) {
		catalog[name] = {
			label: labelForBrandName(name),
			shapes: bakeFaFreeSolidShapes(getFaFreeBrandSource(name)),
		};
	}
	return catalog;
}

/**
 * Every approved brand must either bake from Free Brands or appear in
 * the skipped list with a reason. Aliases must exist in Free Brands.
 */
export function assertFaFreeBrandCoverage() {
	const { registered, skipped } = resolveApprovedBrands();
	const errors = [];
	const seen = new Set([
		...registered.map((entry) => entry.name),
		...skipped.map((entry) => entry.name),
	]);
	for (const name of APPROVED_BRAND_NAMES) {
		if (!seen.has(name)) {
			errors.push(`${name} is approved but neither baked nor skipped`);
		}
	}
	for (const [from, to] of Object.entries(BRAND_FA_ALIASES)) {
		if (!hasFaFreeBrandIcon(to)) {
			errors.push(
				`BRAND_FA_ALIASES ${from} → ${to} is not in free-brands`
			);
		}
	}
	if (errors.length > 0) {
		throw new Error(errors.join('\n'));
	}
}

/** @type {Record<string, { label: string, shapes: Shape[] }>} */
export const BRAND_ICON_CATALOG = brandsCatalog();

/** @type {Record<string, { label: string, shapes: Shape[] }>} */
const KEEP_CUSTOM_CATALOG = {
	compare: {
		label: 'Compare',
		shapes: [
			{
				transform: 'translate(2 5.342) scale(0.026)',
				d: 'M275.2 329.1H18.8v73.1H275.2V512L421.1 365.7 275.2 219.4V329.1zm218.7-36.6V182.9H750.2V109.7H493.8V0L347.9 146.3 493.8 292.6z',
			},
		],
	},
	'presentation-screen': {
		label: 'Presentation Screen',
		shapes: [
			{
				d: 'M2.4 3.2h19.2v12H13.1v2.6h4.1v2.4H6.8v-2.4h4.1V15.2H2.4z',
			},
		],
	},
	card: {
		label: 'Card',
		shapes: [
			{
				fillRule: 'evenodd',
				d: 'M6.6 2h10.8a1.6 1.6 0 0 1 1.6 1.6v16.8a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 20.4V3.6A1.6 1.6 0 0 1 6.6 2zM12 6.4C15.6 10 16.5 11.8 16.5 13.2C16.5 14.7 15.2 15.9 13.6 15.9C13.15 15.9 12.75 15.76 12.5 15.52L14.9 18.6H9.1L11.5 15.52C11.25 15.76 10.85 15.9 10.4 15.9C8.8 15.9 7.5 14.7 7.5 13.2C7.5 11.8 8.4 10 12 6.4z',
			},
		],
	},
	'circle-plus-outline': {
		label: 'Circle Plus Outline',
		shapes: [
			{
				transform: 'translate(0 0) scale(0.046875)',
				d: 'M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM232 344l0-64-64 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l64 0 0-64c0-13.3 10.7-24 24-24s24 10.7 24 24l0 64 64 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0 0 64c0 13.3-10.7 24-24 24s-24-10.7-24-24z',
			},
		],
	},
	'circle-minus-outline': {
		label: 'Circle Minus Outline',
		shapes: [
			{
				transform: 'translate(0 0) scale(0.046875)',
				d: 'M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM184 232l144 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-144 0c-13.3 0-24-10.7-24-24s10.7-24 24-24z',
			},
		],
	},
};

function customCatalog() {
	/** @type {Record<string, { label: string, shapes: Shape[] }>} */
	const catalog = {};
	for (const name of KEEP_CUSTOM_NAMES) {
		const entry = KEEP_CUSTOM_CATALOG[name];
		if (!entry) {
			throw new Error(`KEEP_CUSTOM_CATALOG is missing ${name}`);
		}
		catalog[name] = entry;
	}
	return catalog;
}

/** @type {Record<string, { label: string, shapes: Shape[] }>} */
export const FILL_ICON_CATALOG = {
	...faFreeCatalog(),
	...customCatalog(),
};

export { FA_FREE_REGULAR_NAMES, FA_FREE_SOLID_NAMES, KEEP_CUSTOM_NAMES };
