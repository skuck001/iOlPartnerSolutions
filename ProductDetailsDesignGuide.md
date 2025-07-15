# Product Details Page Design Guide

## Overview
This document outlines the design patterns, structure, and logic used in the ProductDetails page to ensure consistency across all module detail pages in the application.

## Page Architecture

### Core Principles
- **Sales-team optimized**: Compact layout with maximum information density
- **Single-page editing**: All fields always editable, no view/edit mode toggle
- **Minimal scrolling**: Three-column grid layout maximizes screen real estate
- **Visual hierarchy**: Critical information prioritized and easily scannable
- **Contextual relationships**: Clear distinction between direct and related data

## Layout Structure

### 1. Compact Header (`py-3`)
```jsx
<div className="bg-white border-b border-gray-200 px-6 py-3">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {/* Back button + Live title */}
    </div>
    <div className="flex items-center gap-2">
      {/* Action buttons */}
    </div>
  </div>
</div>
```

**Features:**
- **Live updates**: Title shows current form data, not saved data
- **Contextual subtitle**: Shows parent relationship (account name)
- **Minimal padding**: Conserves vertical space
- **Essential actions only**: Delete button for existing records

### 2. Three-Column Grid Layout
```jsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
  {/* Left Column (2/3) - Core Information */}
  <div className="lg:col-span-2 space-y-4">
    {/* Primary sections */}
  </div>
  
  {/* Right Column (1/3) - Metadata & Quick Info */}
  <div className="space-y-4">
    {/* Secondary sections */}
  </div>
</div>
```

## Form Design Patterns

### Input Field Standards
```jsx
<div>
  <label className="block text-xs font-medium text-gray-700 mb-1">
    Field Name
  </label>
  <input
    className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
  />
</div>
```

**Specifications:**
- **Label**: `text-xs font-medium text-gray-700 mb-1`
- **Input**: `text-sm px-2.5 py-1.5` (compact sizing)
- **Grid**: `gap-3` between fields (tight spacing)
- **Focus**: Consistent `focus:ring-2 focus:ring-primary-500`

### Section Headers
```jsx
<div className="flex items-center gap-2 mb-3">
  <IconComponent className="h-4 w-4 text-gray-500" />
  <h2 className="text-base font-medium text-gray-900">Section Title</h2>
</div>
```

## State Management Pattern

### Form State Structure
```jsx
const [formData, setFormData] = useState({
  // Core fields
  name: '',
  parentId: '', // accountId, etc.
  description: '',
  
  // Metadata
  tags: [] as string[],
  
  // Custom fields
  customField1: '',
  customField2: 0,
  
  // Relationships
  relatedIds: [] as string[]
});
```

### Data Fetching Pattern
```jsx
const fetchData = async () => {
  setLoading(true);
  try {
    // Parallel data fetching
    const [parentData, relatedData] = await Promise.all([
      getDocuments('parents'),
      getDocuments('related')
    ]);
    
    setParents(parentData);
    setRelated(relatedData);
    
    // Load existing record
    if (!isNew && id) {
      const recordData = await getDocument('collection', id);
      if (recordData) {
        setFormData({
          // Map all fields with fallbacks
        });
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    setLoading(false);
  }
};
```

## Section Design Patterns

### 1. Primary Information Section (Left Column)
**Purpose**: Core business data that defines the entity
**Location**: `lg:col-span-2` (2/3 width)
**Content**: 
- Required fields (name, parent relationship)
- Business-specific fields
- Primary metadata

### 2. Secondary Information Section (Left Column)
**Purpose**: Metrics, statistics, or operational data
**Styling**: Same as primary but separate card
**Content**: Numeric fields, counts, measurements

### 3. Metadata Section (Right Column) 
**Purpose**: Tags, labels, and categorization
**Features**:
- Tag management with add/remove
- Visual tag display
- Quick access to categorization

### 4. Quick Stats Section (Right Column)
**Purpose**: At-a-glance information for existing records
**Content**:
- Creation date
- Summary statistics
- Related entity counts

### 5. Related Entities Section (Full Width)
**Purpose**: Complex relationship management
**Features**:
- Visual distinction between relationship types
- Interactive association management
- Compact card display

## Relationship Management Pattern

### Contact Association Logic
```jsx
// Separate direct vs. indirect relationships
const directContacts = contacts.filter(c => 
  formData.contactIds.includes(c.id || '')
);
const accountContacts = contacts.filter(c => 
  formData.accountId && 
  c.accountId === formData.accountId && 
  !formData.contactIds.includes(c.id || '')
);
const allRelatedContacts = [...directContacts, ...accountContacts];
```

### Visual Distinction Pattern
```jsx
const isDirect = formData.contactIds.includes(contact.id || '');
return (
  <div className={`rounded-lg p-3 border relative ${
    isDirect 
      ? 'bg-blue-50 border-blue-200'  // Direct relationship
      : 'bg-gray-50 border-gray-200'  // Indirect relationship
  }`}>
    {/* Color-coded content */}
  </div>
);
```

