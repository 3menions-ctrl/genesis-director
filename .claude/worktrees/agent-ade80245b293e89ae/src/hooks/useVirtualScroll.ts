/**
 * Virtual Scroll Hook v1.0
 * 
 * Implements virtual scrolling for large lists to prevent
 * DOM overload. Only renders items visible in the viewport.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface VirtualScrollOptions {
  /** Total number of items in the list */
  totalItems: number;
  /** Height of each item in pixels (or estimated average) */
  itemHeight: number;
  /** Width of each item in pixels (for horizontal scroll) */
  itemWidth?: number;
  /** Number of items to render outside viewport (buffer) */
  overscan?: number;
  /** Container height (if not using ref measurement) */
  containerHeight?: number;
  /** Container width (for horizontal scroll) */
  containerWidth?: number;
  /** Scroll direction */
  direction?: 'vertical' | 'horizontal';
  /** Gap between items */
  gap?: number;
}

interface VirtualScrollReturn {
  /** Index of first visible item */
  startIndex: number;
  /** Index of last visible item */
  endIndex: number;
  /** Total scrollable height/width */
  totalSize: number;
  /** Offset before first rendered item */
  offsetBefore: number;
  /** Offset after last rendered item */
  offsetAfter: number;
  /** Visible items indices */
  visibleRange: number[];
  /** Ref to attach to scroll container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Scroll to a specific index */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  /** Handle scroll event */
  onScroll: () => void;
}

export function useVirtualScroll(options: VirtualScrollOptions): VirtualScrollReturn {
  const {
    totalItems,
    itemHeight,
    itemWidth,
    overscan = 3,
    containerHeight,
    containerWidth,
    direction = 'vertical',
    gap = 0,
  } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportSize, setViewportSize] = useState(
    direction === 'horizontal' ? (containerWidth || 0) : (containerHeight || 0)
  );
  
  // Calculate item size with gap
  const itemSize = direction === 'horizontal' 
    ? (itemWidth || itemHeight) + gap
    : itemHeight + gap;
  
  // Total scrollable size
  const totalSize = useMemo(() => {
    return totalItems * itemSize - gap; // Remove last gap
  }, [totalItems, itemSize, gap]);
  
  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    if (viewportSize === 0 || totalItems === 0) {
      return { startIndex: 0, endIndex: Math.min(overscan * 2, totalItems - 1) };
    }
    
    const start = Math.floor(scrollOffset / itemSize);
    const visibleCount = Math.ceil(viewportSize / itemSize);
    const end = start + visibleCount;
    
    // Apply overscan
    const startWithOverscan = Math.max(0, start - overscan);
    const endWithOverscan = Math.min(totalItems - 1, end + overscan);
    
    return {
      startIndex: startWithOverscan,
      endIndex: endWithOverscan,
    };
  }, [scrollOffset, viewportSize, itemSize, totalItems, overscan]);
  
  // Calculate offsets for positioning
  const offsetBefore = startIndex * itemSize;
  const offsetAfter = Math.max(0, totalSize - (endIndex + 1) * itemSize);
  
  // Visible range array
  const visibleRange = useMemo(() => {
    const range: number[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      range.push(i);
    }
    return range;
  }, [startIndex, endIndex]);
  
  // Handle scroll events with throttling
  const rafRef = useRef<number | null>(null);
  
  const onScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        const offset = direction === 'horizontal'
          ? containerRef.current.scrollLeft
          : containerRef.current.scrollTop;
        setScrollOffset(offset);
      }
    });
  }, [direction]);
  
  // Measure container on mount and resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const measureContainer = () => {
      const size = direction === 'horizontal'
        ? container.clientWidth
        : container.clientHeight;
      setViewportSize(size);
    };
    
    measureContainer();
    
    const resizeObserver = new ResizeObserver(measureContainer);
    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [direction]);
  
  // Scroll to index function
  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    if (!container) return;
    
    const offset = index * itemSize;
    
    if (direction === 'horizontal') {
      container.scrollTo({ left: offset, behavior });
    } else {
      container.scrollTo({ top: offset, behavior });
    }
  }, [direction, itemSize]);
  
  return {
    startIndex,
    endIndex,
    totalSize,
    offsetBefore,
    offsetAfter,
    visibleRange,
    containerRef,
    scrollToIndex,
    onScroll,
  };
}

/**
 * Grid virtual scroll for 2D layouts
 */
interface VirtualGridOptions {
  totalItems: number;
  itemWidth: number;
  itemHeight: number;
  gap?: number;
  overscan?: number;
}

interface VirtualGridReturn {
  visibleRange: number[];
  containerRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  columnsPerRow: number;
  totalHeight: number;
  offsetTop: number;
}

export function useVirtualGrid(options: VirtualGridOptions): VirtualGridReturn {
  const {
    totalItems,
    itemWidth,
    itemHeight,
    gap = 0,
    overscan = 2,
  } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Calculate columns per row
  const columnsPerRow = useMemo(() => {
    if (containerSize.width === 0) return 1;
    return Math.max(1, Math.floor((containerSize.width + gap) / (itemWidth + gap)));
  }, [containerSize.width, itemWidth, gap]);
  
  // Total rows
  const totalRows = Math.ceil(totalItems / columnsPerRow);
  const rowHeight = itemHeight + gap;
  const totalHeight = totalRows * rowHeight - gap;
  
  // Calculate visible rows
  const { startRow, endRow } = useMemo(() => {
    if (containerSize.height === 0) {
      return { startRow: 0, endRow: Math.min(overscan * 2, totalRows - 1) };
    }
    
    const start = Math.floor(scrollTop / rowHeight);
    const visibleRows = Math.ceil(containerSize.height / rowHeight);
    const end = start + visibleRows;
    
    return {
      startRow: Math.max(0, start - overscan),
      endRow: Math.min(totalRows - 1, end + overscan),
    };
  }, [scrollTop, containerSize.height, rowHeight, totalRows, overscan]);
  
  // Calculate visible item indices
  const visibleRange = useMemo(() => {
    const range: number[] = [];
    const startIndex = startRow * columnsPerRow;
    const endIndex = Math.min((endRow + 1) * columnsPerRow - 1, totalItems - 1);
    
    for (let i = startIndex; i <= endIndex; i++) {
      range.push(i);
    }
    return range;
  }, [startRow, endRow, columnsPerRow, totalItems]);
  
  const offsetTop = startRow * rowHeight;
  
  // Handle scroll
  const rafRef = useRef<number | null>(null);
  
  const onScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    });
  }, []);
  
  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const measure = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };
    
    measure();
    
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);
  
  return {
    visibleRange,
    containerRef,
    onScroll,
    columnsPerRow,
    totalHeight,
    offsetTop,
  };
}
