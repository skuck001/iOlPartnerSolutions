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
  const { getBatchLogs, rollbackBatch, updateBatchStatus, loading, error } = useNodesApi();
  
  const [batches, setBatches] = useState<BatchLog[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<BatchLog[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'status' | 'total_records'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<string | null>(null);

  // Load batch logs
  const loadBatches = useCallback(async () => {
    try {
      const logs = await getBatchLogs();
      setBatches(logs);
    } catch (err) {
      console.error('Failed to load batch logs:', err);
    }
  }, [getBatchLogs]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Filter and search batches
  useEffect(() => {
    let filtered = batches;

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

  const getStatusColor = (status: BatchStatus) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'processed':
        return 'text-green-700 bg-green-100 border-green-200';
      case 'error':
        return 'text-red-700 bg-red-100 border-red-200';
      case 'cancelled':
        return 'text-gray-700 bg-gray-100 border-gray-200';
      case 'rolled_back':
        return 'text-purple-700 bg-purple-100 border-purple-200';
      default:
        return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status: BatchStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'processed':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'rolled_back':
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const handleRollback = async (batchId: string) => {
    try {
      await rollbackBatch(batchId);
      await loadBatches(); // Refresh the list
      setShowRollbackConfirm(null);
    } catch (err) {
      console.error('Rollback failed:', err);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const downloadBatchReport = (batch: BatchLog) => {
    const report = {
      batch_id: batch.batch_id,
      batch_name: batch.batch_name,
      status: batch.status,
      created_at: formatDate(batch.createdAt),
      completed_at: formatDate(batch.completedAt),
      total_records: batch.total_records,
      processed_records: batch.processed_records,
      error_records: batch.error_records,
      error_report: batch.error_report
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_report_${batch.batch_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderBatchCard = (batch: BatchLog) => (
    <div key={batch.batch_id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {batch.batch_name || batch.batch_id}
            </h3>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(batch.status)}`}>
              {getStatusIcon(batch.status)}
              <span className="ml-1 capitalize">{batch.status.replace('_', ' ')}</span>
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            ID: {batch.batch_id}
          </p>
          <p className="text-sm text-gray-500">
            Created: {formatDate(batch.createdAt)}
          </p>
          {batch.completedAt && (
            <p className="text-sm text-gray-500">
              Completed: {formatDate(batch.completedAt)}
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => downloadBatchReport(batch)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            title="Download Report"
          >
            <Download className="h-4 w-4" />
          </button>
          
          {batch.status === 'processed' && (
            <>
              <button
                onClick={() => onViewBatch?.(batch.batch_id)}
                className="p-2 text-blue-400 hover:text-blue-600 rounded-md"
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowRollbackConfirm(batch.batch_id)}
                className="p-2 text-red-400 hover:text-red-600 rounded-md"
                title="Rollback"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">{batch.total_records || 0}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-green-600">{batch.processed_records || 0}</div>
          <div className="text-xs text-gray-500">Processed</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-red-600">{batch.error_records || 0}</div>
          <div className="text-xs text-gray-500">Errors</div>
        </div>
      </div>

      {/* Error details */}
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
            className="px-3 py-1 text-sm bg-iol-red text-white rounded-md hover:bg-red-700"
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
        <p className="text-gray-600">Track and manage CSV upload batches</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
                placeholder="Search batch ID or name..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="error">Error</option>
              <option value="cancelled">Cancelled</option>
              <option value="rolled_back">Rolled Back</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
            >
              <option value="createdAt">Created Date</option>
              <option value="status">Status</option>
              <option value="total_records">Record Count</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {(['all', 'pending', 'processed', 'error', 'rolled_back'] as const).map(status => {
          const count = status === 'all' 
            ? batches.length 
            : batches.filter(b => b.status === status).length;
          
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

      {/* Batch List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-iol-red border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Loading batches...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Failed to Load Batches</h4>
              <p className="text-sm text-red-700">{error}</p>
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

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Confirm Rollback</h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will permanently delete all nodes and entities created from this batch. 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRollbackConfirm(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRollback(showRollbackConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Rollback Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchManager; 