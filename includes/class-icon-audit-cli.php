<?php
/**
 * WP-CLI audit command for saved PRC icon references.
 *
 * @package PRC_Icon_Library
 */

declare(strict_types=1);

namespace PRC\Platform\Icon_Library;

use WPCOM_VIP_CLI_Command;
use WP_CLI;
use WP_CLI\Utils;
use WP_Query;

if ( ! class_exists( 'WPCOM_VIP_CLI_Command' ) ) {
	return;
}

/**
 * Audit saved content for icon references (VIP-safe, read-only).
 */
class Icon_Audit_CLI extends WPCOM_VIP_CLI_Command {

	private const BATCH_SIZE = 100;

	/**
	 * Audit saved icon references.
	 *
	 * Scans `core/icon`, leftover `prc-block/icon`, `core/button`,
	 * `prc-block/social-share-sheet`, and `prc-block-bits/icon-span`.
	 * Read-only. Does not rewrite content.
	 *
	 * ## OPTIONS
	 *
	 * [--post-type=<post-types>]
	 * : Comma-separated post types to scan. Defaults to all public post types.
	 *
	 * [--post-status=<statuses>]
	 * : Comma-separated post statuses to scan. Defaults to publish,draft,pending,future,private.
	 *
	 * [--format=<format>]
	 * : Output format: table, csv, json, summary. Defaults to summary.
	 *
	 * [--output=<path>]
	 * : Write JSON (rows + summary) to this path. Parent directory must exist and be writable.
	 *
	 * [--network]
	 * : Scan every site in the network (switch_to_blog). Default: current site only.
	 *
	 * [--start-id=<id>]
	 * : Resume from this post ID (inclusive). Default: 0.
	 *
	 * [--batch-size=<number>]
	 * : Posts per batch. Default: 100. Max: 100.
	 *
	 * [--sleep=<seconds>]
	 * : Seconds to sleep between batches. Default: 2. Use 0 on small local DBs.
	 *
	 * [--url=<url>]
	 * : Target one site in a multisite network (WP-CLI built-in).
	 *
	 * ## EXAMPLES
	 *
	 *     wp prc icon-library audit --format=summary
	 *     wp prc icon-library audit --format=json --output=/tmp/icon-audit.json
	 *     wp prc icon-library audit --network --sleep=2
	 *     vip @pewresearch.alpha -- wp prc icon-library audit --url=<site-url> --format=summary
	 *
	 * @subcommand audit
	 * @synopsis [--post-type=<post-types>] [--post-status=<statuses>] [--format=<format>] [--output=<path>] [--network] [--start-id=<id>] [--batch-size=<number>] [--sleep=<seconds>]
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Associative arguments.
	 */
	public function audit( array $args, array $assoc_args ): void {
		unset( $args );

		$post_types    = $this->csv_arg(
			$assoc_args['post-type'] ?? '',
			get_post_types( array( 'public' => true ), 'names' )
		);
		$post_statuses = $this->csv_arg(
			$assoc_args['post-status'] ?? '',
			array( 'publish', 'draft', 'pending', 'future', 'private' )
		);
		$format        = in_array( $assoc_args['format'] ?? 'summary', array( 'table', 'csv', 'json', 'summary' ), true )
			? ( $assoc_args['format'] ?? 'summary' )
			: 'summary';
		$batch_size    = min( max( 1, (int) ( $assoc_args['batch-size'] ?? self::BATCH_SIZE ) ), self::BATCH_SIZE );
		$sleep         = isset( $assoc_args['sleep'] ) ? max( 0, (int) $assoc_args['sleep'] ) : 2;
		$start_id      = max( 0, (int) ( $assoc_args['start-id'] ?? 0 ) );
		$network       = isset( $assoc_args['network'] );
		$output_path   = isset( $assoc_args['output'] ) ? (string) $assoc_args['output'] : '';

		$site_ids = array( get_current_blog_id() );
		if ( $network && is_multisite() ) {
			$site_ids = array_map(
				'intval',
				get_sites(
					array(
						'fields' => 'ids',
						'number' => 0,
					)
				)
			);
		}

		WP_CLI::line(
			sprintf(
				'Scanning %s on site(s) %s (types: %s; statuses: %s)',
				$network ? 'the network' : 'the current site',
				implode( ', ', $site_ids ),
				implode( ', ', $post_types ),
				implode( ', ', $post_statuses )
			)
		);

		$origin_blog = get_current_blog_id();
		$all_rows    = array();

		foreach ( $site_ids as $site_id ) {
			if ( is_multisite() && (int) $site_id !== $origin_blog ) {
				switch_to_blog( (int) $site_id );
			}

			$all_rows = array_merge(
				$all_rows,
				$this->scan_site( $post_types, $post_statuses, $batch_size, $sleep, $start_id, (int) $site_id )
			);

			if ( is_multisite() && (int) $site_id !== $origin_blog ) {
				restore_current_blog();
			}
		}

		$summary = Icon_Audit::summarize(
			array_map(
				static function ( array $row ): array {
					return array(
						'source'  => (string) $row['source'],
						'library' => (string) $row['library'],
						'icon'    => (string) $row['icon'],
						'status'  => (string) $row['status'],
					);
				},
				$all_rows
			)
		);

		if ( '' !== $output_path ) {
			$this->write_output(
				$output_path,
				array(
					'generatedAt' => gmdate( 'c' ),
					'source'      => 'wp-cli',
					'siteIds'     => $site_ids,
					'summary'     => $summary,
					'rows'        => $all_rows,
				)
			);
			WP_CLI::line( 'Wrote JSON to ' . $output_path );
		}

		if ( 'summary' === $format ) {
			$this->print_summary( $summary );
			return;
		}

		Utils\format_items(
			$format,
			$all_rows,
			array( 'blog_id', 'post_id', 'post_type', 'source', 'library', 'icon', 'status' )
		);
	}

