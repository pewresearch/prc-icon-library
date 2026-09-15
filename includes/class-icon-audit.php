<?php
/**
 * Scan serialized post content for icon references.
 *
 * @package PRC_Icon_Library
 */

declare(strict_types=1);

namespace PRC\Platform\Icon_Library;

/**
 * Finds iconLibrary / iconName and legacy shapes in block comments and icon-span bits.
 */
class Icon_Audit {

	/**
	 * Scan serialized post content.
	 *
	 * @param string $content Post content.
	 * @return array<int, array{source:string,library:string,icon:string,status:string}>
	 */
	public static function scan_content( string $content ): array {
		$rows = array();

		if ( preg_match_all(
			'/<!--\s+wp:([a-z0-9\-\/]+)(\s+(\{(?:[^{}]|(?3))*\}))?\s+\/?-->/s',
			$content,
			$matches,
			PREG_SET_ORDER
		) ) {
			foreach ( $matches as $match ) {
				$block_name = self::normalize_block_name( $match[1] );
				$attrs      = array();
				if ( ! empty( $match[3] ) ) {
					$decoded = json_decode( $match[3], true );
					if ( is_array( $decoded ) ) {
						$attrs = $decoded;
					}
				}
				$row = self::row_from_block( $block_name, $attrs );
				if ( null !== $row ) {
					$rows[] = $row;
				}
			}
		}

		foreach ( self::scan_icon_spans( $content ) as $span ) {
			$rows[] = self::make_row(
				'prc-block-bits/icon-span',
				$span['library'],
				$span['icon']
			);
		}

		return array_values(
			array_filter(
				$rows,
				static fn( array $row ): bool => '' !== $row['icon']
			)
		);
	}

	/**
	 * Summarize scan rows by library/icon/status.
	 *
	 * @param array<int, array{source:string,library:string,icon:string,status:string}> $rows Scan rows.
	 * @return array{total:int,byStatus:array<string,int>,byIcon:array<int,array{library:string,icon:string,status:string,count:int,sources:string[]}>}
	 */
	public static function summarize( array $rows ): array {
		$by_status = array(
			Icon_Allowlist::STATUS_CURATED        => 0,
			Icon_Allowlist::STATUS_APPROVED_BRAND => 0,
			Icon_Allowlist::STATUS_CORE_REGISTRY  => 0,
			Icon_Allowlist::STATUS_UNREGISTERED   => 0,
		);
		$grouped   = array();

		foreach ( $rows as $row ) {
			$status = $row['status'];
			if ( ! isset( $by_status[ $status ] ) ) {
				$by_status[ $status ] = 0;
			}
			++$by_status[ $status ];

			$key = $row['library'] . "\0" . $row['icon'] . "\0" . $row['status'];
			if ( ! isset( $grouped[ $key ] ) ) {
				$grouped[ $key ] = array(
					'library' => $row['library'],
					'icon'    => $row['icon'],
					'status'  => $row['status'],
					'count'   => 0,
					'sources' => array(),
				);
			}
			++$grouped[ $key ]['count'];
			$grouped[ $key ]['sources'][] = $row['source'];
		}

		$by_icon = array_values( $grouped );
		foreach ( $by_icon as &$entry ) {
			$entry['sources'] = array_values( array_unique( $entry['sources'] ) );
		}
		unset( $entry );

		usort(
			$by_icon,
			static function ( array $a, array $b ): int {
				if ( $a['count'] === $b['count'] ) {
					return strcmp( $a['library'] . '/' . $a['icon'], $b['library'] . '/' . $b['icon'] );
				}
				return $b['count'] <=> $a['count'];
			}
		);

		return array(
			'total'    => count( $rows ),
			'byStatus' => $by_status,
			'byIcon'   => $by_icon,
		);
	}

