

# Redirect to OpenReel Video for Editing

## Overview
Add an "Edit in OpenReel" button to the video editor that opens [openreel.video](https://openreel.video) in a new tab. Before redirecting, the app will download all project clips as individual MP4 files so the user has them ready to import into OpenReel.

## What Changes

### 1. Add "Edit in OpenReel" button to EditorToolbar
- Add a new button in `src/components/editor/EditorToolbar.tsx` next to the existing export button
- Icon: external link icon from lucide-react
- Label: "Edit in OpenReel"
- On click: triggers clip download, then opens `https://openreel.video` in a new tab

### 2. Clip download before redirect
In `src/pages/VideoEditor.tsx`:
- Add a `handleOpenInOpenReel` function that:
  1. Collects all video clip `sourceUrl` values from the current timeline
  2. Downloads each clip as an MP4 file using the browser's download API (anchor click with `download` attribute)
  3. Shows a toast: "Clips downloaded! Import them into OpenReel to continue editing."
  4. Opens `https://openreel.video` in a new tab via `window.open()`

### 3. Visual indicator
- Add a small info tooltip on the button explaining: "Open your clips in OpenReel Video, a professional open-source browser editor with full export support"

## Files Changed

| File | Change |
|------|--------|
| `src/components/editor/EditorToolbar.tsx` | Add "Edit in OpenReel" button |
| `src/pages/VideoEditor.tsx` | Add `handleOpenInOpenReel` handler |

## Technical Notes
- No new dependencies required
- Clips are downloaded via standard anchor-click download pattern
- OpenReel runs 100% client-side so users' files stay private
- The existing editor and export functionality remain unchanged as a fallback

