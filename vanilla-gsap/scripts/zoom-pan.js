export function setupZoomPan(timeline) {
    const container = timeline.container.parentElement;
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const zoomLevel = document.getElementById('zoomLevel');
    
    // Button controls
    zoomInBtn.addEventListener('click', () => {
        timeline.setZoom(timeline.zoom * 1.2);
        updateZoomDisplay(zoomLevel, timeline.zoom);
    });
    
    zoomOutBtn.addEventListener('click', () => {
        timeline.setZoom(timeline.zoom / 1.2);
        updateZoomDisplay(zoomLevel, timeline.zoom);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === '+' || e.key === '=') {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                timeline.setZoom(timeline.zoom * 1.2);
                updateZoomDisplay(zoomLevel, timeline.zoom);
            }
        } else if (e.key === '-') {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                timeline.setZoom(timeline.zoom / 1.2);
                updateZoomDisplay(zoomLevel, timeline.zoom);
            }
        }
    });
    
    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            timeline.setZoom(timeline.zoom * delta);
            updateZoomDisplay(zoomLevel, timeline.zoom);
        }
    });
    
    // Click and drag to zoom area (simplified - just zoom in)
    let isSelecting = false;
    let selectStart = null;
    
    container.addEventListener('mousedown', (e) => {
        if (e.shiftKey && e.button === 0) {
            isSelecting = true;
            const rect = container.getBoundingClientRect();
            selectStart = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            e.preventDefault();
        }
    });
    
    container.addEventListener('mousemove', (e) => {
        if (isSelecting && selectStart) {
            // Could show selection rectangle here
        }
    });
    
    container.addEventListener('mouseup', (e) => {
        if (isSelecting && selectStart) {
            const rect = container.getBoundingClientRect();
            const selectEnd = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            const width = Math.abs(selectEnd.x - selectStart.x);
            if (width > 20) {
                // Zoom to selection (simplified - just zoom in)
                timeline.setZoom(timeline.zoom * 1.5);
                updateZoomDisplay(zoomLevel, timeline.zoom);
            }
            
            isSelecting = false;
            selectStart = null;
        }
    });
    
    // Initial zoom display
    updateZoomDisplay(zoomLevel, timeline.zoom);
}

function updateZoomDisplay(element, zoom) {
    element.textContent = `${Math.round(zoom * 100)}%`;
}

