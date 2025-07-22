# Partner Map - User Manual

**Version 1.0** | **Date: January 2025**

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [CSV Data Format](#csv-data-format)
4. [Module Guide](#module-guide)
5. [Step-by-Step Workflows](#step-by-step-workflows)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Overview

The **Partner Map** is a comprehensive Node Intake & Mapping Engine designed to standardize, record, map, and visualize the travel technology connectivity ecosystem. It manages relationships between supply systems (PMS, CRS, Channel Managers) and demand partners (OTAs, GDS, Metasearch engines).

### Key Features
- **CSV Data Import** with validation and duplicate detection
- **AI-Powered Deduplication** with confidence scoring
- **Batch Management** with rollback capabilities
- **Alias Management** for alternative entity/node names
- **Master Mapping** for record consolidation
- **Advanced Search** and filtering across the node registry
- **Interactive Network Visualization** showing system relationships
- **Analytics Dashboard** with business intelligence insights

### System Architecture
- **Entities**: Companies or providers (e.g., Cloudbeds, Expedia)
- **Nodes**: Specific products/systems operated by entities (e.g., Cloudbeds PMS, Expedia Partner API)
- **Connections**: Relationships between nodes showing data flow and integration paths

---

## Getting Started

### Prerequisites
- Access to the Partner Map application
- CSV data file with travel technology node information
- Basic understanding of travel technology ecosystem

### First Time Setup
1. Navigate to the Partner Map module from the main navigation menu
2. Review the overview dashboard to understand the current system state
3. Download the sample CSV file to understand the required format
4. Prepare your data according to the CSV specifications below

---

## CSV Data Format

### Required File Format
- **File Type**: CSV (Comma Separated Values)
- **Encoding**: UTF-8
- **Header Row**: Required (first row must contain column names)
- **Separator**: Comma (,) for main fields
- **Array Separator**: Pipe (|) for multiple values in array fields
- **Boolean Values**: `true` or `false` (lowercase)

### Column Specifications

#### Required Columns

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `entity_name` | String | Company or provider name | `Cloudbeds` |
| `node_name` | String | Specific system/product name (must be unique) | `Cloudbeds PMS` |
| `node_category` | Enum | System classification (see options below) | `PMS` |
| `direction` | Enum | Data flow direction (see options below) | `Supply` |
| `is_active` | Boolean | Whether the node is currently active | `true` |

#### Optional Columns

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `connects_to` | Array | Comma-separated list of connected node IDs | `cloudbeds-cm,expedia-api` |
| `protocols_supported` | Array | Pipe-separated integration protocols | `PushAPI\|PullAPI\|LiveSearch` |
| `data_types_supported` | Array | Pipe-separated data types handled | `Availability\|Rates\|Bookings` |
| `notes` | String | Additional information or description | `Leading cloud-based PMS` |

### Static Data Field Options

#### Node Category Options
```
PMS                - Property Management System
CRS                - Central Reservation System
CM                 - Channel Manager
BookingEngine      - B2C booking interface
RMS                - Revenue Management System
Switch             - Connectivity hub (e.g., Juniper)
Aggregator         - Consolidates inventory from multiple suppliers
Distributor        - Redistributes inventory to third parties
Meta               - Metasearch engine
OTA                - Online Travel Agency
Wholesaler         - B2B buyer/seller
CMS                - Content Management System
Enrichment         - Review, rate shopping, content enrichment
PaymentGateway     - Payment and VCC systems
Other              - Custom or undefined category
```

#### Direction Options
```
Supply             - Originates ARI or content
Demand             - Receives inventory and makes bookings
Supply Switch      - Pure connector for supply side
Demand Switch      - Pure connector for demand side
None               - Internal use only (e.g., analytics tools)
```

#### Protocols Supported Options
```
PushAPI            - Push-based API integration
PullAPI            - Pull-based API integration
LiveSearch         - Real-time search capability
Other              - Custom or undefined protocol
```

#### Data Types Supported Options
```
Availability       - Room/inventory availability data
Rates              - Pricing information
Restrictions       - Booking rules and limitations
Bookings           - Reservation data
Content            - Property descriptions, images, amenities
Policies           - Cancellation, payment policies
PaymentDetails     - Payment and financial data
Analytics          - Performance and business intelligence data
```

### Sample CSV Format
```csv
entity_name,node_name,node_category,direction,connects_to,protocols_supported,data_types_supported,is_active,notes
Cloudbeds,Cloudbeds PMS,PMS,Supply,"cloudbeds-cm,expedia-api",PushAPI|PullAPI,Availability|Rates|Bookings,true,Leading cloud-based property management system
Booking.com,Booking.com API,OTA,Demand,"cloudbeds-cm,synxis-crs",PullAPI|LiveSearch,Availability|Rates|Bookings,true,World's largest online accommodation platform
```

---

## Module Guide

### 1. Overview Dashboard
**Purpose**: System overview and quick access to key functions

**Features**:
- System metrics and status indicators
- Quick action buttons for common tasks
- Recent upload summary
- Development status tracking
- Workflow guide

### 2. CSV Upload
**Purpose**: Import new node data from CSV files

**Features**:
- Drag-and-drop file upload
- CSV preview and validation
- Dynamic column mapping
- Batch naming and processing
- Error reporting and validation

### 3. Duplicate Review
**Purpose**: Review and resolve potential duplicate records

**Features**:
- AI-powered duplicate detection
- Side-by-side record comparison
- Confidence scoring and recommendations
- Bulk decision processing
- Manual editing capabilities

### 4. Batch Management
**Purpose**: Track and manage data import batches

**Features**:
- Batch status monitoring
- Detailed processing logs
- Rollback functionality
- Export batch reports
- Filter and search batches

### 5. Alias Management
**Purpose**: Manage alternative names for entities and nodes

**Features**:
- Add/remove aliases for entities and nodes
- AI-powered alias suggestions
- Bulk alias operations
- Domain-based suggestions
- Alias validation and conflict resolution

### 6. Master Mapping
**Purpose**: Consolidate similar records under unified profiles

**Features**:
- Automatic similarity detection
- Merge opportunity analysis
- Canonical name management
- Rule-based consolidation
- Preview and approval workflow

### 7. Node Registry
**Purpose**: Browse, search, and manage the complete node database

**Features**:
- Advanced search and filtering
- Grid and table view modes
- Bulk operations (activate, deactivate, export, delete)
- Detailed node information
- Category and connection insights

### 8. Network Visualization
**Purpose**: Interactive visual representation of node relationships

**Features**:
- Force-directed, hierarchical, and circular layouts
- Interactive zoom and pan
- Node filtering and search
- Connection visualization
- Export network diagrams

### 9. Analytics Dashboard
**Purpose**: Business intelligence and network insights

**Features**:
- Network metrics and KPIs
- Category distribution analysis
- Connectivity insights (hubs, bridges, isolated nodes)
- Trend analysis and growth tracking
- Export analytics reports

---

## Step-by-Step Workflows

### Workflow 1: Importing New Data

#### Step 1: Prepare Your CSV File
1. Download the sample CSV file from the CSV Upload section
2. Use the sample as a template for your data
3. Ensure all required columns are present
4. Validate data types and enum values
5. Save file as UTF-8 encoded CSV

#### Step 2: Upload and Validate
1. Navigate to **CSV Upload** module
2. Click "Browse Files" or drag-and-drop your CSV file
3. Review the file preview and validation results
4. Fix any validation errors before proceeding
5. Click "Continue to Mapping"

#### Step 3: Map Columns
1. Review automatic column mapping
2. Adjust mappings if column names don't match exactly
3. Ensure all required fields are mapped
4. Preview mapped data for accuracy
5. Click "Continue to Processing"

#### Step 4: Process Batch
1. Enter a descriptive batch name
2. Review processing settings
3. Click "Process CSV" to start import
4. Monitor processing progress
5. Review results summary

#### Step 5: Handle Duplicates (if detected)
1. If duplicates are found, proceed to **Duplicate Review**
2. Review each potential duplicate
3. Choose action: Create New, Merge with Entity/Node, or Reject
4. Complete all pending decisions
5. Finalize batch processing

### Workflow 2: Managing Duplicates

#### Step 1: Access Duplicate Review
1. Navigate from upload results or **Duplicate Review** module
2. Select batch with duplicates to review
3. Review analysis overview and statistics

#### Step 2: Review Individual Duplicates
1. Start with first duplicate in the list
2. Compare new record with existing matches
3. Review confidence scores and similarity factors
4. Consider connection patterns and entity relationships

#### Step 3: Make Decisions
1. **Create New**: If records are genuinely different
2. **Merge with Entity**: If node belongs to existing entity
3. **Merge with Node**: If it's the same node with different name
4. **Reject**: If record is invalid or unwanted

#### Step 4: Complete Review
1. Process all pending decisions
2. Review summary of changes
3. Confirm and apply decisions
4. Monitor processing results

### Workflow 3: Managing Aliases

#### Step 1: Access Alias Manager
1. Navigate to **Alias Management** module
2. Review current entities and their aliases
3. Use search to find specific entities/nodes

#### Step 2: Add Aliases Manually
1. Click "Add Alias" for target entity/node
2. Enter alternative name
3. Save and validate alias
4. Repeat for additional aliases

#### Step 3: Apply AI Suggestions
1. Click "Generate Suggestions" for AI recommendations
2. Review suggested aliases based on:
   - Domain analysis
   - Name variations
   - Category patterns
3. Accept or reject individual suggestions
4. Apply approved suggestions in bulk

#### Step 4: Bulk Operations
1. Select multiple entities/nodes
2. Use bulk edit mode for mass alias additions
3. Enter aliases in comma-separated format
4. Review and apply changes

### Workflow 4: Master Mapping

#### Step 1: Analyze Merge Opportunities
1. Navigate to **Master Mapping** module
2. Review detected merge groups
3. Analyze similarity scores and reasons
4. Prioritize high-confidence matches

#### Step 2: Review Merge Groups
1. Select merge group for detailed review
2. Compare records side-by-side
3. Review proposed canonical name
4. Check connection impacts

#### Step 3: Configure Merges
1. Edit canonical name if needed
2. Select master record
3. Review merge rules and settings
4. Preview merge results

#### Step 4: Execute Merges
1. Apply selected merges
2. Monitor consolidation process
3. Review updated records
4. Validate connection integrity

### Workflow 5: Network Analysis

#### Step 1: Explore Network Visualization
1. Navigate to **Network Map** module
2. Choose layout type (Force, Hierarchical, Circular)
3. Use zoom and pan to explore network
4. Click nodes for detailed information

#### Step 2: Apply Filters
1. Open filter panel
2. Filter by categories, connections, or status
3. Use search to find specific nodes
4. Adjust connection range filters

#### Step 3: Analyze Patterns
1. Identify network hubs (highly connected nodes)
2. Find bridge nodes connecting different categories
3. Spot isolated nodes needing integration
4. Export visualizations for reporting

#### Step 4: Generate Analytics
1. Navigate to **Analytics Dashboard**
2. Review network metrics and KPIs
3. Analyze category distribution
4. Examine connectivity insights
5. Export analytics reports

---

## Troubleshooting

### CSV Upload Issues

#### Invalid File Format
- **Problem**: "Invalid file format" error
- **Solution**: Ensure file is saved as CSV with UTF-8 encoding
- **Check**: File extension is .csv and opens correctly in Excel/text editor

#### Column Mapping Errors
- **Problem**: Required columns not detected
- **Solution**: Verify column headers match expected names exactly
- **Check**: No extra spaces, correct spelling, proper case sensitivity

#### Data Validation Failures
- **Problem**: Invalid enum values or data types
- **Solution**: Check against allowed values in specification
- **Common Issues**:
  - `is_active` must be `true` or `false` (lowercase)
  - `node_category` must match exact enum values
  - Array fields must use proper separators (| for protocols, , for connections)

#### Large File Processing
- **Problem**: Timeout or memory errors with large files
- **Solution**: Split large files into smaller batches (recommended: <1000 rows per file)

### Duplicate Detection Issues

#### False Positives
- **Problem**: System detects duplicates that aren't actually duplicates
- **Solution**: 
  - Review similarity factors
  - Use "Create New" if records are genuinely different
  - Add aliases to improve future matching

#### Missing Duplicates
- **Problem**: Actual duplicates not detected by system
- **Solution**:
  - Use Master Mapping to find and consolidate similar records
  - Add aliases to improve matching accuracy
  - Review and merge manually in Node Registry

### Performance Issues

#### Slow Loading
- **Problem**: Application loads slowly
- **Solution**:
  - Check internet connection
  - Clear browser cache
  - Try refreshing the page

#### Network Visualization Performance
- **Problem**: Laggy or unresponsive network visualization
- **Solution**:
  - Apply filters to reduce displayed nodes
  - Use hierarchical or circular layout for better performance
  - Close other browser tabs to free memory

### Data Integrity Issues

#### Broken Connections
- **Problem**: Node connections reference non-existent nodes
- **Solution**:
  - Review connection IDs in CSV data
  - Ensure connected nodes exist or will be created in same batch
  - Use Node Registry to verify and fix connections

#### Inconsistent Entity Names
- **Problem**: Same entity appears with different names
- **Solution**:
  - Use Alias Management to add alternative names
  - Use Master Mapping to consolidate entities
  - Standardize entity names in source data

---

## Best Practices

### Data Preparation

#### Entity Naming
- Use consistent, official company names
- Avoid abbreviations unless commonly used
- Include proper capitalization and spacing
- Example: "Booking.com" not "booking.com" or "BookingCom"

#### Node Naming
- Combine entity name with system type for clarity
- Use descriptive names that indicate function
- Ensure uniqueness across all nodes
- Example: "Cloudbeds PMS" not just "PMS"

#### Connection Management
- Document connection relationships clearly
- Use consistent node ID formats
- Verify connections exist before referencing
- Group related systems logically

### Import Strategy

#### Batch Organization
- Import by entity or system type for easier management
- Use descriptive batch names with dates
- Keep batch sizes manageable (<1000 records)
- Test with small batches before large imports

#### Validation Process
- Always download and review sample CSV first
- Validate data offline before upload
- Test import with subset of data
- Review duplicate detection results carefully

### Ongoing Maintenance

#### Regular Reviews
- Schedule monthly alias management reviews
- Monitor new duplicate warnings
- Update inactive node status regularly
- Validate connection accuracy quarterly

#### Data Quality
- Maintain consistent naming conventions
- Document system changes and updates
- Regular backup exports for data recovery
- Monitor analytics for data quality issues

### Security Considerations

#### Data Privacy
- Ensure CSV files don't contain sensitive information
- Use generic descriptions in notes fields
- Avoid including personal or confidential data
- Review export data before sharing

#### Access Control
- Limit batch rollback access to authorized users
- Monitor bulk operations and deletions
- Maintain audit trail for data changes
- Regular review of user permissions

---

## Support and Additional Resources

### Getting Help
- Contact system administrators for access issues
- Review error messages for specific guidance
- Use sample CSV file as reference for formatting
- Check this manual for workflow guidance

### Additional Documentation
- Technical API documentation (for developers)
- System architecture overview
- Integration guidelines
- Performance optimization guide

### Version History
- **v1.0 (January 2025)**: Initial release with complete Partner Map functionality

---

**© 2025 iOL - Partner Map User Manual** 