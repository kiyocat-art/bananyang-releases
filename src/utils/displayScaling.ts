/**
 * Display scaling utility for automatic font size adjustment based on screen resolution
 */

export interface DisplayScale {
    scale: number;
    resolution: string;
    description: string;
}

/**
 * Calculate appropriate UI scale based on screen resolution
 */
export function calculateDisplayScale(): DisplayScale {
    const width = window.screen.width;
    const height = window.screen.height;
    const resolution = `${width} × ${height}`;

    // Calculate scale based on width (most common metric)
    let scale = 1.0;
    let description = 'Standard (1080p)';

    if (width >= 3840) {
        // 4K and above (3840x2160, 4096x2160, etc.)
        scale = 1.5;
        description = '4K UHD';
    } else if (width >= 2560) {
        // 2K/QHD (2560x1440, 2560x1600) - now uses standard size
        scale = 1.0;
        description = '2K QHD';
    } else if (width >= 1920) {
        // Full HD (1920x1080, 1920x1200)
        scale = 1.0;
        description = 'Full HD';
    } else if (width >= 1680) {
        // WSXGA+ (1680x1050)
        scale = 0.95;
        description = 'WSXGA+';
    } else if (width >= 1600) {
        // UXGA (1600x1200, 1600x1024)
        scale = 0.9;
        description = 'UXGA';
    } else {
        // Lower resolutions
        scale = 0.85;
        description = 'HD';
    }

    return { scale, resolution, description };
}

/**
 * Apply display scaling to the root element
 */
export function applyDisplayScaling(): DisplayScale {
    const scaleInfo = calculateDisplayScale();
    const root = document.documentElement;

    // Apply zoom to root element
    root.style.setProperty('--display-scale', scaleInfo.scale.toString());
    root.style.fontSize = `${16 * scaleInfo.scale}px`;

    console.log(`Display Scaling Applied: ${scaleInfo.description} (${scaleInfo.resolution}) - Scale: ${scaleInfo.scale}x`);

    return scaleInfo;
}

/**
 * Get current display scale information
 */
export function getDisplayScaleInfo(): DisplayScale {
    return calculateDisplayScale();
}

/**
 * Initialize display scaling on app load
 */
export function initializeDisplayScaling() {
    // Apply scaling immediately
    const scaleInfo = applyDisplayScaling();

    // Re-apply on window resize (for multi-monitor setups)
    let resizeTimeout: NodeJS.Timeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            applyDisplayScaling();
        }, 500);
    });

    return scaleInfo;
}
