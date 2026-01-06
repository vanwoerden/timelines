let dragState = null;
let justDraggedElement = null;
let isDragging = false;
let lastSnappedLeft = null;
let lastSnappedTop = null;

export function setupDragDrop(component, timeline) {
    const element = component.element;
    
    element.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('resize-handle') || 
            e.target.classList.contains('label-input')) {
            return;
        }
        
        // Select the block immediately on pointerdown (before drag logic)
        // This ensures selection happens even if drag prevents click events
        if (component.data.type === 'block') {
            timeline.selectBlock(component.data.id);
        }
        
        // Don't start drag if clicking on label - let label click handler handle editing
        if (e.target.classList.contains('label')) {
            return;
        }
        
        isDragging = false;
        justDraggedElement = null;
        e.preventDefault();
        startDrag(e, component, timeline);
    });
}

function startDrag(e, component, timeline) {
    dragState = {
        component,
        timeline,
        startX: e.clientX,
        startY: e.clientY,
        initialLeft: parseFloat(component.element.style.left) || 0,
        initialTop: parseFloat(component.element.style.top) || 0,
        initialIndex: timeline.dataModel.data.timeline.items.findIndex(
            item => item.id === component.data.id
        )
    };
    
    // Reset snap tracking
    lastSnappedLeft = null;
    lastSnappedTop = null;
    
    component.element.classList.add('dragging');
    component.element.style.zIndex = '1000';
    component.element.style.pointerEvents = 'none';
    
    document.addEventListener('pointermove', handleDragMove);
    document.addEventListener('pointerup', handleDragEnd);
}

function handleDragMove(e) {
    if (!dragState) return;
    
    const { component, timeline, startX, initialLeft, startY, initialTop } = dragState;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const newLeft = initialLeft + deltaX;
    
    // Mark as dragging if moved more than a few pixels
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        isDragging = true;
        justDraggedElement = component.element;
    }
    
    // Snap visual position to grid for better UX
    const snappedLeft = timeline.snapPixelToGrid(newLeft);
    
    // Calculate new top position based on Y movement
    const rect = timeline.container.getBoundingClientRect();
    const padding = 32; // 2rem padding
    const relativeY = e.clientY - rect.top - padding;
    const rowSpacing = timeline.config.blockHeight + timeline.config.annotationSpace;
    const targetRow = Math.max(0, Math.floor(relativeY / rowSpacing));
    const newTop = padding + (targetRow * rowSpacing);
    
    // Update visual position
    component.element.style.left = `${snappedLeft}px`;
    component.element.style.top = `${newTop}px`;
    
    // Update mask when snapped position changes
    if (snappedLeft !== lastSnappedLeft || newTop !== lastSnappedTop) {
        lastSnappedLeft = snappedLeft;
        lastSnappedTop = newTop;
        timeline.renderMask(true); // Animate mask update
    }
    
    // Find drop zone
    const dropZone = findDropZone(e.clientX, timeline);
    if (dropZone) {
        showDropZone(dropZone);
    } else {
        hideDropZone();
    }
}

function handleDragEnd(e) {
    if (!dragState) return;
    
    const { component, timeline } = dragState;
    const rect = timeline.container.getBoundingClientRect();
    const isOutside = e.clientX < rect.left || e.clientX > rect.right ||
                     e.clientY < rect.top || e.clientY > rect.bottom;
    
    // Prevent click event from firing after drag
    e.preventDefault();
    
    if (isOutside) {
        // Move to off-timeline
        timeline.dataModel.removeItem(component.data.id);
        timeline.removeItem(component.data.id);
        renderOffTimeline(timeline);
    } else {
        // Get current pixel position of the block's left edge
        const currentLeft = parseFloat(component.element.style.left) || 0;
        
        // Snap to nearest gridline
        const snappedPixel = timeline.snapPixelToGrid(currentLeft);
        
        // Convert snapped pixel position to days
        const snappedDay = timeline.pixelToDay(snappedPixel);
        
        // Calculate target row based on Y position
        const padding = 32; // 2rem padding
        const relativeY = e.clientY - rect.top - padding;
        const rowSpacing = timeline.config.blockHeight + timeline.config.annotationSpace;
        const targetRow = Math.max(0, Math.floor(relativeY / rowSpacing));
        
        // Find drop position
        const dropZone = findDropZone(e.clientX, timeline);
        if (dropZone) {
            // Update drop zone position to snapped position
            dropZone.position = snappedDay;
            handleDrop(dropZone, component, timeline, targetRow);
        } else {
            // Update block position directly to snapped position
            // Convert relative day to absolute date
            const data = component.data;
            if (data.type === 'block') {
                const absoluteDate = timeline.dataModel.getDateFromRelativeDay(snappedDay);
                timeline.dataModel.updateItem(component.data.id, {
                    startDate: absoluteDate,
                    row: targetRow
                });
            } else if (data.type === 'annotation') {
                const absoluteDate = timeline.dataModel.getDateFromRelativeDay(snappedDay);
                timeline.dataModel.updateItem(component.data.id, {
                    date: absoluteDate,
                    row: targetRow
                });
            }
            timeline.dataModel.sortTimelineItems();
            timeline.render();
        }
    }
    
    cleanupDrag();
}