	/**
	 * Map a parsed block onto an audit row.
	 *
	 * @param string $block_name Normalized block name (core/ prefix kept).
	 * @param array  $attrs      Decoded attributes.
	 * @return array{source:string,library:string,icon:string,status:string}|null
	 */
	private static function row_from_block( string $block_name, array $attrs ): ?array {
		switch ( $block_name ) {
			case 'core/icon':
			case 'icon':
				$icon = self::string_attr( $attrs, 'icon' );
				if ( '' === $icon ) {
					return null;
				}
				$parts = Icon_Allowlist::split_namespaced( $icon );
				return self::make_row(
					'core/icon',
					$parts['collection'] ?? 'prc',
					$parts['name'] ?? $icon
				);

			case 'prc-block/icon':
				return self::make_row(
					'prc-block/icon',
					self::string_attr( $attrs, 'library', 'solid' ),
					self::string_attr( $attrs, 'icon' )
				);

			case 'prc-block/social-share-sheet':
				return self::make_row(
					'social-share-sheet',
					self::string_attr( $attrs, 'iconLibrary', 'solid' ),
					self::string_attr( $attrs, 'iconName', 'share' )
				);

			case 'core/button':
			case 'button':
				$icon = self::string_attr( $attrs, 'iconName' );
				if ( '' === $icon ) {
					return null;
				}
				return self::make_row(
					'core/button',
					self::string_attr( $attrs, 'iconLibrary', 'solid' ),
					$icon
				);
		}

		return null;
	}

	/**
	 * Scan icon-span data attributes.
	 *
	 * @param string $content Post content.
	 * @return array<int, array{library:string,icon:string}>
	 */
	private static function scan_icon_spans( string $content ): array {
		$rows = array();
		if ( ! preg_match_all(
			'/<span\b[^>]*data-prc-block-bit=["\']prc-block-bits\/icon-span["\'][^>]*>/i',
			$content,
			$matches
		) ) {
			return $rows;
		}

		foreach ( $matches[0] as $span ) {
			$rows[] = array(
				'library' => self::html_attr( $span, 'data-icon-library', 'solid' ),
				'icon'    => self::html_attr( $span, 'data-icon-name', '' ),
			);
		}

		return $rows;
	}

	/**
	 * Build a classified row.
	 *
	 * @param string $source  Surface name.
	 * @param string $library Library slug.
	 * @param string $icon    Icon name.
	 * @return array{source:string,library:string,icon:string,status:string}
	 */
	private static function make_row( string $source, string $library, string $icon ): array {
		$library = Icon_Allowlist::normalize_library( $library );
		$icon    = is_string( $icon ) ? $icon : '';
		$parts   = Icon_Allowlist::split_namespaced( $icon );
		if ( null !== $parts ) {
			$library = $parts['collection'];
			$icon    = $parts['name'];
		}
		return array(
			'source'  => $source,
			'library' => $library,
			'icon'    => $icon,
			'status'  => Icon_Allowlist::classify( $library, $icon ),
		);
	}

	/**
	 * Core blocks serialize without the `core/` prefix.
	 *
	 * @param string $name Raw comment name.
	 * @return string
	 */
	private static function normalize_block_name( string $name ): string {
		if ( in_array( $name, array( 'icon', 'button' ), true ) ) {
			return 'core/' . $name;
		}
		return $name;
	}

	/**
	 * Read a string attribute.
	 *
	 * @param array  $attrs    Attributes.
	 * @param string $key      Key.
	 * @param string $fallback Fallback.
	 * @return string
	 */
	private static function string_attr( array $attrs, string $key, string $fallback = '' ): string {
		$value = $attrs[ $key ] ?? $fallback;
		return is_string( $value ) ? $value : $fallback;
	}

	/**
	 * Read an HTML attribute from a tag fragment.
	 *
	 * @param string $markup   Tag HTML.
	 * @param string $name     Attribute name.
	 * @param string $fallback Fallback.
	 * @return string
	 */
	private static function html_attr( string $markup, string $name, string $fallback ): string {
		if ( preg_match( '/' . preg_quote( $name, '/' ) . '=["\']([^"\']*)["\']/i', $markup, $match ) ) {
			return html_entity_decode( $match[1], ENT_QUOTES );
		}
		return $fallback;
	}
}
