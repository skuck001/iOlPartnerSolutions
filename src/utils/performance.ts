/**
 * Performance monitoring utilities for tracking LCP and other metrics
 */

export const measureLCP = () => {
  if (typeof window === 'undefined') return;

  // Measure Largest Contentful Paint
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    
    console.log(`🚀 LCP: ${(lastEntry.startTime / 1000).toFixed(2)}s`);
    
    if (lastEntry.startTime > 2500) {
      console.error('❌ Poor LCP performance detected:', lastEntry);
      console.log('🔍 LCP Element:', lastEntry.element);
    } else if (lastEntry.startTime < 2500) {
      console.log('✅ Good LCP performance!');
    }
  });

  try {
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    console.warn('LCP observation not supported');
  }
};

export const measureDataLoadTime = (operation: string) => {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      console.log(`📊 ${operation}: ${duration.toFixed(2)}ms`);
      
      if (duration > 1000) {
        console.warn(`⚠️ Slow operation: ${operation} took ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    }
  };
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  measureLCP();
  
  // Log initial page load performance
  window.addEventListener('load', () => {
    setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      console.log(`📈 Page Load: ${(navigation.loadEventEnd - navigation.navigationStart).toFixed(2)}ms`);
    }, 0);
  });
}