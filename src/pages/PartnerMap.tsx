import React, { useState } from 'react';
import { Upload, Database, FileText } from 'lucide-react';
import { CSVUpload } from '../components/CSVUpload';
import BatchManager from '../components/BatchManager';
import type { CSVProcessingResult } from '../hooks/useNodesApi';

type ViewMode = 'overview' | 'upload' | 'batches';

const PartnerMap: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const [uploadResult, setUploadResult] = useState<CSVProcessingResult | null>(null);

  const handleUploadComplete = (result: CSVProcessingResult) => {
    setUploadResult(result);
    setCurrentView('batches');
  };

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Partner Map Management</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload and manage travel technology partner data. Process CSV files, 
          review batch uploads, and maintain your partner network database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div 
          className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-red-500 cursor-pointer transition-colors"
          onClick={() => setCurrentView('upload')}
        >
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-red-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload CSV Data</h3>
            <p className="text-gray-600">
              Upload partner and node data from CSV files. Our system will validate, 
              process, and check for duplicates automatically.
            </p>
          </div>
        </div>

        <div 
          className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-red-500 cursor-pointer transition-colors"
          onClick={() => setCurrentView('batches')}
        >
          <div className="text-center">
            <Database className="mx-auto h-12 w-12 text-red-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage Batches</h3>
            <p className="text-gray-600">
              View and manage your upload batches. Review processing status, 
              handle duplicates, and monitor data quality.
            </p>
          </div>
        </div>
      </div>

      {uploadResult && (
        <div className="max-w-2xl mx-auto bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start">
            <FileText className="h-6 w-6 text-green-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-lg font-medium text-green-900 mb-2">Recent Upload Complete</h4>
              <p className="text-green-700 mb-2">
                Successfully processed {uploadResult.valid_rows} of {uploadResult.total_rows} rows
              </p>
              <p className="text-sm text-green-600">
                Batch ID: {uploadResult.batch_id}
              </p>
              <button
                onClick={() => setCurrentView('batches')}
                className="mt-3 inline-flex items-center text-sm font-medium text-green-600 hover:text-green-500"
              >
                View in Batch Manager →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderNavigation = () => (
    <div className="mb-6">
      <nav className="flex space-x-1">
        <button
          onClick={() => setCurrentView('overview')}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            currentView === 'overview'
              ? 'bg-red-100 text-red-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setCurrentView('upload')}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            currentView === 'upload'
              ? 'bg-red-100 text-red-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          Upload CSV
        </button>
        <button
          onClick={() => setCurrentView('batches')}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            currentView === 'batches'
              ? 'bg-red-100 text-red-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          Batch Management
        </button>
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {renderNavigation()}

        {currentView === 'overview' && renderOverview()}
        
        {currentView === 'upload' && (
          <CSVUpload
            onUploadComplete={handleUploadComplete}
            onCancel={() => setCurrentView('overview')}
          />
        )}
        
        {currentView === 'batches' && (
          <BatchManager
            onViewBatch={(batchId) => {
              console.log('View batch:', batchId);
              // Future: Navigate to batch details
            }}
            onReviewDuplicates={(batchId) => {
              console.log('Review duplicates for batch:', batchId);
              // Future: Navigate to duplicate review
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PartnerMap;
