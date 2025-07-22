import React, { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X, ArrowRight, Eye, Edit3, Merge, Users, Building2 } from 'lucide-react';
import { useNodesApi, type DeduplicationResult } from '../hooks/useNodesApi';

interface DuplicateReviewProps {
  batchId: string;
  onReviewComplete?: (decisions: ProcessedDecision[]) => void;
  onCancel?: () => void;
}

interface ProcessedDecision {
  staging_id: string;
  action: 'approve_new' | 'merge_with_entity' | 'merge_with_node' | 'reject';
  target_id?: string;
  manual_edits?: any;
}

interface StagingNodeWithDuplicates {
  staging_node: any;
  duplicates: DeduplicationResult;
}

const DuplicateReview: React.FC<DuplicateReviewProps> = ({ batchId, onReviewComplete, onCancel }) => {
  const { getStagingNodes, analyzeDeduplication, processDeduplicationDecisions, loading, error } = useNodesApi();
  
  const [stagingNodes, setStagingNodes] = useState<any[]>([]);
  const [deduplicationResults, setDeduplicationResults] = useState<DeduplicationResult[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<string, ProcessedDecision>>(new Map());
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [processingDecisions, setProcessingDecisions] = useState(false);

  // Load staging nodes and analyze duplicates
  useEffect(() => {
    const loadData = async () => {
      try {
        const nodes = await getStagingNodes(batchId);
        setStagingNodes(nodes);
        
        if (nodes.length > 0) {
          const results = await analyzeDeduplication(batchId);
          setDeduplicationResults(results);
        }
      } catch (err) {
        console.error('Failed to load duplicate analysis:', err);
      }
    };

    if (batchId) {
      loadData();
    }
  }, [batchId, getStagingNodes, analyzeDeduplication]);

  // Get nodes that need review (have duplicates)
  const nodesNeedingReview = deduplicationResults.filter(result => result.has_duplicates);
  const totalNeedingReview = nodesNeedingReview.length;
  const currentNode = nodesNeedingReview[currentReviewIndex];

  const makeDecision = useCallback((stagingId: string, decision: ProcessedDecision) => {
    setDecisions(prev => new Map(prev.set(stagingId, decision)));
  }, []);

  const handleNextNode = useCallback(() => {
    if (currentReviewIndex < totalNeedingReview - 1) {
      setCurrentReviewIndex(prev => prev + 1);
    }
  }, [currentReviewIndex, totalNeedingReview]);

  const handlePreviousNode = useCallback(() => {
    if (currentReviewIndex > 0) {
      setCurrentReviewIndex(prev => prev - 1);
    }
  }, [currentReviewIndex]);

  const handleCompleteReview = useCallback(async () => {
    const pendingDecisions = Array.from(decisions.values());
    
    // Add automatic decisions for nodes without duplicates
    const autoDecisions: ProcessedDecision[] = deduplicationResults
      .filter(result => !result.has_duplicates)
      .map(result => ({
        staging_id: result.staging_id,
        action: 'approve_new' as const
      }));

    const allDecisions = [...pendingDecisions, ...autoDecisions];
    
    if (onReviewComplete) {
      onReviewComplete(allDecisions);
    }

    setProcessingDecisions(true);
    try {
      await processDeduplicationDecisions(allDecisions);
    } catch (err) {
      console.error('Failed to process decisions:', err);
    } finally {
      setProcessingDecisions(false);
    }
  }, [decisions, deduplicationResults, processDeduplicationDecisions, onReviewComplete]);

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'merge': return 'text-red-600 bg-red-50';
      case 'review': return 'text-yellow-600 bg-yellow-50';
      case 'separate': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Duplicate Analysis Results</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stagingNodes.length}</div>
            <div className="text-sm text-gray-500">Total Records</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {deduplicationResults.filter(r => !r.has_duplicates).length}
            </div>
            <div className="text-sm text-gray-500">Clean Records</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{totalNeedingReview}</div>
            <div className="text-sm text-gray-500">Need Review</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{decisions.size}</div>
            <div className="text-sm text-gray-500">Decisions Made</div>
          </div>
        </div>

        {totalNeedingReview === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Duplicates Found</h4>
            <p className="text-gray-600">All records are unique and ready for import.</p>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <p className="text-gray-600">
              Review potential duplicates to ensure data quality before import.
            </p>
            <button
              onClick={() => setViewMode('detail')}
              className="px-4 py-2 bg-iol-red text-white rounded-md hover:bg-red-700"
            >
              Start Review
            </button>
          </div>
        )}
      </div>

      {/* List of nodes needing review */}
      {totalNeedingReview > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Records Needing Review</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {nodesNeedingReview.map((result, index) => {
              const stagingNode = stagingNodes.find(n => n.id === result.staging_id);
              const decision = decisions.get(result.staging_id);
              
              return (
                <div key={result.staging_id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-900">
                          {stagingNode?.node_name || 'Unknown Node'}
                        </span>
                        <span className="text-sm text-gray-500">
                          ({stagingNode?.entity_name || 'Unknown Entity'})
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(result.matches[0]?.confidence_level || 'low')}`}>
                          {result.duplicate_count} potential duplicate{result.duplicate_count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        Suggested: {result.suggested_merge_action?.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {decision ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Decided
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pending
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setCurrentReviewIndex(index);
                          setViewMode('detail');
                        }}
                        className="text-iol-red hover:text-red-700 text-sm font-medium"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleCompleteReview}
          disabled={decisions.size < totalNeedingReview || processingDecisions}
          className="px-6 py-2 bg-iol-red text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processingDecisions ? 'Processing...' : 'Complete Review'}
        </button>
      </div>
    </div>
  );

  const renderDetailReview = () => {
    if (!currentNode) return null;

    const stagingNode = stagingNodes.find(n => n.id === currentNode.staging_id);
    const currentDecision = decisions.get(currentNode.staging_id);

    return (
      <div className="space-y-6">
        {/* Progress header */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Reviewing Record {currentReviewIndex + 1} of {totalNeedingReview}
              </h3>
              <p className="text-gray-600">
                {stagingNode?.node_name} ({stagingNode?.entity_name})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('list')}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to List
              </button>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-iol-red h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentReviewIndex + 1) / totalNeedingReview) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staging Record */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
              <h4 className="font-medium text-blue-900 flex items-center">
                <Eye className="h-4 w-4 mr-2" />
                New Record (Staging)
              </h4>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500">Node Name</label>
                <div className="text-sm text-gray-900">{stagingNode?.node_name}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Entity Name</label>
                <div className="text-sm text-gray-900">{stagingNode?.entity_name}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Website</label>
                <div className="text-sm text-gray-900">{stagingNode?.website}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Category</label>
                <div className="text-sm text-gray-900">{stagingNode?.node_category}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Direction</label>
                <div className="text-sm text-gray-900">{stagingNode?.direction}</div>
              </div>
              {stagingNode?.notes && (
                <div>
                  <label className="block text-xs font-medium text-gray-500">Notes</label>
                  <div className="text-sm text-gray-900">{stagingNode.notes}</div>
                </div>
              )}
            </div>
          </div>

          {/* Potential Matches */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Potential Matches</h4>
            {currentNode.matches.map((match, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h5 className="font-medium text-gray-900 flex items-center">
                      {match.target_type === 'entity' ? (
                        <Building2 className="h-4 w-4 mr-2" />
                      ) : (
                        <Users className="h-4 w-4 mr-2" />
                      )}
                      {match.target_type === 'entity' ? 'Existing Entity' : 'Existing Node'}
                    </h5>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(match.confidence_level)}`}>
                        {Math.round(match.similarity_score * 100)}% match
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionColor(match.recommended_action)}`}>
                        {match.recommended_action}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm text-gray-900 mb-2">{match.target_name}</div>
                  <div className="text-xs text-gray-500">
                    Match reasons: {match.match_reasons.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Decision Panel */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 mb-4">Make Decision</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => makeDecision(currentNode.staging_id, {
                staging_id: currentNode.staging_id,
                action: 'approve_new'
              })}
              className={`p-4 border rounded-lg text-left hover:border-iol-red transition-colors ${
                currentDecision?.action === 'approve_new' ? 'border-iol-red bg-red-50' : 'border-gray-200'
              }`}
            >
              <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
              <div className="font-medium text-gray-900">Create New</div>
              <div className="text-xs text-gray-500">Add as new entity/node</div>
            </button>

            {currentNode.matches.filter(m => m.target_type === 'entity').map((match, index) => (
              <button
                key={`entity-${index}`}
                onClick={() => makeDecision(currentNode.staging_id, {
                  staging_id: currentNode.staging_id,
                  action: 'merge_with_entity',
                  target_id: match.target_id
                })}
                className={`p-4 border rounded-lg text-left hover:border-iol-red transition-colors ${
                  currentDecision?.action === 'merge_with_entity' && currentDecision?.target_id === match.target_id 
                    ? 'border-iol-red bg-red-50' : 'border-gray-200'
                }`}
              >
                <Merge className="h-6 w-6 text-blue-600 mb-2" />
                <div className="font-medium text-gray-900">Merge with Entity</div>
                <div className="text-xs text-gray-500">{match.target_name}</div>
              </button>
            ))}

            {currentNode.matches.filter(m => m.target_type === 'node').map((match, index) => (
              <button
                key={`node-${index}`}
                onClick={() => makeDecision(currentNode.staging_id, {
                  staging_id: currentNode.staging_id,
                  action: 'merge_with_node',
                  target_id: match.target_id
                })}
                className={`p-4 border rounded-lg text-left hover:border-iol-red transition-colors ${
                  currentDecision?.action === 'merge_with_node' && currentDecision?.target_id === match.target_id 
                    ? 'border-iol-red bg-red-50' : 'border-gray-200'
                }`}
              >
                <Merge className="h-6 w-6 text-purple-600 mb-2" />
                <div className="font-medium text-gray-900">Merge with Node</div>
                <div className="text-xs text-gray-500">{match.target_name}</div>
              </button>
            ))}

            <button
              onClick={() => makeDecision(currentNode.staging_id, {
                staging_id: currentNode.staging_id,
                action: 'reject'
              })}
              className={`p-4 border rounded-lg text-left hover:border-iol-red transition-colors ${
                currentDecision?.action === 'reject' ? 'border-iol-red bg-red-50' : 'border-gray-200'
              }`}
            >
              <X className="h-6 w-6 text-red-600 mb-2" />
              <div className="font-medium text-gray-900">Reject</div>
              <div className="text-xs text-gray-500">Don't import this record</div>
            </button>
          </div>

          {currentDecision && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-green-900">
                Decision: {currentDecision.action.replace('_', ' ')}
                {currentDecision.target_id && ` with ${currentDecision.target_id}`}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handlePreviousNode}
            disabled={currentReviewIndex === 0}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex space-x-3">
            {currentReviewIndex < totalNeedingReview - 1 ? (
              <button
                onClick={handleNextNode}
                disabled={!currentDecision}
                className="px-4 py-2 bg-iol-red text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            ) : (
              <button
                onClick={handleCompleteReview}
                disabled={!currentDecision || processingDecisions}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingDecisions ? 'Processing...' : 'Complete Review'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-iol-red border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">Analyzing duplicates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-red-900 mb-1">Analysis Failed</h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Duplicate Review</h2>
        <p className="text-gray-600">Review potential duplicates and make merge decisions</p>
      </div>

      {viewMode === 'list' ? renderOverview() : renderDetailReview()}
    </div>
  );
};

export default DuplicateReview; 