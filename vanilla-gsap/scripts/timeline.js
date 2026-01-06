import { Block } from './block.js';
import { Annotation } from './annotation.js';
import { renderOffTimeline, wasJustDragging, isCurrentlyDragging } from './drag-drop.js';

export class Timeline {
    constructor(container, dataModel, config = {}) {
        this.container = container;
        this.timelineTrack = container; // The container is the timeline track
        this.dataModel = dataModel;
        this.config = {
            dayWidth: 80,
            weekWidth: 280,
            blockHeight: 80,
            annotationSpace: 40, // Space reserved below each row for annotations
            maskPadding: 40, // Padding around blocks/annotations for mask
            maskFeather: 20, // Blur amount for feathering
            maskAnimationDuration: 0.05, // Animation duration for mask updates (50ms for snappy response)
            maskAnimationEase: 'power2.out', // GSAP easing function
            ...config
        };
        
        this.zoom = 1.0;
        this.items = new Map();
        this.insertButtons = [];
        this.selectedBlockId = null;
        this.selectedAnnotationId = null;
        this.mousedownPosition = null;
        this.annotationHoverIndicator = null;
        this.hoverDateLabel = null; // Hover date label that follows mouse (deprecated - will be removed)
        this.hoverDateLabelMoveHandler = null; // Store mousemove handler reference
        this.hoverDateLabelLeaveHandler = null; // Store mouseleave handler reference
        this.tempBlockElement = null; // Temporary block during drag creation
        this.isDraggingBlock = false; // Track if we're in drag creation mode
        
        // Date label map for hover functionality
        this.dateLabelMap = new Map(); // Map of day number to label element
        this.currentVisibleLabel = null; // Currently visible hover label
        
        // Mask state
        this.maskElement = null; // SVG mask element
        this.maskRectElements = new Map(); // Map of item ID to SVG rect element
        this.previousSnappedPositions = null; // Track snapped positions during block creation
        this.cachedMaskBounds = null; // Cache previous mask bounds to avoid unnecessary updates
        
        this.setupEventListeners();
        this.setupKeyboardListeners();
        this.setupAnnotationHover();
        this.setupHoverDateLabel();
        this.setupScrollListener();
    }
    
    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            // Don't handle shortcuts when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || 
                e.target.classList.contains('label-input') || 
                e.target.classList.contains('annotation-input')) {
                // Allow Enter to work in inputs, but prevent other shortcuts
                if (e.key === 'Enter' && (e.target.classList.contains('label-input') || e.target.classList.contains('annotation-input'))) {
                    return; // Let the input handle Enter
                }
                if (e.key !== 'Escape') {
                    return; // Only allow Escape to work in inputs
                }
            }
            
            // N - Create new block to the right of rightmost block
            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                const rightmost = this.findRightmostBlock();
                let newBlock;
                if (rightmost) {
                    const startDate = rightmost.startDate || this.dataModel.getDateFromRelativeDay(rightmost.startDay || 0);
                    const relativeDay = this.getRelativeDayFromDate(startDate);
                    const newRelativeDay = relativeDay + rightmost.duration;
                    const newDate = this.dataModel.getDateFromRelativeDay(newRelativeDay);
                    newBlock = this.dataModel.addBlock(newDate, 5, '', rightmost.row || 0);
                    this.render();
                    this.selectBlock(newBlock.id);
                } else {
                    // No blocks exist, create at day 0, row 0
                    const startDate = this.dataModel.getStartDate();
                    const newDate = startDate.toISOString().split('T')[0];
                    newBlock = this.dataModel.addBlock(newDate, 5, '', 0);
                    this.render();
                    this.selectBlock(newBlock.id);
                }
                
                // Enter edit mode for the new block
                requestAnimationFrame(() => {
                    const block = this.items.get(newBlock.id);
                    if (block && !block.isEditing) {
                        block.startEditing();
                    }
                });
                
                return;
            }
            
            // TAB - Select next block
            if (e.key === 'Tab') {
                e.preventDefault();
                const sortedBlocks = this.getAllBlocksSorted();
                if (sortedBlocks.length === 0) {
                    return;
                }
                
                if (this.selectedBlockId) {
                    const nextId = this.findNextBlock(this.selectedBlockId);
                    if (nextId) {
                        this.selectBlock(nextId);
                    }
                } else {
                    // No selection, select first block
                    this.selectBlock(sortedBlocks[0].id);
                }
                return;
            }
            
            // DELETE - Delete selected block or annotation
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedBlockId) {
                    e.preventDefault();
                    this.deleteSelectedBlock();
                } else if (this.selectedAnnotationId) {
                    e.preventDefault();
                    this.deleteSelectedAnnotation();
                }
                return;
            }
            
            // ENTER - Edit label of selected block
            if (e.key === 'Enter') {
                if (this.selectedBlockId) {
                    const block = this.items.get(this.selectedBlockId);
                    if (block && !block.isEditing) {
                        e.preventDefault();
                        block.startEditing();
                    }
                }
                return;
            }
            
            // +/- - Increase/decrease block duration by 1 day
            if (e.key === '+' || e.key === '=') {
                if (this.selectedBlockId) {
                    e.preventDefault();
                    const block = this.dataModel.getItem(this.selectedBlockId);
                    if (block && block.type === 'block') {
                        const newDuration = block.duration + 1;
                        this.dataModel.updateItem(block.id, { duration: newDuration });
                        const blockComponent = this.items.get(block.id);
                        if (blockComponent) {
                            blockComponent.update(this.dataModel.getItem(block.id));
                        }
                        this.render();
                    }
                }
                return;
            }
            
            if (e.key === '-' || e.key === '_') {
                if (this.selectedBlockId) {
                    e.preventDefault();
                    const block = this.dataModel.getItem(this.selectedBlockId);
                    if (block && block.type === 'block' && block.duration > 1) {
                        const newDuration = block.duration - 1;
                        this.dataModel.updateItem(block.id, { duration: newDuration });
                        const blockComponent = this.items.get(block.id);
                        if (blockComponent) {
                            blockComponent.update(this.dataModel.getItem(block.id));
                        }
                        this.render();
                    }
                }
                return;
            }
            
            // A - Create annotation at selected block's position
            if (e.key === 'a' || e.key === 'A') {
                if (this.selectedBlockId) {
                    e.preventDefault();
                    const block = this.dataModel.getItem(this.selectedBlockId);
                    if (block && block.type === 'block') {
                        const startDate = block.startDate || this.dataModel.getDateFromRelativeDay(block.startDay || 0);
                        const row = block.row || 0;
                        const annotation = this.dataModel.addAnnotation(startDate, row, '');
                        this.render();
                        // Start editing the annotation immediately
                        requestAnimationFrame(() => {
                            const annotationComponent = this.items.get(annotation.id);
                            if (annotationComponent) {
                                this.selectAnnotation(annotation.id);
                                annotationComponent.startEditing();
                            }
                        });
                    }
                }
                return;
            }
            
            // Arrow keys - Move selected block/annotation
            if (e.key === 'ArrowLeft') {
                if (this.selectedBlockId || this.selectedAnnotationId) {
                    e.preventDefault();
                    this.moveSelectedItem(-1, 0);
                }
                return;
            }
            
            if (e.key === 'ArrowRight') {
                if (this.selectedBlockId || this.selectedAnnotationId) {
                    e.preventDefault();
                    this.moveSelectedItem(1, 0);
                }
                return;
            }
            
            if (e.key === 'ArrowUp') {
                if (this.selectedBlockId || this.selectedAnnotationId) {
                    e.preventDefault();
                    this.moveSelectedItem(0, -1);
                }
                return;
            }
            
            if (e.key === 'ArrowDown') {
                if (this.selectedBlockId || this.selectedAnnotationId) {
                    e.preventDefault();
                    this.moveSelectedItem(0, 1);
                }
                return;
            }
        });
    }
    
    setupScrollListener() {
        const parentContainer = this.container.parentElement;
        if (!parentContainer) return;
        
        let scrollTimeout;
        parentContainer.addEventListener('scroll', () => {
            // Debounce to avoid excessive re-renders
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                // Only re-render grid elements, not all items
                const containerHeight = this.container.offsetHeight || parseInt(this.container.style.height) || 600;
                // Don't update width on scroll - it should be based on actual content, not viewport
                // Width is set in render() based on content, and should stay constant
                // Only re-render grid elements that need updating
                this.renderGridlines(containerHeight);
                this.renderWeekends(containerHeight);
                // Don't re-render date labels on scroll - they should stay fixed
                // this.renderDateLabels(); // Removed - labels should not change on scroll
            }, 100);
        });
    }
    
    selectBlock(blockId) {
        // Deselect previous block
        if (this.selectedBlockId) {
            const prevBlock = this.items.get(this.selectedBlockId);
            if (prevBlock) {
                prevBlock.element.classList.remove('selected');
            }
        }
        
        // Deselect any selected annotation
        if (this.selectedAnnotationId) {
            const prevAnnotation = this.items.get(this.selectedAnnotationId);
            if (prevAnnotation) {
                prevAnnotation.element.classList.remove('selected');
            }
            this.selectedAnnotationId = null;
        }
        
        // Select new
        this.selectedBlockId = blockId;
        if (blockId) {
            const block = this.items.get(blockId);
            if (block) {
                block.element.classList.add('selected');
                // Scroll block into view
                this.scrollBlockIntoView(blockId);
            }
        }
    }
    
    selectAnnotation(annotationId) {
        // Deselect previous annotation
        if (this.selectedAnnotationId) {
            const prevAnnotation = this.items.get(this.selectedAnnotationId);
            if (prevAnnotation) {
                prevAnnotation.element.classList.remove('selected');
            }
        }
        
        // Deselect any selected block
        if (this.selectedBlockId) {
            const prevBlock = this.items.get(this.selectedBlockId);
            if (prevBlock) {
                prevBlock.element.classList.remove('selected');
            }
            this.selectedBlockId = null;
        }
        
        // Select new
        this.selectedAnnotationId = annotationId;
        if (annotationId) {
            const annotation = this.items.get(annotationId);
            if (annotation) {
                annotation.element.classList.add('selected');
                // Scroll annotation into view
                this.scrollBlockIntoView(annotationId);
            }
        }
    }
    
    scrollBlockIntoView(itemId) {
        const item = this.items.get(itemId);
        if (!item) return;
        
        const parentContainer = this.container.parentElement;
        if (!parentContainer) return;
        
        const itemRect = item.element.getBoundingClientRect();
        const containerRect = parentContainer.getBoundingClientRect();
        
        // Check if item is outside viewport
        const isOutside = itemRect.left < containerRect.left || 
                         itemRect.right > containerRect.right ||
                         itemRect.top < containerRect.top ||
                         itemRect.bottom > containerRect.bottom;
        
        if (isOutside) {
            // Scroll to center the item in viewport
            const itemLeft = parseFloat(item.element.style.left) || 0;
            const viewportWidth = parentContainer.clientWidth;
            const targetScroll = itemLeft - (viewportWidth / 2);
            
            parentContainer.scrollTo({
                left: Math.max(0, targetScroll),
                behavior: 'smooth'
            });
            
            // The scroll listener will handle grid updates if needed
            // No need to call render() here as it clears and re-renders everything
        }
    }
    
    deleteSelectedBlock() {
        if (this.selectedBlockId) {
            // Find next block in tab order before deleting
            const nextBlockId = this.findNextBlock(this.selectedBlockId);
            const deletedBlockId = this.selectedBlockId;
            
            // Delete the block
            this.dataModel.removeItem(this.selectedBlockId);
            this.removeItem(this.selectedBlockId);
            this.selectedBlockId = null;
            renderOffTimeline(this);
            
            // Select next block if it exists and is different from the deleted one
            if (nextBlockId && nextBlockId !== deletedBlockId) {
                // Check if the next block still exists (it might be the same one if it was the only block)
                const nextBlock = this.dataModel.getItem(nextBlockId);
                if (nextBlock) {
                    this.selectBlock(nextBlockId);
                } else {
                    // Next block doesn't exist, try to select first available block
                    const sortedBlocks = this.getAllBlocksSorted();
                    if (sortedBlocks.length > 0) {
                        this.selectBlock(sortedBlocks[0].id);
                    }
                }
            } else {
                // No next block, try to select first available block
                const sortedBlocks = this.getAllBlocksSorted();
                if (sortedBlocks.length > 0) {
                    this.selectBlock(sortedBlocks[0].id);
                }
            }
        }
    }
    
    deleteSelectedAnnotation() {
        if (this.selectedAnnotationId) {
            this.dataModel.removeAnnotation(this.selectedAnnotationId);
            this.removeItem(this.selectedAnnotationId);
            this.selectedAnnotationId = null;
            this.render();
        }
    }
    
    findRightmostBlock() {
        let rightmost = null;
        let rightmostEnd = -1;
        
        this.dataModel.data.timeline.items.forEach(item => {
            if (item.type === 'block') {
                const startDate = item.startDate;
                const relativeDay = this.getRelativeDayFromDate(startDate);
                const endDay = relativeDay + item.duration;
                if (endDay > rightmostEnd) {
                    rightmostEnd = endDay;
                    rightmost = item;
                }
            }
        });
        return rightmost;
    }
    
    getAllBlocksSorted() {
        const blocks = this.dataModel.data.timeline.items.filter(item => item.type === 'block');
        return blocks.sort((a, b) => {
            // First sort by row
            const rowA = a.row || 0;
            const rowB = b.row || 0;
            if (rowA !== rowB) {
                return rowA - rowB;
            }
            // Then sort by startDate
            const dateA = a.startDate || this.dataModel.getDateFromRelativeDay(a.startDay || 0);
            const dateB = b.startDate || this.dataModel.getDateFromRelativeDay(b.startDay || 0);
            return dateA.localeCompare(dateB);
        });
    }
    
    findNextBlock(currentBlockId) {
        const sortedBlocks = this.getAllBlocksSorted();
        if (sortedBlocks.length === 0) {
            return null;
        }
        
        // Find current block index
        const currentIndex = sortedBlocks.findIndex(block => block.id === currentBlockId);
        
        if (currentIndex === -1) {
            // Current block not found, return first block
            return sortedBlocks[0].id;
        }
        
        // Find next block in same row
        const currentBlock = sortedBlocks[currentIndex];
        const currentRow = currentBlock.row || 0;
        
        for (let i = currentIndex + 1; i < sortedBlocks.length; i++) {
            if ((sortedBlocks[i].row || 0) === currentRow) {
                return sortedBlocks[i].id;
            }
        }
        
        // No more blocks in current row, find first block in next row
        for (let i = 0; i < sortedBlocks.length; i++) {
            if ((sortedBlocks[i].row || 0) > currentRow) {
                return sortedBlocks[i].id;
            }
        }
        
        // Last block, wrap to first
        return sortedBlocks[0].id;
    }
    
    moveSelectedItem(deltaDays, deltaRow) {
        // Move block
        if (this.selectedBlockId) {
            const block = this.dataModel.getItem(this.selectedBlockId);
            if (block && block.type === 'block') {
                const startDate = block.startDate || this.dataModel.getDateFromRelativeDay(block.startDay || 0);
                const relativeDay = this.getRelativeDayFromDate(startDate);
                const newRelativeDay = Math.max(0, relativeDay + deltaDays);
                const newDate = this.dataModel.getDateFromRelativeDay(newRelativeDay);
                const newRow = Math.max(0, (block.row || 0) + deltaRow);
                
                this.dataModel.updateItem(block.id, {
                    startDate: newDate,
                    row: newRow
                });
                
                const blockComponent = this.items.get(block.id);
                if (blockComponent) {
                    blockComponent.update(this.dataModel.getItem(block.id));
                }
                this.render();
            }
        }
        // Move annotation
        else if (this.selectedAnnotationId) {
            const annotation = this.dataModel.data.timeline.annotations.find(a => a.id === this.selectedAnnotationId);
            if (annotation) {
                const date = annotation.date || this.dataModel.getDateFromRelativeDay(annotation.day || 0);
                const relativeDay = this.getRelativeDayFromDate(date);
                const newRelativeDay = Math.max(0, relativeDay + deltaDays);
                const newDate = this.dataModel.getDateFromRelativeDay(newRelativeDay);
                const newRow = Math.max(0, (annotation.row || 0) + deltaRow);
                
                this.dataModel.updateItem(annotation.id, {
                    date: newDate,
                    row: newRow
                });
                
                const annotationComponent = this.items.get(annotation.id);
                if (annotationComponent) {
                    annotationComponent.update(this.dataModel.data.timeline.annotations.find(a => a.id === annotation.id));
                }
                this.render();
            }
        }
    }
    
    setupEventListeners() {
        // Handle mousedown on timeline track to create blocks
        // Use mousedown instead of click to avoid conflicts with drag operations
        this.container.addEventListener('mousedown', (e) => {
            console.log('mousedown event fired', e.target, 'container:', this.container);
            
            // FIRST: Check if we're currently dragging (but don't block if false)
            // Only skip if we're actually in the middle of a drag operation
            if (isCurrentlyDragging && isCurrentlyDragging()) {
                console.log('Currently dragging, skipping');
                return;
            }
            
            // SECOND: Comprehensive block detection - check multiple conditions FIRST
            // Skip if target is a tooltip (which has pointer-events: none but might still be detected)
            if (e.target.classList.contains('annotation-tooltip')) {
                return;
            }
            // Check if target itself is a block
            const isBlockElement = e.target.classList.contains('timeline-block');
            // Check if target is inside a block
            const clickedBlock = e.target.closest('.timeline-block');
            // Also check if clicking on annotation
            const clickedAnnotation = e.target.closest('.annotation');
            
            if (isBlockElement || clickedBlock || clickedAnnotation) {
                // Block or annotation detected - don't create new block
                // Block handlers will handle selection/editing via click events
                // Don't set up mouseup handler at all
                return;
            }
            
            // THIRD: Don't handle mousedown on interactive elements
            if (e.target.classList.contains('label-input') || 
                e.target.classList.contains('resize-handle') ||
                e.target.classList.contains('timeline-block-badge') ||
                e.target.closest('.timeline-block-badge')) {
                return;
            }
            
            // Note: date-label and weekend-day have pointer-events: none in CSS
            // so they won't block clicks, but we don't need to check for them here
            
            // FOURTH: Handle insert buttons
            if (e.target.classList.contains('insert-button')) {
                const position = parseFloat(e.target.dataset.position);
                const type = e.target.dataset.type;
                this.handleInsertClick(position, type);
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // Check if clicking on annotation hover indicator
            if (e.target.closest('.annotation-hover-indicator') || 
                e.target.closest('.annotation-hover-circle')) {
                // Let annotation click handler handle this
                return;
            }
            
            // FIFTH: Track mousedown position for drag detection
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Check if click is near annotation hover indicator
            if (this.isNearAnnotationHoverIndicator(x, y)) {
                // Too close to annotation hover indicator, skip block creation
                return;
            }
            
            // Only proceed if clicking in the main track area
            if (y < 0) {
                return;
            }
            
            // Store mousedown position
            this.mousedownPosition = { x, y, clientX: e.clientX, clientY: e.clientY };
            
            // SIXTH: Set up handlers to handle drag-to-resize during creation
            const handleMouseMove = (moveEvent) => {
                if (!this.mousedownPosition) return;
                
                const rect = this.container.getBoundingClientRect();
                const currentX = moveEvent.clientX - rect.left;
                const currentY = moveEvent.clientY - rect.top;
                
                // Calculate movement
                const deltaX = Math.abs(moveEvent.clientX - this.mousedownPosition.clientX);
                const deltaY = Math.abs(moveEvent.clientY - this.mousedownPosition.clientY);
                
                // If mouse moved significantly, enter drag creation mode
                if (deltaX > 5 || deltaY > 5) {
                    this.isDraggingBlock = true;
                    
                    // Hide annotation hover indicator during block drag creation
                    this.hideAnnotationHoverIndicator();
                    
                    // Calculate block dimensions with snapping to gridlines
                    const startX = this.mousedownPosition.x;
                    // Snap left edge to nearest gridline
                    const snappedLeft = this.snapPixelToGrid(Math.min(startX, currentX));
                    // Snap right edge to closest gridline, preferring right when it's closer
                    const snappedRight = this.snapPixelToGridPreferRight(Math.max(startX, currentX));
                    // Ensure minimum width of 1 day
                    const minWidth = this.dayToPixel(1);
                    const width = Math.max(minWidth, snappedRight - snappedLeft);
                    const left = snappedLeft;
                    
                    // Calculate row
                    const padding = 32;
                    const relativeY = this.mousedownPosition.y - padding;
                    const rowSpacing = this.config.blockHeight + this.config.annotationSpace;
                    const row = Math.max(0, Math.floor(relativeY / rowSpacing));
                    const top = padding + (row * rowSpacing);
                    
                    // Check if snapped position changed (snap event)
                    const currentSnappedPositions = { left: snappedLeft, right: snappedRight, top: top };
                    const snapChanged = !this.previousSnappedPositions || 
                        this.previousSnappedPositions.left !== snappedLeft ||
                        this.previousSnappedPositions.right !== snappedRight ||
                        this.previousSnappedPositions.top !== top;
                    
                    // Initialize previous positions if this is the first drag
                    if (!this.previousSnappedPositions) {
                        this.previousSnappedPositions = currentSnappedPositions;
                    }
                    
                    // Create or update temporary block
                    if (!this.tempBlockElement) {
                        this.tempBlockElement = document.createElement('div');
                        this.tempBlockElement.className = 'timeline-block temp-block';
                        this.tempBlockElement.style.position = 'absolute';
                        this.tempBlockElement.style.opacity = '0.6';
                        // Border style is handled by .temp-block CSS class
                        this.tempBlockElement.style.pointerEvents = 'none';
                        this.tempBlockElement.style.zIndex = '10';
                        
                        const label = document.createElement('div');
                        label.className = 'label';
                        label.textContent = 'New Block';
                        this.tempBlockElement.appendChild(label);
                        
                        this.container.appendChild(this.tempBlockElement);
                        
                        // Update mask when temporary block is first created
                        requestAnimationFrame(() => {
                            this.renderMask(true); // Animate mask update
                        });
                    }
                    
                    // Update temporary block position and size
                    this.tempBlockElement.style.left = `${left}px`;
                    this.tempBlockElement.style.top = `${top}px`;
                    this.tempBlockElement.style.width = `${width}px`;
                    this.tempBlockElement.style.height = `${this.config.blockHeight}px`;
                    
                    // Update mask if snapped position changed (snap event)
                    if (snapChanged) {
                        this.previousSnappedPositions = currentSnappedPositions;
                        // Use requestAnimationFrame to ensure DOM is updated before mask calculation
                        requestAnimationFrame(() => {
                            this.renderMask(true); // Animate mask update
                        });
                    }
                }
            };
            
            const handleMouseUp = (upEvent) => {
                if (!this.mousedownPosition) {
                    cleanup();
                    return;
                }
                
                // Check if mouseup is on a block - don't create block if so
                const upTarget = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
                if (upTarget && (upTarget.classList.contains('timeline-block') || upTarget.closest('.timeline-block'))) {
                    cleanup();
                    return;
                }
                
                // Check if mouseup is on annotation hover indicator
                if (upTarget && (upTarget.closest('.annotation-hover-indicator') || upTarget.closest('.annotation-hover-circle'))) {
                    cleanup();
                    return;
                }
                
                // Check if mouseup position is near annotation hover indicator
                const rect = this.container.getBoundingClientRect();
                const upX = upEvent.clientX - rect.left;
                const upY = upEvent.clientY - rect.top;
                if (this.isNearAnnotationHoverIndicator(upX, upY)) {
                    cleanup();
                    return;
                }
                
                // Check if mouse moved (might have been a small drag)
                const deltaX = Math.abs(upEvent.clientX - this.mousedownPosition.clientX);
                const deltaY = Math.abs(upEvent.clientY - this.mousedownPosition.clientY);
                
                // Calculate row
                const padding = 32; // 2rem padding
                const relativeY = this.mousedownPosition.y - padding;
                const rowSpacing = this.config.blockHeight + this.config.annotationSpace;
                const row = Math.max(0, Math.floor(relativeY / rowSpacing));
                
                // Clean up temporary block if it exists
                if (this.tempBlockElement) {
                    this.tempBlockElement.remove();
                    this.tempBlockElement = null;
                }
                
                if (deltaX <= 5 && deltaY <= 5 && !this.isDraggingBlock) {
                    // Single click - create block with 1-day duration
                    const day = this.pixelToDay(this.mousedownPosition.x);
                    const newBlock = this.dataModel.addBlock(day, 1, '', row);
                    this.render();
                    // Select and start editing the newly created block
                    setTimeout(() => {
                        const block = this.items.get(newBlock.id);
                        if (block) {
                            this.selectBlock(newBlock.id);
                            block.startEditing();
                        }
                    }, 0);
                } else if (this.isDraggingBlock) {
                    // Drag creation - calculate width from drag with snapping to gridlines
                    const rect = this.container.getBoundingClientRect();
                    const upX = upEvent.clientX - rect.left;
                    const startX = this.mousedownPosition.x;
                    
                    // Snap left edge to nearest gridline
                    const snappedLeft = this.snapPixelToGrid(Math.min(startX, upX));
                    // Snap right edge to closest gridline, preferring right when it's closer
                    const snappedRight = this.snapPixelToGridPreferRight(Math.max(startX, upX));
                    
                    // Ensure minimum width of 1 day
                    const minWidth = this.dayToPixel(1);
                    const width = Math.max(minWidth, snappedRight - snappedLeft);
                    
                    // Convert snapped positions to days
                    const startDay = this.pixelToDay(snappedLeft);
                    const endDay = this.pixelToDay(snappedLeft + width);
                    const duration = Math.max(1, endDay - startDay);
                    const day = startDay;
                    
                    // Create the block
                    const newBlock = this.dataModel.addBlock(day, duration, '', row);
                    this.render();
                    // Select and start editing the newly created block
                    setTimeout(() => {
                        const block = this.items.get(newBlock.id);
                        if (block) {
                            this.selectBlock(newBlock.id);
                            block.startEditing();
                        }
                    }, 0);
                }
                
                // Reset drag state
                this.isDraggingBlock = false;
                this.previousSnappedPositions = null; // Reset snapped positions tracking
                
                // Update mask after block creation completes (temporary block removed)
                requestAnimationFrame(() => {
                    this.renderMask(true); // Animate mask update
                });
                
                cleanup();
            };
            
            const cleanup = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                this.mousedownPosition = null;
                this.isDraggingBlock = false;
                // Clean up temporary block if it exists
                if (this.tempBlockElement) {
                    this.tempBlockElement.remove();
                    this.tempBlockElement = null;
                }
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }, true); // Use capture phase (true = capture phase)
        
        // Handle click for deselection (separate from block creation)
        this.container.addEventListener('click', (e) => {
            // Don't deselect if clicking on badge
            if (e.target.closest('.timeline-block-badge')) {
                return;
            }
            // Only deselect when clicking on empty timeline (not on blocks)
            if (!e.target.closest('.timeline-block')) {
                this.selectBlock(null);
            }
        });
    }
    
    getDayWidth(day = null) {
        // If day is provided, return width for that specific day (20px for weekends, 80px for weekdays)
        if (day !== null) {
            return this.isWeekend(day) ? 20 : 80;
        }
        // Legacy: return default weekday width
        return this.config.dayWidth;
    }
    
    dayToPixel(day) {
        // Iterate through all days from 0 to day and sum their widths
        let totalPixels = 0;
        for (let i = 0; i < day; i++) {
            totalPixels += this.getDayWidth(i);
        }
        return totalPixels * this.zoom;
    }
    
    /**
     * Calculate pixel width for a duration starting from a specific day
     * This correctly handles variable day widths (weekdays vs weekends)
     */
    dayToPixelForDuration(startDay, duration) {
        let totalPixels = 0;
        for (let i = 0; i < duration; i++) {
            totalPixels += this.getDayWidth(startDay + i);
        }
        return totalPixels * this.zoom;
    }
    
    pixelToDay(pixel) {
        // Account for zoom
        const unzoomedPixel = pixel / this.zoom;
        
        // Iterate through days, accumulating widths until we find the day that contains this pixel
        // Return the day that contains the pixel position
        // A pixel at the start of a day (e.g., pixel 400 = start of day 5) should return that day
        let accumulatedPixels = 0;
        let day = 0;
        
        // Keep adding day widths until we find the day that contains the pixel
        while (true) {
            const dayWidth = this.getDayWidth(day);
            const dayStart = accumulatedPixels;
            const dayEnd = accumulatedPixels + dayWidth;
            
            // Check if pixel is exactly at the start of this day (dayStart)
            // This handles the case where pixel = 0 (start of day 0)
            if (Math.abs(unzoomedPixel - dayStart) < 0.001) {
                return day;
            }
            
            // Check if pixel is exactly at the start of the next day (dayEnd)
            // In this case, return the next day
            if (Math.abs(unzoomedPixel - dayEnd) < 0.001) {
                return day + 1;
            }
            
            // Check if pixel is within this day's range (dayStart, dayEnd)
            // Use > and < (not >= and <=) since we handle exact boundaries above
            if (unzoomedPixel > dayStart && unzoomedPixel < dayEnd) {
                return day;
            }
            
            // Move to next day
            accumulatedPixels = dayEnd;
            day++;
            
            // Safety check to prevent infinite loop
            if (day > 10000) {
                console.warn('pixelToDay: exceeded safety limit');
                return day;
            }
        }
    }
    
    /**
     * Get relative day from absolute date
     */
    getRelativeDayFromDate(absoluteDate) {
        return this.dataModel.getRelativeDayFromDate(absoluteDate);
    }
    
    /**
     * Recalculate positions of all blocks and annotations when start date changes
     */
    recalculatePositions() {
        // Update all blocks
        this.dataModel.data.timeline.items.forEach((item) => {
            if (item.type === 'block' && this.items.has(item.id)) {
                const block = this.items.get(item.id);
                block.update(item);
            }
        });
        
        // Update all annotations
        const annotations = this.dataModel.data.timeline.annotations || [];
        annotations.forEach((annotationData) => {
            if (this.items.has(annotationData.id)) {
                const annotation = this.items.get(annotationData.id);
                annotation.update(annotationData);
            }
        });
    }
    
    calculateGridlineIntersection(x, y) {
        // Calculate which day (vertical gridline) the x coordinate is on
        const day = this.pixelToDay(x);
        
        // Calculate which row (horizontal gridline) the y coordinate is closest to
        const padding = 32; // 2rem padding
        const relativeY = y - padding;
        const rowSpacing = this.config.blockHeight + this.config.annotationSpace;
        
        // Calculate fractional row position
        const fractionalRow = relativeY / rowSpacing;
        const integerRow = Math.floor(fractionalRow);
        
        // Calculate position within the row (0 to rowSpacing)
        const positionInRow = (fractionalRow - integerRow) * rowSpacing;
        
        // If click is in the annotation space portion of a row (bottom annotationSpace pixels),
        // assign to that row. Otherwise, use closest gridline logic.
        let row;
        if (integerRow < 0) {
            // Above first row, use row 0
            row = 0;
        } else if (positionInRow >= this.config.blockHeight) {
            // Click is in annotation space of this row, use this row
            row = integerRow;
        } else {
            // Click is in block space, use closest gridline logic
            const rowAbove = integerRow;
            const rowBelow = Math.ceil(fractionalRow);
            
            const rowAboveGridline = padding + (rowAbove * rowSpacing);
            const rowBelowGridline = padding + (rowBelow * rowSpacing);
            
            const distanceToAbove = Math.abs(y - rowAboveGridline);
            const distanceToBelow = Math.abs(y - rowBelowGridline);
            
            if (distanceToAbove < distanceToBelow) {
                row = rowAbove;
            } else {
                row = rowBelow;
            }
        }
        
        return { day, row };
    }
    
    snapPixelToGrid(pixel) {
        // Convert pixel to day, then back to pixel to snap to the start of that day
        const day = this.pixelToDay(pixel);
        return this.dayToPixel(day);
    }
    
    snapPixelToGridPreferRight(pixel) {
        // Find the closest gridline, preferring the right one when it's closer
        // Find the day that contains this pixel position
        const day = this.pixelToDay(pixel);
        
        // Get gridline positions
        const leftGridline = this.dayToPixel(day);
        const rightGridline = this.dayToPixel(day + 1);
        
        // Calculate distances from pixel to both gridlines
        const distanceToLeft = Math.abs(pixel - leftGridline);
        const distanceToRight = Math.abs(pixel - rightGridline);
        
        // Return the gridline that is closer (prefer right when equidistant)
        if (distanceToRight <= distanceToLeft) {
            return rightGridline;
        } else {
            return leftGridline;
        }
    }
    
    setZoom(zoom) {
        this.zoom = Math.max(0.25, Math.min(3.0, zoom));
        this.dataModel.data.timeline.zoom = this.zoom;
        this.render();
    }
    
    getDateForDay(day) {
        const startDate = this.dataModel.getStartDate();
        const date = new Date(startDate);
        date.setDate(date.getDate() + day);
        return date;
    }
    
    isWeekend(day) {
        const date = this.getDateForDay(day);
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    }
    
    formatDateLabel(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        return `${month} ${day}`;
    }
    
    getVisibleDayRange() {
        const parentContainer = this.container.parentElement;
        if (!parentContainer) {
            return { startDay: 0, endDay: 100 };
        }
        
        const scrollLeft = parentContainer.scrollLeft;
        const viewportWidth = parentContainer.clientWidth;
        const startPixel = scrollLeft;
        const endPixel = scrollLeft + viewportWidth;
        
        const startDay = Math.max(0, this.pixelToDay(startPixel / this.zoom));
        const endDay = this.pixelToDay(endPixel / this.zoom);
        
        return { startDay, endDay };
    }
    
    getExtendedDayRange() {
        const { startDay, endDay } = this.getVisibleDayRange();
        const weeksBuffer = 6;
        const daysBuffer = weeksBuffer * 7; // 42 days
        
        return {
            startDay: Math.max(0, startDay - daysBuffer),
            endDay: endDay + daysBuffer
        };
    }
    
    render() {
        this.container.innerHTML = '';
        this.items.clear();
        this.insertButtons = [];
        this.annotationHoverIndicator = null; // Reset hover indicator reference after clearing container
        
        // Clear date label map and reset current visible label
        this.dateLabelMap.clear();
        this.currentVisibleLabel = null;
        
        // Remove hover date label from parent container if it exists (legacy cleanup)
        if (this.hoverDateLabel && this.hoverDateLabel.parentElement) {
            this.hoverDateLabel.parentElement.removeChild(this.hoverDateLabel);
        }
        this.hoverDateLabel = null; // Reset hover date label reference after clearing container
        
        // Remove all date labels from parent container (they're outside the masked container)
        const parentContainer = this.container.parentElement;
        if (parentContainer) {
            const dateLabels = parentContainer.querySelectorAll('.date-label');
            dateLabels.forEach(label => label.remove());
        }
        
        const items = this.dataModel.data.timeline.items;
        
        // Calculate number of rows to fill viewport
        // Get the parent container (timeline-container) which is the scrollable area
        // (parentContainer already declared above)
        const parentRect = parentContainer ? parentContainer.getBoundingClientRect() : null;
        const containerHeight = parentRect ? parentRect.height : (window.innerHeight || document.documentElement.clientHeight || 800);
        
        // Calculate number of rows (each row includes blockHeight + annotationSpace)
        const padding = 32; // 2rem padding
        const rowSpacing = this.config.blockHeight + this.config.annotationSpace;
        // Calculate rows based on actual container height, not viewport
        const numRows = Math.max(1, Math.floor((containerHeight - (padding * 2)) / rowSpacing));
        
        // Set container height to fill all rows (add padding top and bottom)
        const totalHeight = padding + (numRows * rowSpacing) + padding;
        this.container.style.minHeight = `${totalHeight}px`;
        this.container.style.height = `${totalHeight}px`;
        
        // Calculate full timeline width based on actual content (all blocks/annotations)
        // This ensures width stays consistent and date labels don't change on scroll
        let maxDay = 0;
        items.forEach(item => {
            if (item.type === 'block') {
                const startDate = item.startDate || this.dataModel.getDateFromRelativeDay(item.startDay || 0);
                const relativeDay = this.getRelativeDayFromDate(startDate);
                const endDay = relativeDay + (item.duration || 1);
                maxDay = Math.max(maxDay, endDay);
            } else if (item.type === 'annotation') {
                const date = item.date || this.dataModel.getDateFromRelativeDay(item.day || 0);
                const relativeDay = this.getRelativeDayFromDate(date);
                maxDay = Math.max(maxDay, relativeDay);
            }
        });
        // Add buffer for future items and ensure minimum width
        const totalWidth = this.dayToPixel(Math.max(maxDay + 14, 100)); // At least 100 days, plus 2 weeks buffer
        this.container.style.width = `${totalWidth}px`;
        
        // Debug logging
        console.log('Row calculation:', {
            containerHeight,
            padding,
            rowSpacing,
            numRows,
            totalHeight
        });
        
        // Render gridlines (must be before other elements for proper z-index)
        this.renderGridlines(totalHeight);
        
        // Render weekend backgrounds (extend vertically)
        // totalHeight already includes padding, so pass it as-is
        this.renderWeekends(totalHeight);
        
        // Render date labels (after container height is set)
        this.renderDateLabels();
        
        // Render annotations
        const annotations = this.dataModel.data.timeline.annotations || [];
        annotations.forEach((annotationData) => {
            const annotation = new Annotation(annotationData, this);
            this.items.set(annotationData.id, annotation);
            this.container.appendChild(annotation.element);
        });
        
        // Render items
        items.forEach((item, index) => {
            if (item.type === 'block') {
                const block = new Block(item, this);
                this.items.set(item.id, block);
                this.container.appendChild(block.element);
            }
        });
        
        // Note: We no longer use --day-width CSS variable since we have variable day widths
        // Gridlines are now rendered dynamically in renderGridlines()
        
        // Render insert buttons
        this.renderInsertButtons();
        
        // Render mask (after all items are rendered)
        this.renderMask(false); // No animation on initial render
        
        // Recreate hover date label after rendering (it was removed when container was cleared)
        if (!this.hoverDateLabel) {
            this.setupHoverDateLabel();
        }
        
        // Restore selection if it still exists
        if (this.selectedBlockId) {
            const block = this.items.get(this.selectedBlockId);
            if (block) {
                block.element.classList.add('selected');
            } else {
                // Block was deleted, clear selection
                this.selectedBlockId = null;
            }
        }
    }
    
    renderGridlines(containerHeight) {
        // Get extended day range (6 weeks before and after viewport)
        const { startDay, endDay } = this.getExtendedDayRange();
        
        // Render vertical gridlines for each day in the extended range
        for (let day = startDay; day <= endDay; day++) {
            const gridline = document.createElement('div');
            gridline.className = 'gridline-vertical';
            const left = this.dayToPixel(day);
            gridline.style.left = `${left}px`;
            gridline.style.width = '1px';
            gridline.style.height = `${containerHeight}px`;
            gridline.style.top = '0';
            gridline.style.position = 'absolute';
            gridline.style.zIndex = '0';
            this.container.appendChild(gridline);
        }
    }
    
    renderWeekends(containerHeight) {
        // Get extended day range (6 weeks before and after viewport)
        const { startDay, endDay } = this.getExtendedDayRange();
        
        console.log('Rendering weekends, containerHeight:', containerHeight, 'startDay:', startDay, 'endDay:', endDay);
        let weekendCount = 0;
        for (let day = startDay; day <= endDay; day++) {
            if (this.isWeekend(day)) {
                const weekendBg = document.createElement('div');
                weekendBg.className = 'weekend-day';
                const left = this.dayToPixel(day);
                weekendBg.style.left = `${left}px`;
                weekendBg.style.width = `${20 * this.zoom}px`;
                weekendBg.style.height = `${containerHeight}px`;
                weekendBg.style.top = '0';
                // Ensure positioning is absolute
                weekendBg.style.position = 'absolute';
                // Ensure z-index is set
                weekendBg.style.zIndex = '1';
                this.container.appendChild(weekendBg);
                weekendCount++;
            }
        }
        console.log('Created', weekendCount, 'weekend backgrounds');
    }
    
    renderDateLabels() {
        // Remove all existing date labels from parent container first (prevent duplicates on scroll)
        const parentContainer = this.container.parentElement;
        if (parentContainer) {
            const existingLabels = parentContainer.querySelectorAll('.date-label');
            existingLabels.forEach(label => label.remove());
        }
        
        // Clear the date label map when re-rendering
        this.dateLabelMap.clear();
        
        // Use a fixed range based on actual content, not viewport or container width
        // This ensures date labels stay consistent regardless of scroll position
        // Calculate max day from all items
        let maxDay = 0;
        this.dataModel.data.timeline.items.forEach(item => {
            if (item.type === 'block') {
                const startDate = item.startDate || this.dataModel.getDateFromRelativeDay(item.startDay || 0);
                const relativeDay = this.getRelativeDayFromDate(startDate);
                const endDay = relativeDay + (item.duration || 1);
                maxDay = Math.max(maxDay, endDay);
            } else if (item.type === 'annotation') {
                const date = item.date || this.dataModel.getDateFromRelativeDay(item.day || 0);
                const relativeDay = this.getRelativeDayFromDate(date);
                maxDay = Math.max(maxDay, relativeDay);
            }
        });
        // Also check annotations array
        const annotations = this.dataModel.data.timeline.annotations || [];
        annotations.forEach(ann => {
            const date = ann.date || this.dataModel.getDateFromRelativeDay(ann.day || 0);
            const relativeDay = this.getRelativeDayFromDate(date);
            maxDay = Math.max(maxDay, relativeDay);
        });
        // Render labels for the entire timeline, with buffer
        const startDay = 0;
        const endDay = Math.max(maxDay + 14, 100); // At least 100 days, plus 2 weeks buffer
        
        // Get actual container height after it's been set
        const containerHeight = this.container.offsetHeight || parseInt(this.container.style.height) || 600;
        console.log('Rendering date labels, containerHeight:', containerHeight, 'startDay:', startDay, 'endDay:', endDay, 'maxDay:', maxDay);
        
        // Get parent container to append labels outside masked container
        // (parentContainer already declared above for cleanup)
        const containerToAppend = parentContainer || this.container; // Fallback to container if no parent (parentContainer declared above)
        
        let labelCount = 0;
        // Create labels for every day (not just every 7 days) for hover functionality
        for (let day = startDay; day <= endDay; day++) {
            const date = this.getDateForDay(day);
            const label = document.createElement('div');
            label.className = 'date-label';
            label.textContent = this.formatDateLabel(date);
            label.dataset.day = day; // Store day number for lookup
            const left = this.dayToPixel(day);
            // Center-align with the vertical gridline (center of the day column)
            const dayWidth = this.getDayWidth(day) * this.zoom;
            const centerPosition = left + (dayWidth / 2);
            
            // Position relative to parent container if using parent, otherwise relative to container
            if (parentContainer) {
                const containerRect = this.container.getBoundingClientRect();
                const parentRect = parentContainer.getBoundingClientRect();
                const containerOffsetLeft = containerRect.left - parentRect.left;
                // centerPosition is in content coordinates
                // Labels are positioned in the parent container, which scrolls
                // So labels will scroll with the content - we don't need to subtract scrollLeft
                // Position = container viewport offset + content position
                label.style.left = `${containerOffsetLeft + centerPosition}px`;
            } else {
                label.style.left = `${centerPosition}px`;
            }
            
            label.style.transform = 'translateX(-50%)';
            // Position at top of container (8px from top = 0.5rem)
            label.style.top = '8px';
            label.style.bottom = 'auto';
            // Ensure label is visible
            label.style.position = 'absolute';
            label.style.zIndex = '5';
            
            // Set opacity: 1 for weekly labels (multiples of 7), 0 for hover labels
            if (day % 7 === 0) {
                label.style.opacity = '1'; // Regular weekly labels are visible
            } else {
                label.style.opacity = '0'; // Hover labels start hidden
            }
            
            containerToAppend.appendChild(label);
            // Store in map for hover functionality (all labels, not just hover ones)
            this.dateLabelMap.set(day, label);
            labelCount++;
        }
        console.log('Created', labelCount, 'date labels');
    }
    
    renderMask(animate = false) {
        // Get container dimensions
        const containerHeight = this.container.offsetHeight || parseInt(this.container.style.height) || 600;
        const containerWidth = this.container.offsetWidth || parseInt(this.container.style.width) || 1000;
        
        // Get mask corner radius from CSS variable
        const cornerRadiusValue = getComputedStyle(document.documentElement).getPropertyValue('--mask-corner-radius').trim();
        // Parse value (remove "px" suffix if present) - CSS value is "200px"
        const cornerRadius = parseFloat(cornerRadiusValue) || 200; // Default to 200px if not found (matches CSS)
        
        // Create or get SVG element for mask
        let svgElement = document.getElementById('timeline-mask-svg');
        if (!svgElement) {
            svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgElement.id = 'timeline-mask-svg';
            svgElement.style.position = 'absolute';
            svgElement.style.top = '0';
            svgElement.style.left = '0';
            svgElement.style.width = '0';
            svgElement.style.height = '0';
            svgElement.style.pointerEvents = 'none';
            svgElement.setAttribute('width', containerWidth);
            svgElement.setAttribute('height', containerHeight);
            document.body.appendChild(svgElement);
        } else {
            svgElement.setAttribute('width', containerWidth);
            svgElement.setAttribute('height', containerHeight);
        }
        
        // Create or get defs and mask elements
        let defs = svgElement.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svgElement.appendChild(defs);
        }
        
        let maskElement = defs.querySelector('mask#timeline-mask');
        if (!maskElement) {
            maskElement = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
            maskElement.id = 'timeline-mask';
            defs.appendChild(maskElement);
            
            // Add blur filter for feathering
            const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.id = 'mask-blur';
            const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            feGaussianBlur.setAttribute('stdDeviation', this.config.maskFeather);
            filter.appendChild(feGaussianBlur);
            defs.appendChild(filter);
        }
        
        this.maskElement = maskElement;
        
        // Collect all items to mask (blocks and annotations)
        const itemsToMask = [];
        
        // Add all blocks (keep resizing ones in mask, but they'll override mask with CSS)
        this.items.forEach((item, id) => {
            if (item.data && item.data.type === 'block') {
                itemsToMask.push({
                    id: id,
                    element: item.element,
                    type: 'block'
                });
            }
        });
        
        // Add all annotations
        this.items.forEach((item, id) => {
            if (item.data && item.data.type === 'annotation') {
                itemsToMask.push({
                    id: id,
                    element: item.element,
                    type: 'annotation'
                });
            }
        });
        
        // Include temporary block if it exists
        if (this.tempBlockElement) {
            itemsToMask.push({
                id: 'temp-block',
                element: this.tempBlockElement,
                type: 'block'
            });
        }
        
        // Calculate bounds for each item and create/update rect elements
        const currentItemIds = new Set();
        
        itemsToMask.forEach((item) => {
            currentItemIds.add(item.id);
            
            // Get position from element style (more reliable than getBoundingClientRect)
            let left = parseFloat(item.element.style.left) || 0;
            let top = parseFloat(item.element.style.top) || 0;
            let width = parseFloat(item.element.style.width) || item.element.offsetWidth || 0;
            let height = parseFloat(item.element.style.height) || item.element.offsetHeight || 0;
            
            // Handle annotations: they have transform: translate(-50%, 0) so left is the center
            if (item.type === 'annotation') {
                // Annotation circle is 16px diameter, centered on left position
                const annotationSize = 16;
                left = left - (annotationSize / 2); // Adjust to left edge
                width = annotationSize;
                height = annotationSize;
            }
            
            // Calculate position with padding
            const x = left - this.config.maskPadding;
            const y = top - this.config.maskPadding;
            const paddedWidth = width + (this.config.maskPadding * 2);
            const paddedHeight = height + (this.config.maskPadding * 2);
            
            // Get or create rect element for this item
            let rectElement = this.maskRectElements.get(item.id);
            if (!rectElement) {
                rectElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rectElement.setAttribute('fill', 'white');
                rectElement.setAttribute('filter', 'url(#mask-blur)');
                maskElement.appendChild(rectElement);
                this.maskRectElements.set(item.id, rectElement);
            }
            
            // Update rect position and size with rounded corners
            if (animate && rectElement.hasAttribute('x')) {
                // Animate if this is an update (not initial creation)
                const gsap = window.gsap;
                gsap.to(rectElement, {
                    attr: {
                        x: Math.max(0, x),
                        y: Math.max(0, y),
                        width: Math.max(0, paddedWidth),
                        height: Math.max(0, paddedHeight),
                        rx: cornerRadius,
                        ry: cornerRadius
                    },
                    duration: this.config.maskAnimationDuration,
                    ease: this.config.maskAnimationEase
                });
            } else {
                // Set directly for initial creation
                const finalX = Math.max(0, x);
                const finalY = Math.max(0, y);
                const finalW = Math.max(0, paddedWidth);
                const finalH = Math.max(0, paddedHeight);
                rectElement.setAttribute('x', finalX);
                rectElement.setAttribute('y', finalY);
                rectElement.setAttribute('width', finalW);
                rectElement.setAttribute('height', finalH);
                rectElement.setAttribute('rx', cornerRadius);
                rectElement.setAttribute('ry', cornerRadius);
            }
        });
        
        // Remove rect elements for items that no longer exist
        this.maskRectElements.forEach((rectElement, id) => {
            if (!currentItemIds.has(id)) {
                if (animate) {
                    // Animate out before removing
                    const gsap = window.gsap;
                    gsap.to(rectElement, {
                        attr: { width: 0, height: 0 },
                        duration: this.config.maskAnimationDuration,
                        ease: this.config.maskAnimationEase,
                        onComplete: () => {
                            rectElement.remove();
                            this.maskRectElements.delete(id);
                        }
                    });
                } else {
                    rectElement.remove();
                    this.maskRectElements.delete(id);
                }
            }
        });
        
        // Apply mask to container if there are any items
        if (itemsToMask.length > 0) {
            this.container.style.mask = 'url(#timeline-mask)';
            this.container.style.webkitMask = 'url(#timeline-mask)';
        } else {
            // No items, remove mask
            this.container.style.mask = 'none';
            this.container.style.webkitMask = 'none';
        }
    }
    
    renderInsertButtons() {
        // Remove existing insert buttons
        this.insertButtons.forEach(btn => btn.remove());
        this.insertButtons = [];
        
        const items = this.dataModel.data.timeline.items;
        
        // Insert button at the start
        if (items.length === 0) {
            const dayWidth = this.getDayWidth(0) * this.zoom;
            this.createInsertButton(0, dayWidth);
        } else {
            // Get relative day from absolute date for first item
            const first = items[0];
            const firstStartDate = first.type === 'block' 
                ? (first.startDate || this.dataModel.getDateFromRelativeDay(first.startDay || 0))
                : (first.date || this.dataModel.getDateFromRelativeDay(first.day || 0));
            const firstRelativeDay = this.getRelativeDayFromDate(firstStartDate);
            if (firstRelativeDay > 0) {
                const dayWidth = this.getDayWidth(0) * this.zoom;
                this.createInsertButton(0, dayWidth);
            }
        }
        
        // Insert buttons between items
        for (let i = 0; i < items.length - 1; i++) {
            const current = items[i];
            const next = items[i + 1];
            
            // Get relative days from absolute dates
            const currentStartDate = current.type === 'block' 
                ? (current.startDate || this.dataModel.getDateFromRelativeDay(current.startDay || 0))
                : (current.date || this.dataModel.getDateFromRelativeDay(current.day || 0));
            const currentRelativeDay = this.getRelativeDayFromDate(currentStartDate);
            const currentEnd = current.type === 'block' ? currentRelativeDay + current.duration : currentRelativeDay;
            
            const nextStartDate = next.type === 'block' 
                ? (next.startDate || this.dataModel.getDateFromRelativeDay(next.startDay || 0))
                : (next.date || this.dataModel.getDateFromRelativeDay(next.day || 0));
            const nextRelativeDay = this.getRelativeDayFromDate(nextStartDate);
            const nextStart = next.type === 'block' ? nextRelativeDay : nextRelativeDay;
            
            if (nextStart > currentEnd) {
                const position = (currentEnd + nextStart) / 2;
                // Use average width for button sizing (approximation)
                const avgDayWidth = ((80 * 5 + 20 * 2) / 7) * this.zoom;
                this.createInsertButton(position, avgDayWidth);
            }
        }
        
        // Insert button at the end
        if (items.length > 0) {
            const last = items[items.length - 1];
            const lastStartDate = last.type === 'block' 
                ? (last.startDate || this.dataModel.getDateFromRelativeDay(last.startDay || 0))
                : (last.date || this.dataModel.getDateFromRelativeDay(last.day || 0));
            const lastRelativeDay = this.getRelativeDayFromDate(lastStartDate);
            const lastEnd = last.type === 'block' ? lastRelativeDay + last.duration : lastRelativeDay;
            // Use average width for button sizing (approximation)
            const avgDayWidth = ((80 * 5 + 20 * 2) / 7) * this.zoom;
            this.createInsertButton(lastEnd + 5, avgDayWidth);
        }
    }
    
    createInsertButton(position, dayWidth) {
        const button = document.createElement('button');
        button.className = 'insert-button';
        button.textContent = '+';
        button.dataset.position = position;
        
        const pixelX = this.dayToPixel(position) - 12;
        button.style.left = `${pixelX}px`;
        button.style.top = '50%';
        button.style.transform = 'translateY(-50%)';
        
        // Show on hover
        let hoverTimeout;
        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pixelPos = this.dayToPixel(position);
            
            if (Math.abs(x - pixelPos) < 20) {
                clearTimeout(hoverTimeout);
                button.classList.add('visible');
            } else {
                hoverTimeout = setTimeout(() => {
                    button.classList.remove('visible');
                }, 200);
            }
        });
        
        this.container.appendChild(button);
        this.insertButtons.push(button);
    }
    
    handleInsertClick(position, type) {
        const snappedPosition = this.pixelToDay(this.dayToPixel(position));
        
        if (type === 'block') {
            this.dataModel.addBlock(snappedPosition, 5, '');
        }
        
        this.render();
    }
    
    setupAnnotationHover() {
        this.annotationHoverIndicator = null;
        
        this.container.addEventListener('mousemove', (e) => {
            // Don't show hover indicator if dragging to create a block
            if (this.isDraggingBlock) {
                this.hideAnnotationHoverIndicator();
                return;
            }
            
            // Don't show hover indicator if hovering over blocks, annotations, or other interactive elements
            // Skip if target is a tooltip (which has pointer-events: none but might still be detected)
            if (e.target.classList.contains('annotation-tooltip')) {
                return;
            }
            if (e.target.closest('.timeline-block, .annotation, .date-label, .insert-button')) {
                this.hideAnnotationHoverIndicator();
                return;
            }
            
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Calculate gridline intersection
            const intersection = this.calculateGridlineIntersection(x, y);
            
            // Check if annotation already exists at this intersection
            const existingAnnotation = this.dataModel.getAnnotation(intersection.day, intersection.row);
            
            if (!existingAnnotation) {
                // Show plus icon at intersection
                this.showAnnotationHoverIndicator(intersection.day, intersection.row);
            } else {
                // Hide hover indicator if annotation exists
                this.hideAnnotationHoverIndicator();
            }
        });
        
        this.container.addEventListener('mouseleave', () => {
            this.hideAnnotationHoverIndicator();
        });
        
        // Handle click to create annotation
        this.container.addEventListener('click', (e) => {
            // Skip if target is a tooltip (which has pointer-events: none but might still be detected)
            if (e.target.classList.contains('annotation-tooltip')) {
                return;
            }
            // Don't create if clicking on blocks, annotations, or other interactive elements
            if (e.target.closest('.timeline-block, .annotation, .date-label, .insert-button')) {
                return;
            }
            
            // Check if clicking on the hover indicator
            if (e.target.closest('.annotation-hover-indicator')) {
                const rect = this.container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const intersection = this.calculateGridlineIntersection(x, y);
                
                // Create new annotation with empty text - it will show in display mode
                const newAnnotation = this.dataModel.addAnnotation(intersection.day, intersection.row, '');
                const annotationId = newAnnotation.id; // Store ID before render clears items
                
                // Hide hover indicator before rendering
                this.hideAnnotationHoverIndicator();
                
                this.render();
                
                // Start editing the new annotation immediately
                // Use double requestAnimationFrame to ensure DOM is fully painted
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const annotation = this.items.get(annotationId);
                        if (annotation && annotation.element) {
                            // Verify element is in the DOM
                            if (annotation.element.parentNode) {
                                annotation.startEditing();
                            } else {
                                // Element not in DOM yet, try again after a short delay
                                setTimeout(() => {
                                    const annotation = this.items.get(annotationId);
                                    if (annotation && annotation.element && annotation.element.parentNode) {
                                        annotation.startEditing();
                                    }
                                }, 50);
                            }
                        } else {
                            // Fallback: try again after a short delay if annotation not found
                            setTimeout(() => {
                                const annotation = this.items.get(annotationId);
                                if (annotation && annotation.element && annotation.element.parentNode) {
                                    annotation.startEditing();
                                }
                            }, 50);
                        }
                    });
                });
                
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
    
    showAnnotationHoverIndicator(day, row) {
        if (!this.annotationHoverIndicator) {
            this.annotationHoverIndicator = document.createElement('div');
            this.annotationHoverIndicator.className = 'annotation-hover-indicator';
            
            const circle = document.createElement('div');
            circle.className = 'annotation-hover-circle';
            
            const plusIcon = document.createElement('span');
            plusIcon.textContent = '+';
            
            circle.appendChild(plusIcon);
            this.annotationHoverIndicator.appendChild(circle);
            
            this.container.appendChild(this.annotationHoverIndicator);
        }
        
        // Position at gridline intersection (in reserved space below row)
        const left = this.dayToPixel(day);
        const padding = 32;
        const rowSpacing = this.config.blockHeight + this.config.annotationSpace;
        const blockTop = padding + (row * rowSpacing);
        const top = blockTop + this.config.blockHeight + 0; // Start directly at block bottom
        
        this.annotationHoverIndicator.style.left = `${left}px`;
        this.annotationHoverIndicator.style.top = `${top}px`;
        this.annotationHoverIndicator.style.position = 'absolute';
        this.annotationHoverIndicator.style.transform = 'translate(-50%, 0)'; // Match annotation positioning
        this.annotationHoverIndicator.style.zIndex = '1999'; // Below annotations but above everything else
        this.annotationHoverIndicator.style.opacity = '1';
        this.annotationHoverIndicator.style.pointerEvents = 'all';
    }
    
    hideAnnotationHoverIndicator() {
        if (this.annotationHoverIndicator) {
            this.annotationHoverIndicator.style.opacity = '0';
            this.annotationHoverIndicator.style.pointerEvents = 'none';
        }
    }
    
    setupHoverDateLabel() {
        // Remove existing event listeners if they exist
        if (this.hoverDateLabelMoveHandler) {
            this.container.removeEventListener('mousemove', this.hoverDateLabelMoveHandler);
        }
        if (this.hoverDateLabelLeaveHandler) {
            // Remove from both container and parent (in case it was attached to either)
            this.container.removeEventListener('mouseleave', this.hoverDateLabelLeaveHandler);
            const parentContainer = this.container.parentElement;
            if (parentContainer) {
                parentContainer.removeEventListener('mouseleave', this.hoverDateLabelLeaveHandler);
            }
        }
        
        // Mouse move handler - use a named function so we can remove it if needed
        this.hoverDateLabelMoveHandler = (e) => {
            // Calculate position relative to the timeline-track container (for day calculations)
            const containerRect = this.container.getBoundingClientRect();
            
            // Calculate mouse position in content coordinates
            // The key insight: the container's viewport coordinate system IS the content coordinate system
            // When the parent scrolls, containerRect.left changes, but content coordinates don't
            // So x = clientX - containerRect.left gives us the position in content coordinates directly
            // This matches how block creation works: mousedownPosition.x = e.clientX - rect.left, then pixelToDay(x)
            const x = e.clientX - containerRect.left;
            
            // Convert pixel position to relative day (snap to nearest day)
            // Use x directly - it's already in content coordinates
            // This matches how block creation works: pixelToDay(mousedownPosition.x)
            const relativeDay = this.pixelToDay(x);
            
            // Get the pre-rendered label for this day from the map
            const label = this.dateLabelMap.get(relativeDay);
            
            // Hide the previously visible label (if different from current)
            if (this.currentVisibleLabel && this.currentVisibleLabel !== label) {
                // Only hide if it's not a weekly label (multiples of 7 should stay visible)
                const previousDay = parseInt(this.currentVisibleLabel.dataset.day);
                if (previousDay % 7 !== 0) {
                    this.currentVisibleLabel.style.opacity = '0';
                }
            }
            
            // Show the new label (if it exists and is not a weekly label)
            if (label) {
                // Only show hover labels (non-weekly labels)
                // Weekly labels (multiples of 7) are already visible
                if (relativeDay % 7 !== 0) {
                    label.style.opacity = '1';
                    this.currentVisibleLabel = label;
                } else {
                    // For weekly labels, just update the currentVisibleLabel reference
                    this.currentVisibleLabel = label;
                }
            }
        };
        
        // Mouse leave handler
        this.hoverDateLabelLeaveHandler = () => {
            // Hide the currently visible hover label (if it's not a weekly label)
            if (this.currentVisibleLabel) {
                const day = parseInt(this.currentVisibleLabel.dataset.day);
                if (day % 7 !== 0) {
                    this.currentVisibleLabel.style.opacity = '0';
                }
                this.currentVisibleLabel = null;
            }
        };
        
        this.container.addEventListener('mousemove', this.hoverDateLabelMoveHandler);
        
        // Attach mouseleave to parent container since labels are in parent
        // This ensures label hides when mouse leaves the timeline area
        const parentContainer = this.container.parentElement;
        if (parentContainer) {
            parentContainer.addEventListener('mouseleave', this.hoverDateLabelLeaveHandler);
        } else {
            this.container.addEventListener('mouseleave', this.hoverDateLabelLeaveHandler);
        }
    }
    
    isNearAnnotationHoverIndicator(x, y) {
        // Check if annotation hover indicator exists and is visible
        if (!this.annotationHoverIndicator) {
            return false;
        }
        
        // Check if indicator is visible (opacity > 0 and pointer-events is not 'none')
        const opacity = parseFloat(window.getComputedStyle(this.annotationHoverIndicator).opacity) || 0;
        const pointerEvents = window.getComputedStyle(this.annotationHoverIndicator).pointerEvents;
        
        if (opacity === 0 || pointerEvents === 'none') {
            return false;
        }
        
        // Get the position of the hover indicator
        const indicatorRect = this.annotationHoverIndicator.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        // Calculate indicator center relative to container
        const indicatorCenterX = indicatorRect.left - containerRect.left + (indicatorRect.width / 2);
        const indicatorCenterY = indicatorRect.top - containerRect.top + (indicatorRect.height / 2);
        
        // Calculate distance from click position to indicator center
        const distanceX = Math.abs(x - indicatorCenterX);
        const distanceY = Math.abs(y - indicatorCenterY);
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        // Exclusion radius: 15px (slightly larger than the 20px circle to provide buffer)
        const exclusionRadius = 15;
        
        return distance <= exclusionRadius;
    }
    
    getItemElement(id) {
        return this.items.get(id)?.element;
    }
    
    updateItem(id) {
        // Check in timeline items
        let item = this.dataModel.data.timeline.items.find(i => i.id === id);
        if (!item) {
            // Check in annotations
            item = this.dataModel.data.timeline.annotations.find(a => a.id === id);
        }
        if (item && this.items.has(id)) {
            const component = this.items.get(id);
            component.update(item);
        }
    }
    
    removeItem(id) {
        const component = this.items.get(id);
        if (component) {
            component.element.remove();
            this.items.delete(id);
            this.renderInsertButtons();
        }
    }
}

