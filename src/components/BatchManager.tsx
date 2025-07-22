import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RotateCcw, 
  Eye, 
  Trash2, 
  Download,
  Filter,
  Search,
  Calendar
} from 'lucide-react';
import { useNodesApi, type BatchLog } from '../hooks/useNodesApi';

interface BatchManagerProps {
  onViewBatch?: (batchId: string) => void;
  onReviewDuplicates?: (batchId: string) => void;
}

type BatchStatus = 'pending' | 'processed' | 'error' | 'cancelled' | 'rolled_back';
type FilterStatus = 'all' | BatchStatus;

const BatchManager: React.FC<BatchManagerProps> = ({ onViewBatch, onReviewDuplicates }) => {
  const { getBatchLogs, loading, error } = useNodesApi();
  
  const [batches, setBatches] = useState<BatchLog[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<BatchLog[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'status' | 'total_records'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load batch logs
  const loadBatches = useCallback(async () => {
    try {
      const logs = await getBatchLogs();
      // Ensure logs is always an array
      setBatches(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.error('Failed to load batch logs:', err);
      setBatches([]); // Reset to empty array on error
    }
  }, [getBatchLogs]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Filter and search batches
  useEffect(() => {
    const safeBatches = Array.isArray(batches) ? batches : [];
    let filtered = safeBatches;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(batch => batch.status === filterStatus);
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(batch =>
        batch.batch_id.toLowerCase().includes(term) ||
        (batch.batch_name && batch.batch_name.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt.seconds * 1000).getTime();
          bValue = new Date(b.createdAt.seconds * 1000).getTime();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'total_records':
          aValue = a.total_records || 0;
          bValue = b.total_records || 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredBatches(filtered);
  }, [batches, filterStatus, searchTerm, sortBy, sortOrder]);

  const getStatusIcon = (status: BatchStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'processed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'rolled_back':
        return <RotateCcw className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: BatchStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'rolled_back':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.seconds 
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const renderBatchCard = (batch: BatchLog) => (
    <div key={batch.batch_id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon(batch.status)}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {batch.batch_name || batch.batch_id}
            </h3>
            <p className="text-sm text-gray-500">ID: {batch.batch_id}</p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(batch.status)}`}>
          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Total Records</p>
          <p className="text-lg font-semibold text-gray-900">{batch.total_records || 0}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Processed</p>
          <p className="text-lg font-semibold text-green-600">{batch.processed_records || 0}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Errors</p>
          <p className="text-lg font-semibold text-red-600">{batch.error_records || 0}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Created</p>
          <p className="text-sm text-gray-900">{formatDate(batch.createdAt)}</p>
        </div>
      </div>

      {batch.status === 'error' && batch.error_report && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-red-900 mb-1">Error Details</h4>
          <p className="text-sm text-red-700">
            {typeof batch.error_report === 'string' 
              ? batch.error_report 
              : batch.error_report.error || 'Unknown error'
            }
          </p>
        </div>
      )}

      {/* Actions */}
      {batch.status === 'processed' && (
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={() => onReviewDuplicates?.(batch.batch_id)}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Review Duplicates
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Batch Management</h2>
        <p className="text-gray-600">Monitor and manage your CSV upload batches</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="h-4 w-4 inline mr-1" />
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="error">Error</option>
              <option value="rolled_back">Rolled Back</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="h-4 w-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by batch name or ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as any);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="status-asc">Status A-Z</option>
              <option value="total_records-desc">Most Records</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {(['all', 'pending', 'processed', 'error', 'rolled_back'] as const).map(status => {
          const safeBatches = Array.isArray(batches) ? batches : [];
          const count = status === 'all' 
            ? safeBatches.length 
            : safeBatches.filter(b => b.status === status).length;
          
          return (
            <div key={status} className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-sm text-gray-500 capitalize">
                {status === 'all' ? 'Total' : status.replace('_', ' ')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Batches List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Loading batches...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Failed to Load Batches</h4>
              <p className="text-sm text-red-700">{typeof error === 'string' ? error : error?.message || 'An unexpected error occurred'}</p>
            </div>
          </div>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Batches Found</h3>
          <p className="text-gray-600">
            {searchTerm || filterStatus !== 'all' 
              ? 'No batches match your current filters.' 
              : 'Upload your first CSV file to get started.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBatches.map(renderBatchCard)}
        </div>
      )}
    </div>
  );
};

export default BatchManager;
