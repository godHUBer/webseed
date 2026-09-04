// js/state.js
window.App = window.App || {};

window.App.state = {
    originalImage: null,
    originalImageDataUrl: null,
    originalFileName: 'edited-image',
    geometry: {
        rotate: 0, // degrees (multiples of 90)
        straighten: 0, // degrees (fine tune -45 to 45)
        straightenCache: null, // ImageBitmap or Canvas caching the inpainted background
        straightenCacheAngle: null,
        flipX: false,
        flipY: false,
        crop: null // {x, y, w, h} - fractional from 0 to 1
    },
    canvasConfig: {
        width: 0,
        height: 0,
        previewScale: 1,
        userZoom: 1,
        baseFitScale: 1,
        panX: 0,
        panY: 0
    },
    perspective: {
        enabled: false,
        corners: [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}], // normalized 0..1
        gridVisible: true,
        tiltX: 0,
        tiltY: 0,
        rotate: 0
    },
    expand: {
        enabled: false,
        mode: 'smart', // 'smart'|'white'|'black'|'reflect'
        pad: { top:0, right:0, bottom:0, left:0 } // fractions 0..0.4
    },
    uiFlags: {
        compareOriginal: false,
        opencvReady: false
    },
    filters: {
        rawExposure: 0,
        rawHighlights: 0,
        rawShadows: 0,
        rawContrast: 0,
        rawStructure: 0,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        ambiance: 0,
        highlights: 0,
        shadows: 0,
        warmth: 0,
        structure: 0,
        sharpen: 0,
        temperature: 0,
        tint: 0,
        glamourGlow: 0,
        glamourSaturation: 0,
        glamourWarmth: 0,
        grainyFilmEnabled: false,
        grainyFilmStyleStrength: 50,
        grainyFilmGrain: 50,
        grainyFilmStyleId: null,
        bwEnabled: false,
        bwStyleId: 'Neutral',
        bwFilterId: 'Neutral',
        bwBrightness: 0,
        bwContrast: 0,
        bwGrain: 0
    },
    lensBlur: {
        enabled: false,
        blurStrength: 50,
        transition: 50,
        vignetteStrength: 0, // -100..100 darken/brighten bg like real lens (Phase C)
        bokehShape: 1, // 1 to 11
        bokehRotation: 0, // 0..360 (Phase C)
        maskMode: 'elliptical', // 'elliptical' | 'linear'
        anchor: {
            x: 0.5,
            y: 0.5,
            focusScaleX: 0.24,
            focusScaleY: 0.24,
            rotation: 0
        }
    },
    selective: {
        points: [], // { id, x, y, radius, color: {r,g,b, lab}, filters: { brightness: 0, contrast: 0, saturation: 0, structure: 0 } }
        activePointId: null,
        activeParam: 'brightness',
        showMask: false,
        threshold: 32, // Lab ΔE sigma (Phase B)
        feather: 48, // spatial feather %
        maxPoints: 8
    },
    vignette: {
        enabled: false,
        innerBrightness: 0,
        outerBrightness: -50,
        feather: 45, // 0..100 softness (Phase C)
        tint: null, // optional warm tint color string e.g. '#d8a86a' (Phase C)
        anchor: { x: 0.5, y: 0.5, radius: 0.4, radiusX: null, radiusY: null }
    },
    text: {
        enabled: false,
        content: "DOUBLE TAP TO EDIT",
        x: 0.5, y: 0.5,
        scale: 1.0,
        rotation: 0,
        color: "#ffffff",
        customFontFamily: "",
        opacity: 100,
        inverted: false,
        styleId: "N1",
        align: "center", // Phase C: left|center|right
        letterSpacing: 0, // 0..30
        lineSpacing: 1.15,
        shadow: false,
        outline: false
    },
    frames: {
        enabled: false,
        styleId: 1,
        frameWidth: 0
    },
    curvesLUT: new Uint8Array(256).map((_, i) => i), // Default 1:1 mapping
    curvesMix: 100, // 0..100 blend of curve vs original (Phase B)
    curvesChannel: 'rgb', // 'rgb'|'r'|'g'|'b'|'luminance' (Phase B)
    brush: {
        activeType: 'dodgeBurn',   // 'dodgeBurn' | 'exposure' | 'temperature' | 'saturation'
        strength: 50,               // 1–100 (sign is per-type)
        size: 40,                   // brush radius in canvas pixels
        hardness: 65,               // 0..100 (Phase B) -> sigma 0.7..4.2
        flow: 85,                   // 10..100 (Phase B) opacity build-up
        edgeAware: false,           // guided filter on mask (Phase B)
        spacing: 18,                // % of radius for dab spacing (Phase B)
        erasing: false,
        showMask: false,
        // Float32Array per type — values -100..+100, lazy-initialized when tool opens
        mask: {
            dodgeBurn: null,
            exposure: null,
            temperature: null,
            saturation: null
        },
        maskWidth: 0,
        maskHeight: 0
    },
    healing: {
        size: 40,
        hardness: 72, // 0..100
        mode: 'heal', // 'heal'|'clone' Phase B
        source: null, // {x,y} for clone stamp offset
        patches: [], // Array of { maskData: ImageData, srcData: ImageData, dstData: ImageData } or similar offscreen buffers
        overlayCanvas: null // Rendered composite of applied healing
    }
};

