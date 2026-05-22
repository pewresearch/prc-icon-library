<?php
declare(strict_types=1);

/**
 * PRC Icon Library (Font Awesome)
 *
 * @package           PRC_Icon_Library
 * @author            Seth Rubenstein
 * @copyright         2025 Pew Research Center
 * @license           GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       PRC Icon Library (Font Awesome)
 * Plugin URI:        https://github.com/pewresearch/prc-icon-library
 * Description:       Provides Font Awesome icon library assets for PRC Platform's Icon Loader.
 * Version:           1.0.0
 * Requires at least: 6.7
 * Requires PHP:      8.2
 * Author:            Seth Rubenstein
 * Author URI:        https://pewresearch.org
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       prc-icon-library
 * Requires Plugins:  prc-scripts
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * The icon library url. Ends with trailing slash. Simply append the library name to the end of the url.
 * Get specific icon by icon name: {library}.svg#{icon_name}.
 */
define( 'PRC_PLATFORM_ICONS_URL', plugin_dir_url( __FILE__ ) . 'build/icons/sprites/' );
define( 'PRC_PLATFORM_ICONS_PATH', plugin_dir_path( __FILE__ ) . '/build/icons/sprites/' );

add_filter(
	'robots_txt',
	static function ( $output, $public ) {
		if ( ! $public ) {
			return $output;
		}

		return $output . "\nDisallow: /wp-content/plugins/prc-icon-library/\n";
	},
	10,
	2
);
