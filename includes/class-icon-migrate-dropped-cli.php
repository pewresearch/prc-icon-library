<?php
/**
 * Dry-run VIP CLI to map dropped glyphs onto the curated fill set.
 *
 * Default is dry-run.
 *
 * @package PRC_Icon_Library
 */

declare(strict_types=1);

namespace PRC\Platform\Icon_Library;

use WPCOM_VIP_CLI_Command;
use WP_CLI;
use WP_Query;

if ( ! class_exists( 'WPCOM_VIP_CLI_Command' ) ) {
	return;
}

/**
 * Optional rewrite of saved icon refs that the constrained pickers no longer offer.
 */
class Icon_Migrate_Dropped_CLI extends WPCOM_VIP_CLI_Command {

	private const BATCH_SIZE = 100;

	/**
	 * Map dropped glyphs onto curated PRC names where an alias exists.
	 *
	 * Defaults to dry-run. Pass --dry-run=false to write. At VIP scale, run
	 * per site with `--url` and resume with `--start-id`. Do not run a live
	 * network rewrite from this audit slice without an explicit go-ahead.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run=<bool>]
	 * : Preview changes without writing. Default: true.
	 *
	 * [--batch-size=<number>]
	 * : Posts per batch. Default: 100. Max: 100.
	 *
	 * [--start-id=<id>]
	 * : Resume from this post ID (inclusive). Default: 0.
	 *
	 * [--sleep=<seconds>]
	 * : Seconds to sleep between batches. Default: 2.
	 *
	 * [--post-type=<post-types>]
	 * : Comma-separated post types. Defaults to public types.
	 *
	 * ## EXAMPLES
	 *
	 *     wp prc icon-library migrate-dropped
	 *     wp prc icon-library migrate-dropped --dry-run=false --start-id=12000
	 *     vip @pewresearch.alpha -- wp prc icon-library migrate-dropped --url=<site-url>
	 *
	 * @subcommand migrate-dropped
	 * @synopsis [--dry-run=<bool>] [--batch-size=<number>] [--start-id=<id>] [--sleep=<seconds>] [--post-type=<post-types>]
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Associative arguments.
	 */
	public function migrate_dropped( array $args, array $assoc_args ): void {
		unset( $args );

		$dry_run    = $this->parse_dry_run( $assoc_args );
		$batch_size = min( max( 1, (int) ( $assoc_args['batch-size'] ?? self::BATCH_SIZE ) ), self::BATCH_SIZE );
		$start_id   = max( 0, (int) ( $assoc_args['start-id'] ?? 0 ) );
		$sleep      = isset( $assoc_args['sleep'] ) ? max( 0, (int) $assoc_args['sleep'] ) : 2;
		$post_types = $this->csv_arg(
			$assoc_args['post-type'] ?? '',
			get_post_types( array( 'public' => true ), 'names' )
		);

		WP_CLI::line(
			$dry_run
				? 'DRY RUN — no changes will be written. Pass --dry-run=false to execute.'
				: 'LIVE RUN — writing updated post_content.'
		);

		$this->start_bulk_operation();

		$last_id = $start_id > 0 ? $start_id - 1 : 0;
		$changed = 0;
		$skipped = 0;
		$flagged = 0;

		do {
			$query = $this->query_next_ids( $post_types, $batch_size, $last_id );

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
					++$skipped;
					continue;
				}

				$result = Icon_Dropped_Migrate::rewrite_content( (string) $post->post_content );
				if ( $result['content'] === $post->post_content ) {
					if ( ! empty( $result['flagged'] ) ) {
						++$flagged;
						WP_CLI::line(
							sprintf(
								'[FLAG] Post %d: unmapped glyphs: %s',
								$post_id,
								implode( ', ', $result['flagged'] )
							)
						);
					}
					continue;
				}

				if ( $dry_run ) {
					++$changed;
					WP_CLI::line(
						sprintf(
							'[DRY RUN] Post %d: would rewrite %s%s',
							$post_id,
							implode( ', ', $result['mapped'] ),
							empty( $result['flagged'] ) ? '' : '; still flagged: ' . implode( ', ', $result['flagged'] )
						)
					);
					continue;
				}

				$update = wp_update_post(
					wp_slash(
						array(
							'ID'           => $post_id,
							'post_content' => $result['content'],
						)
					),
					true
				);
				if ( is_wp_error( $update ) ) {
					WP_CLI::warning( sprintf( 'Post %d: update failed — %s', $post_id, $update->get_error_message() ) );
					++$skipped;
					continue;
				}
				++$changed;
				WP_CLI::line( sprintf( 'Rewrote post %d.', $post_id ) );
			}

			WP_CLI::line( sprintf( 'Batch done. Last ID: %d | Rewrites: %d | Flagged: %d', $last_id, $changed, $flagged ) );
			if ( ! empty( $ids ) && $sleep > 0 ) {
				sleep( $sleep );
			}
			$this->vip_inmemory_cleanup();
		} while ( $batch_count === $batch_size );

		$this->end_bulk_operation();

		WP_CLI::success(
			sprintf(
				'%s complete. %s: %d. Flagged (no alias): %d. Skipped: %d. Last ID: %d.',
				$dry_run ? 'Dry run' : 'Migration',
				$dry_run ? 'Would rewrite' : 'Rewritten',
				$changed,
				$flagged,
				$skipped,
				$last_id
			)
		);
	}

	/**
	 * Next post ID batch. SQL `ID > last` works when `id__greater_than` is absent.
	 *
	 * @param string[] $post_types Post types.
	 * @param int      $batch_size Batch size.
	 * @param int      $last_id    Exclusive cursor.
	 * @return WP_Query
	 */
	private function query_next_ids( array $post_types, int $batch_size, int $last_id ): WP_Query {
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
				'post_status'            => array( 'publish', 'draft', 'pending', 'future', 'private' ),
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
	 * Parse --dry-run from assoc args.
	 *
	 * @param array $assoc_args Named arguments.
	 * @return bool
	 */
	private function parse_dry_run( array $assoc_args ): bool {
		if ( ! isset( $assoc_args['dry-run'] ) ) {
			return true;
		}
		if ( 'false' === $assoc_args['dry-run'] ) {
			return false;
		}
		return (bool) $assoc_args['dry-run'];
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

WP_CLI::add_command( 'prc icon-library migrate-dropped', array( new Icon_Migrate_Dropped_CLI(), 'migrate_dropped' ) );