window.App.deepClone = function (value) {
    return JSON.parse(JSON.stringify(value));
};

window.App.mergeDeep = function (base, patch) {
    const result = Array.isArray(base) ? base.slice() : { ...base };
    if (!patch || typeof patch !== 'object') return result;

    Object.keys(patch).forEach((key) => {
        const patchValue = patch[key];
        if (Array.isArray(patchValue)) {
            result[key] = patchValue.slice();
        } else if (patchValue && typeof patchValue === 'object') {
            const baseValue = result[key] && typeof result[key] === 'object' ? result[key] : {};
            result[key] = window.App.mergeDeep(baseValue, patchValue);
        } else {
            result[key] = patchValue;
        }
    });

    return result;
};

window.App.getLookSnapshot = function () {
    return {
        filters: window.App.deepClone(window.App.state.filters),
        lensBlur: window.App.deepClone(window.App.state.lensBlur),
        vignette: window.App.deepClone(window.App.state.vignette),
        frames: window.App.deepClone(window.App.state.frames),
        curvesLUT: Array.from(window.App.state.curvesLUT || [])
    };
};

window.App.getProjectSnapshot = function () {
    return {
        geometry: {
            rotate: window.App.state.geometry.rotate,
            straighten: window.App.state.geometry.straighten,
            flipX: !!window.App.state.geometry.flipX,
            flipY: !!window.App.state.geometry.flipY,
            crop: window.App.state.geometry.crop ? window.App.deepClone(window.App.state.geometry.crop) : null
        },
        filters: window.App.deepClone(window.App.state.filters),
        lensBlur: window.App.deepClone(window.App.state.lensBlur),
        selective: window.App.deepClone(window.App.state.selective),
        vignette: window.App.deepClone(window.App.state.vignette),
        text: window.App.deepClone(window.App.state.text),
        frames: window.App.deepClone(window.App.state.frames),
        curvesLUT: Array.from(window.App.state.curvesLUT || [])
    };
};

window.App.applyLookSnapshot = function (snapshot) {
    if (!window.App.defaultLookSnapshot) return;

    const merged = {
        filters: window.App.mergeDeep(window.App.defaultLookSnapshot.filters, snapshot && snapshot.filters),
        lensBlur: window.App.mergeDeep(window.App.defaultLookSnapshot.lensBlur, snapshot && snapshot.lensBlur),
        vignette: window.App.mergeDeep(window.App.defaultLookSnapshot.vignette, snapshot && snapshot.vignette),
        frames: window.App.mergeDeep(window.App.defaultLookSnapshot.frames, snapshot && snapshot.frames),
        curvesLUT: Array.isArray(snapshot && snapshot.curvesLUT) ? snapshot.curvesLUT.slice() : window.App.defaultLookSnapshot.curvesLUT.slice(),
        curvesMix: typeof snapshot?.curvesMix==='number'? snapshot.curvesMix : window.App.defaultLookSnapshot.curvesMix,
        curvesChannel: snapshot?.curvesChannel || window.App.defaultLookSnapshot.curvesChannel
    };

    window.App.state.filters = merged.filters;
    window.App.state.lensBlur = merged.lensBlur;
    window.App.state.vignette = merged.vignette;
    window.App.state.frames = merged.frames;
    window.App.state.curvesLUT = new Uint8Array(merged.curvesLUT);
    window.App.state.curvesMix = merged.curvesMix;
    window.App.state.curvesChannel = merged.curvesChannel;

    if (window.App.normalizeLensBlurState) window.App.normalizeLensBlurState();
    if (window.App.normalizeVignetteState) window.App.normalizeVignetteState();
};

