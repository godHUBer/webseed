// js/filters/raw.js
window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};

window.App.filtersLogic.applyRaw = function(data) {
    const filters = window.App.state.filters;
    
    // EV scale from -100 to 100 mapped to roughly 4 f-stops up or down
    // 100 = 2^4 = 16x multiplier, but realistically people use -2 to +2 EV max for general edits.
    // Let's map -100..100 to -3..+3 EV.
    const exposureEV = (filters.rawExposure / 100) * 3;
    const exposureMultiplier = Math.pow(2, exposureEV);
    
    // Highlights & Shadows
    const h = filters.rawHighlights / 100; // -1 to 1
    const s = filters.rawShadows / 100;    // -1 to 1

    const c = filters.rawContrast;
    const contrastFactor = c !== 0 ? (259 * (c + 255)) / (255 * (259 - c)) : 1;

    // Fast process
    if (exposureEV === 0 && h === 0 && s === 0 && c === 0) return;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let bl = data[i + 2];

        // Exposure (linear multiplier)
        if (exposureEV !== 0) {
            r *= exposureMultiplier;
            g *= exposureMultiplier;
            bl *= exposureMultiplier;
        }

        // Calculate Luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * bl;

        // Highlights and Shadows mapping
        // Shadows mask falls off linearly toward midtones (128)
        // Highlights mask starts from midtones to brights
        if (s !== 0) {
            const shadowMask = Math.max(0, 1 - (lum / 128)); // 1 at 0, 0 at 128+
            // Boosting shadows means adding lightness where it's dark
            const shadowBoost = s * shadowMask * 128; // up to half white
            r += shadowBoost;
            g += shadowBoost;
            bl += shadowBoost;
        }

        if (h !== 0) {
            const highlightMask = Math.max(0, (lum - 128) / 128); // 0 at <128, 1 at 255
            // Reducing highlights means darkening where it's bright
            const highlightDrop = h * highlightMask * 128; // + or - adjustment
            r += highlightDrop;
            g += highlightDrop;
            bl += highlightDrop;
        }

        // Contrast
        if (c !== 0) {
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            bl = contrastFactor * (bl - 128) + 128;
        }

        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, bl));
    }
};
