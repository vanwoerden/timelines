# Timeline Editor Application Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Features](#core-features)
4. [User Guide](#user-guide)
5. [Data Model](#data-model)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Technical Architecture](#technical-architecture)
8. [Styling and Theming](#styling-and-theming)

---

## Introduction

### Purpose and Functionality

The Timeline Editor is a web-based application for creating and managing project timelines. It allows users to:

- Create and organize timeline blocks representing time periods
- Add annotations at specific points in time
- Categorize blocks using a badge system (XD, PM, PD)
- Drag and drop blocks to reorder them
- Resize blocks with automatic snapping to day intervals
- Edit block labels inline
- Zoom and pan the timeline view
- Save and load timeline data as JSON files
- Automatically save changes to browser localStorage

### Technology Stack

- **Vanilla JavaScript (ES6 Modules)** - Core application logic
- **GSAP (GreenSock Animation Platform)** - Smooth animations and transitions
- **HTML5 & CSS3** - Structure and styling
- **LocalStorage API** - Auto-save functionality
- **File API** - Import/export JSON files

### Architecture Overview

The application follows a modular architecture with clear separation of concerns:

- **Data Model** (`data-model.js`) - Manages timeline data, serialization, and persistence
- **Timeline** (`timeline.js`) - Main rendering engine and event coordination
- **Block** (`block.js`) - Individual block component with editing, badges, and tooltips
- **Annotation** (`annotation.js`) - Annotation component for point-in-time markers
- **Drag & Drop** (`drag-drop.js`) - Handles block reordering and row movement
- **Resize** (`resize.js`) - Block resizing with snap-to-grid and push behavior
- **Zoom & Pan** (`zoom-pan.js`) - Viewport controls and zoom functionality
- **Save & Load** (`save-load.js`) - JSON file import/export
- **Auto-save** (`auto-save.js`) - LocalStorage persistence with debouncing

---

## Getting Started

### Running the Application

1. Open `index.html` in a modern web browser
2. The application will automatically restore any previously saved timeline from localStorage
3. If no saved data exists, you'll start with an empty timeline

### Initial Setup

1. **Set Start Date**: Use the "Start Date" input in the header to set the timeline's starting date (defaults to today)
2. **Create Blocks**: Click anywhere on the timeline track to create a new block
3. **Add Annotations**: Hover over grid intersections to see a plus icon, then click to create an annotation

---

## Core Features

### Blocks

Blocks are rectangular timeline items that represent time periods. Each block has:

- **Label**: Editable text displayed on the block
- **Duration**: Measured in days, can be resized
- **Badge**: Category indicator (XD, PM, or PD) displayed in the top-right corner
- **Row**: Vertical position on the timeline (supports multiple rows)
- **Border Color**: Automatically matches the badge value

**Block Properties:**
- Default duration: 5 days when created
- Minimum width: Based on zoom level and day width
- Height: 80px (fixed)
- Position: Absolute positioning based on start date and row

### Annotations

Annotations are circular markers positioned at gridline intersections (day/row combinations). They represent point-in-time notes or milestones.

**Annotation Features:**
- Created by hovering over grid intersections and clicking the plus icon
- Display as filled circles (16px diameter)
- Show tooltips on hover with full text content
- Click to edit text inline
- Empty annotations are automatically removed

### Badge System

Blocks support three badge categories that cycle through:

1. **XD** (Experience Design) - Green (`--accent-color-primary`)
2. **PM** (Product Management) - Yellow (`--accent-color-tertiary`)
3. **PD** (Product Development) - Blue (`--accent-color-quaternary`)

**Badge Behavior:**
- Click the badge to cycle: XD → PM → PD → XD
- Badge color matches the category
- Block border color automatically matches badge value
- Last used badge value is remembered for new blocks

### Multi-Row Timeline

The timeline supports multiple rows, allowing blocks to be organized vertically:

- Blocks can be dragged between rows
- Each row is 80px tall with 32px padding at the top
- Grid lines extend vertically across all rows
- Date labels appear at the top of the timeline
- Weekend columns are highlighted with a light gray background

---

## User Guide

### Creating Blocks

1. **Click on Timeline Track**: Click anywhere on the timeline track (not on an existing block) to create a new block
2. **Default Properties**: New blocks are created with:
   - 5-day duration
   - Empty label (shows as non-breaking space)
   - Badge set to last used value (default: XD)
   - Positioned at the clicked location
   - Row determined by vertical click position

### Editing Block Labels

1. **Click the Label**: Click directly on a block's label text to enter edit mode
2. **Edit Text**: Type to modify the label
3. **Finish Editing**: 
   - Press `Enter` to save
   - Press `Escape` to cancel
   - Click outside the input to save

### Selecting Blocks

- **Click Block Body**: Click anywhere on a block (except the label or badge) to select it
- **Visual Feedback**: Selected blocks show:
  - Dashed outline in accent color
  - Enhanced shadow effect
  - Highlighted appearance

### Deleting Blocks

- **Keyboard Shortcut**: Press `Delete` or `Backspace` while a block is selected
- **Note**: Cannot delete while editing a label (to prevent accidental deletion)

### Drag and Drop

**Reordering Blocks:**
1. Click and hold on a block (not on label or resize handle)
2. Drag horizontally to reorder within the same row
3. Other blocks automatically rearrange to make space
4. Release to drop the block in the new position

**Moving Between Rows:**
1. Drag a block vertically while dragging
2. The block will snap to the nearest row
3. Release to place the block in the new row

**Visual Feedback:**
- Dragging block becomes semi-transparent
- Drop indicators show where the block will be placed
- Blocks being pushed show visual feedback during drag

### Resizing Blocks

1. **Hover Over Right Edge**: Hover near the right edge of a block to reveal the resize handle
2. **Drag to Resize**: Click and drag the resize handle to change block duration
3. **Snap to Grid**: Resizing automatically snaps to day intervals
4. **Push Behavior**: Blocks to the right are automatically pushed when a block is resized larger

**Resize Details:**
- Minimum duration: 1 day
- Snaps to nearest day boundary
- Visual feedback shows new width during resize
- Blocks in the same row are pushed if they would overlap

### Badge Cycling

1. **Click Badge**: Click the badge in the top-right corner of a block
2. **Cycle Through**: Each click cycles: XD → PM → PD → XD
3. **Visual Update**: Badge text and block border color update immediately

### Creating Annotations

1. **Hover Over Grid**: Move your mouse over a gridline intersection (where a day column meets a row)
2. **See Plus Icon**: A circular plus icon appears at the intersection
3. **Click to Create**: Click the plus icon to create a new annotation
4. **Edit Text**: The annotation immediately enters edit mode - type your text
5. **Save**: Press `Enter` or click outside to save

### Editing Annotations

1. **Click Annotation Circle**: Click on an existing annotation circle
2. **Edit Mode**: An input field appears
3. **Modify Text**: Type to change the annotation text
4. **Save or Cancel**:
   - Press `Enter` to save
   - Press `Escape` to cancel (or remove if empty)

### Zoom Controls

**Zoom In:**
- Click the `+` button in the header
- Press `Ctrl/Cmd + +` or `Ctrl/Cmd + =`
- Scroll with `Ctrl/Cmd` key held while hovering over timeline

**Zoom Out:**
- Click the `−` button in the header
- Press `Ctrl/Cmd + -`
- Scroll with `Ctrl/Cmd` key held while hovering over timeline

**Zoom to Selection:**
- Hold `Shift` and drag to select an area
- Release to zoom into the selected area (simplified - just zooms in)

**Zoom Display:**
- Current zoom level shown as percentage in header (e.g., "100%")
- Zoom affects day width and all block positions

### Pan/Scroll

- **Horizontal Scroll**: When the timeline exceeds the viewport width, scroll horizontally using:
  - Mouse wheel (horizontal scroll if supported)
  - Trackpad gestures
  - Scrollbar at bottom of timeline container

### Start Date Configuration

1. **Change Start Date**: Use the date input in the header
2. **Recalculation**: All blocks and annotations automatically recalculate positions based on the new start date
3. **Date Format**: Uses browser's native date picker (YYYY-MM-DD format)

### Save and Load

**Export to JSON:**
1. Click "Export timeline to JSON" button
2. File downloads automatically with name like `timeline-1234567890.json`
3. Contains complete timeline state including blocks, annotations, zoom, and start date

**Import from JSON:**
1. Click "Load JSON file" button
2. Select a previously exported JSON file
3. Timeline replaces current data with loaded data
4. Automatically renders the loaded timeline

**Clear Timeline:**
1. Click "Clear timeline" button
2. Removes all blocks and annotations
3. Clears selection
4. Timeline remains empty until new items are added

### Auto-Save

- **Automatic**: Changes are automatically saved to browser localStorage
- **Debounce**: Saves 2 seconds after the last change
- **Status Indicator**: Shows "Saving changes..." while saving, then "All changes saved to localStorage"
- **Restoration**: Timeline automatically restores from localStorage on page load
- **Storage Key**: Uses key `timeline-autosave`

---

## Data Model

### Structure

The timeline data is stored in a JSON structure:

```json
{
  "timeline": {
    "items": [
      {
        "type": "block",
        "id": "1",
        "startDate": "2024-01-15",
        "duration": 5,
        "label": "Project Phase 1",
        "row": 0,
        "badge": "XD"
      }
    ],
    "annotations": [
      {
        "type": "annotation",
        "id": "2",
        "date": "2024-01-20",
        "row": 0,
        "text": "Milestone reached"
      }
    ],
    "zoom": 1.0,
    "scrollPosition": 0,
    "startDate": "2024-01-01",
    "lastBadgeValue": "XD"
  },
  "offTimeline": {
    "blocks": []
  }
}
```

### Block Data Structure

- `type`: Always `"block"`
- `id`: Unique string identifier
- `startDate`: ISO date string (YYYY-MM-DD) - absolute date
- `duration`: Number of days
- `label`: Text content (can be empty)
- `row`: Vertical position (0-based index)
- `badge`: One of `"XD"`, `"PM"`, or `"PD"`

### Annotation Data Structure

- `type`: Always `"annotation"`
- `id`: Unique string identifier
- `date`: ISO date string (YYYY-MM-DD) - absolute date
- `row`: Vertical position (0-based index)
- `text`: Annotation content (can be empty, but empty annotations are removed)

### Date Handling

- **Absolute Dates**: All dates are stored as ISO date strings (YYYY-MM-DD)
- **Relative Days**: Calculated on-the-fly from absolute dates and start date
- **Backward Compatibility**: Old data with `startDay` or `day` properties is automatically migrated to `startDate`/`date`

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` or `Backspace` | Delete selected block (when not editing) |
| `Ctrl/Cmd + +` or `Ctrl/Cmd + =` | Zoom in |
| `Ctrl/Cmd + -` | Zoom out |
| `Ctrl/Cmd + Mouse Wheel` | Zoom in/out |
| `Shift + Drag` | Select area to zoom into |
| `Enter` | Save when editing block label or annotation |
| `Escape` | Cancel editing (or remove if empty) |

---

## Technical Architecture

### Event Handling

**Pointer Events:**
- `pointerdown` - Used for drag initiation, resize, and badge clicks
- `pointermove` - Track drag and resize operations
- `pointerup` - Complete drag or resize operations

**Click Events:**
- Used for block selection, label editing, and annotation interactions
- Carefully managed to prevent conflicts with drag operations

**Event Propagation:**
- Badge clicks use `stopPropagation()` to prevent block selection
- Resize handle clicks prevent block drag operations
- Label clicks trigger edit mode before block selection

### Date System

**Absolute Date Storage:**
- All dates stored as ISO strings (YYYY-MM-DD format)
- Start date stored in data model
- Block `startDate` and annotation `date` are absolute

**Relative Day Calculation:**
- Calculated dynamically: `(absoluteDate - startDate) / millisecondsPerDay`
- Used for positioning and rendering
- Rounded to nearest integer

**Date Migration:**
- Old data format with `startDay` (relative) automatically converted to `startDate` (absolute)
- Ensures backward compatibility with older saved files

### Animation System

**GSAP Animations:**
- Block position updates use `gsap.to()` for smooth transitions
- Auto-save status uses fade in/out animations
- Resize operations use smooth width transitions

**Animation Properties:**
- Duration: 0.3s for position changes
- Easing: `power2.out` for natural motion
- Opacity transitions: 0.2s for status updates

### Row Layout System

**Row Calculation:**
- Each row is 80px tall (block height)
- 32px padding at top of timeline
- Row index: `Math.floor((y - padding) / blockHeight)`
- Minimum row: 0

**Vertical Positioning:**
- Blocks positioned: `top = padding + (row * blockHeight)`
- Grid lines extend full height
- Annotations centered at row intersections

### Rendering Pipeline

1. **Clear**: Remove all existing items from DOM
2. **Calculate Dimensions**: Determine timeline width based on items and zoom
3. **Render Grid**: Draw vertical grid lines and weekend backgrounds
4. **Render Date Labels**: Add date labels every 7 days
5. **Render Blocks**: Create and position all blocks
6. **Render Annotations**: Create and position all annotations
7. **Update Container**: Set container height to accommodate all rows

### Snap-to-Grid

**Day Snapping:**
- All positions snap to day boundaries
- Day width calculated: `dayWidth * zoom`
- Pixel to day: `Math.round(pixelX / dayWidth)`
- Day to pixel: `day * dayWidth`

**Resize Snapping:**
- Duration changes snap to whole days
- Visual feedback shows snapped position during drag
- Final duration always whole number of days

---

## Styling and Theming

### CSS Variables

The application uses CSS custom properties for theming:

```css
--primary-color: #131313
--secondary-color: #4a4a4a
--block-color: #00000040
--background: #0f0f0f
--background-secondary: #191a1a
--timeline-bg: #0d0c0c
--border-color: #3a3e3c
--gridline-color: #1c1a1a
--text-primary: #f1f1f1
--text-secondary: #a0a0a0
--accent-color-primary: #35b66f (Green - XD)
--accent-color-secondary: #b635a5 (Purple - Annotations)
--accent-color-tertiary: #b69a35 (Yellow - PM)
--accent-color-quaternary: #4d52dc (Blue - PD)
```

### Badge Color Mapping

| Badge | CSS Variable | Color | Usage |
|-------|-------------|------|-------|
| XD | `--accent-color-primary` | #35b66f (Green) | Experience Design |
| PM | `--accent-color-tertiary` | #b69a35 (Yellow) | Product Management |
| PD | `--accent-color-quaternary` | #4d52dc (Blue) | Product Development |

**Visual Application:**
- Badge text color matches category
- Block border color automatically matches badge value
- Applied via inline style on block element

### Block Styling

**Default Block:**
- Background: Semi-transparent black (`--block-color`)
- Border: 1px solid, color matches badge
- Height: 80px (fixed)
- Padding: 0.4rem 0.6rem
- Border radius: None (square corners)
- Shadow: Subtle drop shadow

**Selected Block:**
- Outline: 1px dashed in accent color
- Enhanced shadow with glow effect
- Slightly elevated appearance

**Hover State:**
- Slight upward translation (-2px)
- Enhanced shadow
- Resize handle becomes visible

### Annotation Styling

**Circle:**
- Size: 16px diameter
- Background: `--accent-color-secondary` (purple)
- Border radius: 50% (perfect circle)
- Position: Centered at grid intersection

**Tooltip:**
- Background: Dark with transparency
- Text: Primary text color
- Max width: 200px
- Wraps text if longer than 200px
- Positioned above annotation

### Grid System

**Vertical Grid Lines:**
- Color: `--gridline-color`
- Width: 1px (configurable via `--gridline-width`)
- Spacing: Based on day width and zoom level
- Z-index: 0 (behind content)

**Horizontal Grid Lines:**
- Color: `--gridline-color`
- Spacing: 80px (block height)
- Extend full timeline width
- Z-index: 0

**Weekend Highlighting:**
- Background: Light gray overlay
- Applies to Saturday and Sunday columns
- Z-index: 1 (above grid, below content)

**Date Labels:**
- Format: "Mon-DD-YYYY" (e.g., "Jan-15-2024")
- Frequency: Every 7 days
- Position: Top of timeline, centered on day column
- Font size: 10px
- Color: `--text-secondary`

### Typography

**Font Family:**
- Primary: Eudoxus Sans (300 weight) from Google Fonts
- Fallback: System fonts

**Font Sizes:**
- Block labels: 14px
- Badge text: 12px
- Date labels: 10px
- Annotation tooltips: 14px

**Font Weights:**
- Most text: 300 (light)
- Headers: 300 (light)

### Responsive Behavior

- Timeline container scrolls horizontally when content exceeds viewport
- Vertical scrolling for multiple rows
- Zoom affects all dimensions proportionally
- Touch-friendly interaction areas (minimum 8px for resize handle)

---

## Additional Notes

### Browser Compatibility

- Requires modern browser with ES6 module support
- LocalStorage API required for auto-save
- File API required for import/export
- Pointer events preferred, falls back to mouse events

### Performance Considerations

- Rendering is optimized to only update changed elements
- GSAP animations use GPU acceleration when available
- Large timelines may require optimization for many blocks
- Auto-save debouncing prevents excessive localStorage writes

### Known Limitations

- Weeks view mode is not yet fully implemented (UI exists but functionality incomplete)
- Annotation tooltips may overlap with nearby elements
- Very long block labels may overflow (handled with word-wrap)
- Maximum timeline length is limited by browser performance

---

*Documentation last updated: Based on current codebase state*

