<?php
/**
 * WordPress 7.1 icon collection adapter (PRC-722).
 *
 * Registers the `prc` collection and every curated fill SVG from the
 * generator manifest. No-ops when the Icon API is absent (WP < 7.1).
 * `\PRC\Platform\Icons\*` (PRC-724) prefers this collection for curated
 * names. Approved brands register as collection `brands` (see
 * Brand_Icon_Registry). Missing names fail closed.
 *
 * @package PRC_Icon_Library
 */

declare(strict_types=1);

namespace PRC\Platform\Icon_Library;

/**
 * Registers fill SVGs with the WordPress Icon API when those functions exist.
 */
class Icon_Registry {

	/**
	 * Collection slug for PRC fill icons.
	 */
	public const COLLECTION = 'prc';

	/**
	 * Kebab-case icon name pattern (matches WP 7.1 unqualified icon names).
	 */
	public const ICON_NAME_PATTERN = '/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/';

	/**
	 * Hook registration onto init after core/Gutenberg default icons.
	 *
	 * @return void
	 */
	public static function init(): void {
		add_action( 'init', array( self::class, 'register' ), 11 );
	}

	/**
	 * Load the generated SVG → registration list, then let plugins extend it.
	 *
	 * @return array<string, array{label: string, file_path: string}>
	 */
	public static function get_manifest(): array {
		$manifest_path = PRC_ICON_LIBRARY_DIR . 'includes/icon-manifest.php';
		$manifest      = array();
		if ( is_readable( $manifest_path ) ) {
			$loaded = include $manifest_path;
			if ( is_array( $loaded ) ) {
				$manifest = $loaded;
			}
		}

		/**
		 * Filter the PRC fill-icon registration list.
		 *
		 * Other plugins can add icons (kebab-case name => label + file_path)
		 * or remove them. `file_path` may be plugin-relative or absolute.
		 * This does not cut over production `\PRC\Platform\Icons\*` call sites.
		 *
		 * @param array<string, array{label: string, file_path: string}> $manifest Generated SVG registration list.
		 */
		$filtered = apply_filters( 'prc_icon_library_manifest', $manifest );
		if ( ! is_array( $filtered ) ) {
			$filtered = $manifest;
		}

		return self::sanitize_manifest( $filtered );
	}

	/**
	 * Icon names that should be passed to wp_register_icon().
	 *
	 * Defaults to every key in the (possibly extended) manifest.
	 *
	 * @param array<string, array{label: string, file_path: string}> $manifest Manifest list.
	 * @return string[]
	 */
	public static function get_register_icon_names( array $manifest ): array {
		$names = array_keys( $manifest );
		/**
		 * Filter which curated fill icons are registered.
		 *
		 * Defaults to every manifest key. Names must exist in the manifest
		 * (use `prc_icon_library_manifest` to add file paths first). Do not
		 * use this to cut over production call sites.
		 *
		 * @param string[] $names    Icon names (no collection prefix).
		 * @param array    $manifest Generated + filtered SVG registration list.
		 */
		$filtered = apply_filters( 'prc_icon_library_register_icon_names', $names, $manifest );
		if ( ! is_array( $filtered ) ) {
			return array();
		}

		$allowed = array_keys( $manifest );
		$out     = array();
		foreach ( $filtered as $name ) {
			if ( is_string( $name ) && in_array( $name, $allowed, true ) ) {
				$out[] = $name;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * Register the PRC collection and every curated fill icon when the Icon API exists.
	 *
	 * @hook init
	 * @return int Number of icons registered.
	 */
	public static function register(): int {
		if ( ! function_exists( 'wp_register_icon_collection' ) || ! function_exists( 'wp_register_icon' ) ) {
			return 0;
		}

		$manifest = self::get_manifest();
		$names    = self::get_register_icon_names( $manifest );
		if ( empty( $names ) ) {
			return 0;
		}

		self::register_named_collection(
			self::COLLECTION,
			__( 'PRC Icons', 'prc-icon-library' ),
			__( 'Pew Research Center fill icons.', 'prc-icon-library' )
		);

		$registered = 0;
		foreach ( $names as $name ) {
			$entry = $manifest[ $name ];
			$file  = self::resolve_icon_file( $entry['file_path'] );
			if ( '' === $file ) {
				continue;
			}

			$ok = wp_register_icon(
				self::COLLECTION . '/' . $name,
				array(
					// Labels are generated English strings from kebab-case names.
					// phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText
					'label'     => __( $entry['label'], 'prc-icon-library' ),
					'file_path' => $file,
				)
			);
			if ( $ok ) {
				++$registered;
			}
		}

		return $registered;
	}

	/**
	 * Keep only kebab-case names with a string label and file_path.
	 *
	 * @param array $manifest Raw list from the generator and filters.
	 * @return array<string, array{label: string, file_path: string}>
	 */
	public static function sanitize_manifest( array $manifest ): array {
		$out = array();
		foreach ( $manifest as $name => $entry ) {
			if ( ! is_string( $name ) || 1 !== preg_match( self::ICON_NAME_PATTERN, $name ) ) {
				continue;
			}
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$label     = $entry['label'] ?? null;
			$file_path = $entry['file_path'] ?? null;
			if ( ! is_string( $label ) || '' === $label || ! is_string( $file_path ) || '' === $file_path ) {
				continue;
			}
			$out[ $name ] = array(
				'label'     => $label,
				'file_path' => $file_path,
			);
		}
		return $out;
	}

	/**
	 * Resolve a plugin-relative or absolute SVG path.
	 *
	 * @param string $file_path Manifest or filter path.
	 * @return string Readable absolute path, or empty string.
	 */
	public static function resolve_icon_file( string $file_path ): string {
		if ( is_readable( $file_path ) ) {
			return $file_path;
		}

		$from_plugin = PRC_ICON_LIBRARY_DIR . ltrim( $file_path, '/' );
		return is_readable( $from_plugin ) ? $from_plugin : '';
	}

	/**
	 * Register one Icon API collection when it is not already present.
	 *
	 * @param string $slug        Collection slug.
	 * @param string $label       Collection label.
	 * @param string $description Collection description.
	 * @return void
	 */
	public static function register_named_collection( string $slug, string $label, string $description ): void {
		if ( class_exists( 'WP_Icon_Collections_Registry' ) ) {
			$collections = \WP_Icon_Collections_Registry::get_instance();
			if ( $collections->is_registered( $slug ) ) {
				return;
			}
		}

		wp_register_icon_collection(
			$slug,
			array(
				'label'       => $label,
				'description' => $description,
			)
		);
	}
}
