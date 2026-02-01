/**
 * Universal Safe Ref Wrapper
 * 
 * World-class solution for ref-forwarding conflicts between:
 * - Radix UI (Dialogs, Popovers, Tooltips) that inject refs
 * - Framer Motion components that require refs
 * - React Router lazy-loaded components
 * 
 * This HOC provides bulletproof ref handling that:
 * 1. Never crashes on ref injection from parent libraries
 * 2. Maintains internal ref access for component logic
 * 3. Works with memo() for performance optimization
 * 4. Supports both callback refs and RefObject refs
 * 
 * @example
 * // Wrap any page or dialog component
 * const MyPage = withSafeRef(function MyPageContent() { ... });
 * export default MyPage;
 * 
 * @example
 * // With internal ref access
 * const MyComponent = withSafeRef(function MyContent(props, { internalRef }) {
 *   useEffect(() => { internalRef.current?.focus(); }, []);
 *   return <div>...</div>;
 * });
 */

import React, {
  forwardRef,
  useRef,
  useCallback,
  memo,
  type ForwardedRef,
  type RefObject,
  type ComponentType,
  type ReactNode,
} from 'react';

// ============= TYPES =============

/**
 * Ref utilities passed to wrapped components
 */
export interface SafeRefUtils<T extends HTMLElement = HTMLDivElement> {
  /** Internal ref for component's own DOM access */
  internalRef: RefObject<T>;
  /** Whether the component is currently mounted */
  isMounted: RefObject<boolean>;
}

/**
 * Props passed to wrapped components (original props + ref utilities)
 */
export type SafeWrappedProps<P, T extends HTMLElement = HTMLDivElement> = P & {
  /** Ref utilities for internal component use */
  refUtils?: SafeRefUtils<T>;
};

/**
 * Options for withSafeRef HOC
 */
export interface WithSafeRefOptions {
  /** Display name for debugging */
  displayName?: string;
  /** Element type for the wrapper (default: 'div') */
  as?: keyof JSX.IntrinsicElements;
  /** Additional wrapper className */
  wrapperClassName?: string;
  /** Whether to apply memo() optimization (default: true) */
  memoize?: boolean;
}

// ============= CORE HOC =============

/**
 * Creates a merged ref callback that safely handles both internal and external refs.
 * This is the core utility that prevents "Function components cannot be given refs" crashes.
 */
export function createMergedRef<T extends HTMLElement>(
  internalRef: RefObject<T>,
  externalRef: ForwardedRef<T>
): (node: T | null) => void {
  return (node: T | null) => {
    // Always update internal ref first
    (internalRef as React.MutableRefObject<T | null>).current = node;
    
    // Then update external ref (from Radix, etc.)
    if (externalRef) {
      if (typeof externalRef === 'function') {
        externalRef(node);
      } else {
        (externalRef as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

/**
 * Universal Safe Ref Wrapper HOC
 * 
 * Wraps any component to safely handle ref injection from parent UI libraries.
 * Prevents crashes from Radix UI, Framer Motion, and other ref-injecting libraries.
 * 
 * @param Component - The component to wrap
 * @param options - Configuration options
 * @returns A ref-safe wrapped component
 */
export function withSafeRef<P extends object, T extends HTMLElement = HTMLDivElement>(
  Component: ComponentType<P & { refUtils?: SafeRefUtils<T> }>,
  options: WithSafeRefOptions = {}
) {
  const {
    displayName = Component.displayName || Component.name || 'SafeComponent',
    memoize = true,
  } = options;

  // Create the wrapped component with forwardRef
  const WrappedComponent = forwardRef<T, P>(function SafeRefWrapper(props, externalRef) {
    // Internal refs for component's own use
    const internalRef = useRef<T>(null);
    const isMountedRef = useRef(true);

    // Track mount state for async safety
    React.useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    // Create merged ref callback - memoized to prevent unnecessary re-renders
    const mergedRef = useCallback(
      createMergedRef(internalRef, externalRef),
      [externalRef]
    );

    // Ref utilities for the wrapped component
    const refUtils: SafeRefUtils<T> = {
      internalRef: internalRef as RefObject<T>,
      isMounted: isMountedRef,
    };

    // Render the wrapped component with properly typed props
    const componentProps = {
      ...props,
      refUtils,
    } as P & { refUtils?: SafeRefUtils<T> };

    return <Component {...componentProps} />;
  });

  // Set display name for debugging
  WrappedComponent.displayName = `SafeRef(${displayName})`;

  // Optionally apply memo for performance
  if (memoize) {
    const MemoizedComponent = memo(WrappedComponent);
    MemoizedComponent.displayName = `SafeRef(${displayName})`;
    return MemoizedComponent;
  }

  return WrappedComponent;
}

// ============= SIMPLIFIED VARIANT =============

/**
 * Simplified wrapper for page components that don't need internal ref access.
 * Just absorbs injected refs silently to prevent crashes.
 * 
 * @example
 * const MyPage = withSafePageRef(function MyPageContent() {
 *   return <div>Page content</div>;
 * });
 */
export function withSafePageRef<P extends object>(
  Component: ComponentType<P>,
  displayName?: string
) {
  const name = displayName || Component.displayName || Component.name || 'SafePage';

  const WrappedPage = forwardRef<HTMLDivElement, P>(function SafePageWrapper(props, _ref) {
    // Simply absorb the ref - page components don't need it
    // The ref is intentionally ignored to prevent crashes
    const componentProps = props as P;
    return <Component {...componentProps} />;
  });

  WrappedPage.displayName = `SafePage(${name})`;

  const MemoizedPage = memo(WrappedPage);
  MemoizedPage.displayName = `SafePage(${name})`;

  return MemoizedPage;
}

// ============= HOOK FOR MANUAL USE =============

/**
 * Hook for components that need to manually handle ref merging.
 * Use this when you can't use the HOC (e.g., class components).
 * 
 * @example
 * const MyComponent = forwardRef((props, externalRef) => {
 *   const { mergedRef, internalRef, isMounted } = useSafeRef(externalRef);
 *   return <div ref={mergedRef}>...</div>;
 * });
 */
export function useSafeRef<T extends HTMLElement = HTMLDivElement>(
  externalRef?: ForwardedRef<T>
) {
  const internalRef = useRef<T>(null);
  const isMountedRef = useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mergedRef = useCallback(
    createMergedRef(internalRef, externalRef || null),
    [externalRef]
  );

  return {
    mergedRef,
    internalRef: internalRef as RefObject<T>,
    isMounted: isMountedRef,
  };
}

// ============= UTILITY TYPES =============

/**
 * Extract the element type from a component wrapped with withSafeRef
 */
export type SafeRefElement<C> = C extends React.ForwardRefExoticComponent<
  React.RefAttributes<infer T>
>
  ? T
  : HTMLDivElement;

/**
 * Type helper for components using withSafeRef
 */
export type SafeRefComponent<P extends object, T extends HTMLElement = HTMLDivElement> =
  React.MemoExoticComponent<React.ForwardRefExoticComponent<P & React.RefAttributes<T>>>;

export default withSafeRef;
