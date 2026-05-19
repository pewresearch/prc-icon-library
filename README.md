# PRC Icon Library

Font Awesome Pro SVG sprite assets for the [PRC Platform](https://github.com/pewresearch/prc-platform). This WordPress plugin defines path/URL constants and ships the built sprite files consumed by `prc-platform-core`'s Icon Loader (`PRC\Platform\Icons`).

## Repository status

This repository is the **standalone consumer mirror** for `prc-icon-library`. Plugin source is developed in the [prc-platform](https://github.com/pewresearch/prc-platform) monorepo under `plugins/prc-icon-library/`.

Starting with **platform release 1.7**, changed releases of this plugin are pushed here automatically from [.github/workflows/build-release.yml](https://github.com/pewresearch/prc-platform/blob/trunk/.github/workflows/build-release.yml) when the plugin is listed in [.github/release-plugins.json](https://github.com/pewresearch/prc-platform/blob/trunk/.github/release-plugins.json).

Until the first 1.7 ship, this repo contains documentation only. The plugin tree will appear on the first release that includes `prc-icon-library` in the ship matrix.

## What it does

- Builds Font Awesome Pro SVG sprites (solid, regular, light, thin, duotone, brands, sharp variants, and PRC custom icons) into `build/icons/sprites/`
- Defines `PRC_PLATFORM_ICONS_URL` and `PRC_PLATFORM_ICONS_PATH` at plugin load for the Icon Loader in `prc-platform-core`
- Registers no hooks; rendering lives in `prc-platform-core/includes/icon-loader/`

## Development

Work happens in the monorepo, not in this repository directly.

```bash
git clone https://github.com/pewresearch/prc-platform.git
cd prc-platform
npm run bootstrap
npx turbo build --filter=@prc/icon-library
```

Sprite rebuild (requires `PRC_PLATFORM_FONTAWESOME_TOKEN` — see [docs/DEPENDENCY_AUTH.md](https://github.com/pewresearch/prc-platform/blob/trunk/docs/DEPENDENCY_AUTH.md) in the monorepo):

```bash
npm run build:sprites -w @prc/icon-library
```

## Dependencies

| Dependency | Notes |
| --- | --- |
| `prc-platform-core` | Required; provides `Icon_Loader` and `PRC\Platform\Icons\*` render helpers |
| Font Awesome Pro (npm) | Licensed packages; token required for install/build in the monorepo |

## License

GPL-2.0-or-later (same as PRC Platform plugins).
