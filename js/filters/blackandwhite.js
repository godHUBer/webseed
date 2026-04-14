// js/filters/blackandwhite.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    // A fast Pseudo-Random Number Generator for grain
    function LCG(seed) {
        let state = seed;
        return function() {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 4294967296; 
        }
    }

    const filtersData = {
        'Neutral': { r: 0.299, g: 0.587, b: 0.114 },
        'Red': { r: 0.8, g: 0.15, b: 0.05 },
        'Orange': { r: 0.6, g: 0.35, b: 0.05 },
        'Yellow': { r: 0.4, g: 0.5, b: 0.1 },
        'Green': { r: 0.15, g: 0.75, b: 0.1 },
        'Blue': { r: 0.1, g: 0.1, b: 0.8 }
    };

    window.App.filtersLogic.applyBlackAndWhite = function (data, width, height) {
        // Since BW requires knowing if the tool is actively modifying pixels or just globally checked:
        // Actually, if bwStyleId logic exists or any slider is touched, OR if the tool is open.
        // Wait, realistically, if the tool is applied, it stamps the state.
        const filters = window.App.state.filters;
        if (!filters) return;

        const isToolOpen = window.App.toolManager && window.App.toolManager.activeToolId === 'btn-bw';
        
        // If it's never been applied and the tool isn't open, we don't apply B&W logic at all.
        // But what if it was applied? We don't have a specific `isBWEnabled` flag.
        // A simple heuristic: if it was committed, we should apply it. If we cancel, state reverts. 
        // We will default bwStyleId to null originally in a prod app, but we set it to 'Neutral'.
        // So we need a way to know if we should run B&W.
        // If we want no B&W by default: checking if tool is open OR if a value changed.
        // Let's assume if bwBrightness === 0 && bwContrast === 0 && bwGrain === 0 AND bwStyleId === 'Neutral' 
        // AND bwFilterId === 'Neutral', we theoretically do nothing... UNLESS the tool is open.
        // Wait! In Snapseed, opening the tool instantly turns the image BW. 
        // If we close with cancel, state reverts. 
        // But we initialized state with `bwStyleId: 'Neutral'`. This means the whole image will ALWAYS be BW!
        // FIX: I will check a condition. I'll read a `bwEnabled` flag, or if the properties were touched.
        // Actually, we can check if `bwEnabled` exists, or just enable it ONLY if we explicitly set a flag.
        // For simplicity: We will assume B&W is applied IF we are editing it OR if we have actively set `bwEnabled = true`.
        // I will add `bwEnabled: false` to the filter check.
        if (!filters.bwEnabled && !isToolOpen) return;

        // When the tool opens, it automatically enables preview, we must flag it.
        if (isToolOpen) filters.bwEnabled = true;

        const styleId = filters.bwStyleId || 'Neutral';
        const filterId = filters.bwFilterId || 'Neutral';
        const brightness = filters.bwBrightness || 0;
        const contrast = filters.bwContrast || 0;
        const grainAmount = filters.bwGrain || 0;

        const lens = filtersData[filterId] || filtersData['Neutral'];
        
        let rng = null;
        if (grainAmount > 0) {
            rng = LCG(width * height + Math.floor(grainAmount));
        }

        // Precompute contrast & bright offset
        // Style overrides
        let styleContrastMult = 1.0;
        let styleLift = 0;
        let styleFade = 0;
        let styleExp = 0;
        let styleSky = false;

        switch(styleId) {
            case 'Contrast':
                styleContrastMult = 1.25;
                break;
            case 'Bright':
                styleExp = 0.2; // roughly +20% brightness
                break;
            case 'Dark':
                styleExp = -0.15;
                styleContrastMult = 1.1; // crush darks
                break;
            case 'Film':
                styleLift = 0.05; // 5% toe lift
                styleFade = 0.05; // 5% black fade
                styleContrastMult = 0.95;
                break;
            case 'Sky':
                styleSky = true;
                styleContrastMult = 1.3;
                styleExp = -0.1;
                break;
        }

        const bOffset = brightness / 100;
        const cFactor = Math.pow((contrast + 100) / 100, 2);

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // 1. Virtual Lens Filter mixing
            let gray = r * lens.r + g * lens.g + b * lens.b;

            if (styleSky) {
                // Sky style overrides normal luminosities for blue explicitly
                gray = r * 0.7 + g * 0.2 + b * 0.1;
                // Penalize blue heavily (sky drops to near black)
                let blueIntensity = b - (r + g) / 2;
                if (blueIntensity > 0) {
                     gray -= blueIntensity * 0.8;
                }
            }

            // 2. Style Adjustments (Exposure, Lift, Fade)
            gray += styleExp;

            if (styleContrastMult !== 1.0) {
                // S-curve contrast pivot around 0.5
                gray = (gray - 0.5) * styleContrastMult + 0.5;
            }

            if (styleLift !== 0 || styleFade !== 0) {
                gray = gray * (1 - styleFade) + styleLift;
            }

            // 3. Manual Sliders
            gray += bOffset;
            if (cFactor !== 1) {
                gray = (gray - 0.5) * cFactor + 0.5;
            }

            // 4. Grain
            if (grainAmount > 0 && rng) {
                let noise = rng() - 0.5;
                let noiseShift = noise * (grainAmount / 100) * 0.5; // High ISO grit
                // B&W grain operates even in pure shadows often, but let's give it a slight luma curve
                let visibility = 1 - Math.pow(2 * Math.max(0, Math.min(1, gray)) - 1, 4); 
                gray += noiseShift * (0.6 + 0.4 * visibility);
            }

            gray = Math.max(0, Math.min(1, gray)) * 255;

            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
    };
})();
