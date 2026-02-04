
# Plan: Fix Avatar Selection Gallery Centering Across All Devices

## Problem Summary

The avatar selection gallery is not centered on the screen because the implementation uses a horizontal scroll pattern that is fundamentally left-aligned. Six specific issues were identified through code analysis.

## Solution Approach

The fix requires a **conditional centering strategy**: when avatars fit within the viewport, center them; when they overflow, allow left-aligned scrolling with symmetric padding.

---

## Technical Implementation

### Step 1: Update VirtualAvatarGallery.tsx - Add Dynamic Centering Logic

**Changes to make:**

1. **Detect if content fits in viewport** by comparing total content width to container width
2. **Apply centering conditionally** when content fits, otherwise use scroll behavior
3. **Use `justify-center` on the scroll container** when content doesn't overflow

```text
┌─────────────────────────────────────────┐
│  Before (current - always left-aligned) │
│  [Card][Card][Card]                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  After (centered when fits)             │
│       [Card][Card][Card]                │
└─────────────────────────────────────────┘
```

**Code changes:**

**a)** Add state to track if content overflows:
```typescript
const [contentOverflows, setContentOverflows] = useState(true);
```

**b)** Update the measurement effect to detect overflow:
```typescript
useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container) return;
  
  const checkOverflow = () => {
    const totalContentWidth = displayAvatars.length * ITEM_WIDTH + (isMobile ? 32 : 96);
    setContentOverflows(totalContentWidth > container.clientWidth);
  };
  
  checkOverflow();
  const resizeObserver = new ResizeObserver(checkOverflow);
  resizeObserver.observe(container);
  return () => resizeObserver.disconnect();
}, [displayAvatars.length, ITEM_WIDTH, isMobile]);
```

**c)** Update scroll container classes for conditional centering:
```tsx
<div
  ref={scrollContainerRef}
  onScroll={handleScroll}
  className={cn(
    "overflow-x-auto scrollbar-hide py-4 md:py-8",
    !contentOverflows && "flex justify-center" // Center when content fits
  )}
  style={{
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
  }}
>
```

**d)** Update inner container to conditionally remove w-max when centered:
```tsx
<div 
  className={cn(
    "flex",
    contentOverflows && "w-max" // Only use w-max when scrolling needed
  )}
  style={{ 
    gap: CARD_GAP,
    paddingLeft: isMobile ? 16 : 48,
    paddingRight: isMobile ? 16 : 48,
  }}
>
```

---

### Step 2: Update Avatars.tsx - Add Consistent Width Constraint

**File:** `src/pages/Avatars.tsx`

Add consistent max-width and centering to the gallery wrapper to match sibling components:

```tsx
<SafeComponent name="VirtualAvatarGallery">
  <div className="mb-8 animate-fade-in w-full" style={{ animationDelay: '0.2s' }}>
```

The `w-full` ensures the gallery wrapper takes full width, allowing the internal centering logic to work correctly.

---

## Files to Modify

1. **`src/components/avatars/VirtualAvatarGallery.tsx`**
   - Add overflow detection state
   - Add ResizeObserver to measure content vs container
   - Conditionally apply centering classes
   - Update inner container to conditionally use `w-max`

2. **`src/pages/Avatars.tsx`**
   - Ensure wrapper has `w-full` for proper containment

---

## How This Fixes Each Root Cause

| Root Cause | Fix |
|------------|-----|
| 1. `w-max` prevents centering | Conditionally apply only when overflow needed |
| 2. No centering on scroll container | Add `flex justify-center` when content fits |
| 3. Parent wrapper has no constraints | Keep `w-full` to allow internal centering |
| 4. Inconsistent with siblings | Gallery now centers like Hero/Filters |
| 5. Design is left-aligned | Changed to dynamic centering |
| 6. Outer gallery lacks centering | Inner logic now handles this |

---

## Testing Requirements

After implementation, verify:
- **Desktop (1920px+)**: Gallery content centered when few avatars visible (after filtering)
- **Tablet (768-1024px)**: Proper centering on smaller filters
- **Mobile (320-480px)**: Cards centered or scrollable with symmetric padding
- **Full avatar set (119+)**: Scrolls normally from left to right
- **Filtered results (1-5 avatars)**: Centered on screen
