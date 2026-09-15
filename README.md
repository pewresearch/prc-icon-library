# PRC Icon Library

> Canonical docs: [docs/plugins/prc-icon-library/](../../docs/plugins/prc-icon-library/)

Curated PRC fill icons and approved brand marks for the PRC Platform. Defines `PRC_PLATFORM_ICONS_URL` / `PRC_PLATFORM_ICONS_PATH` at the fill-sprite directory (`build/icons/`). Font Awesome Pro weight sprites are not shipped.

On WordPress 7.1+, PHP registers collection `prc` (“PRC Icons”) and collection `brands`. `\PRC\Platform\Icons\render()` / `get_icon_as_svg()` / `get_icon_as_data_uri()` use those collections. JS `@prc/icons` loads `build/icons/prc.svg` and `build/icons/brands.svg`. Missing names fail closed (HTML comment in PHP, `null` in JS). Historical FA weight slugs (`solid` / `regular` / `light`) still resolve curated names onto `prc`.

## What it does

- Defines `PRC_PLATFORM_ICONS_URL` and `PRC_PLATFORM_ICONS_PATH` so `prc-scripts` icon helpers can resolve fill-sprite URLs
- Ships 24×24 fill SVGs and, on WordPress 7.1+, registers collection `prc` and collection `brands` through `wp_register_icon()`
- Bakes fills from Font Awesome **Free** solid, Regular, and Brands packages (`npm run build:fill-svgs`)

## Key files

| File                                  | Purpose                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `prc-icon-library.php`                | Plugin entry; fill-sprite URL/path constants; boots registries                    |
| `bin/build-fill-svgs.mjs`             | Writes `src/icons/prc/*.svg` and `src/icons/brands/*.svg` from the fill catalog   |
| `bin/fill-icon-catalog.mjs`           | Imports FA Free solid, Regular, and Brands and bakes 24×24 fills                  |
| `bin/check-fa-pro-gone.mjs`           | CI guard: no Pro packages, no `build/icons/sprites/`, no kit copy script          |
| `includes/approved-brands.json`       | Approved brand names for living pickers and the sprite `IconPicker`               |
| `includes/brands-manifest.php`        | Generated `brands/{name}` registration list                                       |
| `includes/skipped-brands.json`        | Approved names missing from Free Brands (documented skips; no Pro path data)      |
| `src/icons/icon-source-map.json`      | Curated name → `fa-free-solid`, `fa-free-regular` (`{name}-outline`), or `custom` |
| `src/icons/chrome-icon-map.json`      | Block inserter chrome → WP / FA Free                                              |
| `bin/scan-icon-call-sites.mjs`        | Classify first-party JS/PHP icon call sites (`--check` / `--write`)               |
| `src/icons/call-site-remap.json`      | Hardcoded name remaps (globe-pointer → earth-americas, chart-bar → chart-column)  |
| `src/icons/call-site-exceptions.json` | Empty keep-sprite / phpcsDebt lists                                               |
| `build/icons/prc.svg`                 | Generated PRC fill sprite                                                         |
| `build/icons/brands.svg`              | Generated approved-brand fill sprite                                              |
| `bin/generate-icon-manifest.mjs`      | Fill SVGs → PHP manifests, `@prc/icons` curated picker JSON, and fill sprites     |
| `src/icons/prc/*.svg`                 | Fill glyphs (WP 7.1 sanitizer contract)                                           |
| `src/icons/brands/*.svg`              | Approved brand fill glyphs (same fill contract)                                   |

## Constants defined

| Constant                  | Value                                             |
| ------------------------- | ------------------------------------------------- |
| `PRC_PLATFORM_ICONS_URL`  | `{plugin_dir_url}/build/icons/` (trailing slash)  |
| `PRC_PLATFORM_ICONS_PATH` | `{plugin_dir_path}/build/icons/` (trailing slash) |

Both constants are consumed by `\PRC\Platform\Icons\get_icon_as_url()` in `prc-scripts`. Missing names return an HTML comment.

## Fill sprites

| Sprite file                         | Library name        | Notes                                   |
| ----------------------------------- | ------------------- | --------------------------------------- |
| `prc.svg` (under `build/icons/`)    | `prc`               | Generated from `src/icons/prc/*.svg`    |
| `brands.svg` (under `build/icons/`) | `brands` (approved) | Generated from `src/icons/brands/*.svg` |

## Filters / hooks

On public sites the plugin appends a `robots.txt` disallow for `/wp-content/plugins/prc-icon-library/` (both the catch-all `User-agent: *` group and the dedicated `User-agent: Googlebot` group).

On `init` (priority 11) `Icon_Registry` registers collection `prc`. On `init` (priority 12) `Brand_Icon_Registry` registers collection `brands`. Curated names: `prc/{name}` is FA Free solid; `prc/{name}-outline` is FA Free Regular when that Regular glyph exists, or a custom fill when Free Regular lacks the solid (`circle-plus-outline`, `circle-minus-outline`). Approved brands: `brands/{name}` is FA Free Brands.

