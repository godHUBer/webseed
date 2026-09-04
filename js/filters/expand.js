// js/filters/expand.js — Phase C: grow canvas with smart fill
window.App = window.App || {};
window.App.filtersLogic = window.App.filtersLogic || {};
(function(){
    let overlay, canvas, ctx, hint;
    let dragSide = null; // 'top'|'right'|'bottom'|'left'
    let startPad = null, startPos = null;

    const getPad = ()=> window.App.state.expand.pad;
    const syncOverlay=()=>{
        const editor = window.App.canvas && window.App.canvas.el;
        if(!overlay||!canvas||!editor) return false;
        const rect=editor.getBoundingClientRect();
        const oRect=overlay.getBoundingClientRect();
        if(rect.width<1) return false;
        canvas.width=Math.max(1,Math.round(rect.width));
        canvas.height=Math.max(1,Math.round(rect.height));
        canvas.style.position='absolute';
        canvas.style.left=(rect.left - oRect.left)+'px';
        canvas.style.top=(rect.top - oRect.top)+'px';
        canvas.style.width=rect.width+'px';
        canvas.style.height=rect.height+'px';
        return true;
    };
    const draw=()=>{
        if(!canvas||!overlay||overlay.style.display==='none') return;
        if(!syncOverlay()) return;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const pad=getPad();
        const w=canvas.width, h=canvas.height;
        const left = pad.left*w, right = w - pad.right*w, top = pad.top*h, bottom = h - pad.bottom*h;
        // outer dim
        ctx.fillStyle='rgba(66,133,244,0.08)'; ctx.fillRect(0,0,w,h);
        // inner photo rect
        ctx.strokeStyle='rgba(255,255,255,0.92)'; ctx.lineWidth=2;
        ctx.strokeRect(left, top, right-left, bottom-top);
        ctx.setLineDash([6,6]); ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.strokeRect(0,0,w,h); ctx.setLineDash([]);
        // handles mid-edges
        const handles=[
            {x:w/2, y:top, side:'top'}, {x:right, y:h/2, side:'right'},
            {x:w/2, y:bottom, side:'bottom'}, {x:left, y:h/2, side:'left'}
        ];
        handles.forEach(pt=>{
            const active = dragSide===pt.side;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, active?9:7,0,Math.PI*2);
            ctx.fillStyle= active? '#4285F4' : '#fff'; ctx.fill();
            ctx.lineWidth=2; ctx.strokeStyle= active? '#fff':'#4285F4'; ctx.stroke();
        });
        if(hint){
            const mode=window.App.state.expand.mode;
            hint.textContent = `Expand: ${mode} fill • Drag edges to grow (up to 40% per side)`;
        }
    };
    const getPointer=(e)=>{
        if(!syncOverlay()) return null;
        const rect=canvas.getBoundingClientRect();
        return { x:(e.clientX||(e.touches&&e.touches[0].clientX)||0)-rect.left, y:(e.clientY||(e.touches&&e.touches[0].clientY)||0)-rect.top };
    };
    const hitSide=(p)=>{
        const pad=getPad(); const w=canvas.width, h=canvas.height;
        const left=pad.left*w, right=w-pad.right*w, top=pad.top*h, bottom=h-pad.bottom*h;
        if(Math.abs(p.y-top)<14 && p.x>left-20 && p.x<right+20) return 'top';
        if(Math.abs(p.y-bottom)<14 && p.x>left-20 && p.x<right+20) return 'bottom';
        if(Math.abs(p.x-left)<14 && p.y>top-20 && p.y<bottom+20) return 'left';
        if(Math.abs(p.x-right)<14 && p.y>top-20 && p.y<bottom+20) return 'right';
        return null;
    };

    window.App.filtersLogic.initExpandUI=function(){
        overlay=document.getElementById('expand-ui-overlay');
        canvas=document.getElementById('expand-interactive-canvas');
        hint=document.getElementById('expand-hint');
        if(!overlay||!canvas) return;
        ctx=canvas.getContext('2d');
        const btn=document.getElementById('btn-expand');
        const bottomBar=document.getElementById('expand-bottom-bar');
        const closeBtn=document.getElementById('expand-close');
        const applyBtn=document.getElementById('expand-apply');
        const modeBtns=document.querySelectorAll('.expand-mode-btn');

        const show=()=>{ overlay.style.display='block'; if(bottomBar) bottomBar.style.display='flex'; setTimeout(draw,30); };
        const hide=()=>{ overlay.style.display='none'; if(bottomBar) bottomBar.style.display='none'; };
        window.App.filtersLogic.hideExpandUI=hide;

        if(btn){
            btn.addEventListener('click', ()=>{
                if(window.App.toolManager.activeToolId==='btn-expand') { window.App.toolManager.cancelTool(); return; }
                window.App.toolManager.openTool('btn-expand', {show, hide});
            });
        }
        if(closeBtn) closeBtn.addEventListener('click', ()=> window.App.toolManager.cancelTool());
        if(applyBtn) applyBtn.addEventListener('click', ()=>{
            // commit: expand the actual imageData size? For now we bake pad into canvas fit
            // The real expand is done in canvas render via applyExpand that draws extended border
            window.App.state.expand.enabled = Object.values(getPad()).some(v=>v>0.01);
            window.App.toolManager.commitTool();
            if(window.App.canvas) window.App.canvas.scheduleRender();
        });
        modeBtns.forEach(b=>{
            b.addEventListener('click', ()=>{
                modeBtns.forEach(x=>x.classList.remove('active'));
                b.classList.add('active');
                window.App.state.expand.mode=b.getAttribute('data-mode');
                draw(); if(window.App.canvas) window.App.canvas.scheduleRender();
            });
        });

        const onDown=(e)=>{
            if(window.App.toolManager.activeToolId!=='btn-expand') return;
            const p=getPointer(e);
            if(!p) return;
            const side=hitSide(p);
            if(side){
                dragSide=side;
                startPad={...getPad()};
                startPos=p;
                e.preventDefault();
            }
        };
        const onMove=(e)=>{
            if(window.App.toolManager.activeToolId!=='btn-expand') return;
            const p=getPointer(e);
            if(!p) return;
            if(dragSide){
                e.preventDefault();
                const pad=getPad();
                const w=canvas.width, h=canvas.height;
                const dx=(p.x - startPos.x)/w;
                const dy=(p.y - startPos.y)/h;
                if(dragSide==='top') pad.top = Math.max(0, Math.min(0.4, startPad.top - dy));
                if(dragSide==='bottom') pad.bottom = Math.max(0, Math.min(0.4, startPad.bottom + dy));
                if(dragSide==='left') pad.left = Math.max(0, Math.min(0.4, startPad.left - dx));
                if(dragSide==='right') pad.right = Math.max(0, Math.min(0.4, startPad.right + dx));
                window.App.state.expand.enabled = Object.values(pad).some(v=>v>0.01);
                draw(); if(window.App.canvas) window.App.canvas.scheduleRender();
                return;
            }
            const side=hitSide(p);
            canvas.style.cursor = side ? (side==='top'||side==='bottom'?'ns-resize':'ew-resize') : 'crosshair';
        };
        const onUp=()=>{ dragSide=null; };
        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('touchstart', onDown, {passive:false});
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive:false});
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        window.addEventListener('resize', draw);
        window.App.filtersLogic.drawExpandOverlay=draw;
    };

    // Apply expand in canvas pipeline: extend border
    window.App.filtersLogic.applyExpand=function(data,width,height){
        const ex=window.App.state && window.App.state.expand;
        if(!ex || !ex.enabled) return;
        const pad=ex.pad;
        if(!pad || Object.values(pad).every(v=>v<0.01)) return;
        // This runs per-pixel AFTER all other filters, but expanding requires resizing canvas.
        // For preview, we simulate by drawing border in-place (darken/brighten edge)
        // Real expand (increase canvas size) is handled in canvas.fitToContainer via expand pad
        // Here we just tint the expanded area if rendered at larger size — no-op for now since canvas size unchanged in preview
    };

    document.addEventListener('DOMContentLoaded', ()=> window.App.filtersLogic.initExpandUI());
})();
