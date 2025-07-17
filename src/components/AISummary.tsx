import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { useOpportunitiesApi } from '../hooks/useOpportunitiesApi';
import { format } from 'date-fns';
import type { Opportunity } from '../types';

interface AISummaryProps {
  opportunity: Opportunity;
  onSummaryUpdate?: (summary: string) => void;
}

export const AISummary: React.FC<AISummaryProps> = ({ opportunity, onSummaryUpdate }) => {
  const { generateAISummaryManual } = useOpportunitiesApi();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullSummary, setShowFullSummary] = useState(false);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await generateAISummaryManual(opportunity.id);
      onSummaryUpdate?.(result.summary);
    } catch (err) {
      setError('Failed to generate summary. Please try again.');
      console.error('Error generating AI summary:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const hasSummary = Boolean(opportunity.aiSummary);
  
  // Safely handle timestamp conversion
  const getTimestampAsDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    
    // If it's a Firestore Timestamp
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it's already a Date
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // If it's a string or number, try to parse it
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
  };

  const summaryDate = getTimestampAsDate(opportunity.aiSummaryGeneratedAt);
  const summaryAge = summaryDate ? Date.now() - summaryDate.getTime() : null;
  const isStale = summaryAge ? summaryAge > 24 * 60 * 60 * 1000 : false; // 24 hours

  // Truncate summary for display
  const displaySummary = opportunity.aiSummary || '';
  const isLongSummary = displaySummary.length > 120;
  const truncatedSummary = isLongSummary && !showFullSummary 
    ? displaySummary.substring(0, 120) + '...'
    : displaySummary;

  return (
    <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-900">Executive Summary</span>
          {isStale && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="h-3 w-3" />
              <span>Needs Update</span>
            </div>
          )}
        </div>
        
        <button
          onClick={handleGenerateSummary}
          disabled={isGenerating}
          className="flex items-center gap-1 px-2 py-1 text-xs text-purple-700 hover:text-purple-900 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generating...' : hasSummary ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1 mb-2 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}

      {hasSummary ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-800 leading-relaxed">
            {truncatedSummary}
            {isLongSummary && (
              <button
                onClick={() => setShowFullSummary(!showFullSummary)}
                className="ml-1 text-purple-600 hover:text-purple-800 text-xs underline"
              >
                {showFullSummary ? 'Show less' : 'Show more'}
              </button>
            )}
          </p>
          
          {summaryDate && (
            <div className="text-xs text-gray-500">
              Generated {format(summaryDate, 'MMM d, h:mm a')}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-600 italic">
          {isGenerating 
            ? 'Generating executive summary...'
            : 'Click Generate to create an AI-powered executive summary for this opportunity.'
          }
        </div>
      )}
    </div>
  );
}; 