function findDropZone(clientX, timeline) {
    const rect = timeline.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const items = timeline.dataModel.data.timeline.items;
    const draggedId = dragState.component.data.id;
    
    // Check if dropping between items
    for (let i = 0; i < items.length - 1; i++) {
        const current = items[i];
        const next = items[i + 1];
        
        if (current.id === draggedId || next.id === draggedId) continue;
        
        // Get relative days from absolute dates
        const currentStartDate = current.type === 'block' ? (current.startDate || timeline.dataModel.getDateFromRelativeDay(current.startDay || 0)) : (current.date || timeline.dataModel.getDateFromRelativeDay(current.day || 0));
        const currentRelativeDay = timeline.getRelativeDayFromDate(currentStartDate);
        const currentEnd = current.type === 'block' 
            ? timeline.dayToPixel(currentRelativeDay + current.duration)
            : timeline.dayToPixel(currentRelativeDay);
        
        const nextStartDate = next.type === 'block' ? (next.startDate || timeline.dataModel.getDateFromRelativeDay(next.startDay || 0)) : (next.date || timeline.dataModel.getDateFromRelativeDay(next.day || 0));
        const nextRelativeDay = timeline.getRelativeDayFromDate(nextStartDate);
        const nextStart = next.type === 'block'
            ? timeline.dayToPixel(nextRelativeDay)
            : timeline.dayToPixel(nextRelativeDay);
        
        const gapCenter = (currentEnd + nextStart) / 2;
        if (Math.abs(x - gapCenter) < 30) {
            return {
                type: 'between',
                index: i + 1,
                position: timeline.pixelToDay(gapCenter)
            };
        }
    }
    
    // Check if dropping at edges
    if (items.length > 0) {
        const first = items[0];
        const firstStartDate = first.type === 'block' ? (first.startDate || timeline.dataModel.getDateFromRelativeDay(first.startDay || 0)) : (first.date || timeline.dataModel.getDateFromRelativeDay(first.day || 0));
        const firstRelativeDay = timeline.getRelativeDayFromDate(firstStartDate);
        const firstStart = first.type === 'block'
            ? timeline.dayToPixel(firstRelativeDay)
            : timeline.dayToPixel(firstRelativeDay);
        
        if (x < firstStart && Math.abs(x - firstStart) < 50) {
            return {
                type: 'before',
                index: 0,
                position: timeline.pixelToDay(x)
            };
        }
        
        const last = items[items.length - 1];
        const lastStartDate = last.type === 'block' ? (last.startDate || timeline.dataModel.getDateFromRelativeDay(last.startDay || 0)) : (last.date || timeline.dataModel.getDateFromRelativeDay(last.day || 0));
        const lastRelativeDay = timeline.getRelativeDayFromDate(lastStartDate);
        const lastEnd = last.type === 'block'
            ? timeline.dayToPixel(lastRelativeDay + last.duration)
            : timeline.dayToPixel(lastRelativeDay);
        
        if (x > lastEnd && Math.abs(x - lastEnd) < 50) {
            return {
                type: 'after',
                index: items.length,
                position: timeline.pixelToDay(x)
            };
        }
    }
    
    return null;
}

