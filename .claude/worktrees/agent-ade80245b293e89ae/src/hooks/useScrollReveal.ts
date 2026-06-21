import { useEffect, useRef } from 'react';

/**
 * Hook that adds scroll-driven reveal animations to elements.
 * Uses IntersectionObserver for performant, GPU-accelerated reveals.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Add the scroll-reveal class (starts invisible)
    el.classList.add('scroll-reveal');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el); // Only reveal once
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px', ...options }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/**
 * Hook that observes multiple children for staggered reveals.
 */
export function useStaggeredReveal(containerSelector = '.stagger-child') {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const children = container.querySelectorAll(containerSelector);
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    children.forEach((child, i) => {
      child.classList.add('scroll-reveal');
      (child as HTMLElement).style.animationDelay = `${i * 100}ms`;
      observer.observe(child);
    });

    return () => observer.disconnect();
  }, [containerSelector]);

  return containerRef;
}
