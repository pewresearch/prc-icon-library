#!/usr/bin/env node
/**
 * Fail if Font Awesome Pro leftovers remain (PRC-725 / PRC-486).
 *
 * Usage:
 *   node bin/check-fa-pro-gone.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const REPO_ROOT = path.resolve(PLUGIN_ROOT, '../..');

const PRO_PACKAGE_RES = [
	/@awesome\.me\/kit-/,
	/@fortawesome\/fontawesome-pro/,
	/@fortawesome\/pro-/,
	/@fortawesome\/sharp-/,
	/@fortawesome\/react-fontawesome/,
	/@fortawesome\/fontawesome-svg-core/,
];

const errors = [];

function rel(abs) {
	return path.relative(REPO_ROOT, abs);
}

const pkgPath = path.join(PLUGIN_ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
for (const field of [
	'dependencies',
	'devDependencies',
	'optionalDependencies',
]) {
	const block = pkg[field];
	if (!block || typeof block !== 'object') {
		continue;
	}
	for (const name of Object.keys(block)) {
		if (PRO_PACKAGE_RES.some((re) => re.test(name))) {
			errors.push(`${rel(pkgPath)} ${field} still lists ${name}`);
		}
	}
}
if (pkg.optionalDependencies && Object.keys(pkg.optionalDependencies).length) {
	errors.push(
		`${rel(pkgPath)} still has optionalDependencies (FA Pro kit leftover)`
	);
}

const spritesDir = path.join(PLUGIN_ROOT, 'build/icons/sprites');
if (fs.existsSync(spritesDir)) {
	errors.push(`${rel(spritesDir)} still exists`);
}

const resolver = path.join(
	REPO_ROOT,
	'plugins/prc-scripts/includes/scripts/src/@prc/icons/src/resolve-icon-source.js'
);
const resolverSrc = fs.readFileSync(resolver, 'utf8');
if (
	resolverSrc.includes('FA_PRO_LIBRARIES') ||
	resolverSrc.includes('sprites/')
) {
	errors.push(
		`${rel(resolver)} still exports FA Pro libraries or sprites/ URLs`
	);
}

const lockPath = path.join(REPO_ROOT, 'package-lock.json');
if (fs.existsSync(lockPath)) {
	const lock = fs.readFileSync(lockPath, 'utf8');
	const lockHits = [
		'@awesome.me/kit-329ff3ff3e',
		'@fortawesome/fontawesome-pro',
		'@fortawesome/pro-solid-svg-icons',
		'@fortawesome/pro-regular-svg-icons',
		'@fortawesome/pro-light-svg-icons',
		'@fortawesome/pro-thin-svg-icons',
		'@fortawesome/sharp-solid-svg-icons',
		'@fortawesome/sharp-regular-svg-icons',
		'@fortawesome/sharp-light-svg-icons',
	];
	for (const hit of lockHits) {
		if (lock.includes(`"${hit}"`)) {
			errors.push(`package-lock.json still lists ${hit}`);
		}
	}
}

const buildSh = path.join(PLUGIN_ROOT, 'bin/build.sh');
if (fs.existsSync(buildSh)) {
	errors.push(`${rel(buildSh)} still copies FA Pro kit sprites`);
}

if (errors.length) {
	process.stderr.write(`${errors.join('\n')}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(
		'OK Font Awesome Pro packages and weight sprites are gone\n'
	);
}