window.App.applyProjectSnapshot = function (snapshot) {
    if (!window.App.defaultProjectSnapshot) return;

    const merged = {
        geometry: window.App.mergeDeep(window.App.defaultProjectSnapshot.geometry, snapshot && snapshot.geometry),
        filters: window.App.mergeDeep(window.App.defaultProjectSnapshot.filters, snapshot && snapshot.filters),
        lensBlur: window.App.mergeDeep(window.App.defaultProjectSnapshot.lensBlur, snapshot && snapshot.lensBlur),
        selective: window.App.mergeDeep(window.App.defaultProjectSnapshot.selective, snapshot && snapshot.selective),
        vignette: window.App.mergeDeep(window.App.defaultProjectSnapshot.vignette, snapshot && snapshot.vignette),
        text: window.App.mergeDeep(window.App.defaultProjectSnapshot.text, snapshot && snapshot.text),
        frames: window.App.mergeDeep(window.App.defaultProjectSnapshot.frames, snapshot && snapshot.frames),
        curvesLUT: Array.isArray(snapshot && snapshot.curvesLUT) ? snapshot.curvesLUT.slice() : window.App.defaultProjectSnapshot.curvesLUT.slice(),
        curvesMix: typeof snapshot?.curvesMix==='number'? snapshot.curvesMix : window.App.defaultProjectSnapshot.curvesMix,
        curvesChannel: snapshot?.curvesChannel || window.App.defaultProjectSnapshot.curvesChannel
    };

    window.App.state.geometry = merged.geometry;
    window.App.state.filters = merged.filters;
    window.App.state.lensBlur = merged.lensBlur;
    window.App.state.selective = merged.selective;
    window.App.state.vignette = merged.vignette;
    window.App.state.text = merged.text;
    window.App.state.frames = merged.frames;
    window.App.state.curvesLUT = new Uint8Array(merged.curvesLUT);
    window.App.state.curvesMix = merged.curvesMix;
    window.App.state.curvesChannel = merged.curvesChannel;

    if (window.App.normalizeLensBlurState) window.App.normalizeLensBlurState();
    if (window.App.normalizeVignetteState) window.App.normalizeVignetteState();
};

window.App.cloneBrushState = function (brush) {
    const source = brush || window.App.state.brush;
    const mask = {};
    ['dodgeBurn', 'exposure', 'temperature', 'saturation'].forEach((type) => {
        mask[type] = source.mask[type] ? new Float32Array(source.mask[type]) : null;
    });
    return {
        activeType: source.activeType,
        strength: source.strength,
        size: source.size,
        hardness: source.hardness,
        flow: source.flow,
        edgeAware: source.edgeAware,
        spacing: source.spacing,
        erasing: source.erasing,
        showMask: source.showMask,
        mask,
        maskWidth: source.maskWidth,
        maskHeight: source.maskHeight
    };
};

window.App.cloneHealingState = function (healing) {
    const source = healing || window.App.state.healing;
    return {
        size: source.size,
        hardness: source.hardness,
        mode: source.mode,
        source: source.source ? { x: source.source.x, y: source.source.y } : null,
        patches: source.patches ? source.patches.slice() : [],
        overlayCanvas: source.overlayCanvas || null
    };
};