function showDropZone(dropZone) {
    let indicator = document.querySelector('.drop-zone');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'drop-zone';
        document.querySelector('.timeline-track').appendChild(indicator);
    }
    
    const timeline = dragState.timeline;
    const position = timeline.dayToPixel(dropZone.position);
    indicator.style.left = `${position - 2}px`;
    indicator.style.width = '4px';
    indicator.classList.add('active');
}

function hideDropZone() {
    const indicator = document.querySelector('.drop-zone');
    if (indicator) {
        indicator.classList.remove('active');
    }
}

function handleDrop(dropZone, component, timeline, targetRow) {
    const draggedId = component.data.id;
    const currentIndex = timeline.dataModel.data.timeline.items.findIndex(
        item => item.id === draggedId
    );
    
    if (currentIndex === -1) return;
    
    // Remove from current position
    const [item] = timeline.dataModel.data.timeline.items.splice(currentIndex, 1);
    
    // Calculate new position - convert relative day to absolute date
    const newPosition = dropZone.position;
    const absoluteDate = timeline.dataModel.getDateFromRelativeDay(newPosition);
    if (item.type === 'block') {
        item.startDate = absoluteDate;
        if (targetRow !== undefined) {
            item.row = targetRow;
        }
        // Remove old startDay if it exists
        delete item.startDay;
    } else if (item.type === 'annotation') {
        item.date = absoluteDate;
        if (targetRow !== undefined) {
            item.row = targetRow;
        }
        // Remove old day if it exists
        delete item.day;
    }
    
    // Insert at new position
    let insertIndex = dropZone.index;
    if (currentIndex < insertIndex) {
        insertIndex--;
    }
    timeline.dataModel.data.timeline.items.splice(insertIndex, 0, item);
    timeline.dataModel.sortTimelineItems();
    
    // Animate to new position
    timeline.render();
}

function snapBack(component, timeline) {
    const data = component.data;
    // Get relative day from absolute date
    const startDate = data.type === 'block' 
        ? (data.startDate || timeline.dataModel.getDateFromRelativeDay(data.startDay || 0))
        : (data.date || timeline.dataModel.getDateFromRelativeDay(data.day || 0));
    const relativeDay = timeline.getRelativeDayFromDate(startDate);
    const position = timeline.dayToPixel(relativeDay);
    
    gsap.to(component.element, {
        left: `${position}px`,
        duration: 0.3,
        ease: 'power2.out'
    });
}

function cleanupDrag() {
    const wasDragging = isDragging;
    const draggedElement = justDraggedElement;
    
    if (dragState) {
        dragState.component.element.classList.remove('dragging');
        dragState.component.element.style.zIndex = '';
        dragState.component.element.style.pointerEvents = '';
        
        // Update mask after drag ends
        if (dragState.timeline) {
            dragState.timeline.renderMask(true);
        }
        
        // Add a one-time click handler to prevent click after drag
        if (wasDragging && draggedElement) {
            const preventClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                draggedElement.removeEventListener('click', preventClick, true);
            };
            // Use capture phase to catch the event early
            draggedElement.addEventListener('click', preventClick, true);
            // Also prevent on container
            const container = dragState.timeline.container;
            const preventContainerClick = (e) => {
                if (e.target === draggedElement || e.target.closest('.timeline-block') === draggedElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    container.removeEventListener('click', preventContainerClick, true);
                }
            };
            container.addEventListener('click', preventContainerClick, true);
        }
        
        dragState = null;
    }
    
    // Reset snap tracking
    lastSnappedLeft = null;
    lastSnappedTop = null;
    
    hideDropZone();
    document.removeEventListener('pointermove', handleDragMove);
    document.removeEventListener('pointerup', handleDragEnd);
    
    // Clear the drag flags after a short delay to prevent click event
    if (wasDragging || draggedElement) {
        setTimeout(() => {
            isDragging = false;
            justDraggedElement = null;
        }, 300);
    } else {
        isDragging = false;
        justDraggedElement = null;
    }
}

export function wasJustDragging(element) {
    return justDraggedElement === element;
}

export function isCurrentlyDragging() {
    return isDragging;
}

export function renderOffTimeline(timeline) {
    // Off-timeline functionality has been removed
    // This function is kept for compatibility but does nothing
}

