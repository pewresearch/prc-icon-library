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
 * Approved brands that Font Awesome Free Brands does not ship. Each path is
 * the owner's official mark, used unchanged and only scaled into 24×24.
 *
 * - `apple-news`: Apple's black app icon (`Apple_News_app_icon_blk_RGB_100819.svg`)
 *   from the asset pack linked by the Apple News Identity Guidelines
 *   (https://marketing.services.apple/apple-news-identity-guidelines).
 *   The art spans 0..360, so scale = 24 / 360. Apple trademark; use only
 *   under those guidelines.
 *
 * @type {Record<string, { label: string, shapes: Shape[] }>}
 */
export const CUSTOM_BRAND_CATALOG = {
	'apple-news': {
		label: 'Apple News',
		shapes: [
			{
				transform: 'scale(0.0666667)',
				d: 'M359.99652,112.58435c0-4.29785,0.00348-8.59747-0.02289-12.89532c-0.02283-3.62109-0.065-7.24042-0.16168-10.86151 c-0.21448-7.88733-0.67847-15.8432-2.08112-23.64435c-1.42365-7.9137-3.74548-15.27893-7.40674-22.46838 c-3.5979-7.06635-8.29962-13.53162-13.90826-19.13904c-5.60693-5.60565-12.07507-10.30426-19.14264-13.90253 c-7.19403-3.6615-14.56567-5.98535-22.48566-7.40741c-7.80048-1.401-15.75562-1.86505-23.64398-2.07776 c-3.62073-0.09845-7.24152-0.14062-10.86401-0.16168C255.98029,0,251.68109,0.00171,247.38013,0.00171L197.99182,0h-36.01611 l-49.36902,0.00348c-4.29742,0-8.59668-0.00348-12.8941,0.02289c-3.62079,0.02283-7.23981,0.065-10.86053,0.16168 c-7.8866,0.21448-15.8418,0.67853-23.64221,2.0813C57.29688,3.69318,49.93231,6.0152,42.74347,9.67676 c-7.06573,3.59821-13.5304,8.30035-19.13733,13.90955C18.00098,29.19373,13.3028,35.66248,9.7049,42.73065 c-3.66119,7.1947-5.9848,14.56696-7.40674,22.48767c-1.40088,7.80121-1.86493,15.75702-2.07758,23.64612 c-0.09845,3.62109-0.14062,7.24219-0.16168,10.86505c-0.02637,4.29956-0.02466,8.59918-0.02466,12.90057l-0.00171,49.39276 L0,198.00964l0.00348,49.37347c0,4.29785-0.00348,8.59747,0.02289,12.89532c0.02283,3.62109,0.065,7.24042,0.16168,10.86151 c0.21448,7.88733,0.67847,15.84314,2.08112,23.64435c1.42365,7.91364,3.74548,15.27887,7.40674,22.46832 c3.5979,7.06641,8.29962,13.53168,13.90826,19.1391c5.60693,5.60565,12.07507,10.30426,19.14264,13.90253 c7.19403,3.6615,14.56567,5.98535,22.48566,7.40741c7.80048,1.401,15.75562,1.86505,23.64398,2.07776 c3.62073,0.09845,7.24152,0.14062,10.86401,0.16168c4.29926,0.02637,8.59845,0.02466,12.89941,0.02466l49.38831,0.00171 L198.05682,360l49.36896-0.00354c4.29749,0,8.59668,0.00354,12.89417-0.02283c3.62079-0.02289,7.23975-0.06506,10.86053-0.16174 c7.8866-0.21442,15.84174-0.67853,23.64221-2.08124c7.91296-1.42383,15.27753-3.74591,22.46631-7.40741 c7.0658-3.59827,13.53046-8.30042,19.13733-13.90961c5.60516-5.60742,10.30341-12.07617,13.90131-19.14429 c3.66119-7.19476,5.9848-14.56702,7.40674-22.48773c1.40088-7.80115,1.86487-15.75702,2.07758-23.64606 c0.09839-3.62109,0.14062-7.24219,0.16168-10.86505c0.02637-4.29962,0.0246-8.59924,0.0246-12.90057L360,197.97711v-36.01935 L359.99652,112.58435z M192.35278,76.875h62.67316l8.56824,0.00031c0.74597,0,1.49194-0.00037,2.23792,0.00415 c0.62836,0.00391,1.25659,0.01111,1.88483,0.02808c1.36823,0.03699,2.74854,0.11761,4.10162,0.3609 c1.37402,0.24695,2.65289,0.65021,3.90118,1.28601c1.22614,0.62463,2.34808,1.44043,3.32098,2.41382 c0.97296,0.97339,1.78851,2.09613,2.41284,3.32312c0.63513,1.24829,1.03802,2.52704,1.28485,3.90088 c0.24335,1.35437,0.32404,2.73572,0.36096,4.10529c0.01703,0.62848,0.02429,1.25702,0.02808,1.88568 c0.00452,0.74634,0.00421,1.49268,0.00421,2.23895l0.00024,8.57245v62.66766c0,1.80176-2.42157,2.39001-3.24384,0.78693 c-19.6405-38.29102-50.03455-68.68787-88.32208-88.33002C189.96301,79.29681,190.55121,76.875,192.35278,76.875z M167.67975,283.125 h-62.67316l-8.5683-0.00031c-0.74591,0-1.49188,0.00031-2.23785-0.00421c-0.62836-0.00385-1.25659-0.01111-1.88483-0.02802 c-1.36829-0.03705-2.7486-0.11768-4.10168-0.3609c-1.37402-0.24701-2.65283-0.65021-3.90112-1.28601 c-1.2262-0.62469-2.34808-1.44049-3.32098-2.41382c-0.97296-0.97345-1.78851-2.09619-2.4129-3.32312 c-0.63507-1.24829-1.03796-2.52704-1.28485-3.90094c-0.24329-1.35437-0.32397-2.73572-0.3609-4.10529 c-0.01703-0.62842-0.02429-1.25696-0.02814-1.88568c-0.00446-0.74628-0.00415-1.49255-0.00415-2.23895l-0.00031-8.57245v-62.66766 c0-1.8017,2.42157-2.38995,3.2439-0.78687c19.64044,38.29095,50.03455,68.68781,88.32208,88.33008 C170.06958,280.70325,169.48132,283.125,167.67975,283.125z M283.13177,263.58539c0,0.74585,0.00037,1.49225-0.00427,2.23804 c-0.00385,0.62878-0.01117,1.25659-0.02789,1.88489c-0.03705,1.36841-0.11786,2.74878-0.36096,4.10217 c-0.24689,1.37396-0.65002,2.65302-1.28601,3.90192c-0.62451,1.22577-1.44019,2.34766-2.41339,3.32086 c-0.97351,0.97308-2.09607,1.78857-3.323,2.41321c-1.24811,0.63513-2.52673,1.03772-3.90057,1.28467 c-1.35406,0.24347-2.73547,0.32404-4.10486,0.36102c-0.62842,0.01715-1.2569,0.02435-1.88538,0.02808 c-0.74628,0.00458-1.49268,0.0047-2.23877,0.0047H237.8374c-5.24506-0.00012-7.9292-0.97321-11.87524-4.91925L81.81934,134.0498 c-3.89667-3.89722-4.91876-6.61902-4.91876-11.87616l0.00012-25.75909c-0.00006-0.74573-0.00031-1.49225,0.00427-2.23804 c0.00391-0.62878,0.01117-1.25653,0.02789-1.88483c0.03711-1.36847,0.11786-2.74878,0.36096-4.10217 c0.24689-1.37402,0.65002-2.65308,1.28607-3.90186c0.62439-1.22577,1.44006-2.34778,2.41339-3.32092 c0.97351-0.97308,2.09607-1.78857,3.323-2.41321c1.24805-0.63513,2.52661-1.03772,3.90057-1.28473 c1.354-0.24347,2.73535-0.32404,4.1048-0.36102c0.62842-0.01715,1.2569-0.02435,1.88544-0.02802 c0.74628-0.00464,1.49261-0.0047,2.23871-0.0047h25.74927c5.24506,0.00006,7.9292,0.97314,11.87524,4.91925l144.14282,144.15582 c3.89673,3.89734,4.91882,6.61902,4.91882,11.87622L283.13177,263.58539z',
			},
		],
	},
};

/**
 * Approved brand names baked from CUSTOM_BRAND_CATALOG instead of Free Brands.
 *
 * @type {string[]}
 */
export const CUSTOM_BRAND_NAMES = Object.keys(CUSTOM_BRAND_CATALOG);

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
		if (CUSTOM_BRAND_CATALOG[name]) {
			registered.push({ name });
			continue;
		}
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
		if (CUSTOM_BRAND_CATALOG[name]) {
			catalog[name] = CUSTOM_BRAND_CATALOG[name];
			continue;
		}
		catalog[name] = {
			label: labelForBrandName(name),
			shapes: bakeFaFreeSolidShapes(getFaFreeBrandSource(name)),
		};
	}
	return catalog;
}

/**
 * Every approved brand must bake from Free Brands or CUSTOM_BRAND_CATALOG,
 * or appear in the skipped list with a reason. Aliases must exist in Free Brands.
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
	for (const name of CUSTOM_BRAND_NAMES) {
		if (!APPROVED_BRAND_NAMES.includes(name)) {
			errors.push(`custom brand ${name} is not in approved-brands.json`);
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
