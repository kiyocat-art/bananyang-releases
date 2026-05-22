/**
 * macOS Notarization Script
 * Called by electron-builder via "afterSign" hook after code signing.
 *
 * Required environment variables (set in CI or local .env.mac):
 *   APPLE_ID                    - Your Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD - App-specific password from appleid.apple.com
 *   APPLE_TEAM_ID               - Your Apple Developer Team ID (10-char alphanumeric)
 *
 * If any env var is missing, notarization is skipped (useful for local dev builds).
 */

const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    // Only run on macOS builds
    if (electronPlatformName !== 'darwin') {
        return;
    }

    // Skip if notarization credentials are not set (local dev builds)
    const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
    if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
        console.warn('[Notarize] Skipping notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID not set.');
        console.warn('[Notarize] Set these env vars for distribution builds.');
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = `${appOutDir}/${appName}.app`;

    console.log(`[Notarize] Notarizing ${appPath} ...`);
    console.log(`[Notarize] Apple ID: ${APPLE_ID}`);
    console.log(`[Notarize] Team ID: ${APPLE_TEAM_ID}`);

    try {
        await notarize({
            tool: 'notarytool',
            appPath,
            appleId: APPLE_ID,
            appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
            teamId: APPLE_TEAM_ID,
        });
        console.log('[Notarize] Notarization complete.');
    } catch (error) {
        console.error('[Notarize] Notarization failed:', error.message);
        throw error;
    }
};
