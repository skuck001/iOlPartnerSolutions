import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  Grid,
  List,
  Eye,
  Edit3,
  Trash2,
  Download,
  Upload,
  Plus,
  Building2,
  Users,
  Globe,
  Tag,
  Calendar,
  MapPin,
  Activity,
  ChevronDown,
  ChevronRight,
  Star,
  ExternalLink,
  Settings
} from 'lucide-react';
import { useNodesApi } from '../hooks/useNodesApi';
import type {
  Node,
  Entity,
  NodeCategory,
  Direction,
  ProtocolSupported,
  DataTypeSupported,
  NodeSearchFilters
} from '../types';

interface NodeRegistryProps {
  onNodeSelect?: (node: Node) => void;
  onEntitySelect?: (entity: Entity) => void;
}

interface NodeWithEntity extends Node {
  entity: Entity;
}

type ViewMode = 'grid' | 'list' | 'table';
type GroupBy = 'none' | 'entity' | 'category' | 'direction';

const NodeRegistry: React.FC<NodeRegistryProps> = ({ onNodeSelect, onEntitySelect }) => {
  const { getNodes, getEntities, updateNode, updateEntity, deleteNode, searchNodes, loading, error } = useNodesApi();

  const [nodes, setNodes] = useState<NodeWithEntity[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<NodeWithEntity[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<NodeWithEntity | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<NodeSearchFilters>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'entity' | 'category' | 'created' | 'updated'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [nodesData, entitiesData] = await Promise.all([
        getNodes(),
        getEntities()
      ]);

      // Combine nodes with entity data
      const nodesWithEntities: NodeWithEntity[] = nodesData.map(node => {
        const entity = entitiesData.find(e => e.entity_id === node.entity_id);
        return {
          ...node,
          entity: entity || {
            entity_id: node.entity_id,
            master_entity_name: node.entity_name,
            alternate_names: [],
            website: '',
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            ownerId: node.ownerId
          }
        };
      });

      setNodes(nodesWithEntities);
      setEntities(entitiesData);
    } catch (err) {
      console.error('Failed to load registry data:', err);
    }
  }, [getNodes, getEntities]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter and search logic
  const applyFilters = useCallback(() => {
    let filtered = nodes;

    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(node =>
        node.node_name.toLowerCase().includes(term) ||
        node.entity_name.toLowerCase().includes(term) ||
        node.notes.toLowerCase().includes(term) ||
        node.node_aliases.some(alias => alias.toLowerCase().includes(term)) ||
        node.entity.alternate_names.some(alias => alias.toLowerCase().includes(term))
      );
    }

    // Advanced filters
    if (filters.entity_name) {
      filtered = filtered.filter(node =>
        node.entity_name.toLowerCase().includes(filters.entity_name!.toLowerCase())
      );
    }

    if (filters.node_category?.length) {
      filtered = filtered.filter(node =>
        filters.node_category!.includes(node.node_category)
      );
    }

    if (filters.direction?.length) {
      filtered = filtered.filter(node =>
        filters.direction!.includes(node.direction)
      );
    }

    if (filters.protocols_supported?.length) {
      filtered = filtered.filter(node =>
        filters.protocols_supported!.some(protocol =>
          node.protocols_supported.includes(protocol)
        )
      );
    }

    if (filters.data_types_supported?.length) {
      filtered = filtered.filter(node =>
        filters.data_types_supported!.some(dataType =>
          node.data_types_supported.includes(dataType)
        )
      );
    }

    if (filters.is_active !== undefined) {
      filtered = filtered.filter(node => node.is_active === filters.is_active);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.node_name.toLowerCase();
          bValue = b.node_name.toLowerCase();
          break;
        case 'entity':
          aValue = a.entity_name.toLowerCase();
          bValue = b.entity_name.toLowerCase();
          break;
        case 'category':
          aValue = a.node_category;
          bValue = b.node_category;
          break;
        case 'created':
          aValue = new Date(a.createdAt.seconds * 1000);
          bValue = new Date(b.createdAt.seconds * 1000);
          break;
        case 'updated':
          aValue = new Date(a.updatedAt.seconds * 1000);
          bValue = new Date(b.updatedAt.seconds * 1000);
          break;
        default:
          aValue = a.node_name.toLowerCase();
          bValue = b.node_name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredNodes(filtered);
  }, [nodes, searchTerm, filters, sortBy, sortOrder]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Group nodes for display
  const groupedNodes = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Nodes': filteredNodes };
    }

    const groups: Record<string, NodeWithEntity[]> = {};

    filteredNodes.forEach(node => {
      let groupKey: string;

      switch (groupBy) {
        case 'entity':
          groupKey = node.entity_name;
          break;
        case 'category':
          groupKey = node.node_category;
          break;
        case 'direction':
          groupKey = node.direction;
          break;
        default:
          groupKey = 'All Nodes';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(node);
    });

    return groups;
  }, [filteredNodes, groupBy]);

  const handleNodeClick = (node: NodeWithEntity) => {
    setSelectedNode(node);
    setShowDetails(true);
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete' | 'export') => {
    const selectedNodesList = Array.from(selectedNodes);
    
    try {
      switch (action) {
        case 'activate':
          await Promise.all(
            selectedNodesList.map(nodeId =>
              updateNode({ node_id: nodeId, is_active: true })
            )
          );
          break;
        case 'deactivate':
          await Promise.all(
            selectedNodesList.map(nodeId =>
              updateNode({ node_id: nodeId, is_active: false })
            )
          );
          break;
        case 'delete':
          if (confirm(`Delete ${selectedNodesList.length} node(s)? This action cannot be undone.`)) {
            await Promise.all(selectedNodesList.map(nodeId => deleteNode(nodeId)));
          }
          break;
        case 'export':
          exportNodes(selectedNodesList.map(id => nodes.find(n => n.node_id === id)!));
          break;
      }
      
      await loadData();
      setSelectedNodes(new Set());
    } catch (err) {
      console.error('Bulk action failed:', err);
    }
  };

  const exportNodes = (nodesToExport: NodeWithEntity[]) => {
    const csvContent = [
      'Node Name,Entity Name,Category,Direction,Website,Protocols,Data Types,Active,Notes',
      ...nodesToExport.map(node => [
        node.node_name,
        node.entity_name,
        node.node_category,
        node.direction,
        node.entity.website,
        node.protocols_supported.join(';'),
        node.data_types_supported.join(';'),
        node.is_active ? 'Yes' : 'No',
        node.notes.replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nodes_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCategoryIcon = (category: NodeCategory) => {
    const icons = {
      PMS: Building2,
      CRS: Calendar,
      CM: Activity,
      BookingEngine: Globe,
      RMS: Star,
      Switch: MapPin,
      Aggregator: Grid,
      Distributor: Upload,
      Meta: Search,
      OTA: ExternalLink,
      Wholesaler: Users,
      CMS: Edit3,
      Enrichment: Plus,
      PaymentGateway: Settings,
      Other: Tag
    };
    return icons[category] || Tag;
  };

  const getCategoryColor = (category: NodeCategory) => {
    const colors = {
      PMS: 'bg-blue-100 text-blue-800',
      CRS: 'bg-green-100 text-green-800',
      CM: 'bg-purple-100 text-purple-800',
      BookingEngine: 'bg-orange-100 text-orange-800',
      RMS: 'bg-yellow-100 text-yellow-800',
      Switch: 'bg-gray-100 text-gray-800',
      Aggregator: 'bg-indigo-100 text-indigo-800',
      Distributor: 'bg-pink-100 text-pink-800',
      Meta: 'bg-cyan-100 text-cyan-800',
      OTA: 'bg-red-100 text-red-800',
      Wholesaler: 'bg-emerald-100 text-emerald-800',
      CMS: 'bg-violet-100 text-violet-800',
      Enrichment: 'bg-lime-100 text-lime-800',
      PaymentGateway: 'bg-amber-100 text-amber-800',
      Other: 'bg-slate-100 text-slate-800'
    };
    return colors[category] || colors.Other;
  };

  const renderNodeCard = (node: NodeWithEntity) => {
    const CategoryIcon = getCategoryIcon(node.node_category);
    const isSelected = selectedNodes.has(node.node_id);

    return (
      <div
        key={node.node_id}
        className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
          isSelected ? 'border-iol-red bg-red-50' : 'border-gray-200'
        }`}
        onClick={() => handleNodeClick(node)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                const newSelected = new Set(selectedNodes);
                if (e.target.checked) {
                  newSelected.add(node.node_id);
                } else {
                  newSelected.delete(node.node_id);
                }
                setSelectedNodes(newSelected);
              }}
              className="h-4 w-4 text-iol-red focus:ring-iol-red border-gray-300 rounded"
            />
            <CategoryIcon className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(node.node_category)}`}>
              {node.node_category}
            </span>
            <div className={`w-2 h-2 rounded-full ${node.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
          </div>
        </div>

        <div className="mb-2">
          <h3 className="font-semibold text-gray-900 text-sm">{node.node_name}</h3>
          <p className="text-xs text-gray-600">{node.entity_name}</p>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-center text-gray-500">
            <MapPin className="h-3 w-3 mr-1" />
            <span>{node.direction}</span>
          </div>
          
          {node.entity.website && (
            <div className="flex items-center text-gray-500">
              <Globe className="h-3 w-3 mr-1" />
              <span className="truncate">{node.entity.website}</span>
            </div>
          )}

          {node.protocols_supported.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {node.protocols_supported.slice(0, 2).map(protocol => (
                <span key={protocol} className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                  {protocol}
                </span>
              ))}
              {node.protocols_supported.length > 2 && (
                <span className="text-xs text-gray-500">+{node.protocols_supported.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNodeRow = (node: NodeWithEntity) => {
    const isSelected = selectedNodes.has(node.node_id);
    const CategoryIcon = getCategoryIcon(node.node_category);

    return (
      <tr
        key={node.node_id}
        className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-red-50' : ''}`}
        onClick={() => handleNodeClick(node)}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              const newSelected = new Set(selectedNodes);
              if (e.target.checked) {
                newSelected.add(node.node_id);
              } else {
                newSelected.delete(node.node_id);
              }
              setSelectedNodes(newSelected);
            }}
            className="h-4 w-4 text-iol-red focus:ring-iol-red border-gray-300 rounded"
          />
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <CategoryIcon className="h-4 w-4 text-gray-600 mr-2" />
            <div>
              <div className="text-sm font-medium text-gray-900">{node.node_name}</div>
              {node.node_aliases.length > 0 && (
                <div className="text-xs text-gray-500">
                  Aliases: {node.node_aliases.slice(0, 2).join(', ')}
                  {node.node_aliases.length > 2 && ` +${node.node_aliases.length - 2}`}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{node.entity_name}</div>
          <div className="text-xs text-gray-500">{node.entity.website}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(node.node_category)}`}>
            {node.node_category}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {node.direction}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex flex-wrap gap-1">
            {node.protocols_supported.slice(0, 2).map(protocol => (
              <span key={protocol} className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                {protocol}
              </span>
            ))}
            {node.protocols_supported.length > 2 && (
              <span className="text-xs text-gray-500">+{node.protocols_supported.length - 2}</span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            node.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {node.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {new Date(node.updatedAt.seconds * 1000).toLocaleDateString()}
        </td>
      </tr>
    );
  };

  const renderAdvancedFilters = () => (
    <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
          <input
            type="text"
            value={filters.entity_name || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, entity_name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red text-sm"
            placeholder="Filter by entity..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categories</label>
          <select
            multiple
            value={filters.node_category || []}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value as NodeCategory);
              setFilters(prev => ({ ...prev, node_category: values }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red text-sm"
          >
            <option value="PMS">PMS</option>
            <option value="CRS">CRS</option>
            <option value="CM">Channel Manager</option>
            <option value="BookingEngine">Booking Engine</option>
            <option value="RMS">RMS</option>
            <option value="OTA">OTA</option>
            <option value="Switch">Switch</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
          <select
            multiple
            value={filters.direction || []}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value as Direction);
              setFilters(prev => ({ ...prev, direction: values }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red text-sm"
          >
            <option value="Supply">Supply</option>
            <option value="Demand">Demand</option>
            <option value="Supply Switch">Supply Switch</option>
            <option value="Demand Switch">Demand Switch</option>
            <option value="None">None</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filters.is_active === undefined ? 'all' : filters.is_active.toString()}
            onChange={(e) => {
              const value = e.target.value === 'all' ? undefined : e.target.value === 'true';
              setFilters(prev => ({ ...prev, is_active: value }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red text-sm"
          >
            <option value="all">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setFilters({})}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Clear Filters
        </button>
        <div className="text-sm text-gray-500">
          {filteredNodes.length} of {nodes.length} nodes
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Node Registry</h2>
        <p className="text-gray-600">Browse, search, and manage your travel technology node database</p>
      </div>

      {/* Search and Controls */}
      <div className="bg-white border border-gray-200 rounded-lg mb-6">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search */}
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
                  placeholder="Search nodes, entities, or aliases..."
                />
              </div>
            </div>

            {/* View Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">Group by:</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red text-sm"
                >
                  <option value="none">None</option>
                  <option value="entity">Entity</option>
                  <option value="category">Category</option>
                  <option value="direction">Direction</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red text-sm"
                >
                  <option value="name">Name</option>
                  <option value="entity">Entity</option>
                  <option value="category">Category</option>
                  <option value="created">Created</option>
                  <option value="updated">Updated</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>

              <div className="flex items-center space-x-1 border border-gray-300 rounded-md">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-iol-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 ${viewMode === 'table' ? 'bg-iol-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-3 py-2 border rounded-md text-sm ${
                  showAdvancedFilters 
                    ? 'border-iol-red bg-red-50 text-iol-red' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4 mr-1 inline" />
                Filters
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedNodes.size > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-900 font-medium">
                  {selectedNodes.size} node{selectedNodes.size > 1 ? 's' : ''} selected
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleBulkAction('activate')}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    className="px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleBulkAction('export')}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {showAdvancedFilters && renderAdvancedFilters()}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-iol-red border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Loading registry...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error}</p>
        </div>
      ) : filteredNodes.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Nodes Found</h3>
          <p className="text-gray-600">
            {searchTerm || Object.keys(filters).length > 0
              ? 'No nodes match your current search or filters.'
              : 'No nodes available. Import some data first.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNodes).map(([groupName, groupNodes]) => (
            <div key={groupName} className="bg-white border border-gray-200 rounded-lg">
              {groupBy !== 'none' && (
                <div
                  className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    const newExpanded = new Set(expandedGroups);
                    if (expandedGroups.has(groupName)) {
                      newExpanded.delete(groupName);
                    } else {
                      newExpanded.add(groupName);
                    }
                    setExpandedGroups(newExpanded);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{groupName}</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">{groupNodes.length} nodes</span>
                      {expandedGroups.has(groupName) ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(groupBy === 'none' || expandedGroups.has(groupName)) && (
                <div className="p-6">
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {groupNodes.map(renderNodeCard)}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Select
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Node
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Entity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Category
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Direction
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Protocols
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Updated
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {groupNodes.map(renderNodeRow)}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Statistics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{nodes.length}</div>
          <div className="text-sm text-gray-500">Total Nodes</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {nodes.filter(n => n.is_active).length}
          </div>
          <div className="text-sm text-gray-500">Active Nodes</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{entities.length}</div>
          <div className="text-sm text-gray-500">Entities</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {[...new Set(nodes.map(n => n.node_category))].length}
          </div>
          <div className="text-sm text-gray-500">Categories</div>
        </div>
      </div>
    </div>
  );
};

export default NodeRegistry; 