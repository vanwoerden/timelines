These are initial instructions for the project.

We are building a web application that allows users to create and save project timelines. 

Exact frameworks is to be determined but we have a preference for native html, css, and javascript.

# Variables
## time interval: 1 day
## font: Kollektif

# Features

## timeline
The timeline is the main feature of the application. It is a list of blocks and milestones that describe the sequence and length of steps in a project.

## block
- A block is a square or rectangle with resizable width. 
- A block can be dragged and dropped to reorder the timeline. 
-   A block can in inserted in between other blocks, or dropped on the right or left of other blocks. Blocks rearrange themselves to fit the new block. Everything snaps into place. 
- Dragging a block outside of the timeline and letting it go will move the block to a list of blocks that are not on the timeline.
- A new block can be created by hovering in between blocks or on the right or left of blocks. A plus icon indicates a new block can be created.
- Hovering close to the right edge of a block will change the cursor to show drag handles. Dragging the right edge will resize the block. Resizing snaps to the nearest time interval
- A block has a label that can be edited by clicking on the block. The label is displayed on the block.

## milestone
- A milestone is a vertical line with a circular dot at the top that is not resizable. It is a single point in time.
- A milestone can be dragged and dropped to reorder the timeline.
- A milestone can be inserted in between other blocks, or dropped on the right or left of other blocks. Milestones rearrange themselves to fit the new milestone. Everything snaps into place. 
- Dragging a milestone outside of the timeline and letting it go will move the milestone to a list of milestones that are not on the timeline.
- A new milestone can be created by hovering in between blocks or on the right or left of blocks. A plus icon indicates a new milestone can be created.
- Hovering close to the right edge of a milestone will change the cursor to show drag handles. Dragging the right edge will resize the milestone. Resizing snaps to the nearest time interval

## save/load
- The timeline can be saved as a JSON object. For now save to a file and load from a file.

## zoom and pan
- The timeline can be zoomed in and out.
- the user can click and drag to create an area of the timeline to zoom in on.
- plus and minus keyboard shortcuts to zoom in and out.
- plus and minus buttons to zoom in and out.
- The timeline can be scrolleed left and right when it doesn't fit in the viewport.
- the user can toggle between a blocks showing as days or weeks. Use a segmented button to toggle between the two.

## presets
- there is a dropdown that contains a list of project presets. To be determined what these are.