window.App.getRuntimeSnapshot = function () {
    return {
        geometry: {
            rotate: window.App.state.geometry.rotate,
            straighten: window.App.state.geometry.straighten,
            straightenCache: null,
            straightenCacheAngle: null,
            flipX: !!window.App.state.geometry.flipX,
            flipY: !!window.App.state.geometry.flipY,
            crop: window.App.state.geometry.crop ? window.App.deepClone(window.App.state.geometry.crop) : null
        },
        filters: window.App.deepClone(window.App.state.filters),
        curvesLUT: new Uint8Array(window.App.state.curvesLUT),
        curvesMix: window.App.state.curvesMix,
        curvesChannel: window.App.state.curvesChannel,
        perspective: window.App.deepClone(window.App.state.perspective),
        expand: window.App.deepClone(window.App.state.expand),
        selective: window.App.deepClone(window.App.state.selective),
        lensBlur: window.App.deepClone(window.App.state.lensBlur),
        vignette: window.App.deepClone(window.App.state.vignette),
        text: window.App.deepClone(window.App.state.text),
        frames: window.App.deepClone(window.App.state.frames),
        brush: window.App.cloneBrushState(window.App.state.brush),
        healing: window.App.cloneHealingState(window.App.state.healing)
    };
};

window.App.applyRuntimeSnapshot = function (snapshot) {
    if (!snapshot) return;

    window.App.state.geometry = window.App.deepClone(snapshot.geometry);
    window.App.state.filters = window.App.deepClone(snapshot.filters);
    window.App.state.curvesLUT = new Uint8Array(snapshot.curvesLUT || []);
    window.App.state.curvesMix = typeof snapshot.curvesMix==='number'? snapshot.curvesMix : 100;
    window.App.state.curvesChannel = snapshot.curvesChannel || 'rgb';
    if(snapshot.perspective) window.App.state.perspective = window.App.deepClone(snapshot.perspective);
    if(snapshot.expand) window.App.state.expand = window.App.deepClone(snapshot.expand);
    window.App.state.selective = window.App.deepClone(snapshot.selective);
    window.App.state.lensBlur = window.App.deepClone(snapshot.lensBlur);
    window.App.state.vignette = window.App.deepClone(snapshot.vignette);
    window.App.state.text = window.App.deepClone(snapshot.text);
    window.App.state.frames = window.App.deepClone(snapshot.frames);
    window.App.state.brush = window.App.cloneBrushState(snapshot.brush);
    window.App.state.healing = window.App.cloneHealingState(snapshot.healing);

    if (window.App.normalizeLensBlurState) window.App.normalizeLensBlurState();
    if (window.App.normalizeVignetteState) window.App.normalizeVignetteState();

    if (window.App.filtersLogic && window.App.filtersLogic.rebuildHealingOverlay) {
        window.App.filtersLogic.rebuildHealingOverlay();
    }
};

window.App.historyFieldModes = {
    geometry: 'diff',
    filters: 'diff',
    curvesLUT: 'replace',
    curvesMix: 'diff',
    curvesChannel: 'diff',
    perspective: 'diff',
    expand: 'diff',
    selective: 'replace',
    lensBlur: 'diff',
    vignette: 'diff',
    text: 'diff',
    frames: 'diff',
    brush: 'replace',
    healing: 'replace'
};

window.App.cloneHistoryValue = function (value) {
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (value instanceof Float32Array) return new Float32Array(value);
    if (Array.isArray(value)) return value.map((item) => window.App.cloneHistoryValue(item));
    if (value && Object.prototype.toString.call(value) === '[object Object]') {
        const result = {};
        Object.keys(value).forEach((key) => {
            result[key] = window.App.cloneHistoryValue(value[key]);
        });
        return result;
    }
    return value;
};

