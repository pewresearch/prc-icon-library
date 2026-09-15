# PRC fill SVG contract (PRC-721)

WordPress 7.1’s icon sanitizer allowlists `svg`, `path`, and `polygon` and **strips `stroke`**. Registry-surviving PRC glyphs are fill-based.

Every file in `prc/*.svg` and `brands/*.svg` must match this contract:

1. Root: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">`
2. Children: `path` and/or `polygon` only
3. `fill="currentColor"` on every shape (not on the root — the sanitizer drops `fill` on `svg`)
4. No `stroke` / `stroke-*`
5. No `<defs>`, `<g>`, `<circle>`, `<rect>`, `<use>`, classes, ids, or hardcoded colors
6. Optional: `fill-rule="evenodd"`, `transform` (both survive the sanitizer)
7. Solid glyphs use the kebab-case FA name (`circle-plus.svg`). Free Regular companions use `{name}-outline` (`bookmark-outline.svg`). Custom `{name}-outline` companions are allowed when Free Regular lacks the solid (`circle-plus-outline.svg`). Do not use `circlePlus` or `circle-plus-solid`.

Regenerate from the catalog:

```bash
npm run build:fill-svgs -w @prc/icon-library
npm run generate:icon-manifest -w @prc/icon-library
npm run build:icon-compare-sheet -w @prc/icon-library
npm run icons:map-chrome -w @prc/icon-library
```

`--check` on those scripts fails when committed output is stale.

The manifest is the registration list. PHP registers every curated name as `prc/{name}` and every baked approved brand as `brands/{name}` when `wp_register_icon()` exists. `\PRC\Platform\Icons\*` prefers those collections. Unregistered names keep the sprite path. Authors can pick `prc/file-pdf`, `prc/upload`, and `brands/google`; report-materials PHP still maps `report` to `file`. Historical names `column-chart` and `pdf` alias onto `chart-column` and `file-pdf`.

The fill catalog imports `@fortawesome/free-solid-svg-icons` and `@fortawesome/free-regular-svg-icons`. Every `fa-free-solid` row in `icon-source-map.json` bakes into 24×24 (`s = 24 / max(W, H)`, centered) as `prc/{name}`. When Font Awesome 6 Free Regular includes the same icon, the catalog also bakes `prc/{name}-outline` from that Regular glyph with the same contain-fit. Keep-custom replacements are `compare`, `presentation-screen`, and `card` (no outlines). Custom `{name}-outline` companions are `circle-plus-outline` and `circle-minus-outline` (Free Regular does not ship those glyphs). `search` bakes `magnifying-glass`. `circle-x` and `circle-x-outline` bake `circle-xmark`. Chrome glyphs that exist in FA Free join the curated set. Approved brands bake from `@fortawesome/free-brands-svg-icons` into `brands/{name}` (same contain-fit). License for FA-derived glyphs: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Do not copy Font Awesome Pro path data into this set. Living pickers list Gutenberg `core` and collection `brands`.