	/**
	 * Scan one site with VIP-safe pagination.
	 *
	 * @param string[] $post_types    Post types.
	 * @param string[] $post_statuses Statuses.
	 * @param int      $batch_size    Batch size.
	 * @param int      $sleep         Sleep seconds.
	 * @param int      $start_id      Resume ID.
	 * @param int      $blog_id       Blog ID.
	 * @return array<int, array<string, string|int>>
	 */
	private function scan_site(
		array $post_types,
		array $post_statuses,
		int $batch_size,
		int $sleep,
		int $start_id,
		int $blog_id
	): array {
		$rows    = array();
		$last_id = $start_id > 0 ? $start_id - 1 : 0;
		$scanned = 0;

		do {
			$query = $this->query_next_ids( $post_types, $post_statuses, $batch_size, $last_id );

			$ids         = $query->posts;
			$batch_count = is_countable( $ids ) ? count( $ids ) : 0;
			$first_id    = $batch_count > 0 ? (int) $ids[0] : 0;
			if ( $last_id > 0 && $first_id > 0 && $first_id <= $last_id ) {
				WP_CLI::warning( 'ID cursor did not advance; stopping to avoid an infinite loop.' );
				break;
			}
			foreach ( $ids as $post_id ) {
				$post_id = (int) $post_id;
				$last_id = $post_id;
				$post    = get_post( $post_id );
				if ( ! $post ) {
					continue;
				}
				foreach ( Icon_Audit::scan_content( (string) $post->post_content ) as $hit ) {
					$rows[] = array(
						'blog_id'   => $blog_id,
						'post_id'   => $post_id,
						'post_type' => (string) $post->post_type,
						'source'    => $hit['source'],
						'library'   => $hit['library'],
						'icon'      => $hit['icon'],
						'status'    => $hit['status'],
					);
				}
				++$scanned;
			}

			$this->vip_inmemory_cleanup();
			WP_CLI::line(
				sprintf(
					'Site %d: scanned %d posts (last ID %d), %d icon refs so far.',
					$blog_id,
					$scanned,
					$last_id,
					count( $rows )
				)
			);

			if ( ! empty( $ids ) && $sleep > 0 ) {
				sleep( $sleep );
			}
		} while ( $batch_count === $batch_size );

		return $rows;
	}

	/**
	 * Print status and glyph counts.
	 *
	 * @param array $summary Summary from Icon_Audit::summarize().
	 * @return void
	 */
	private function print_summary( array $summary ): void {
		WP_CLI::line( sprintf( 'Total icon refs: %d', (int) $summary['total'] ) );
		foreach ( $summary['byStatus'] as $status => $count ) {
			WP_CLI::line( sprintf( '  %s: %d', $status, (int) $count ) );
		}
		WP_CLI::line( 'Top glyphs:' );
		$shown = 0;
		foreach ( $summary['byIcon'] as $entry ) {
			WP_CLI::line(
				sprintf(
					'  %s/%s [%s] ×%d (%s)',
					$entry['library'],
					$entry['icon'],
					$entry['status'],
					$entry['count'],
					implode( ',', $entry['sources'] )
				)
			);
			++$shown;
			if ( $shown >= 40 ) {
				WP_CLI::line( '  …' );
				break;
			}
		}
		WP_CLI::success( 'Audit complete (read-only).' );
	}

	/**
	 * Write JSON to a local path.
	 *
	 * @param string $path Path.
	 * @param array  $data Payload.
	 * @return void
	 */
	private function write_output( string $path, array $data ): void {
		$json = wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $json ) ) {
			WP_CLI::warning( 'Could not encode audit JSON.' );
			return;
		}
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_file_put_contents -- CLI artifact write, opt-in --output.
		$ok = file_put_contents( $path, $json . "\n" );
		if ( false === $ok ) {
			WP_CLI::warning( 'Could not write ' . $path );
		}
	}

	/**
	 * Next post ID batch. Uses SQL `ID > last` so pagination works when
	 * VIP `id__greater_than` is absent (Elasticsearch off in cloud).
	 *
	 * @param string[] $post_types    Post types.
	 * @param string[] $post_statuses Statuses.
	 * @param int      $batch_size    Batch size.
	 * @param int      $last_id       Exclusive cursor.
	 * @return WP_Query
	 */
	private function query_next_ids( array $post_types, array $post_statuses, int $batch_size, int $last_id ): WP_Query {
		$cursor = static function ( string $where ) use ( $last_id ): string {
			global $wpdb;
			if ( $last_id <= 0 ) {
				return $where;
			}
			return $where . $wpdb->prepare( " AND {$wpdb->posts}.ID > %d", $last_id ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		};

		add_filter( 'posts_where', $cursor );
		$query = new WP_Query(
			array(
				'post_type'              => $post_types,
				'post_status'            => $post_statuses,
				'posts_per_page'         => $batch_size,
				'fields'                 => 'ids',
				'orderby'                => 'ID',
				'order'                  => 'ASC',
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				'id__greater_than'       => $last_id,
			)
		);
		remove_filter( 'posts_where', $cursor );
		return $query;
	}

	/**
	 * Parse a comma-separated CLI arg.
	 *
	 * @param mixed $value    Raw value.
	 * @param array $fallback Fallback values.
	 * @return array
	 */
	private function csv_arg( $value, array $fallback ): array {
		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return array_values( $fallback );
		}
		return array_values(
			array_filter(
				array_map( 'trim', explode( ',', $value ) )
			)
		);
	}
}

WP_CLI::add_command( 'prc icon-library audit', array( new Icon_Audit_CLI(), 'audit' ) );
