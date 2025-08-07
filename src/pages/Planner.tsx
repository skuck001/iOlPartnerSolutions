import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, RefreshCw } from 'lucide-react';
import { usePlannerData } from '../hooks/usePlannerData';
import { PlannerCalendar } from '../components/PlannerCalendar';
import { OptimizedLoader } from '../components/OptimizedLoader';

export const Planner: React.FC = () => {
  const navigate = useNavigate();
  const {
    filteredTasks,
    loading,
    error,
    filters,
    sortOptions,
    updateFilters,
    updateSortOptions,
    clearFilters,
    fetchData
  } = usePlannerData();



  const handleRefresh = () => {
    fetchData();
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <OptimizedLoader />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-800">Error Loading Planner</h3>
            <p className="mt-2 text-red-600">{error}</p>
            <div className="mt-4 text-sm text-red-600">
              <p>This might be due to:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Server maintenance or temporary issues</li>
                <li>Network connectivity problems</li>
                <li>Large dataset causing timeouts</li>
              </ul>
            </div>
            <div className="mt-4 flex space-x-3">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Planner</h1>
              <p className="mt-1 text-gray-600">
                Unified view of all tasks and activities from Opportunities and Assignments
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area with padding to account for fixed header */}
      <div className="pt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex gap-6">
          {/* Main Content Section (2/3 width) */}
          <div className="flex-1 w-full lg:w-2/3" data-section="main-content">



            {/* Calendar View */}
            <PlannerCalendar 
              tasks={filteredTasks}
              onTaskClick={(task) => {
                // Navigate to the task's parent detail page
                navigate(task.linkedUrl);
              }}
              filters={filters}
              onUpdateFilters={updateFilters}
              onClearFilters={clearFilters}
            />
          </div>

          {/* Sidebar Content Section (1/3 width) */}
          <div className="hidden lg:block w-1/3" data-section="sidebar-content">
            {/* Placeholder for future sidebar content */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-500 text-sm">Sidebar content will go here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 