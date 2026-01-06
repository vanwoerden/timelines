let resizeState = null;
const gsap = window.gsap;
let resizeMaskUpdateFrame = null;

/**
 * Find all blocks in the same row that are positioned to the right of the resized block
 * @param {Object} resizedBlock - The block component being resized
 * @param {Object} timeline - The timeline instance
 * @returns {Array} Array of { component, initialStartDay, initialLeft } objects
 */
function findBlocksToRight(resizedBlock, timeline) {
    const resizedData = resizedBlock.data;
    const resizedRow = resizedData.row || 0;
    
    // Get relative day from absolute date for resized block
    const resizedStartDate = resizedData.startDate || timeline.dataModel.getDateFromRelativeDay(resizedData.startDay || 0);
    const resizedRelativeDay = timeline.getRelativeDayFromDate(resizedStartDate);
    const resizedRightEdge = resizedRelativeDay + resizedData.duration;
    
    const blocksToPush = [];
    
    // Iterate through all timeline items
    timeline.dataModel.data.timeline.items.forEach((item) => {
        // Only process blocks in the same row
        if (item.type === 'block' && item.id !== resizedData.id && (item.row || 0) === resizedRow) {
            // Get relative day from absolute date for this block
            const itemStartDate = item.startDate || timeline.dataModel.getDateFromRelativeDay(item.startDay || 0);
            const itemRelativeDay = timeline.getRelativeDayFromDate(itemStartDate);
            
            // Check if block is to the right of the resized block's right edge
            if (itemRelativeDay >= resizedRightEdge) {
                const component = timeline.items.get(item.id);
                if (component) {
                    const initialLeft = parseFloat(component.element.style.left) || timeline.dayToPixel(itemRelativeDay);
                    blocksToPush.push({
                        component,
                        initialStartDate: itemStartDate, // Store absolute date
                        initialRelativeDay: itemRelativeDay, // Store relative day for calculations
                        initialLeft
                    });
                }
            }
        }
    });
    
    return blocksToPush;
}

export function setupResize(component, timeline) {
    if (component.data.type !== 'block') return;
    
    const resizeHandle = component.element.querySelector('.resize-handle');
    if (!resizeHandle) return;
    
    resizeHandle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        startResize(e, component, timeline);
    });
}

function startResize(e, component, timeline) {
    const rect = component.element.getBoundingClientRect();
    const initialWidth = rect.width;
    const startX = e.clientX;
    const initialLeft = parseFloat(component.element.style.left) || 0;
    
    // Get relative day from absolute date
    const startDate = component.data.startDate || timeline.dataModel.getDateFromRelativeDay(component.data.startDay || 0);
    const initialRelativeDay = timeline.getRelativeDayFromDate(startDate);
    const initialRightEdge = initialRelativeDay + component.data.duration;
    
    // Find all blocks in the same row that are to the right
    const blocksToPush = findBlocksToRight(component, timeline);
    
    resizeState = {
        component,
        timeline,
        startX,
        initialWidth,
        initialDuration: component.data.duration,
        initialLeft,
        initialRightEdge,
        initialRelativeDay,
        blocksToPush
    };
    
    // Add resizing class to exclude from mask
    component.element.classList.add('resizing');
    
    component.element.style.cursor = 'ew-resize';
    document.addEventListener('pointermove', handleResizeMove);
    document.addEventListener('pointerup', handleResizeEnd);
}

function handleResizeMove(e) {
    if (!resizeState) return;
    
    const { component, timeline, startX, initialWidth, blocksToPush } = resizeState;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(timeline.dayToPixel(1), initialWidth + deltaX);
    const deltaWidth = newWidth - initialWidth;
    
    // Update visual width of resized block
    component.element.style.width = `${newWidth}px`;
    
    // Push blocks to the right visually
    blocksToPush.forEach(({ component: blockComponent, initialLeft }) => {
        const newLeft = initialLeft + deltaWidth;
        blockComponent.element.style.left = `${newLeft}px`;
    });
    
    // Update mask during resize (throttled with requestAnimationFrame)
    if (resizeMaskUpdateFrame === null) {
        resizeMaskUpdateFrame = requestAnimationFrame(() => {
            timeline.renderMask(true); // Animate mask update
            resizeMaskUpdateFrame = null;
        });
    }
}

function handleResizeEnd(e) {
    if (!resizeState) return;
    
    const { component, timeline, startX, initialWidth, initialDuration, initialLeft, initialRelativeDay, blocksToPush } = resizeState;
    const deltaX = e.clientX - startX;
    // Calculate minimum width for 1 day starting from the initial day
    const minWidth = timeline.dayToPixelForDuration(initialRelativeDay, 1);
    const newWidth = Math.max(minWidth, initialWidth + deltaX);
    
    // Convert to days: calculate end day based on start position + width
    const startDay = initialRelativeDay;
    const endDay = timeline.pixelToDay(initialLeft + newWidth);
    const newDuration = Math.max(1, endDay - startDay);
    const snappedDuration = newDuration;
    
    // Calculate the delta in days
    const deltaDays = snappedDuration - initialDuration;
    
    // Update resized block's duration in data model
    timeline.dataModel.updateItem(component.data.id, {
        duration: snappedDuration
    });
    
    // Update all pushed blocks' startDate in data model
    blocksToPush.forEach(({ component: blockComponent, initialStartDate, initialRelativeDay }) => {
        const newRelativeDay = initialRelativeDay + deltaDays;
        const newStartDate = timeline.dataModel.getDateFromRelativeDay(newRelativeDay);
        timeline.dataModel.updateItem(blockComponent.data.id, {
            startDate: newStartDate
        });
    });
    
    // Animate to snapped width for resized block
    // Calculate width by summing actual day widths from start day
    const snappedWidth = timeline.dayToPixelForDuration(initialRelativeDay, snappedDuration);
    gsap.to(component.element, {
        width: `${snappedWidth}px`,
        duration: 0.2,
        ease: 'power2.out'
    });
    
    // Animate pushed blocks to their final positions
    blocksToPush.forEach(({ component: blockComponent, initialRelativeDay }) => {
        const newRelativeDay = initialRelativeDay + deltaDays;
        const finalLeft = timeline.dayToPixel(newRelativeDay);
        gsap.to(blockComponent.element, {
            left: `${finalLeft}px`,
            duration: 0.2,
            ease: 'power2.out'
        });
    });
    
    // Update mask after resize completes (with animation)
    gsap.delayedCall(0.2, () => {
        timeline.renderMask(true);
    });
    
    cleanupResize();
}

function cleanupResize() {
    if (resizeState) {
        // Remove resizing class
        resizeState.component.element.classList.remove('resizing');
        resizeState.component.element.style.cursor = '';
        resizeState = null;
    }
    
    // Cancel pending mask update if any
    if (resizeMaskUpdateFrame !== null) {
        cancelAnimationFrame(resizeMaskUpdateFrame);
        resizeMaskUpdateFrame = null;
    }
    
    document.removeEventListener('pointermove', handleResizeMove);
    document.removeEventListener('pointerup', handleResizeEnd);
}