| Hook                                         | Type   | Purpose                                                                                                        |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `prc_icon_library_manifest`                  | filter | Add/replace/remove PRC entries (`name => [label, file_path]`). `file_path` may be plugin-relative or absolute. |
| `prc_icon_library_register_icon_names`       | filter | Choose which PRC manifest keys are registered. Defaults to every key. Unknown names are dropped.               |
| `prc_icon_library_brands_manifest`           | filter | Add/replace/remove brand entries (`name => [label, file_path]`). Do not copy Font Awesome Pro path data.       |
| `prc_icon_library_register_brand_icon_names` | filter | Choose which brand manifest keys are registered. Defaults to every key. Unknown names are dropped.             |

## Icon audit CLI (PRC-725)

Read-only VIP command. It does not rewrite content.

```bash
wp prc icon-library audit --format=summary
wp prc icon-library audit --format=json --output=/tmp/icon-audit.json
npm run icons:audit-repo -w @prc/icon-library
```

See [docs/plugins/prc-icon-library/icon-audit.md](../../docs/plugins/prc-icon-library/icon-audit.md).

## Usage

Icon rendering is handled by functions in the `PRC\Platform\Icons` namespace (defined in `prc-scripts/includes/utils.php`).

**Render an icon as inline HTML (cached, `<i>` wrapper):**

```php
echo \PRC\Platform\Icons\render( 'prc', 'arrow-right', 1.25 );
echo \PRC\Platform\Icons\render( 'prc', 'circle-plus-outline' );
```

**Get an icon as an SVG fragment (cached, useful for server-side templating):**

```php
$svg = \PRC\Platform\Icons\get_icon_as_svg( 'prc', 'magnifying-glass', '#333' );
```

**Get an icon as a data URI (useful for CSS `mask-image` / `background-image`):**

```php
$uri = \PRC\Platform\Icons\get_icon_as_data_uri( 'prc', 'circle-check' );
// currentColor silhouette on ::after: mask, not background-image.
$mask = \PRC\Platform\Icons\get_icon_mask_declarations( 'prc', 'circle-plus-outline' );
```

**Get a fill-sprite fragment URL:**

```php
$url = \PRC\Platform\Icons\get_icon_as_url( 'prc', 'arrow-right' );
// https://.../build/icons/prc.svg#arrow-right
```

Icons are object-cached for 7 days (`prc_icons__rendered` / `prc_icons__svg` / `prc_icons__data_uri` groups). Cache keys include `PRC_PLATFORM_VERSION` and a `prc-no-badge` facade suffix.

## Build

```bash
npm run build:fill-svgs -w @prc/icon-library
npm run generate:icon-manifest -w @prc/icon-library
node plugins/prc-scripts/includes/scripts/src/@prc/icons/bin/build-index.js
npx turbo build --filter=@prc/icons
npm run icons:check -w @prc/icon-library
```

Fill SVGs bake from public `@fortawesome/free-*-svg-icons` packages. No Font Awesome token is required.

## Dependencies

| Dependency                            | Type             | Notes                                                      |
| ------------------------------------- | ---------------- | ---------------------------------------------------------- |
| `prc-scripts`                         | WordPress plugin | Required; provides `\PRC\Platform\Icons\*` render helpers  |
| `@fortawesome/free-solid-svg-icons`   | npm (public)     | Source for curated `prc/{name}` solid fill bakes           |
| `@fortawesome/free-regular-svg-icons` | npm (public)     | Source for curated `prc/{name}-outline` Regular fill bakes |
| `@fortawesome/free-brands-svg-icons`  | npm (public)     | Source for approved `brands/{name}` fill bakes             |

## Licensing

| Asset                                                 | License                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Plugin PHP, `package.json`                            | GPL-2.0-or-later ([LICENSE](LICENSE))                                                                                             |
| `build/icons/brands.svg`                              | Font Awesome Free Brands — [SIL OFL 1.1](https://scripts.sil.org/OFL) / [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `src/icons/prc/*.svg` (FA Free solid bakes)           | Font Awesome Free 6 solid, scaled into 24×24 — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                          |
| `src/icons/prc/*-outline.svg` (FA Free Regular bakes) | Font Awesome Free 6 Regular, scaled into 24×24 — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                        |
| `src/icons/brands/*.svg` (FA Free Brands bakes)       | Font Awesome Free 6 Brands, scaled into 24×24 — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                         |

Font Awesome is a trademark of Fonticons, Inc.

## Notes

- Fill-sprite `<use href="…">` references must be served from the **same origin** as the page.
- The plugin defines constants unconditionally at load time; loading it twice will trigger a PHP notice. Keep it in the standard plugins directory only.
