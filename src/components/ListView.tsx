import React from 'react';
import { Search, Filter, Plus } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, item: T) => React.ReactNode;
  sortable?: boolean;
}

interface CreateField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'select';
  required?: boolean;
  options?: string[];
}

interface ListViewProps<T> {
  // Original simple props
  title?: string;
  data?: T[];
  columns?: Column<T>[];
  onRowClick?: (item: T) => void;
  onAdd?: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  
  // Extended props for the sophisticated version
  items?: T[];
  onItemSelect?: (item: T) => void;
  onSort?: (field: string) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  emptyDescription?: string;
  searchValue?: string;
  enableCreate?: boolean;
  createLabel?: string;
  onCreateItem?: (data: any) => void;
  onUpdateItem?: (id: string, data: any) => void;
  onDeleteItem?: (id: string) => void;
  createFields?: CreateField[];
  
  [key: string]: any; // Allow additional props
}

export function ListView<T extends { id: string }>({
  title = 'Items',
  data,
  columns = [],
  onRowClick,
  onAdd,
  searchTerm = '',
  onSearchChange,
  loading = false,
  emptyMessage = 'No items found',
  items,
  onItemSelect,
  onSort,
  sortField,
  sortDirection,
  emptyDescription,
  searchValue,
  enableCreate,
  createLabel,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  createFields = [],
  ...rest
}: ListViewProps<T>) {
  // Use items if data is not provided (for compatibility)
  const displayData = data || items || [];
  const handleRowClick = onRowClick || onItemSelect;
  const currentSearchTerm = searchTerm || searchValue || '';
  
  // For now, show a simple list view that works with the data
  // The sophisticated form/CRUD features can be added later
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {(onAdd || enableCreate) && (
            <button
              onClick={onAdd}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {createLabel || `Add ${title.slice(0, -1)}`}
            </button>
          )}
        </div>
        
        {/* Search and filters */}
        <div className="mt-4 flex items-center gap-4">
          {onSearchChange && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={currentSearchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}
          <button className="btn-secondary flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="text-lg font-medium">{emptyMessage}</div>
            {emptyDescription && (
              <div className="text-sm mt-2">{emptyDescription}</div>
            )}
          </div>
        ) : columns.length > 0 ? (
          // Table view when columns are provided
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => column.sortable && onSort && onSort(String(column.key))}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortable && sortField === String(column.key) && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayData.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick?.(item)}
                  className={`${
                    handleRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                  } transition-colors`}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {column.render 
                        ? column.render(item[column.key], item)
                        : String(item[column.key] || '')
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // Card view when no columns are provided
          <div className="grid gap-4 p-6">
            {displayData.map((item: any) => (
              <div
                key={item.id}
                onClick={() => handleRowClick?.(item)}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <h3 className="font-semibold text-lg">{item.name}</h3>
                {item.description && (
                  <p className="text-gray-600 mt-1">{item.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                  {item.region && <span>Region: {item.region}</span>}
                  {item.status && <span>Status: {item.status}</span>}
                  {item.industry && <span>Industry: {item.industry}</span>}
                  {item.size && <span>Size: {item.size}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 