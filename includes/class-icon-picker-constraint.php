<?php
/**
 * Constrain living registry pickers to PRC fills, Gutenberg `core`,
 * and approved `brands`.
 *
 * REST list endpoints used by `core/icon` and the bits icon modal keep
 * collections from Icon_Allowlist::allowed_registry_collections() (`prc`,
 * `core`, and `brands`). Font Awesome Pro sprites are not shipped.
 *
 * @package PRC_Icon_Library
 */

declare(strict_types=1);

namespace PRC\Platform\Icon_Library;

/**
 * REST filters for icon collections and icon lists.
 */
class Icon_Picker_Constraint {

	/**
	 * Hook REST filters.
	 *
	 * WP 7.1 `dispatch()` no longer applies `rest_post_dispatch`. Hook
	 * `rest_request_after_callbacks` so `rest_do_request()` and HTTP both
	 * see the constraint. Keep `rest_post_dispatch` for `serve_request()`.
	 *
	 * @return void
	 */
	public static function init(): void {
		add_filter( 'rest_request_after_callbacks', array( self::class, 'after_callbacks' ), 10, 3 );
		add_filter( 'rest_post_dispatch', array( self::class, 'post_dispatch' ), 10, 3 );
	}

	/**
	 * Filter after the REST controller callback (internal + HTTP).
	 *
	 * @param mixed            $response Response.
	 * @param array            $handler  Matched handler.
	 * @param \WP_REST_Request $request  Request.
	 * @return mixed
	 */
	public static function after_callbacks( $response, $handler, $request ) {
		unset( $handler );
		return self::constrain_response( $response, $request );
	}

	/**
	 * Filter HTTP REST responses in `serve_request()`.
	 *
	 * @param mixed            $response Response.
	 * @param \WP_REST_Server  $server   Server.
	 * @param \WP_REST_Request $request  Request.
	 * @return mixed
	 */
	public static function post_dispatch( $response, $server, $request ) {
		unset( $server );
		return self::constrain_response( $response, $request );
	}

	/**
	 * Filter icon collection and icon list REST responses.
	 *
	 * Single-icon GET (`/wp/v2/icons/{collection}/{name}`) is unchanged so
	 * saved `core/*` values still resolve in the editor.
	 *
	 * @param mixed $response Response.
	 * @param mixed $request  Request.
	 * @return mixed
	 */
	public static function constrain_response( $response, $request ) {
		if ( ! $response instanceof \WP_REST_Response ) {
			return $response;
		}
		if ( ! $request instanceof \WP_REST_Request ) {
			return $response;
		}
		if ( 'GET' !== $request->get_method() ) {
			return $response;
		}

		$route = $request->get_route();
		if ( ! is_string( $route ) ) {
			return $response;
		}

		if ( 1 === preg_match( '#^/wp/v2/icon-collections/?$#', $route ) ) {
			$data = $response->get_data();
			if ( is_array( $data ) ) {
				$response->set_data( self::filter_collections( $data ) );
			}
			return $response;
		}

		// Single icon: /wp/v2/icons/{collection}/{name}.
		if ( 1 === preg_match( '#^/wp/v2/icons/[a-z0-9_-]+/[a-z0-9_-]+$#', $route ) ) {
			return $response;
		}

		// List all icons, or list one collection: /wp/v2/icons or /wp/v2/icons/{collection}.
		if ( 1 === preg_match( '#^/wp/v2/icons(?:/([a-z0-9_-]+))?$#', $route, $route_match ) ) {
			$collection = $route_match[1] ?? '';
			if ( '' === $collection ) {
				$param      = $request->get_param( 'collection' );
				$collection = is_string( $param ) ? $param : '';
			}
			if ( '' !== $collection && ! in_array( $collection, Icon_Allowlist::allowed_registry_collections(), true ) ) {
				$response->set_data( array() );
				return $response;
			}
			$data = $response->get_data();
			if ( is_array( $data ) ) {
				$response->set_data( self::filter_icons( $data ) );
			}
		}

		return $response;
	}

	/**
	 * Keep only allowed collections.
	 *
	 * @param array $items Collection REST items.
	 * @return array
	 */
	public static function filter_collections( array $items ): array {
		$allowed = Icon_Allowlist::allowed_registry_collections();
		$out     = array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$slug = isset( $item['slug'] ) && is_string( $item['slug'] ) ? $item['slug'] : '';
			if ( in_array( $slug, $allowed, true ) ) {
				$out[] = $item;
			}
		}
		return $out;
	}

	/**
	 * Keep only icons whose collection (or namespaced name) is allowed.
	 *
	 * @param array $items Icon REST items.
	 * @return array
	 */
	public static function filter_icons( array $items ): array {
		$out = array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$collection = isset( $item['collection'] ) && is_string( $item['collection'] ) ? $item['collection'] : '';
			$name       = isset( $item['name'] ) && is_string( $item['name'] ) ? $item['name'] : '';
			if ( '' === $collection && '' !== $name ) {
				$parts      = Icon_Allowlist::split_namespaced( $name );
				$collection = $parts['collection'] ?? '';
			}
			if ( in_array( $collection, Icon_Allowlist::allowed_registry_collections(), true ) ) {
				$out[] = $item;
			}
		}
		return $out;
	}
}