## UI Component Patterns

### Floating Action Button
```jsx
<button
  onClick={handleSubmit}
  disabled={saving || !formData.name.trim() || !formData.parentId}
  className="fixed bottom-4 right-4 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-50"
>
  {saving ? <Spinner /> : <Save className="h-5 w-5" />}
</button>
```

### Tag Management
```jsx
// Display tags
<div className="flex flex-wrap gap-1.5">
  {formData.tags.map((tag, index) => (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      {tag}
      <button onClick={() => handleRemoveTag(tag)}>
        <X className="h-3 w-3" />
      </button>
    </span>
  ))}
</div>

// Add new tag
<div className="flex gap-1.5">
  <input
    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
    className="flex-1 text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
  />
  <button onClick={handleAddTag}>
    <Plus className="h-3.5 w-3.5" />
  </button>
</div>
```

## Business Logic Patterns

### Dropdown Options
```jsx
const BUSINESS_TYPES = [
  { value: 'CODE', label: 'CODE: Full Description' },
  // ...
];

// In render:
<select>
  <option value="">Select Type</option>
  {BUSINESS_TYPES.map((type) => (
    <option key={type.value} value={type.value}>
      {type.value} - {type.label.split(': ')[1]}
    </option>
  ))}
</select>
```

### Form Validation
```jsx
// Disable save based on required fields
disabled={saving || !formData.name.trim() || !formData.parentId}
```

### Save Logic
```jsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);
  
  try {
    const submitData = {
      ...formData,
      createdAt: isNew ? Timestamp.now() : existing?.createdAt
    };

    if (isNew) {
      await createDocument('collection', submitData);
      navigate('/collection');
    } else if (id) {
      await updateDocument('collection', id, submitData);
      await fetchData(); // Refresh to show updated data
    }
  } catch (error) {
    console.error('Error saving:', error);
  } finally {
    setSaving(false);
  }
};
```

## Responsive Design

### Breakpoint Strategy
- **Mobile**: Single column, stacked sections
- **Tablet** (`md:`): 2-column grids within sections
- **Desktop** (`lg:`): 3-column main layout
- **Large** (`xl:`): More items per row in grids

### Grid Patterns
```jsx
// Main layout
"grid grid-cols-1 lg:grid-cols-3 gap-4"

// Within sections
"grid grid-cols-1 md:grid-cols-2 gap-3"

// Contact cards
"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
```

## Performance Considerations

### Loading States
```jsx
if (loading) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}
```

### Parallel Data Fetching
Always fetch independent data sources in parallel using `Promise.all()`

### Form State Optimization
- Single state object for all form data
- Batch updates where possible
- Avoid excessive re-renders

## Styling Standards

### Color Scheme
- **Primary**: Blue (`bg-blue-50`, `text-blue-800`, etc.)
- **Secondary**: Gray (`bg-gray-50`, `text-gray-500`, etc.)
- **Interactive**: Primary brand colors
- **Danger**: Red for delete actions

### Spacing Scale
- **Sections**: `space-y-4` (16px)
- **Within sections**: `gap-3` (12px)
- **Form elements**: `mb-1` for labels, `py-1.5` for inputs
- **Cards**: `p-3` or `p-4` depending on content density

### Typography Scale
- **Page title**: `text-xl font-semibold`
- **Section headers**: `text-base font-medium`
- **Labels**: `text-xs font-medium`
- **Body text**: `text-sm`
- **Metadata**: `text-xs`

## Accessibility

### Focus Management
- Consistent focus rings: `focus:ring-2 focus:ring-primary-500`
- Keyboard navigation support
- Screen reader friendly labels

### Color Contrast
- Meet WCAG guidelines
- Don't rely solely on color for information
- Use icons + color for state indication

## Implementation Checklist

When creating a new detail page:

- [ ] Use three-column layout pattern
- [ ] Implement compact header with live updates
- [ ] Create sections following the hierarchy (primary, secondary, metadata, relationships)
- [ ] Use consistent form field styling
- [ ] Implement tag management if applicable
- [ ] Add relationship management with visual distinction
- [ ] Include floating save button
- [ ] Implement proper loading states
- [ ] Follow responsive design patterns
- [ ] Use parallel data fetching
- [ ] Apply consistent spacing and typography
- [ ] Ensure accessibility compliance

## File Structure Template

```
ComponentDetails.tsx
├── Imports (React, routing, icons, types, utils)
├── Constants (dropdown options, etc.)
├── Component Definition
├── State Management (form data, loading, saving)
├── Data Fetching (useEffect, fetchData function)
├── Event Handlers (submit, delete, field changes)
├── Derived Data (filtered lists, computed values)
├── Loading State
└── Render (header, three-column layout, floating button)
```

This pattern ensures consistency across all detail pages while maintaining the sales-team optimized design and functionality. 