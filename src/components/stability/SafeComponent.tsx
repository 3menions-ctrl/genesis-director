/**
 * Safe Component Wrapper
 * 
 * A component-level error boundary with silent failure option.
 * Use for non-critical UI sections that shouldn't crash the page.
 */

import React, { Component, ReactNode } from 'react';
import { stabilityMonitor } from '@/lib/stabilityMonitor';

interface SafeComponentProps {
  children: ReactNode;
  /** Component name for error tracking */
  name?: string;
  /** Fallback to render on error (null = render nothing) */
  fallback?: ReactNode;
  /** Log error silently without user notification */
  silent?: boolean;
}

interface SafeComponentState {
  hasError: boolean;
}

/**
 * SafeComponent - Lightweight error boundary for individual components.
 * Catches errors and optionally renders nothing, preventing cascading failures.
 */
export class SafeComponent extends Component<SafeComponentProps, SafeComponentState> {
  state: SafeComponentState = { hasError: false };

  static getDerivedStateFromError(): SafeComponentState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const { name, silent = false } = this.props;
    
    stabilityMonitor.log(stabilityMonitor.classify(error), error.message, {
      componentName: name || 'SafeComponent',
      stack: error.stack,
      silent,
    });
    
    if (!silent) {
      console.error(`[SafeComponent${name ? ` - ${name}` : ''}]`, error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

/**
 * SilentBoundary - Error boundary that fails invisibly.
 * Use for optional UI enhancements that shouldn't affect core functionality.
 */
export class SilentBoundary extends Component<
  { children: ReactNode; name?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Log silently for debugging
    console.debug(`[SilentBoundary${this.props.name ? ` - ${this.props.name}` : ''}] Component failed:`, error.message);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/**
 * withSafeComponent HOC - Wraps a component with SafeComponent
 */
export function withSafeComponent<P extends object>(
  Component: React.ComponentType<P>,
  options?: { name?: string; fallback?: ReactNode; silent?: boolean }
) {
  const displayName = options?.name || Component.displayName || Component.name || 'Component';

  function WrappedComponent(props: P) {
    return (
      <SafeComponent name={displayName} {...options}>
        <Component {...props} />
      </SafeComponent>
    );
  }

  WrappedComponent.displayName = `Safe(${displayName})`;
  return WrappedComponent;
}

export default SafeComponent;
