<?php
/**
 * Curated picker allowlist: PRC fill names + approved brand marks.
 *
 * @package PRC_Icon_Library
 */

declare(strict_types=1);

namespace PRC\Platform\Icon_Library;

/**
 * Shared allowlist for content audit, REST picker constraint, and migrate CLI.
 */
class Icon_Allowlist {

	public const STATUS_CURATED        = 'curated';
	public const STATUS_APPROVED_BRAND = 'approved-brand';
	public const STATUS_CORE_REGISTRY  = 'core-registry';
	public const STATUS_UNREGISTERED   = 'unregistered';

	public const REGISTRY_COLLECTION = 'prc';
	public const CORE_COLLECTION     = 'core';
	public const BRANDS_LIBRARY      = 'brands';

	/**
	 * Approved Font Awesome Free brand names shown in living pickers
	 * (registry collection `brands`) and the sprite IconPicker.
	 *
	 * @var string[]|null
	 */
	private static $brands = null;

	/**
	 * PRC fill names from the generated manifest.
	 *
	 * @return string[]
	 */
	public static function curated_names(): array {
		return array_keys( Icon_Registry::get_manifest() );
	}

	/**
	 * Registry collections living pickers may list.
	 *
	 * @return string[]
	 */
	public static function allowed_registry_collections(): array {
		return array(
			self::REGISTRY_COLLECTION,
			self::CORE_COLLECTION,
			self::BRANDS_LIBRARY,
		);
	}

	/**
	 * Approved brand icon names.
	 *
	 * @return string[]
	 */
	public static function approved_brands(): array {
		if ( is_array( self::$brands ) ) {
			return self::$brands;
		}

		$path = PRC_ICON_LIBRARY_DIR . 'includes/approved-brands.json';
		$raw  = array();
		if ( is_readable( $path ) ) {
			$decoded = json_decode( (string) file_get_contents( $path ), true ); // phpcs:ignore WordPressVIPMinimum.Performance.FetchingRemoteData.FileGetContentsUnknown
			if ( is_array( $decoded ) ) {
				$raw = $decoded;
			}
		}

		$out = array();
		foreach ( $raw as $name ) {
			if ( is_string( $name ) && '' !== $name ) {
				$out[] = $name;
			}
		}
		self::$brands = array_values( array_unique( $out ) );
		return self::$brands;
	}

	/**
	 * Whether a namespaced registry key belongs to an allowed picker collection.
	 *
	 * @param string $name Namespaced icon name (e.g. prc/arrow-right).
	 * @return bool
	 */
	public static function is_allowed_registry_icon( string $name ): bool {
		$parts = self::split_namespaced( $name );
		if ( null === $parts ) {
			return false;
		}
		return in_array( $parts['collection'], self::allowed_registry_collections(), true );
	}

	/**
	 * Classify one library/name pair from saved content.
	 *
	 * @param string $library Library or collection slug.
	 * @param string $icon    Icon name, optionally namespaced.
	 * @return string One of the STATUS_* constants.
	 */
	public static function classify( string $library, string $icon ): string {
		$library = self::normalize_library( $library );
		$icon    = trim( $icon );
		if ( '' === $icon ) {
			return self::STATUS_UNREGISTERED;
		}

		$namespaced = self::split_namespaced( $icon );
		if ( null !== $namespaced ) {
			$library = $namespaced['collection'];
			$icon    = $namespaced['name'];
		}

		if ( self::CORE_COLLECTION === $library ) {
			return self::STATUS_CORE_REGISTRY;
		}

		if ( self::BRANDS_LIBRARY === $library ) {
			return in_array( $icon, self::approved_brands(), true )
				? self::STATUS_APPROVED_BRAND
				: self::STATUS_UNREGISTERED;
		}

		if ( in_array( $icon, self::curated_names(), true ) ) {
			return self::STATUS_CURATED;
		}

		return self::STATUS_UNREGISTERED;
	}

	/**
	 * Split `collection/name` when both sides are kebab-case.
	 *
	 * @param string $icon Raw icon attribute.
	 * @return array{collection:string,name:string}|null
	 */
	public static function split_namespaced( string $icon ): ?array {
		if ( ! str_contains( $icon, '/' ) ) {
			return null;
		}
		$parts = explode( '/', $icon, 2 );
		if ( 2 !== count( $parts ) || '' === $parts[0] || '' === $parts[1] ) {
			return null;
		}
		return array(
			'collection' => $parts[0],
			'name'       => $parts[1],
		);
	}

	/**
	 * Lowercase library slug.
	 *
	 * @param string $library Raw library.
	 * @return string
	 */
	public static function normalize_library( string $library ): string {
		$library = strtolower( trim( $library ) );
		return '' === $library ? 'solid' : $library;
	}

	/**
	 * Reset cached brand list (tests).
	 *
	 * @return void
	 */
	public static function reset_cache(): void {
		self::$brands = null;
	}
}
