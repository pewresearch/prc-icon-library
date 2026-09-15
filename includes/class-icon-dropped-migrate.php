<?php
/**
 * Rewrite dropped icon attributes onto curated aliases.
 *
 * @package PRC_Icon_Library
 */

declare(strict_types=1);

namespace PRC\Platform\Icon_Library;

/**
 * Content rewriter used by the migrate-dropped CLI (dry-run by default).
 */
class Icon_Dropped_Migrate {

	/**
	 * Safe aliases onto curated fill names. Unlisted glyphs are flagged only.
	 *
	 * @return array<string, string>
	 */
	public static function aliases(): array {
		return array(
			'circle-x'          => 'circle-xmark',
			'circle-xmark-fill' => 'circle-xmark',
			'plus-circle'       => 'circle-plus',
			'minus-circle'      => 'circle-minus',
			'search'            => 'magnifying-glass',
			'home'              => 'house',
			'times'             => 'xmark',
			'close'             => 'xmark',
			'check-circle'      => 'circle-check',
			'column-chart'      => 'chart-column',
			'pdf'               => 'file-pdf',
		);
	}

	/**
	 * Rewrite serialized content. Idempotent.
	 *
	 * @param string $content Post content.
	 * @return array{content:string,mapped:string[],flagged:string[]}
	 */
	public static function rewrite_content( string $content ): array {
		$mapped  = array();
		$flagged = array();

		$updated = preg_replace_callback(
			'/<!--\s+wp:([a-z0-9\-\/]+)(\s+(\{(?:[^{}]|(?3))*\}))?\s+(\/?)-->/s',
			static function ( array $found ) use ( &$mapped, &$flagged ): string {
				$block_name = $found[1];
				$json       = $found[3] ?? '';
				$self_close = $found[4] ?? '';
				if ( '' === $json ) {
					return $found[0];
				}
				$attrs = json_decode( $json, true );
				if ( ! is_array( $attrs ) ) {
					return $found[0];
				}

				$next = self::rewrite_attrs( $block_name, $attrs, $mapped, $flagged );
				if ( $next === $attrs ) {
					return $found[0];
				}

				$encoded = wp_json_encode( $next, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
				if ( ! is_string( $encoded ) ) {
					return $found[0];
				}
				$slash = '' !== $self_close ? ' /' : ' ';
				return '<!-- wp:' . $block_name . ' ' . $encoded . $slash . '-->';
			},
			$content
		);

		if ( is_string( $updated ) ) {
			$content = $updated;
		}

		$updated_spans = preg_replace_callback(
			'/(<span\b[^>]*data-prc-block-bit=["\']prc-block-bits\/icon-span["\'][^>]*>)/i',
			static function ( array $found ) use ( &$mapped, &$flagged ): string {
				return self::rewrite_span_tag( $found[1], $mapped, $flagged );
			},
			$content
		);
		if ( is_string( $updated_spans ) ) {
			$content = $updated_spans;
		}

		return array(
			'content' => $content,
			'mapped'  => array_values( array_unique( $mapped ) ),
			'flagged' => array_values( array_unique( $flagged ) ),
		);
	}

	/**
	 * Rewrite one block's attributes.
	 *
	 * @param string   $block_name Block comment name.
	 * @param array    $attrs      Attributes.
	 * @param string[] $mapped     Mapped labels (by ref).
	 * @param string[] $flagged    Flagged labels (by ref).
	 * @return array
	 */
	private static function rewrite_attrs( string $block_name, array $attrs, array &$mapped, array &$flagged ): array {
		$normalized = in_array( $block_name, array( 'icon', 'button' ), true ) ? 'core/' . $block_name : $block_name;

		if ( 'core/icon' === $normalized ) {
			$icon = isset( $attrs['icon'] ) && is_string( $attrs['icon'] ) ? $attrs['icon'] : '';
			$next = self::map_namespaced_icon( $icon, $mapped, $flagged );
			if ( $next !== $icon && '' !== $next ) {
				$attrs['icon'] = $next;
			}
			return $attrs;
		}

		if ( 'prc-block/icon' === $normalized ) {
			$library     = isset( $attrs['library'] ) && is_string( $attrs['library'] ) ? $attrs['library'] : 'solid';
			$icon        = isset( $attrs['icon'] ) && is_string( $attrs['icon'] ) ? $attrs['icon'] : '';
			$mapped_icon = self::map_library_icon( $library, $icon, $mapped, $flagged );
			if ( $mapped_icon !== $icon ) {
				$attrs['icon']    = $mapped_icon;
				$attrs['library'] = 'prc';
			}
			return $attrs;
		}

		if ( in_array( $normalized, array( 'core/button', 'prc-block/social-share-sheet' ), true ) ) {
			$library = isset( $attrs['iconLibrary'] ) && is_string( $attrs['iconLibrary'] ) ? $attrs['iconLibrary'] : 'solid';
			$icon    = isset( $attrs['iconName'] ) && is_string( $attrs['iconName'] ) ? $attrs['iconName'] : '';
			if ( '' === $icon ) {
				return $attrs;
			}
			if ( Icon_Allowlist::BRANDS_LIBRARY === $library ) {
				if ( Icon_Allowlist::STATUS_APPROVED_BRAND !== Icon_Allowlist::classify( $library, $icon ) ) {
					$flagged[] = $library . '/' . $icon;
				}
				return $attrs;
			}
			$mapped_icon = self::map_library_icon( $library, $icon, $mapped, $flagged );
			if ( $mapped_icon !== $icon ) {
				$attrs['iconName']    = $mapped_icon;
				$attrs['iconLibrary'] = 'prc';
			}
		}

		return $attrs;
	}

	/**
	 * Rewrite one icon-span opening tag.
	 *
	 * @param string   $tag     Opening tag.
	 * @param string[] $mapped  Mapped labels.
	 * @param string[] $flagged Flagged labels.
	 * @return string
	 */
	private static function rewrite_span_tag( string $tag, array &$mapped, array &$flagged ): string {
		$library = 'solid';
		$icon    = '';
		if ( preg_match( '/data-icon-library=["\']([^"\']*)["\']/', $tag, $match ) ) {
			$library = $match[1];
		}
		if ( preg_match( '/data-icon-name=["\']([^"\']*)["\']/', $tag, $match ) ) {
			$icon = $match[1];
		}
		if ( '' === $icon ) {
			return $tag;
		}

		$namespaced = Icon_Allowlist::split_namespaced( $icon );
		if ( null !== $namespaced ) {
			$next = self::map_namespaced_icon( $icon, $mapped, $flagged );
			if ( $next !== $icon ) {
				$tag   = (string) preg_replace(
					'/data-icon-name=["\'][^"\']*["\']/',
					'data-icon-name="' . $next . '"',
					$tag,
					1
				);
				$parts = Icon_Allowlist::split_namespaced( $next );
				if ( null !== $parts ) {
					$tag = (string) preg_replace(
						'/data-icon-library=["\'][^"\']*["\']/',
						'data-icon-library="' . $parts['collection'] . '"',
						$tag,
						1
					);
				}
			}
			return $tag;
		}

		if ( Icon_Allowlist::BRANDS_LIBRARY === $library ) {
			if ( Icon_Allowlist::STATUS_APPROVED_BRAND !== Icon_Allowlist::classify( $library, $icon ) ) {
				$flagged[] = $library . '/' . $icon;
			}
			return $tag;
		}

		$mapped_icon = self::map_library_icon( $library, $icon, $mapped, $flagged );
		if ( $mapped_icon === $icon ) {
			return $tag;
		}

		$tag = (string) preg_replace(
			'/data-icon-name=["\'][^"\']*["\']/',
			'data-icon-name="' . $mapped_icon . '"',
			$tag,
			1
		);
		$tag = (string) preg_replace(
			'/data-icon-library=["\'][^"\']*["\']/',
			'data-icon-library="prc"',
			$tag,
			1
		);
		return $tag;
	}

	/**
	 * Map a namespaced registry icon.
	 *
	 * @param string   $icon    Namespaced name.
	 * @param string[] $mapped  Mapped labels.
	 * @param string[] $flagged Flagged labels.
	 * @return string
	 */
	private static function map_namespaced_icon( string $icon, array &$mapped, array &$flagged ): string {
		$parts = Icon_Allowlist::split_namespaced( $icon );
		if ( null === $parts ) {
			return $icon;
		}
		if ( Icon_Allowlist::REGISTRY_COLLECTION === $parts['collection'] ) {
			if ( in_array( $parts['name'], Icon_Allowlist::curated_names(), true ) ) {
				return $icon;
			}
			$alias = self::aliases()[ $parts['name'] ] ?? '';
			if ( '' !== $alias && in_array( $alias, Icon_Allowlist::curated_names(), true ) ) {
				$mapped[] = $icon . '→prc/' . $alias;
				return 'prc/' . $alias;
			}
			$flagged[] = $icon;
			return $icon;
		}
		if ( Icon_Allowlist::CORE_COLLECTION === $parts['collection'] ) {
			if ( in_array( $parts['name'], Icon_Allowlist::curated_names(), true ) ) {
				$mapped[] = $icon . '→prc/' . $parts['name'];
				return 'prc/' . $parts['name'];
			}
			$alias = self::aliases()[ $parts['name'] ] ?? '';
			if ( '' !== $alias && in_array( $alias, Icon_Allowlist::curated_names(), true ) ) {
				$mapped[] = $icon . '→prc/' . $alias;
				return 'prc/' . $alias;
			}
			$flagged[] = $icon;
			return $icon;
		}
		$flagged[] = $icon;
		return $icon;
	}

	/**
	 * Map a sprite library + name.
	 *
	 * @param string   $library Library slug.
	 * @param string   $icon    Icon name.
	 * @param string[] $mapped  Mapped labels.
	 * @param string[] $flagged Flagged labels.
	 * @return string Unchanged or curated name.
	 */
	private static function map_library_icon( string $library, string $icon, array &$mapped, array &$flagged ): string {
		if ( in_array( $icon, Icon_Allowlist::curated_names(), true ) ) {
			return $icon;
		}
		$alias = self::aliases()[ $icon ] ?? '';
		if ( '' !== $alias && in_array( $alias, Icon_Allowlist::curated_names(), true ) ) {
			$mapped[] = $library . '/' . $icon . '→prc/' . $alias;
			return $alias;
		}
		$flagged[] = $library . '/' . $icon;
		return $icon;
	}
}
