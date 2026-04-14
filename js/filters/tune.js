// js/filters/tune.js
window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};

window.App.filtersLogic.applyTune = function(data) {
    const filters = window.App.state.filters;
    
    const b = filters.brightness;
    const c = filters.contrast;
    const contrastFactor = c !== 0 ? (259 * (c + 255)) / (255 * (259 - c)) : 1;
    const s = filters.saturation / 100;
    const w = filters.warmth;
    const amb = filters.ambiance / 100;
    const hl = filters.highlights / 100;
    const sh = filters.shadows / 100;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], bl = data[i + 2];

        // Brightness & Contrast
        r += b; g += b; bl += b;
        if (c !== 0) {
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            bl = contrastFactor * (bl - 128) + 128;
        }

        const lum = 0.299 * r + 0.587 * g + 0.114 * bl;

        // Highlights & Shadows (Tune)
        if (sh !== 0) { // boost shadows
            const shadowMask = Math.max(0, 1 - (lum / 128));
            r += sh * shadowMask * 128; g += sh * shadowMask * 128; bl += sh * shadowMask * 128;
        }
        if (hl !== 0) { // drop highlights
            const highlightMask = Math.max(0, (lum - 128) / 128);
            r += hl * highlightMask * 128; g += hl * highlightMask * 128; bl += hl * highlightMask * 128;
        }

        // Ambiance (combines midtone brightness and saturation)
        if (amb !== 0) {
            const midMask = 1 - Math.abs(lum - 128) / 128; // strongest at 128
            const ambBoost = amb * midMask * 50; 
            r += ambBoost; g += ambBoost; bl += ambBoost;
            // Adds slight saturation with ambiance
            const lum2 = 0.299 * r + 0.587 * g + 0.114 * bl;
            r = lum2 + (r - lum2) * (1 + amb * 0.5);
            g = lum2 + (g - lum2) * (1 + amb * 0.5);
            bl = lum2 + (bl - lum2) * (1 + amb * 0.5);
        }

        // Warmth
        if (w !== 0) { r += w * 0.5; bl -= w * 0.5; }

        // Saturation
        if (s !== 0) {
            const lum3 = 0.299 * r + 0.587 * g + 0.114 * bl;
            r = lum3 + (r - lum3) * (1 + s);
            g = lum3 + (g - lum3) * (1 + s);
            bl = lum3 + (bl - lum3) * (1 + s);
        }

        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, bl));
    }
};
