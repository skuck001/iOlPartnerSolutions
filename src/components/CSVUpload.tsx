import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Settings, Download } from 'lucide-react';
import { useNodesApi, type CSVProcessingResult } from '../hooks/useNodesApi';

interface CSVUploadProps {
  onUploadComplete?: (result: CSVProcessingResult) => void;
  onCancel?: () => void;
}

interface ColumnMapping {
  csvColumn: string;
  systemField: string;
  required: boolean;
  mapped: boolean;
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

const VALID_NODE_CATEGORIES = [
  'PMS', 'CRS', 'CM', 'BookingEngine', 'RMS', 'Switch', 'Aggregator',
  'Distributor', 'Meta', 'OTA', 'Wholesaler', 'CMS', 'Enrichment',
  'PaymentGateway', 'Other'
];

const VALID_DIRECTIONS = [
  'Supply', 'Demand', 'Supply Switch', 'Demand Switch', 'None'
];

export const CSVUpload: React.FC<CSVUploadProps> = ({ onUploadComplete, onCancel }) => {
  const { processBatchCSV, loading, error, clearError } = useNodesApi();
  
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping' | 'processing' | 'complete'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
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

    // Auto-generate column mappings
    const mappings: ColumnMapping[] = REQUIRED_FIELDS.map(field => {
      const matchingHeader = headers.find(h => 
        h.toLowerCase().replace(/[^a-z]/g, '') === field.field.toLowerCase().replace(/[^a-z]/g, '')
      );
      
      return {
        csvColumn: matchingHeader || '',
        systemField: field.field,
        required: field.required,
        mapped: !!matchingHeader
      };
    });

    setColumnMappings(mappings);
    setStep('preview');
  }, []);

  const handleColumnMappingChange = useCallback((systemField: string, csvColumn: string) => {
    setColumnMappings(prev => prev.map(mapping => 
      mapping.systemField === systemField 
        ? { ...mapping, csvColumn, mapped: !!csvColumn }
        : mapping
    ));
  }, []);

  const validateMappings = useCallback(() => {
    const requiredMappings = columnMappings.filter(m => m.required);
    return requiredMappings.every(m => m.mapped);
  }, [columnMappings]);

  const generateMappedCSV = useCallback(() => {
    if (!previewData) return '';

    const systemHeaders = REQUIRED_FIELDS.map(field => field.field);
    const headerLine = systemHeaders.join(',');

    const lines = csvContent.trim().split('\n');
    const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1);

    const mappedLines = dataLines.map(line => {
      const cells = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
      
      return systemHeaders.map(systemField => {
        const mapping = columnMappings.find(m => m.systemField === systemField);
        if (!mapping || !mapping.mapped) return '';
        
        const csvColumnIndex = originalHeaders.indexOf(mapping.csvColumn);
        return csvColumnIndex >= 0 ? cells[csvColumnIndex] || '' : '';
      }).join(',');
    });

    return [headerLine, ...mappedLines].join('\n');
  }, [csvContent, previewData, columnMappings]);

  const handleProcessCSV = useCallback(async () => {
    if (!validateMappings()) return;

    setStep('processing');
    clearError();

    try {
      const mappedContent = generateMappedCSV();
      const result = await processBatchCSV(mappedContent, batchName);
      
      setProcessingResult(result);
      setStep('complete');
      
      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (err) {
      console.error('CSV processing failed:', err);
      setStep('preview');
    }
  }, [validateMappings, generateMappedCSV, processBatchCSV, batchName, onUploadComplete, clearError]);

  const handleStartOver = useCallback(() => {
    setCsvFile(null);
    setCsvContent('');
    setPreviewData(null);
    setColumnMappings([]);
    setBatchName('');
    setProcessingResult(null);
    setStep('upload');
    clearError();
  }, [clearError]);

  const downloadSampleCSV = () => {
    const link = document.createElement('a');
    link.href = '/sample-nodes.csv';
    link.download = 'sample-nodes.csv';
    link.click();
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Node Data</h3>
        <p className="text-gray-600 mb-4">
          Upload a CSV file containing travel technology node data for processing and deduplication.
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver 
            ? 'border-iol-red bg-red-50' 
            : 'border-gray-300 hover:border-iol-red'
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
              className="text-iol-red hover:text-red-700 font-semibold"
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

      {/* Sample CSV Download Section */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-center space-x-3 mb-3">
          <FileText className="h-5 w-5 text-blue-600" />
          <h4 className="text-sm font-medium text-blue-900">Need a template?</h4>
        </div>
        <p className="text-sm text-blue-700 mb-3">
          Download our sample CSV file to see the expected format and column structure.
        </p>
        <button
          onClick={downloadSampleCSV}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Sample CSV
        </button>
      </div>

      {/* Format Requirements */}
      <div className="mb-8 text-left bg-gray-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Required CSV Format:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <h5 className="font-medium text-gray-700 mb-2">Required Columns:</h5>
            <ul className="space-y-1 text-gray-600">
              <li>• <code className="bg-gray-200 px-1 rounded">entity_name</code> - Company name</li>
              <li>• <code className="bg-gray-200 px-1 rounded">node_name</code> - System/product name</li>
              <li>• <code className="bg-gray-200 px-1 rounded">node_category</code> - System type (PMS, CRS, OTA, etc.)</li>
              <li>• <code className="bg-gray-200 px-1 rounded">direction</code> - Supply, Demand, Switch, or None</li>
              <li>• <code className="bg-gray-200 px-1 rounded">is_active</code> - true or false</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-gray-700 mb-2">Optional Columns:</h5>
            <ul className="space-y-1 text-gray-600">
              <li>• <code className="bg-gray-200 px-1 rounded">connects_to</code> - Comma-separated node IDs</li>
              <li>• <code className="bg-gray-200 px-1 rounded">protocols_supported</code> - PushAPI|PullAPI|LiveSearch</li>
              <li>• <code className="bg-gray-200 px-1 rounded">data_types_supported</code> - Pipe-separated types</li>
              <li>• <code className="bg-gray-200 px-1 rounded">notes</code> - Additional information</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> Use pipe (|) separator for multiple values in array fields like protocols_supported and data_types_supported.
            Use comma separator for connects_to field.
          </p>
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
            {previewData?.totalRows} rows detected. Review data and configure column mappings.
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

      {/* Batch Configuration */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <Settings className="h-5 w-5 text-gray-400 mr-2" />
          <h4 className="font-medium text-gray-900">Batch Configuration</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Name
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
              placeholder="Enter batch name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File
            </label>
            <div className="flex items-center text-sm text-gray-600">
              <FileText className="h-4 w-4 mr-1" />
              {csvFile?.name}
            </div>
          </div>
        </div>
      </div>

      {/* Column Mapping */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Column Mapping</h4>
          <p className="text-sm text-gray-600">
            Map your CSV columns to system fields. Required fields must be mapped.
          </p>
        </div>
        <div className="p-4 space-y-3">
          {columnMappings.map((mapping) => (
            <div key={mapping.systemField} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-900">
                  {REQUIRED_FIELDS.find(f => f.field === mapping.systemField)?.label}
                </span>
                {mapping.required && (
                  <span className="ml-1 text-red-500 text-xs">*</span>
                )}
              </div>
              <div>
                <select
                  value={mapping.csvColumn}
                  onChange={(e) => handleColumnMappingChange(mapping.systemField, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red text-sm"
                >
                  <option value="">Select column...</option>
                  {previewData?.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                {mapping.mapped ? (
                  <div className="flex items-center text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mapped
                  </div>
                ) : mapping.required ? (
                  <div className="flex items-center text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Required
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">Optional</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Preview */}
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

      {/* Validation Errors */}
      {!validateMappings() && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Missing Required Mappings</h4>
              <p className="text-sm text-red-700">
                Please map all required fields before proceeding with the upload.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
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
          disabled={!validateMappings()}
          className="px-6 py-2 bg-iol-red text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Process CSV
        </button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="animate-spin mx-auto h-12 w-12 border-4 border-iol-red border-t-transparent rounded-full"></div>
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
                    {processingResult.duplicate_warnings} records have potential duplicates that need review.
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
          className="px-6 py-2 bg-iol-red text-white rounded-md hover:bg-red-700"
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
                <div className={`flex items-center ${isActive ? 'text-iol-red' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isActive ? 'border-iol-red bg-iol-red text-white' : 
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
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {step === 'upload' && renderUploadStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'processing' && renderProcessingStep()}
        {step === 'complete' && renderCompleteStep()}
      </div>
    </div>
  );
}; 