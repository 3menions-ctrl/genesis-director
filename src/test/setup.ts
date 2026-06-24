import { vi } from "vitest";
import "@testing-library/jest-dom";

// AUDIT FIX L-17: stub the Supabase env so tests that import the real
// src/integrations/supabase/client.ts at module load don't throw on an invalid
// URL. CI sets VITE_SUPABASE_URL=https://stub.supabase.co; mirror that here so
// the suite is hermetic locally too (setupFiles run before each test file's
// imports).
vi.stubEnv("VITE_SUPABASE_URL", "https://stub.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "stub-publishable-key");

// Mock URL.createObjectURL / revokeObjectURL for jsdom
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = () => 'blob:mock-url';
  URL.revokeObjectURL = () => {};
}

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = IntersectionObserverMock as any;

// Polyfill CSS.supports for jsdom (used by browserCompat module)
if (typeof (globalThis as any).CSS === 'undefined') {
  (globalThis as any).CSS = { supports: () => false };
} else if (typeof (globalThis as any).CSS.supports !== 'function') {
  (globalThis as any).CSS.supports = () => false;
}
