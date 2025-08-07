import React, { useState } from 'react';
import { X, Calendar, Filter } from 'lucide-react';
import type { UnifiedTaskFilters } from '../types';

interface PlannerFiltersProps {
  filters: UnifiedTaskFilters;
  onUpdateFilters: (filters: Partial<UnifiedTaskFilters>) => void;
  onClearFilters: () => void;
}

const STATUS_OPTIONS = [
  { value: 'Overdue', label: 'Overdue', color: 'text-red-600' },
  { value: 'Due Today', label: 'Due Today', color: 'text-orange-600' },
  { value: 'Upcoming', label: 'Upcoming', color: 'text-blue-600' },
  { value: 'Completed', label: 'Completed', color: 'text-green-600' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'Critical', label: 'Critical', color: 'text-red-600' },
  { value: 'High', label: 'High', color: 'text-orange-600' },
  { value: 'Medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'Low', label: 'Low', color: 'text-green-600' },
] as const;

const TYPE_OPTIONS = [
  { value: 'OpportunityActivity', label: 'Opportunity Activity' },
  { value: 'OpportunityChecklist', label: 'Opportunity Checklist' },
  { value: 'OpportunityBlocker', label: 'Opportunity Blocker' },
  { value: 'AssignmentActivity', label: 'Assignment Activity' },
  { value: 'AssignmentChecklist', label: 'Assignment Checklist' },
] as const;

const PARENT_TYPE_OPTIONS = [
  { value: 'Opportunity', label: 'Opportunities' },
  { value: 'Assignment', label: 'Assignments' },
] as const;

export const PlannerFilters: React.FC<PlannerFiltersProps> = ({
  filters,
  onUpdateFilters,
  onClearFilters
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleFilterChange = (key: keyof UnifiedTaskFilters, value: any) => {
    if (value === '' || value === null || value === undefined) {
      // Create a new filters object without the removed key
      const { [key]: _, ...newFilters } = filters;
      // Pass the entire new filters object to replace the current filters
      onUpdateFilters(newFilters as UnifiedTaskFilters);
    } else {
      onUpdateFilters({ ...filters, [key]: value });
    }
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : undefined;
    const currentRange = filters.dateRange || { start: undefined, end: undefined };
    const newRange = { ...currentRange, [field]: date };
    
    if (newRange.start || newRange.end) {
      onUpdateFilters({ dateRange: newRange });
    } else {
      handleFilterChange('dateRange', undefined);
    }
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {Object.keys(filters).length} active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </button>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            >
              <X className="w-4 h-4 mr-1" />
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority
          </label>
          <select
            value={filters.priority || ''}
            onChange={(e) => handleFilterChange('priority', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type
          </label>
          <select
            value={filters.type || ''}
            onChange={(e) => handleFilterChange('type', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Parent Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source
          </label>
          <select
            value={filters.parentType || ''}
            onChange={(e) => handleFilterChange('parentType', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Sources</option>
            {PARENT_TYPE_OPTIONS.map((parentType) => (
              <option key={parentType.value} value={parentType.value}>
                {parentType.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Advanced Filters</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Assigned To Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To
              </label>
              <input
                type="text"
                value={filters.assignedTo || ''}
                onChange={(e) => handleFilterChange('assignedTo', e.target.value || undefined)}
                placeholder="Enter user name or ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={filters.dateRange?.start?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={filters.dateRange?.end?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Active Filters</h4>
          <div className="flex flex-wrap gap-2">
            {filters.status && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Status: {STATUS_OPTIONS.find(s => s.value === filters.status)?.label}
                <button
                  onClick={() => handleFilterChange('status', undefined)}
                  className="ml-1 hover:bg-blue-200 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.priority && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Priority: {PRIORITY_OPTIONS.find(p => p.value === filters.priority)?.label}
                <button
                  onClick={() => handleFilterChange('priority', undefined)}
                  className="ml-1 hover:bg-blue-200 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.type && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Type: {TYPE_OPTIONS.find(t => t.value === filters.type)?.label}
                <button
                  onClick={() => handleFilterChange('type', undefined)}
                  className="ml-1 hover:bg-blue-200 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.parentType && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Source: {PARENT_TYPE_OPTIONS.find(p => p.value === filters.parentType)?.label}
                <button
                  onClick={() => handleFilterChange('parentType', undefined)}
                  className="ml-1 hover:bg-blue-200 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.assignedTo && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Assigned: {filters.assignedTo}
                <button
                  onClick={() => handleFilterChange('assignedTo', undefined)}
                  className="ml-1 hover:bg-blue-200 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.dateRange && (filters.dateRange.start || filters.dateRange.end) && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Date Range: {filters.dateRange.start?.toLocaleDateString()} - {filters.dateRange.end?.toLocaleDateString()}
                <button
                  onClick={() => handleFilterChange('dateRange', undefined)}
                  className="ml-1 hover:bg-blue-200 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 