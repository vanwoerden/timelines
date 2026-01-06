// Data model for timeline items
export class TimelineDataModel {
    constructor() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        this.data = {
            timeline: {
                items: [],
                annotations: [],
                zoom: 1.0,
                scrollPosition: 0,
                startDate: today.toISOString().split('T')[0],
                lastBadgeValue: 'XD' // Remember last used badge value
            },
            offTimeline: {
                blocks: []
            }
        };
        
        this.nextId = 1;
        this._changeListeners = [];
    }
    
    /**
     * Register a callback to be notified of data changes
     */
    onChange(callback) {
        this._changeListeners.push(callback);
    }
    
    /**
     * Notify all registered listeners of a data change
     */
    _notifyChange() {
        this._changeListeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in change listener:', error);
            }
        });
    }
    
    generateId() {
        return String(this.nextId++);
    }
    
    addBlock(startDayOrDate, duration = 5, label = '', row = 0) {
        // Accept either relative day (number) or absolute date (string)
        let startDate;
        if (typeof startDayOrDate === 'number') {
            // Backward compatibility: calculate absolute date from relative day
            const startDateObj = this.getStartDate();
            const absoluteDate = new Date(startDateObj);
            absoluteDate.setDate(absoluteDate.getDate() + startDayOrDate);
            startDate = absoluteDate.toISOString().split('T')[0];
        } else {
            // Absolute date string provided
            startDate = startDayOrDate;
        }
        
        const block = {
            type: 'block',
            id: this.generateId(),
            startDate, // Store absolute date
            duration,
            label,
            row,
            badge: this.data.timeline.lastBadgeValue || 'XD' // Use last badge value or default to XD
        };
        this.data.timeline.items.push(block);
        this.sortTimelineItems();
        this._notifyChange();
        return block;
    }
    
    /**
     * Calculate relative day from absolute date
     */
    getRelativeDayFromDate(absoluteDate) {
        const startDate = this.getStartDate();
        const date = new Date(absoluteDate);
        const diffTime = date - startDate;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    
    /**
     * Calculate absolute date from relative day (for backward compatibility)
     */
    getDateFromRelativeDay(relativeDay) {
        const startDate = this.getStartDate();
        const date = new Date(startDate);
        date.setDate(date.getDate() + relativeDay);
        return date.toISOString().split('T')[0];
    }
    
    addAnnotation(dayOrDate, row, text = '') {
        // Accept either relative day (number) or absolute date (string)
        let date;
        if (typeof dayOrDate === 'number') {
            // Backward compatibility: calculate absolute date from relative day
            date = this.getDateFromRelativeDay(dayOrDate);
        } else {
            // Absolute date string provided
            date = dayOrDate;
        }
        
        const annotation = {
            type: 'annotation',
            id: this.generateId(),
            date, // Store absolute date
            row,
            text
        };
        this.data.timeline.annotations.push(annotation);
        this._notifyChange();
        return annotation;
    }
    
    removeAnnotation(id) {
        const index = this.data.timeline.annotations.findIndex(ann => ann.id === id);
        if (index !== -1) {
            const removed = this.data.timeline.annotations.splice(index, 1)[0];
            this._notifyChange();
            return removed;
        }
        return null;
    }
    
    getAnnotation(dayOrDate, row) {
        // Accept either relative day (number) or absolute date (string)
        let date;
        if (typeof dayOrDate === 'number') {
            // Convert relative day to absolute date for comparison
            date = this.getDateFromRelativeDay(dayOrDate);
        } else {
            date = dayOrDate;
        }
        return this.data.timeline.annotations.find(ann => ann.date === date && ann.row === row);
    }
    
    removeItem(id) {
        const index = this.data.timeline.items.findIndex(item => item.id === id);
        if (index !== -1) {
            const item = this.data.timeline.items.splice(index, 1)[0];
            // Note: off-timeline functionality removed, items are just deleted
            this._notifyChange();
            return item;
        }
        return null;
    }
    
    moveToTimeline(id, position) {
        let item = null;
        
        // Find in off-timeline blocks
        const blockIndex = this.data.offTimeline.blocks.findIndex(b => b.id === id);
        if (blockIndex !== -1) {
            item = this.data.offTimeline.blocks.splice(blockIndex, 1)[0];
        }
        
        if (item) {
            if (item.type === 'block') {
                // Convert relative position to absolute date
                item.startDate = this.getDateFromRelativeDay(position);
                // Remove old startDay if it exists
                delete item.startDay;
            }
            this.data.timeline.items.push(item);
            this.sortTimelineItems();
        }
        
        return item;
    }
    
    updateItem(id, updates) {
        // Check in timeline items
        let item = this.data.timeline.items.find(i => i.id === id);
        if (item) {
            // If updating startDay, convert to startDate
            if (item.type === 'block' && updates.startDay !== undefined && !updates.startDate) {
                updates.startDate = this.getDateFromRelativeDay(updates.startDay);
                delete updates.startDay;
            }
            // If updating day for annotation, convert to date
            if (item.type === 'annotation' && updates.day !== undefined && !updates.date) {
                updates.date = this.getDateFromRelativeDay(updates.day);
                delete updates.day;
            }
            Object.assign(item, updates);
            
            // If updating badge, update lastBadgeValue
            if (item.type === 'block' && updates.badge !== undefined) {
                this.data.timeline.lastBadgeValue = updates.badge;
            }
            
            this.sortTimelineItems();
            this._notifyChange();
            return item;
        }
        // Check in annotations
        item = this.data.timeline.annotations.find(a => a.id === id);
        if (item) {
            // If updating day, convert to date
            if (updates.day !== undefined && !updates.date) {
                updates.date = this.getDateFromRelativeDay(updates.day);
                delete updates.day;
            }
            Object.assign(item, updates);
            this._notifyChange();
            return item;
        }
        return null;
    }
    
    reorderItems(draggedId, targetIndex) {
        const draggedIndex = this.data.timeline.items.findIndex(i => i.id === draggedId);
        if (draggedIndex === -1) return;
        
        const [item] = this.data.timeline.items.splice(draggedIndex, 1);
        this.data.timeline.items.splice(targetIndex, 0, item);
    }
    
    sortTimelineItems() {
        this.data.timeline.items.sort((a, b) => {
            if (a.type === 'block' && b.type === 'block') {
                // Compare by absolute date
                const aDate = a.startDate || this.getDateFromRelativeDay(a.startDay || 0);
                const bDate = b.startDate || this.getDateFromRelativeDay(b.startDay || 0);
                return aDate.localeCompare(bDate);
            }
            return 0;
        });
    }
    
    getItem(id) {
        return this.data.timeline.items.find(i => i.id === id) ||
               this.data.offTimeline.blocks.find(b => b.id === id);
    }
    
    getAllItems() {
        return {
            timeline: [...this.data.timeline.items],
            offTimeline: {
                blocks: [...this.data.offTimeline.blocks]
            }
        };
    }
    
    toJSON() {
        return JSON.stringify(this.data, null, 2);
    }
    
    setStartDate(date) {
        const dateObj = date instanceof Date ? date : new Date(date);
        dateObj.setHours(0, 0, 0, 0);
        this.data.timeline.startDate = dateObj.toISOString().split('T')[0];
        this._notifyChange();
    }
    
    getStartDate() {
        // startDate is stored as YYYY-MM-DD, create Date object from it
        return new Date(this.data.timeline.startDate + 'T00:00:00');
    }
    
    fromJSON(json) {
        try {
            const parsed = typeof json === 'string' ? JSON.parse(json) : json;
            this.data = parsed;
            // Ensure startDate exists, default to today if not
            if (!this.data.timeline.startDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                this.data.timeline.startDate = today.toISOString().split('T')[0];
            } else {
                // Normalize startDate to YYYY-MM-DD format (start of day)
                const date = new Date(this.data.timeline.startDate);
                date.setHours(0, 0, 0, 0);
                this.data.timeline.startDate = date.toISOString().split('T')[0];
            }
            // Migrate old data: convert startDay to startDate for blocks
            this.data.timeline.items.forEach(item => {
                if (item.type === 'block') {
                    if (item.row === undefined) {
                        item.row = 0;
                    }
                    // Migrate startDay to startDate if needed
                    if (item.startDay !== undefined && !item.startDate) {
                        // Calculate absolute date from old startDay
                        const startDateObj = new Date(this.data.timeline.startDate + 'T00:00:00');
                        const absoluteDate = new Date(startDateObj);
                        absoluteDate.setDate(absoluteDate.getDate() + item.startDay);
                        item.startDate = absoluteDate.toISOString().split('T')[0];
                        // Keep startDay for backward compatibility during migration, but prefer startDate
                    }
                    // Migrate: add default badge if missing
                    if (item.badge === undefined) {
                        item.badge = this.data.timeline.lastBadgeValue || 'XD';
                    }
                }
            });
            
            // Ensure lastBadgeValue exists
            if (!this.data.timeline.lastBadgeValue) {
                this.data.timeline.lastBadgeValue = 'XD';
            }
            // Ensure annotations array exists
            if (!this.data.timeline.annotations) {
                this.data.timeline.annotations = [];
            }
            // Migrate old data: convert day to date for annotations
            this.data.timeline.annotations.forEach(ann => {
                if (ann.day !== undefined && !ann.date) {
                    // Calculate absolute date from old day
                    const startDateObj = new Date(this.data.timeline.startDate + 'T00:00:00');
                    const absoluteDate = new Date(startDateObj);
                    absoluteDate.setDate(absoluteDate.getDate() + ann.day);
                    ann.date = absoluteDate.toISOString().split('T')[0];
                    // Keep day for backward compatibility during migration, but prefer date
                }
            });
            // Find max ID to continue generating unique IDs
            const allItems = [
                ...this.data.timeline.items,
                ...this.data.timeline.annotations,
                ...this.data.offTimeline.blocks
            ];
            const maxId = allItems.reduce((max, item) => {
                const id = parseInt(item.id) || 0;
                return Math.max(max, id);
            }, 0);
            this.nextId = maxId + 1;
            return true;
        } catch (e) {
            console.error('Failed to parse JSON:', e);
            return false;
        }
    }
}

