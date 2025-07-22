import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { CSVUpload } from '../components/CSVUpload';
import DuplicateReview from '../components/DuplicateReview';
import BatchManager from '../components/BatchManager';
import AliasManager from '../components/AliasManager';
import MasterMapping from '../components/MasterMapping';
import NodeRegistry from '../components/NodeRegistry';
import NetworkVisualization from '../components/NetworkVisualization';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { Upload, Database, Search, BarChart3, Users, FileCheck, Tag, Merge, Activity, TrendingUp } from 'lucide-react';
import type { CSVProcessingResult } from '../hooks/useNodesApi';

type ViewMode = 'overview' | 'upload' | 'review' | 'batches' | 'aliases' | 'mapping' | 'registry' | 'visualization' | 'analytics';

const PartnerMap: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const [lastUploadResult, setLastUploadResult] = useState<CSVProcessingResult | null>(null);
  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);

  const handleUploadComplete = (result: CSVProcessingResult) => {
    setLastUploadResult(result);
    
    // If there are duplicates to review, automatically navigate to review
    if (result.duplicate_warnings > 0) {
      setReviewBatchId(result.batch_id);
      setCurrentView('review');
    } else {
      // If no duplicates, show success and allow user to continue
      console.log('Upload completed with no duplicates:', result);
    }
  };

  const handleReviewComplete = () => {
    setCurrentView('overview');
    setReviewBatchId(null);
  };

  const handleViewBatch = (batchId: string) => {
    // Future implementation: detailed batch view
    console.log('View batch:', batchId);
  };

  const handleReviewDuplicates = (batchId: string) => {
    setReviewBatchId(batchId);
    setCurrentView('review');
  };

  const handleAliasUpdate = () => {
    // Callback when aliases are updated
    console.log('Aliases updated');
  };

  const handleMappingComplete = () => {
    // Callback when master mapping is completed
    console.log('Master mapping completed');
    setCurrentView('overview');
  };

  const navigationItems = [
    {
      id: 'overview' as ViewMode,
      label: 'Overview',
      icon: Database,
      description: 'System overview and quick actions'
    },
    {
      id: 'upload' as ViewMode,
      label: 'CSV Upload',
      icon: Upload,
      description: 'Import new node data'
    },
    {
      id: 'review' as ViewMode,
      label: 'Duplicate Review',
      icon: Users,
      description: 'Review and merge duplicates'
    },
    {
      id: 'batches' as ViewMode,
      label: 'Batch Management',
      icon: FileCheck,
      description: 'Track and manage imports'
    },
    {
      id: 'aliases' as ViewMode,
      label: 'Alias Management',
      icon: Tag,
      description: 'Manage entity and node aliases'
    },
    {
      id: 'mapping' as ViewMode,
      label: 'Master Mapping',
      icon: Merge,
      description: 'Consolidate similar records'
    },
    {
      id: 'registry' as ViewMode,
      label: 'Node Registry',
      icon: Search,
      description: 'Browse and manage nodes'
    },
    {
      id: 'visualization' as ViewMode,
      label: 'Network Map',
      icon: Activity,
      description: 'Visualize network connections'
    },
    {
      id: 'analytics' as ViewMode,
      label: 'Analytics',
      icon: TrendingUp,
      description: 'Network insights and reports'
    }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Travel Tech Node Registry</h2>
        <p className="text-gray-700 mb-6">
          Manage the complete ecosystem of travel technology systems, from property management 
          systems to online travel agencies. Import data, resolve duplicates, manage aliases, 
          and visualize connectivity relationships.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {navigationItems.slice(1).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-iol-red hover:shadow-md transition-all duration-200"
              >
                <Icon className="h-8 w-8 text-iol-red mb-3" />
                <h3 className="font-medium text-gray-900 mb-1">{item.label}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workflow Guide */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Data Management Workflow</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2">1</div>
            <h4 className="font-medium text-blue-900">Import</h4>
            <p className="text-sm text-blue-700">Upload CSV data</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-yellow-600 text-white rounded-full flex items-center justify-center mx-auto mb-2">2</div>
            <h4 className="font-medium text-blue-900">Review</h4>
            <p className="text-sm text-blue-700">Resolve duplicates</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-2">3</div>
            <h4 className="font-medium text-blue-900">Aliases</h4>
            <p className="text-sm text-blue-700">Manage variations</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-2">4</div>
            <h4 className="font-medium text-blue-900">Mapping</h4>
            <p className="text-sm text-blue-700">Consolidate records</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Import New Data</h3>
          <p className="text-blue-700 mb-4">
            Upload a CSV file with travel technology node information to get started.
          </p>
          <button
            onClick={() => setCurrentView('upload')}
            className="inline-flex items-center px-4 py-2 bg-iol-red text-white rounded-md hover:bg-red-700 transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            Start CSV Upload
          </button>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">Manage Aliases</h3>
          <p className="text-green-700 mb-4">
            Add and manage alternate names for entities and nodes to improve matching.
          </p>
          <button
            onClick={() => setCurrentView('aliases')}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Tag className="h-4 w-4 mr-2" />
            Manage Aliases
          </button>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-2">Network Visualization</h3>
          <p className="text-purple-700 mb-4">
            Explore interactive network maps showing system connectivity and relationships.
          </p>
          <button
            onClick={() => setCurrentView('visualization')}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <Activity className="h-4 w-4 mr-2" />
            View Network
          </button>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">Analytics Dashboard</h3>
          <p className="text-orange-700 mb-4">
            Access comprehensive analytics and insights about your network ecosystem.
          </p>
          <button
            onClick={() => setCurrentView('analytics')}
            className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            View Analytics
          </button>
        </div>
      </div>

      {lastUploadResult && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Upload</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{lastUploadResult.total_rows}</div>
              <div className="text-sm text-gray-500">Total Rows</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{lastUploadResult.valid_rows}</div>
              <div className="text-sm text-gray-500">Valid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{lastUploadResult.invalid_rows}</div>
              <div className="text-sm text-gray-500">Invalid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{lastUploadResult.duplicate_warnings}</div>
              <div className="text-sm text-gray-500">Duplicates</div>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <strong>Batch ID:</strong> {lastUploadResult.batch_id}
            </div>
            <div className="flex space-x-2">
              {lastUploadResult.duplicate_warnings > 0 && (
                <button
                  onClick={() => {
                    setReviewBatchId(lastUploadResult.batch_id);
                    setCurrentView('review');
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
                >
                  Review Duplicates
                </button>
              )}
              <button
                onClick={() => setCurrentView('batches')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
              >
                View Batches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Status */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Development Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span className="text-sm">CSV Upload & Processing</span>
            </div>
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span className="text-sm">Duplicate Detection & Review</span>
            </div>
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span className="text-sm">Batch Management</span>
            </div>
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span className="text-sm">Alias Management</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span className="text-sm">Master Mapping</span>
            </div>
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span className="text-sm">Node Registry & Search</span>
            </div>
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span className="text-sm">Network Visualization</span>
            </div>
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span className="text-sm">Analytics Dashboard</span>
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-green-100 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">✓</span>
              </div>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-green-900">System Complete</h4>
              <p className="text-sm text-green-700">
                All phases implemented successfully. The Node Intake & Mapping Engine is ready for production use.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUpload = () => (
    <CSVUpload 
      onUploadComplete={handleUploadComplete}
      onCancel={() => setCurrentView('overview')}
    />
  );

  const renderReview = () => {
    if (!reviewBatchId) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Duplicate Review</h2>
          <p className="text-gray-600">
            No batch selected for review. Please select a batch from the Batch Management page.
          </p>
          <button
            onClick={() => setCurrentView('batches')}
            className="mt-4 px-4 py-2 bg-iol-red text-white rounded-md hover:bg-red-700"
          >
            Go to Batch Management
          </button>
        </div>
      );
    }

    return (
      <DuplicateReview 
        batchId={reviewBatchId}
        onReviewComplete={handleReviewComplete}
        onCancel={() => setCurrentView('overview')}
      />
    );
  };

  const renderBatches = () => (
    <BatchManager 
      onViewBatch={handleViewBatch}
      onReviewDuplicates={handleReviewDuplicates}
    />
  );

  const renderAliases = () => (
    <AliasManager 
      onAliasUpdate={handleAliasUpdate}
    />
  );

  const renderMapping = () => (
    <MasterMapping 
      onMappingComplete={handleMappingComplete}
    />
  );

  const renderRegistry = () => (
    <NodeRegistry 
      onNodeSelect={(node) => console.log('Node selected:', node)}
      onEntitySelect={(entity) => console.log('Entity selected:', entity)}
    />
  );

  const renderVisualization = () => (
    <div className="h-screen">
      <NetworkVisualization 
        onNodeSelect={(nodeId) => console.log('Node selected:', nodeId)}
      />
    </div>
  );

  const renderAnalytics = () => (
    <AnalyticsDashboard 
      selectedTimeRange="30d"
    />
  );

  return (
    <Layout>
      <div className="bg-white min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-iol-red">Partner Map</h1>
                <p className="text-gray-600 mt-1">
                  Node Intake & Mapping Engine for Travel Technology Systems
                </p>
              </div>
              
              {currentView !== 'overview' && (
                <button
                  onClick={() => setCurrentView('overview')}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ← Back to Overview
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            {currentView !== 'overview' && (
              <div className="border-t border-gray-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                  {navigationItems.slice(1).map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                          isActive
                            ? 'border-iol-red text-iol-red'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className={`${currentView === 'visualization' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'} ${currentView === 'visualization' ? 'h-screen' : 'py-8'}`}>
          {currentView === 'overview' && renderOverview()}
          {currentView === 'upload' && renderUpload()}
          {currentView === 'review' && renderReview()}
          {currentView === 'batches' && renderBatches()}
          {currentView === 'aliases' && renderAliases()}
          {currentView === 'mapping' && renderMapping()}
          {currentView === 'registry' && renderRegistry()}
          {currentView === 'visualization' && renderVisualization()}
          {currentView === 'analytics' && renderAnalytics()}
        </div>
      </div>
    </Layout>
  );
};

export default PartnerMap; 