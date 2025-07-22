import { Timestamp } from 'firebase-admin/firestore';
import { AuditService } from '../../shared/audit.service';
import { NodesService } from './nodes.service';

export interface CSVRow {
  node_name: string;
  website: string;
  entity_name: string;
  node_category: string;
  direction: string;
  notes: string;
  connect_targets: string;
  protocols_supported: string;
  data_types_supported: string;
}

export interface ParsedCSVRow {
  node_name: string;
  website: string;
  entity_name: string;
  node_category: string;
  direction: string;
  notes: string;
  connect_targets: string[];
  protocols_supported: string[];
  data_types_supported: string[];
}

export interface SanitizedRow extends ParsedCSVRow {
  sanitized_entity_name: string;
  sanitized_node_name: string;
  normalized_website: string;
  extracted_tags: string[];
  confidence_score: number;
  potential_duplicates: string[];
}

export interface ValidationError {
  row: number;
  field: string;
  error: string;
  value: any;
}

export interface CSVProcessingResult {
  batch_id: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  staging_nodes: any[];
  validation_errors: ValidationError[];
  duplicate_warnings: number;
}

export class CSVProcessingService {
  private nodesService: NodesService;

  // Valid enum values from the system
  private readonly VALID_NODE_CATEGORIES = [
    'PMS', 'CRS', 'CM', 'BookingEngine', 'RMS', 'Switch', 'Aggregator',
    'Distributor', 'Meta', 'OTA', 'Wholesaler', 'CMS', 'Enrichment',
    'PaymentGateway', 'Other'
  ];

  private readonly VALID_DIRECTIONS = [
    'Supply', 'Demand', 'Supply Switch', 'Demand Switch', 'None'
  ];

  private readonly VALID_PROTOCOLS = [
    'PushAPI', 'PullAPI', 'LiveSearch', 'Other'
  ];

  private readonly VALID_DATA_TYPES = [
    'Availability', 'Rates', 'Restrictions', 'Bookings', 'Content',
    'Policies', 'PaymentDetails', 'Analytics'
  ];

  // Corporate identifiers to remove during sanitization
  private readonly CORPORATE_SUFFIXES = [
    'ltd', 'ltd.', 'inc', 'inc.', 'corp', 'corp.', 'llc', 'llc.',
    'gmbh', 'sa', 's.a.', 'bv', 'b.v.', 'ag', 'plc', 'pty',
    'limited', 'incorporated', 'corporation', 'company', 'co.', 'co'
  ];

  private readonly WEBSITE_CLEANERS = [
    '.com', '.net', '.org', '.io', '.co', 'www.', 'http://', 'https://'
  ];

  constructor() {
    this.nodesService = new NodesService();
  }

