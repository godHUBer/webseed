window.App = window.App || {};

window.App.canvas = window.App.canvas || {};

window.App.canvas.generateCornerFills = async function(angle) {
    if (angle === 0) return; // No corners to fill
    
    const badge = document.getElementById('rotate-processing-badge');
    if (badge) {
        badge.style.display = 'block';
        badge.style.backgroundColor = 'rgba(66,133,244,0.8)';
        badge.innerText = 'Synthesizing...';
    }

    // Wait 1 frame for UI badge to render before hanging the thread
    await new Promise(r => setTimeout(r, 50)); 
    
    // Ensure OpenCV loaded
    if (typeof cv === 'undefined' || !cv.Mat) {
        if (badge) {
            badge.style.backgroundColor = 'rgba(234,67,53,0.8)';
            badge.innerText = 'OpenCV Not Initialized';
            setTimeout(() => badge.style.display = 'none', 2000);
        }
        return;
    }

    try {
        const geom = window.App.state.geometry;
        const img = window.App.state.originalImage;
        const canvasObj = window.App.canvas;

        if (!img) return;

        // Determine a safe down-scaling factor to prevent WASM OOM and execution lags.
        // 512px max dimension is lightning fast for Telea.
        const maxDim = Math.max(canvasObj.el.width, canvasObj.el.height);
        const scaleFactor = Math.min(1.0, 512 / maxDim);

        // 1. Render exactly the raw geometric base without applying any pixel filters
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.floor(canvasObj.el.width * scaleFactor);
        offscreen.height = Math.floor(canvasObj.el.height * scaleFactor);
        const ctx = offscreen.getContext('2d', { willReadFrequently: true });
        
        ctx.clearRect(0, 0, offscreen.width, offscreen.height);
        ctx.save();
        ctx.translate(offscreen.width / 2, offscreen.height / 2);
        
        // Scale immediately for down-sampling
        ctx.scale(scaleFactor, scaleFactor);

        // Match rotation math from canvas.js
        let totalRotation = geom.rotate || 0;
        totalRotation += geom.straighten;
        ctx.rotate((totalRotation * Math.PI) / 180);
        ctx.scale(geom.flipX ? -1 : 1, geom.flipY ? -1 : 1);

        const isRotatedOrthogonal = Math.abs(geom.rotate) % 180 === 90;
        let drawW = (isRotatedOrthogonal ? canvasObj.el.height : canvasObj.el.width);
        let drawH = (isRotatedOrthogonal ? canvasObj.el.width : canvasObj.el.height);

        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (geom.crop) {
            let r = ((geom.rotate % 360) + 360) % 360;
            let oc = { ...geom.crop };
            if (r === 90)  oc = {x: geom.crop.y, y: 1 - (geom.crop.x + geom.crop.w), w: geom.crop.h, h: geom.crop.w};
            if (r === 180) oc = {x: 1 - (geom.crop.x + geom.crop.w), y: 1 - (geom.crop.y + geom.crop.h), w: geom.crop.w, h: geom.crop.h};
            if (r === 270) oc = {x: 1 - (geom.crop.y + geom.crop.h), y: geom.crop.x, w: geom.crop.h, h: geom.crop.w};

            sx = img.width * oc.x;
            sy = img.height * oc.y;
            sw = img.width * oc.w;
            sh = img.height * oc.h;
        }

        ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        // 2. Fetch pixels
        const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
        
        // 3. Build OpenCV Mats
        let srcRgba = cv.matFromImageData(imageData);
        let src = new cv.Mat();
        
        // inpaint strictly requires 8-bit 3-channel (RGB)
        cv.cvtColor(srcRgba, src, cv.COLOR_RGBA2RGB); 
        
        let mask = new cv.Mat(src.rows, src.cols, cv.CV_8UC1);
        let dst = new cv.Mat();

        // 4. Generate Mask (detect transparent pixels where alpha == 0)
        let needsInpaint = false;
        for (let i = 0; i < src.rows; i++) {
            for (let j = 0; j < src.cols; j++) {
                let p = i * src.cols + j;
                let alpha = imageData.data[(p * 4) + 3];
                // Anything nearly transparent gets masked
                if (alpha < 10) {
                    mask.data[p] = 255;
                    needsInpaint = true;
                } else {
                    mask.data[p] = 0;
                }
            }
        }

        if (needsInpaint) {
            // 5. Run Telea Pattern Inpainting
            cv.inpaint(src, mask, dst, 3, cv.INPAINT_TELEA);

            // 6. Convert back to Canvas Cache
            cv.cvtColor(dst, dst, cv.COLOR_RGB2RGBA); // dst becomes 4-channel
            
            let outData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows);
            for(let i=3; i<outData.data.length; i+=4) outData.data[i] = 255; // enforce opaque

            ctx.putImageData(outData, 0, 0);
            App.state.geometry.straightenCache = offscreen;
            App.state.geometry.straightenCacheAngle = angle;
        } else {
            App.state.geometry.straightenCache = null;
        }

        src.delete(); mask.delete(); dst.delete(); srcRgba.delete();
        
        if (badge) badge.style.display = 'none';

    } catch(err) {
        console.error("OpenCV Inpaint Failed: ", err);
        App.state.geometry.straightenCache = null;
        if (badge) {
            badge.style.backgroundColor = 'rgba(234,67,53,0.8)';
            badge.innerText = 'Failed: ' + err.message;
            setTimeout(() => badge.style.display = 'none', 3000);
        }
    }

    // Request a final refresh utilizing the cache
    window.App.canvas.scheduleRender();
};


