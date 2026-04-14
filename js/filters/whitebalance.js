// js/filters/whitebalance.js
window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};

window.App.filtersLogic.applyWhiteBalance = function(data) {
    const filters = window.App.state.filters;
    const t = filters.temperature;
    const tint = filters.tint;

    if (t === 0 && tint === 0) return;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let bl = data[i + 2];

        // Temperature (-100 to 100). Adjust Red and Blue.
        if (t !== 0) {
            r += t * 0.6;
            bl -= t * 0.6;
        }

        // Tint (-100 to 100). Green vs Magenta.
        if (tint !== 0) {
            // green is positive tint, magenta is negative tint
            g += tint * 0.6;
            r -= tint * 0.3;
            bl -= tint * 0.3;
        }

        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, bl));
    }
};