  async processBatchUpload(
    csvContent: string, 
    batchName: string | undefined, 
    userId: string
  ): Promise<CSVProcessingResult> {
    // 1. Create batch log
    const batchId = await this.nodesService.createBatchLog({
      batch_name: batchName || `Import_${new Date().toISOString().split('T')[0]}`,
      status: 'pending'
    }, userId);

    try {
      // 2. Parse CSV content
      const parsedRows = this.parseCSVContent(csvContent);
      
      // 3. Validate and sanitize each row
      const validationResults = await this.validateAndSanitizeRows(parsedRows, userId);
      
      // 4. Process valid rows into staging
      const stagingNodes = await this.processStagingNodes(
        validationResults.validRows, 
        batchId, 
        userId
      );

      // 5. Update batch log with results
      await this.nodesService.updateBatchLog(batchId, {
        status: validationResults.validRows.length > 0 ? 'processed' : 'error',
        total_records: parsedRows.length,
        processed_records: validationResults.validRows.length,
        error_records: validationResults.errors.length,
        error_report: validationResults.errors.length > 0 ? {
          validation_errors: validationResults.errors,
          failed_rows: validationResults.errors.length
        } : null,
        completedAt: Timestamp.now()
      });

      // 6. Log audit trail
      await AuditService.log({
        action: 'BATCH_UPLOAD',
        userId,
        resourceType: 'csv_processing',
        resourceId: batchId,
        data: {
          action: 'CSV batch processed',
          total_rows: parsedRows.length,
          valid_rows: validationResults.validRows.length,
          batch_name: batchName
        }
      });

      return {
        batch_id: batchId,
        total_rows: parsedRows.length,
        valid_rows: validationResults.validRows.length,
        invalid_rows: validationResults.errors.length,
        staging_nodes: stagingNodes,
        validation_errors: validationResults.errors,
        duplicate_warnings: validationResults.validRows.filter(row => row.potential_duplicates.length > 0).length
      };

    } catch (error) {
      // Update batch log with error
      await this.nodesService.updateBatchLog(batchId, {
        status: 'error',
        error_report: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Timestamp.now()
        }
      });
      
      throw error;
    }
  }

  private parseCSVContent(csvContent: string): CSVRow[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must contain header row and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const requiredHeaders = [
      'node_name', 'website', 'entity_name', 'node_category', 
      'direction', 'notes', 'connect_targets', 'protocols_supported', 
      'data_types_supported'
    ];

    // Validate headers
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Parse data rows
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        continue; // Skip malformed rows
      }

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      rows.push(row as CSVRow);
    }

    return rows;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private async validateAndSanitizeRows(
    rows: CSVRow[], 
    userId: string
  ): Promise<{ validRows: SanitizedRow[], errors: ValidationError[] }> {
    const validRows: SanitizedRow[] = [];
    const errors: ValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors: ValidationError[] = [];

      try {
        // Basic field validation
        if (!row.node_name?.trim()) {
          rowErrors.push({ row: i + 2, field: 'node_name', error: 'Required field', value: row.node_name });
        }

        if (!row.entity_name?.trim()) {
          rowErrors.push({ row: i + 2, field: 'entity_name', error: 'Required field', value: row.entity_name });
        }

        if (!row.website?.trim()) {
          rowErrors.push({ row: i + 2, field: 'website', error: 'Required field', value: row.website });
        }

        // Enum validation
        if (!this.VALID_NODE_CATEGORIES.includes(row.node_category)) {
          rowErrors.push({ 
            row: i + 2, 
            field: 'node_category', 
            error: `Invalid category. Must be one of: ${this.VALID_NODE_CATEGORIES.join(', ')}`, 
            value: row.node_category 
          });
        }

        if (!this.VALID_DIRECTIONS.includes(row.direction)) {
          rowErrors.push({ 
            row: i + 2, 
            field: 'direction', 
            error: `Invalid direction. Must be one of: ${this.VALID_DIRECTIONS.join(', ')}`, 
            value: row.direction 
          });
        }

        // If validation failed, add errors and continue
        if (rowErrors.length > 0) {
          errors.push(...rowErrors);
          continue;
        }

        // Sanitize and process valid row
        const sanitizedRow = await this.sanitizeRow(row, userId);
        validRows.push(sanitizedRow);

      } catch (error) {
        errors.push({ 
          row: i + 2, 
          field: 'general', 
          error: error instanceof Error ? error.message : 'Processing error', 
          value: row 
        });
      }
    }

    return { validRows, errors };
  }

  private async sanitizeRow(row: CSVRow, userId: string): Promise<SanitizedRow> {
    // Parse array fields
    const parsedRow: ParsedCSVRow = {
      ...row,
      connect_targets: this.parseArrayField(row.connect_targets),
      protocols_supported: this.parseArrayField(row.protocols_supported).filter(p => 
        this.VALID_PROTOCOLS.includes(p)
      ),
      data_types_supported: this.parseArrayField(row.data_types_supported).filter(d => 
        this.VALID_DATA_TYPES.includes(d)
      )
    };

    // Sanitization pipeline
    const sanitized: SanitizedRow = {
      ...parsedRow,
      sanitized_entity_name: this.sanitizeEntityName(parsedRow.entity_name),
      sanitized_node_name: this.sanitizeNodeName(parsedRow.node_name),
      normalized_website: this.normalizeWebsite(parsedRow.website),
      extracted_tags: this.extractTagsFromNotes(parsedRow.notes),
      confidence_score: 0,
      potential_duplicates: []
    };

    // Find potential duplicates
    sanitized.potential_duplicates = await this.findPotentialDuplicates(sanitized, userId);
    sanitized.confidence_score = this.calculateConfidenceScore(sanitized);

    return sanitized;
  }

  private sanitizeEntityName(name: string): string {
    let cleaned = name.trim().toLowerCase();
    
    // Remove corporate suffixes
    for (const suffix of this.CORPORATE_SUFFIXES) {
      const regex = new RegExp(`\\b${suffix}\\b$`, 'i');
      cleaned = cleaned.replace(regex, '').trim();
    }

    // Remove common website elements
    for (const cleaner of this.WEBSITE_CLEANERS) {
      cleaned = cleaned.replace(cleaner, '').trim();
    }

    // Capitalize first letter of each word
    return cleaned.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .trim();
  }

  private sanitizeNodeName(name: string): string {
    // Similar to entity name but preserve technical terms
    let cleaned = name.trim();
    
    // Remove only corporate suffixes, keep technical terms
    for (const suffix of this.CORPORATE_SUFFIXES) {
      const regex = new RegExp(`\\b${suffix}\\b$`, 'i');
      cleaned = cleaned.replace(regex, '').trim();
    }

    return cleaned;
  }

  private normalizeWebsite(website: string): string {
    let normalized = website.toLowerCase().trim();
    
    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');
    
    // Remove www
    normalized = normalized.replace(/^www\./, '');
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    // Extract domain only (remove paths)
    const domainMatch = normalized.match(/^[^\/]+/);
    return domainMatch ? domainMatch[0] : normalized;
  }

  private extractTagsFromNotes(notes: string): string[] {
    const tags: string[] = [];
    const noteText = notes.toLowerCase();

    // Extract technology mentions
    const techPatterns = [
      /\bpms\b/, /\bcrs\b/, /\bchannel manager\b/, /\bbooking engine\b/,
      /\bota\b/, /\bapi\b/, /\bxml\b/, /\bjson\b/, /\bsoap\b/, /\brest\b/
    ];

    techPatterns.forEach(pattern => {
      if (pattern.test(noteText)) {
        const match = noteText.match(pattern);
        if (match) tags.push(match[0]);
      }
    });

    // Extract numbers (hotel counts, etc.)
    const numberMatches = noteText.match(/\d+\s*(?:hotels?|properties|rooms?)/g);
    if (numberMatches) {
      tags.push(...numberMatches);
    }

    // Extract connectivity mentions
    const connectivityPatterns = [
      /connected to \w+/g, /integrates with \w+/g, /partners with \w+/g
    ];

    connectivityPatterns.forEach(pattern => {
      const matches = noteText.match(pattern);
      if (matches) tags.push(...matches);
    });

    return [...new Set(tags)]; // Remove duplicates
  }

  private parseArrayField(field: string): string[] {
    if (!field || !field.trim()) return [];
    
    return field.split(/[,;|]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  private async findPotentialDuplicates(row: SanitizedRow, userId: string): Promise<string[]> {
    const duplicates = await this.nodesService.findPotentialDuplicates({
      entity_name: row.sanitized_entity_name,
      node_name: row.sanitized_node_name,
      website: row.normalized_website
    }, userId);

    return duplicates.map((dup: any) => dup.node_id || dup.entity_id);
  }

  private calculateConfidenceScore(row: SanitizedRow): number {
    let score = 1.0;

    // Penalize if potential duplicates found
    if (row.potential_duplicates.length > 0) {
      score -= 0.3;
    }

    // Boost if website is well-formed
    if (row.normalized_website.includes('.')) {
      score += 0.1;
    }

    // Boost if entity name is clean
    if (row.sanitized_entity_name.length > 3 && !row.sanitized_entity_name.includes('unknown')) {
      score += 0.1;
    }

    // Boost if has extracted tags
    if (row.extracted_tags.length > 0) {
      score += 0.05 * Math.min(row.extracted_tags.length, 4);
    }

    return Math.max(0, Math.min(1, score));
  }

  private async processStagingNodes(
    sanitizedRows: SanitizedRow[], 
    batchId: string, 
    userId: string
  ): Promise<any[]> {
    const stagingNodes: any[] = [];

    for (const row of sanitizedRows) {
      const stagingNode = await this.nodesService.createStagingNode({
        batch_id: batchId,
        node_name: row.sanitized_node_name,
        website: row.normalized_website,
        entity_name: row.sanitized_entity_name,
        node_category: row.node_category,
        direction: row.direction,
        notes: row.notes,
        connect_targets: row.connect_targets,
        protocols_supported: row.protocols_supported,
        data_types_supported: row.data_types_supported,
        confidence_score: row.confidence_score,
        duplicate_matches: row.potential_duplicates,
        extracted_tags: row.extracted_tags,
        original_data: {
          original_node_name: row.node_name,
          original_entity_name: row.entity_name,
          original_website: row.website
        }
      }, userId);

      stagingNodes.push(stagingNode);
    }

    return stagingNodes;
  }
} 