import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Download } from 'lucide-react';
import { useNodesApi, type CSVProcessingResult } from '../hooks/useNodesApi';

interface CSVUploadProps {
  onUploadComplete?: (result: CSVProcessingResult) => void;
  onCancel?: () => void;
}

interface PreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  previewRows: number;
}

const REQUIRED_FIELDS = [
  { field: 'node_name', label: 'Node Name', required: true },
  { field: 'website', label: 'Website', required: true },
  { field: 'entity_name', label: 'Entity Name', required: true },
  { field: 'node_category', label: 'Node Category', required: true },
  { field: 'direction', label: 'Direction', required: true },
  { field: 'notes', label: 'Notes', required: false },
  { field: 'connect_targets', label: 'Connect Targets', required: false },
  { field: 'protocols_supported', label: 'Protocols Supported', required: false },
  { field: 'data_types_supported', label: 'Data Types Supported', required: false },
];

export const CSVUpload: React.FC<CSVUploadProps> = ({ onUploadComplete, onCancel }) => {
  const { processBatchCSV, loading, error, clearError } = useNodesApi();
  
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [batchName, setBatchName] = useState<string>('');
  const [processingResult, setProcessingResult] = useState<CSVProcessingResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = useCallback(() => {
    const headers = REQUIRED_FIELDS.map(field => field.field);
    const sampleData = [
      'Example Hotel PMS,example-hotel.com,Example Hotels,PMS,Supply,"PMS system for boutique hotels",Booking.com;Expedia,PushAPI;PullAPI,Availability;Rates;Bookings'
    ];
    
    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'node_upload_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    
    if (csvFile) {
      handleFileSelect(csvFile);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setCsvFile(file);
    setBatchName(file.name.replace('.csv', ''));
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      parseCSVPreview(content);
    };
    reader.readAsText(file);
  }, []);

  const parseCSVPreview = useCallback((content: string) => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1);
    const previewRows = dataLines.slice(0, 5).map(line => 
      line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );

    setPreviewData({
      headers,
      rows: previewRows,
      totalRows: dataLines.length,
      previewRows: previewRows.length
    });

    setStep('preview');
  }, []);

  const handleProcessCSV = useCallback(async () => {
    if (!csvContent || !batchName) return;

    setStep('processing');
    clearError();

    try {
      const result = await processBatchCSV(csvContent, batchName);
      
      setProcessingResult(result);
      setStep('complete');
      
      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (err) {
      console.error('CSV processing failed:', err);
      setStep('preview');
    }
  }, [csvContent, batchName, processBatchCSV, onUploadComplete, clearError]);

  const handleStartOver = useCallback(() => {
    setCsvFile(null);
    setCsvContent('');
    setPreviewData(null);
    setBatchName('');
    setProcessingResult(null);
    setStep('upload');
    clearError();
  }, [clearError]);

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Node Data</h3>
        <p className="text-gray-600 mb-4">
          Upload a CSV file containing travel technology node data for processing.
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver 
            ? 'border-red-500 bg-red-50' 
            : 'border-gray-300 hover:border-red-500'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900">
            Drop your CSV file here, or{' '}
            <button
              type="button"
              className="text-red-600 hover:text-red-700 font-semibold"
              onClick={() => fileInputRef.current?.click()}
            >
              browse
            </button>
          </p>
          <p className="text-sm text-gray-500">CSV files up to 10MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <FileText className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Need a template?</h4>
            <p className="text-sm text-blue-700 mb-2">
              Download our CSV template with the correct column headers and sample data.
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              <Download className="h-4 w-4 mr-1" />
              Download Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Preview & Configure</h3>
          <p className="text-gray-600">
            {previewData?.totalRows} rows detected. Review data before processing.
          </p>
        </div>
        <button
          type="button"
          onClick={handleStartOver}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Batch Configuration</h4>
        </div>
        <div className="p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Name
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              placeholder="Enter batch name..."
            />
          </div>
        </div>
      </div>

      {previewData && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Data Preview</h4>
            <p className="text-sm text-gray-600">
              Showing {previewData.previewRows} of {previewData.totalRows} rows
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {previewData.headers.map((header, index) => (
                    <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleStartOver}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Start Over
        </button>
        <button
          type="button"
          onClick={handleProcessCSV}
          disabled={!batchName}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Process CSV
        </button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="animate-spin mx-auto h-12 w-12 border-4 border-red-600 border-t-transparent rounded-full"></div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing CSV Data</h3>
        <p className="text-gray-600">
          Validating data, checking for duplicates, and creating staging records...
        </p>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Complete</h3>
        <p className="text-gray-600">
          Your CSV data has been processed and is ready for review.
        </p>
      </div>

      {processingResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 mb-4">Processing Results</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{processingResult.total_rows}</div>
              <div className="text-sm text-gray-500">Total Rows</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{processingResult.valid_rows}</div>
              <div className="text-sm text-gray-500">Valid Rows</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{processingResult.invalid_rows}</div>
              <div className="text-sm text-gray-500">Invalid Rows</div>
            </div>
          </div>

          {processingResult.duplicate_warnings > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
                <div>
                  <h5 className="text-sm font-medium text-yellow-900">Potential Duplicates Found</h5>
                  <p className="text-sm text-yellow-700">
                    {processingResult.duplicate_warnings} records have potential duplicates.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-600">
            <strong>Batch ID:</strong> {processingResult.batch_id}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleStartOver}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Upload Another File
        </button>
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Continue to Review
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['upload', 'preview', 'processing', 'complete'].map((stepName, index) => {
            const isActive = step === stepName;
            const isCompleted = ['upload', 'preview', 'processing', 'complete'].indexOf(step) > index;
            
            return (
              <React.Fragment key={stepName}>
                <div className={`flex items-center ${isActive ? 'text-red-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isActive ? 'border-red-600 bg-red-600 text-white' : 
                    isCompleted ? 'border-green-600 bg-green-600 text-white' : 
                    'border-gray-300'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : index + 1}
                  </div>
                  <span className="ml-2 text-sm font-medium capitalize">{stepName}</span>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-4 ${isCompleted ? 'bg-green-600' : 'bg-gray-300'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Upload Error</h4>
              <p className="text-sm text-red-700">{error.message || 'An unexpected error occurred'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {step === 'upload' && renderUploadStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'processing' && renderProcessingStep()}
        {step === 'complete' && renderCompleteStep()}
      </div>
    </div>
  );
};
