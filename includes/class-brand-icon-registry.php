<?php
/**
 * WordPress 7.1 icon collection adapter for approved brand marks.
 *
 * Registers collection `brands` and every baked fill SVG from the brands
 * manifest. No-ops when the Icon API is absent (WP < 7.1). Missing brand
 * names fail closed — there is no Font Awesome Pro sprite fallback.
 *
 * @package PRC_Icon_Library
 */

declare(strict_types=1);

namespace PRC\Platform\Icon_Library;

/**
 * Registers approved brand fill SVGs with the WordPress Icon API.
 */
class Brand_Icon_Registry {

	/**
	 * Collection slug for approved brand marks.
	 */
	public const COLLECTION = 'brands';

	/**
	 * Hook registration onto init after the PRC fill collection.
	 *
	 * @return void
	 */
	public static function init(): void {
		add_action( 'init', array( self::class, 'register' ), 12 );
	}

	/**
	 * Load the generated brand SVG → registration list, then let plugins extend it.
	 *
	 * @return array<string, array{label: string, file_path: string}>
	 */
	public static function get_manifest(): array {
		$manifest_path = PRC_ICON_LIBRARY_DIR . 'includes/brands-manifest.php';
		$manifest      = array();
		if ( is_readable( $manifest_path ) ) {
			$loaded = include $manifest_path;
			if ( is_array( $loaded ) ) {
				$manifest = $loaded;
			}
		}

		/**
		 * Filter the approved-brand fill-icon registration list.
		 *
		 * Other plugins can add icons (kebab-case name => label + file_path)
		 * or remove them. `file_path` may be plugin-relative or absolute.
		 * Do not use this to copy Font Awesome Pro path data.
		 *
		 * @param array<string, array{label: string, file_path: string}> $manifest Generated SVG registration list.
		 */
		$filtered = apply_filters( 'prc_icon_library_brands_manifest', $manifest );
		if ( ! is_array( $filtered ) ) {
			$filtered = $manifest;
		}

		return Icon_Registry::sanitize_manifest( $filtered );
	}

	/**
	 * Icon names that should be passed to wp_register_icon().
	 *
	 * Defaults to every key in the (possibly extended) brands manifest.
	 *
	 * @param array<string, array{label: string, file_path: string}> $manifest Manifest list.
	 * @return string[]
	 */
	public static function get_register_icon_names( array $manifest ): array {
		$names = array_keys( $manifest );
		/**
		 * Filter which approved brand fill icons are registered.
		 *
		 * Defaults to every brands-manifest key. Names must exist in the
		 * manifest (use `prc_icon_library_brands_manifest` to add file
		 * paths first).
		 *
		 * @param string[] $names    Icon names (no collection prefix).
		 * @param array    $manifest Generated + filtered SVG registration list.
		 */
		$filtered = apply_filters( 'prc_icon_library_register_brand_icon_names', $names, $manifest );
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
	 * Register the brands collection and every baked approved brand icon.
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

		Icon_Registry::register_named_collection(
			self::COLLECTION,
			__( 'Brands', 'prc-icon-library' ),
			__( 'Approved brand marks.', 'prc-icon-library' )
		);

		$registered = 0;
		foreach ( $names as $name ) {
			$entry = $manifest[ $name ];
			$file  = Icon_Registry::resolve_icon_file( $entry['file_path'] );
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
}