window.App.valuesEqual = function (a, b) {
    if (a === b) return true;
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
    if (a instanceof Float32Array && b instanceof Float32Array) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (!window.App.valuesEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (
        a && b &&
        Object.prototype.toString.call(a) === '[object Object]' &&
        Object.prototype.toString.call(b) === '[object Object]'
    ) {
        const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
        for (let i = 0; i < keys.length; i += 1) {
            if (!window.App.valuesEqual(a[keys[i]], b[keys[i]])) return false;
        }
        return true;
    }
    return false;
};

window.App.diffHistoryValue = function (beforeValue, afterValue) {
    if (window.App.valuesEqual(beforeValue, afterValue)) return null;
    if (
        !beforeValue ||
        !afterValue ||
        Object.prototype.toString.call(beforeValue) !== '[object Object]' ||
        Object.prototype.toString.call(afterValue) !== '[object Object]' ||
        beforeValue instanceof Uint8Array ||
        afterValue instanceof Uint8Array ||
        beforeValue instanceof Float32Array ||
        afterValue instanceof Float32Array ||
        Array.isArray(beforeValue) ||
        Array.isArray(afterValue)
    ) {
        return window.App.cloneHistoryValue(afterValue);
    }

    const patch = {};
    let changed = false;
    Object.keys(afterValue).forEach((key) => {
        const nextPatch = window.App.diffHistoryValue(beforeValue[key], afterValue[key]);
        if (nextPatch !== null) {
            patch[key] = nextPatch;
            changed = true;
        }
    });

    return changed ? patch : null;
};

window.App.applyHistoryPatch = function (targetValue, patchValue) {
    if (
        patchValue === null ||
        Object.prototype.toString.call(patchValue) !== '[object Object]' ||
        patchValue instanceof Uint8Array ||
        patchValue instanceof Float32Array ||
        Array.isArray(patchValue)
    ) {
        return window.App.cloneHistoryValue(patchValue);
    }

    const result = targetValue && typeof targetValue === 'object' ? window.App.cloneHistoryValue(targetValue) : {};
    Object.keys(patchValue).forEach((key) => {
        result[key] = window.App.applyHistoryPatch(result[key], patchValue[key]);
    });
    return result;
};

window.App.normalizeLensBlurState = function () {
    const lensBlur = window.App.state && window.App.state.lensBlur;
    if (!lensBlur) return null;
    lensBlur.maskMode = 'elliptical';
    lensBlur.enabled = !!lensBlur.enabled;
    lensBlur.blurStrength = typeof lensBlur.blurStrength === 'number' ? lensBlur.blurStrength : 50;
    lensBlur.transition = typeof lensBlur.transition === 'number' ? lensBlur.transition : 50;
    lensBlur.vignetteStrength = typeof lensBlur.vignetteStrength === 'number' ? lensBlur.vignetteStrength : 0;
    lensBlur.bokehShape = typeof lensBlur.bokehShape === 'number' ? lensBlur.bokehShape : 1;
    lensBlur.bokehRotation = typeof lensBlur.bokehRotation === 'number' ? lensBlur.bokehRotation : 0;
    lensBlur.anchor = lensBlur.anchor || {};
    lensBlur.anchor.x = typeof lensBlur.anchor.x === 'number' ? lensBlur.anchor.x : 0.5;
    lensBlur.anchor.y = typeof lensBlur.anchor.y === 'number' ? lensBlur.anchor.y : 0.5;
    const legacyFocus = typeof lensBlur.anchor.focusScale === 'number' ? lensBlur.anchor.focusScale : 0.24;
    lensBlur.anchor.focusScaleX = typeof lensBlur.anchor.focusScaleX === 'number' ? lensBlur.anchor.focusScaleX : legacyFocus;
    lensBlur.anchor.focusScaleY = typeof lensBlur.anchor.focusScaleY === 'number' ? lensBlur.anchor.focusScaleY : legacyFocus;
    lensBlur.anchor.rotation = typeof lensBlur.anchor.rotation === 'number' ? lensBlur.anchor.rotation : 0;
    lensBlur.anchor.x = Math.max(0, Math.min(1, lensBlur.anchor.x));
    lensBlur.anchor.y = Math.max(0, Math.min(1, lensBlur.anchor.y));
    lensBlur.anchor.focusScaleX = Math.max(0.08, Math.min(0.45, lensBlur.anchor.focusScaleX));
    lensBlur.anchor.focusScaleY = Math.max(0.08, Math.min(0.45, lensBlur.anchor.focusScaleY));
    lensBlur.bokehRotation = ((lensBlur.bokehRotation % 360)+360)%360;
    lensBlur.vignetteStrength = Math.max(-100, Math.min(100, lensBlur.vignetteStrength));
    return lensBlur;
};

window.App.normalizeVignetteState = function () {
    const vignette = window.App.state && window.App.state.vignette;
    if (!vignette) return null;
    vignette.enabled = !!vignette.enabled;
    vignette.innerBrightness = typeof vignette.innerBrightness === 'number' ? vignette.innerBrightness : 0;
    vignette.outerBrightness = typeof vignette.outerBrightness === 'number' ? vignette.outerBrightness : -50;
    vignette.feather = typeof vignette.feather === 'number' ? vignette.feather : 45;
    vignette.tint = vignette.tint || null;
    vignette.anchor = vignette.anchor || {};
    vignette.anchor.x = typeof vignette.anchor.x === 'number' ? vignette.anchor.x : 0.5;
    vignette.anchor.y = typeof vignette.anchor.y === 'number' ? vignette.anchor.y : 0.5;
    vignette.anchor.radius = typeof vignette.anchor.radius === 'number' ? vignette.anchor.radius : 0.4;
    if(vignette.anchor.radiusX!=null && typeof vignette.anchor.radiusX!=='number') vignette.anchor.radiusX=null;
    if(vignette.anchor.radiusY!=null && typeof vignette.anchor.radiusY!=='number') vignette.anchor.radiusY=null;
    vignette.anchor.x = Math.max(0, Math.min(1, vignette.anchor.x));
    vignette.anchor.y = Math.max(0, Math.min(1, vignette.anchor.y));
    vignette.anchor.radius = Math.max(0.08, Math.min(1.2, vignette.anchor.radius));
    vignette.feather = Math.max(0, Math.min(100, vignette.feather));
    vignette.innerBrightness = Math.max(-100, Math.min(100, vignette.innerBrightness));
    vignette.outerBrightness = Math.max(-100, Math.min(100, vignette.outerBrightness));
    return vignette;
};

window.App.normalizeLensBlurState();
window.App.normalizeVignetteState();
window.App.defaultLookSnapshot = window.App.getLookSnapshot();
window.App.defaultProjectSnapshot = window.App.getProjectSnapshot();
window.App.defaultRuntimeSnapshot = window.App.getRuntimeSnapshot();

window.App.historyManager = {
    baseSnapshot: window.App.cloneHistoryValue(window.App.defaultRuntimeSnapshot),
    entries: [],
    cursor: 0,
    selectedEntryId: null,

    getDisplayName(toolId, explicitLabel) {
        if (explicitLabel) return explicitLabel;
        const names = {
            'btn-tune-image': 'Tune Image',
            'btn-details': 'Details',
            'btn-curves': 'Curves',
            'btn-wb': 'White Balance',
            'btn-crop': 'Crop',
            'btn-rotate': 'Rotate',
            'btn-selective': 'Selective',
            'btn-brush': 'Brush',
            'btn-healing': 'Healing',
            'btn-glamour-glow': 'Glamour Glow',
            'btn-grainy-film': 'Grainy Film',
            'btn-bw': 'Black & White',
            'btn-lens-blur': 'Lens Blur',
            'btn-vignette': 'Vignette',
            'btn-text': 'Text',
            looks: 'Look'
        };
        return names[toolId] || 'Edit';
    },

    reset(baseSnapshot) {
        this.baseSnapshot = window.App.cloneHistoryValue(baseSnapshot || window.App.defaultRuntimeSnapshot);
        this.entries = [];
        this.cursor = 0;
        this.selectedEntryId = null;
        this.syncUI();
    },

    syncUI() {
        if (window.App.ui && window.App.ui.renderHistoryPanel) {
            window.App.ui.renderHistoryPanel();
        }
        if (window.App.ui && window.App.ui.renderLooksUI) {
            window.App.ui.renderLooksUI();
        }
    },

    createPatch(beforeSnapshot, afterSnapshot) {
        const patch = {};
        let changed = false;

        Object.keys(window.App.historyFieldModes).forEach((key) => {
            const mode = window.App.historyFieldModes[key];
            if (mode === 'replace') {
                if (!window.App.valuesEqual(beforeSnapshot[key], afterSnapshot[key])) {
                    patch[key] = window.App.cloneHistoryValue(afterSnapshot[key]);
                    changed = true;
                }
                return;
            }

            const diff = window.App.diffHistoryValue(beforeSnapshot[key], afterSnapshot[key]);
            if (diff !== null) {
                patch[key] = diff;
                changed = true;
            }
        });

        return changed ? patch : null;
    },

    rebuildToCursor() {
        let snapshot = window.App.cloneHistoryValue(this.baseSnapshot || window.App.defaultRuntimeSnapshot);

        for (let i = 0; i < this.cursor; i += 1) {
            const entry = this.entries[i];
            if (!entry || !entry.patch) continue;

            Object.keys(entry.patch).forEach((key) => {
                const mode = window.App.historyFieldModes[key];
                if (mode === 'replace') {
                    snapshot[key] = window.App.cloneHistoryValue(entry.patch[key]);
                } else {
                    snapshot[key] = window.App.applyHistoryPatch(snapshot[key], entry.patch[key]);
                }
            });
        }

        window.App.applyRuntimeSnapshot(snapshot);
        if (window.App.ui) {
            window.App.ui.activeLookId = null;
        }
        if (window.App.canvas && window.App.state.originalImage) {
            window.App.canvas.fitToContainer(true);
            window.App.canvas.scheduleRender();
        }
        this.syncUI();
    },

    recordEdit(options) {
        const beforeSnapshot = options && options.beforeSnapshot;
        const afterSnapshot = options && options.afterSnapshot;
        const patch = beforeSnapshot && afterSnapshot ? this.createPatch(beforeSnapshot, afterSnapshot) : null;
        if (!patch) {
            this.syncUI();
            return false;
        }

        if (this.cursor < this.entries.length) {
            this.entries = this.entries.slice(0, this.cursor);
        }

        const entry = {
            id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            toolId: options && options.toolId ? options.toolId : 'edit',
            label: this.getDisplayName(options && options.toolId, options && options.label),
            patch
        };

        this.entries.push(entry);
        this.cursor = this.entries.length;
        this.selectedEntryId = entry.id;
        if (window.App.ui && entry.toolId !== 'looks') {
            window.App.ui.activeLookId = null;
        }
        this.syncUI();
        return true;
    },

    undo() {
        if (this.cursor === 0) return;
        this.cursor -= 1;
        this.selectedEntryId = this.entries[Math.max(0, this.cursor - 1)] ? this.entries[Math.max(0, this.cursor - 1)].id : null;
        this.rebuildToCursor();
    },

    redo() {
        if (this.cursor >= this.entries.length) return;
        this.cursor += 1;
        this.selectedEntryId = this.entries[this.cursor - 1] ? this.entries[this.cursor - 1].id : null;
        this.rebuildToCursor();
    },

    deleteEntry(entryId) {
        const index = this.entries.findIndex((entry) => entry.id === entryId);
        if (index === -1) return;

        this.entries.splice(index, 1);
        if (index < this.cursor) {
            this.cursor = Math.max(0, this.cursor - 1);
        }
        if (this.cursor > this.entries.length) {
            this.cursor = this.entries.length;
        }

        const selected = this.entries[Math.min(index, this.entries.length - 1)];
        this.selectedEntryId = selected ? selected.id : null;
        this.rebuildToCursor();
    },

    selectEntry(entryId) {
        this.selectedEntryId = entryId;
        this.syncUI();
    }
};

window.App.toolManager = {
    activeToolId: null,
    sessionState: null, // snapshot of state before tool modifications

    openTool(toolId, uiCallback) {
        if (this.activeToolId === toolId) { this.cancelTool(); return; }
        
        // Auto-revert previous tool without committing if switched aggressively
        if (this.activeToolId) {
            this.cancelTool();
        }

        this.activeToolId = toolId;
        
        // Take Snapshot (Deep clone necessary filters & geometry)
        const brushState = window.App.state.brush;
        const brushMaskSnapshot = {};
        ['dodgeBurn', 'exposure', 'temperature', 'saturation'].forEach(type => {
            brushMaskSnapshot[type] = brushState.mask[type] ? new Float32Array(brushState.mask[type]) : null;
        });
        this.sessionState = {
            filters: window.App.deepClone(window.App.state.filters),
            geometry: window.App.deepClone(window.App.state.geometry),
            curvesLUT: new Uint8Array(window.App.state.curvesLUT),
            curvesMix: window.App.state.curvesMix,
            curvesChannel: window.App.state.curvesChannel,
            perspective: window.App.deepClone(window.App.state.perspective),
            expand: window.App.deepClone(window.App.state.expand),
            selective: window.App.deepClone(window.App.state.selective),
            lensBlur: window.App.deepClone(window.App.state.lensBlur),
            vignette: window.App.deepClone(window.App.state.vignette),
            text: window.App.deepClone(window.App.state.text),
            frames: window.App.deepClone(window.App.state.frames),
            brush: window.App.cloneBrushState(brushState),
            healing: window.App.cloneHealingState(window.App.state.healing),
            uiCallback: uiCallback
        };

        if (uiCallback && uiCallback.show) uiCallback.show();
    },

    commitTool() {
        if (!this.activeToolId) return;
        const toolId = this.activeToolId;
        const beforeSnapshot = this.sessionState ? {
            geometry: window.App.deepClone(this.sessionState.geometry),
            filters: window.App.deepClone(this.sessionState.filters),
            curvesLUT: new Uint8Array(this.sessionState.curvesLUT),
            curvesMix: this.sessionState.curvesMix,
            curvesChannel: this.sessionState.curvesChannel,
            perspective: window.App.deepClone(this.sessionState.perspective),
            expand: window.App.deepClone(this.sessionState.expand),
            selective: window.App.deepClone(this.sessionState.selective),
            lensBlur: window.App.deepClone(this.sessionState.lensBlur),
            vignette: window.App.deepClone(this.sessionState.vignette),
            text: window.App.deepClone(this.sessionState.text),
            frames: window.App.deepClone(this.sessionState.frames),
            brush: window.App.cloneBrushState(this.sessionState.brush),
            healing: window.App.cloneHealingState(this.sessionState.healing)
        } : null;
        const afterSnapshot = window.App.getRuntimeSnapshot();

        if (this.sessionState && this.sessionState.uiCallback && this.sessionState.uiCallback.hide) {
            this.sessionState.uiCallback.hide();
        }
        
        // Clear snapshot (permanently binding state edits)
        this.activeToolId = null;
        this.sessionState = null;

        if (window.App.historyManager) {
            window.App.historyManager.recordEdit({
                toolId,
                beforeSnapshot,
                afterSnapshot
            });
        }
    },

    cancelTool() {
        if (!this.activeToolId || !this.sessionState) return;
        
        // Revert live state to snapshot
        window.App.state.filters = window.App.deepClone(this.sessionState.filters);
        window.App.state.geometry = window.App.deepClone(this.sessionState.geometry);
        window.App.state.curvesLUT.set(this.sessionState.curvesLUT);
        window.App.state.curvesMix = this.sessionState.curvesMix;
        window.App.state.curvesChannel = this.sessionState.curvesChannel;
        if(this.sessionState.perspective) window.App.state.perspective = window.App.deepClone(this.sessionState.perspective);
        if(this.sessionState.expand) window.App.state.expand = window.App.deepClone(this.sessionState.expand);
        window.App.state.selective = window.App.deepClone(this.sessionState.selective);
        window.App.state.lensBlur = window.App.deepClone(this.sessionState.lensBlur);
        window.App.state.vignette = window.App.deepClone(this.sessionState.vignette);
        window.App.state.text = window.App.deepClone(this.sessionState.text);
        window.App.state.frames = window.App.deepClone(this.sessionState.frames);

        // Restore brush mask snapshot
        if (this.sessionState.brush) {
            window.App.state.brush = window.App.cloneBrushState(this.sessionState.brush);
        }

        if (this.sessionState.healing) {
            window.App.state.healing = window.App.cloneHealingState(this.sessionState.healing);
            // Notify healing UI to rebuild the overlay canvas
            if (window.App.filtersLogic && window.App.filtersLogic.rebuildHealingOverlay) {
                window.App.filtersLogic.rebuildHealingOverlay();
            }
        }
        
        // Refresh canvas to clear uncommitted changes
        if (window.App.canvas) {
            window.App.canvas.fitToContainer(); // Geometry may have been rolled back
            window.App.canvas.scheduleRender();
        }
        
        if (this.sessionState.uiCallback && this.sessionState.uiCallback.hide) {
            this.sessionState.uiCallback.hide();
        }

        this.activeToolId = null;
        this.sessionState = null;
    }
};
