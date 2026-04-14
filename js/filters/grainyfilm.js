// js/filters/grainyfilm.js
(function () {
    window.App = window.App || {};
    window.App.filtersLogic = window.App.filtersLogic || {};

    // A fast Pseudo-Random Number Generator to avoid Math.random() overhead in loops
    function LCG(seed) {
        let state = seed;
        return function() {
            // classic LCG parameters
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 4294967296; 
        }
    }

    // Styles catalog
    // A: Classics, B: Moody/Faded, F: Vibrant, X: Cross-Process
    const stylesData = {
        'A1': { rMode: 'neutral', gMode: 'neutral', bMode: 'neutral', contrast: 1.0, lift: 0, fade: 0 },
        'A2': { rMode: 'warm', gMode: 'neutral', bMode: 'cool', contrast: 1.1, lift: 0, fade: 0 },
        'A3': { rMode: 'neutral', gMode: 'neutral', bMode: 'warm', contrast: 1.1, lift: 15, fade: 10 },
        'A4': { rMode: 'warm', gMode: 'neutral', bMode: 'cool', contrast: 1.25, lift: 5, fade: 0 },

        'B1': { rMode: 'cool', gMode: 'cool', bMode: 'cool', contrast: 1.0, lift: 5, fade: 5, sat: 0.7 },
        'B2': { rMode: 'neutral', gMode: 'cool', bMode: 'cool', contrast: 0.9, lift: 10, fade: 15, sat: 0.6 },
        'B3': { rMode: 'cool', gMode: 'neutral', bMode: 'cool', contrast: 1.1, lift: 30, fade: 30, sat: 0.5 },
        'B4': { rMode: 'neutral', gMode: 'neutral', bMode: 'cool', contrast: 0.9, lift: 40, fade: 40, sat: 0.4 },

        'F1': { rMode: 'neutral', gMode: 'vibrant', bMode: 'vibrant', contrast: 1.15, lift: 0, fade: 0, sat: 1.3 },
        'F2': { rMode: 'warm', gMode: 'vibrant', bMode: 'vibrant', contrast: 1.1, lift: 0, fade: 0, sat: 1.2 },
        'F3': { rMode: 'neutral', gMode: 'vibrant', bMode: 'vibrant', contrast: 1.2, lift: 5, fade: 0, sat: 1.4 },
        'F4': { rMode: 'warm', gMode: 'neutral', bMode: 'neutral', contrast: 1.1, lift: 0, fade: 5, sat: 1.2 },
        'F5': { rMode: 'verywarm', gMode: 'neutral', bMode: 'cool', contrast: 1.2, lift: 0, fade: 0, sat: 1.3 },

        'X1': { rMode: 'cool', gMode: 'warm', bMode: 'cool', contrast: 1.3, lift: 10, fade: 0, sat: 1.1, cross: 'green-magenta' },
        'X2': { rMode: 'cool', gMode: 'warm', bMode: 'verycool', contrast: 1.2, lift: 0, fade: 10, sat: 1.0, cross: 'yellow-blue' },
        'X3': { rMode: 'verywarm', gMode: 'cool', bMode: 'verycool', contrast: 1.4, lift: 0, fade: 20, sat: 1.2, cross: 'red-cyan' },
        'X4': { rMode: 'cool', gMode: 'neutral', bMode: 'warm', contrast: 1.5, lift: 20, fade: 0, sat: 1.3, cross: 'cyan-red' },
        'X5': { rMode: 'verywarm', gMode: 'verywarm', bMode: 'verycool', contrast: 1.6, lift: -10, fade: -10, sat: 0.8, cross: 'yellow-blue-heavy' }
    };

    window.App.filtersLogic.applyGrainyFilm = function (data, width, height) {
        const filters = window.App.state.filters;
        if (!filters) return;
        const isToolOpen = window.App.toolManager && window.App.toolManager.activeToolId === 'btn-grainy-film';

        if (!filters.grainyFilmEnabled && !isToolOpen) return;
        if (isToolOpen) filters.grainyFilmEnabled = true;

        const styleId = filters.grainyFilmStyleId;
        const styleStrength = filters.grainyFilmStyleStrength || 0;
        const grainAmount = filters.grainyFilmGrain || 0;

        if (!styleId && grainAmount === 0) return;

        const style = stylesData[styleId];
        const strengthRatio = styleStrength / 100;
        const grainRatio = grainAmount / 100;
        
        // Setup fast noise generator per frame
        // Combine width/height to have a pseudo-static seed if dimensions don't change
        let rng = null;
        if (grainRatio > 0) {
            rng = LCG(width * height + Math.floor(grainAmount));
        }

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];

            // 1. Color Styling (if a style is selected & strength > 0)
            if (style && strengthRatio > 0) {
                let origR = r, origG = g, origB = b;
                
                // --- Contrast & Lift/Fade ---
                // Map to 0-1
                let nr = r / 255, ng = g / 255, nb = b / 255;
                
                // Contrast (Pivot around 0.5)
                nr = (nr - 0.5) * style.contrast + 0.5;
                ng = (ng - 0.5) * style.contrast + 0.5;
                nb = (nb - 0.5) * style.contrast + 0.5;

                // Lift blacks and fade shadows
                let lNorm = style.lift / 255;
                let fNorm = style.fade / 255;
                if (lNorm !== 0 || fNorm !== 0) {
                    nr = nr * (1 - fNorm) + lNorm;
                    ng = ng * (1 - fNorm) + lNorm;
                    nb = nb * (1 - fNorm) + lNorm;
                }

                r = Math.max(0, Math.min(255, nr * 255));
                g = Math.max(0, Math.min(255, ng * 255));
                b = Math.max(0, Math.min(255, nb * 255));

                // --- Saturation ---
                const sat = style.sat !== undefined ? style.sat : 1.0;
                if (sat !== 1.0) {
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    r = lum + (r - lum) * sat;
                    g = lum + (g - lum) * sat;
                    b = lum + (b - lum) * sat;
                }

                // --- Color Channels Mapping based on mode ---
                // Helper to tint
                function applyTint(val, mode, isR, isG, isB) {
                    if (mode === 'warm') val += 10;
                    else if (mode === 'verywarm') val += 20;
                    else if (mode === 'cool') val -= 10;
                    else if (mode === 'verycool') val -= 20;
                    else if (mode === 'vibrant') val += val * 0.1;
                    return val;
                }
                
                r = applyTint(r, style.rMode, true, false, false);
                g = applyTint(g, style.gMode, false, true, false);
                b = applyTint(b, style.bMode, false, false, true);

                // --- Cross Processing Casts ---
                if (style.cross) {
                    const lumNorm = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // 0 to 1
                    
                    if (style.cross === 'green-magenta') {
                        // Shadows green, Highs magenta
                        g += (1 - lumNorm) * 20; 
                        r += lumNorm * 15;
                        b += lumNorm * 15;
                    } else if (style.cross === 'yellow-blue') {
                        r += (1 - lumNorm) * 15;
                        g += (1 - lumNorm) * 15;
                        b += lumNorm * 25;
                    } else if (style.cross === 'red-cyan') {
                        r += (1 - lumNorm) * 25;
                        g += lumNorm * 20;
                        b += lumNorm * 20;
                    } else if (style.cross === 'cyan-red') {
                        g += (1 - lumNorm) * 20;
                        b += (1 - lumNorm) * 20;
                        r += lumNorm * 30;
                    } else if (style.cross === 'yellow-blue-heavy') {
                        r += (1 - lumNorm) * 30;
                        g += (1 - lumNorm) * 30;
                        b -= (1 - lumNorm) * 20; // pull blue from shadows
                        b += lumNorm * 40;       // push blue to highs
                        r -= lumNorm * 10;
                    }
                }

                // Blend with original based on strength
                r = origR + (r - origR) * strengthRatio;
                g = origG + (g - origG) * strengthRatio;
                b = origB + (b - origB) * strengthRatio;
            }

            // 2. Grain Synthesis
            if (grainRatio > 0 && rng) {
                // Generate a noise value between -0.5 and 0.5
                let noise = rng() - 0.5;
                
                // Scale noise by grain slider (up to a ~50 value shift at 100% grain)
                let noiseShift = noise * 100 * grainRatio;
                
                // To look like real film, grain is less visible in pure blacks and pure whites
                const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                const visibility = 1 - Math.pow(2 * lum - 1, 2); // Parabola: 1 at midtones, 0 at extremes
                
                noiseShift *= (0.4 + 0.6 * visibility);

                r += noiseShift;
                g += noiseShift;
                b += noiseShift;
            }

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }
    };

})();
