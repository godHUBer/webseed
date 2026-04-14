// js/geometry.js
window.App = window.App || {};

window.transformAction = function(type, value) {
    const geom = window.App.state.geometry;
    
    if (type === 'rotate') {
        geom.rotate = (geom.rotate + value) % 360;
    } 
    else if (type === 'crop') {
        const img = window.App.state.originalImage;
        if (!img) return;

        if (value === 'reset') {
            geom.crop = null;
        } else if (value === '1:1') {
            const aspect = img.width / img.height;
            if (aspect > 1) { // Wider
                const trim = (1 - (1/aspect)) / 2;
                geom.crop = { x: trim, y: 0, w: 1/aspect, h: 1 };
            } else { // Taller
                const trim = (1 - aspect) / 2;
                geom.crop = { x: 0, y: trim, w: 1, h: aspect };
            }
        }
    }
    else if (type === 'expand') {
        // Expand is a visual mock: We increase the crop bounds past 1,
        // and later the rendering will clamp/mirror the drawn image.
        if (geom.crop) {
            geom.crop.x -= 0.1;
            geom.crop.y -= 0.1;
            geom.crop.w += 0.2;
            geom.crop.h += 0.2;
        } else {
            geom.crop = { x: -0.1, y: -0.1, w: 1.2, h: 1.2 };
        }
    }

    if (window.App.state.originalImage) {
        window.App.canvas.fitToContainer();
        window.App.canvas.scheduleRender();
    }
};
