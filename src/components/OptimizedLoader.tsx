import React from 'react';

interface OptimizedLoaderProps {
  title?: string;
  subtitle?: string;
  showSkeleton?: boolean;
}

export const OptimizedLoader: React.FC<OptimizedLoaderProps> = ({ 
  title = "Loading...", 
  subtitle,
  showSkeleton = false 
}) => {
  if (showSkeleton) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          {/* Header renders immediately for better LCP */}
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          </div>
          
          {/* Skeleton content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
    </div>
  );
};