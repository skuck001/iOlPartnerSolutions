import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Edit3, 
  Trash2, 
  Plus, 
  Save, 
  X, 
  Building2, 
  Users, 
  Star,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  ArrowRight
} from 'lucide-react';
import { useNodesApi } from '../hooks/useNodesApi';

interface AliasManagerProps {
  onAliasUpdate?: (entityId: string, nodeId: string) => void;
}

interface EntityWithAliases {
  entity_id: string;
  master_entity_name: string;
  alternate_names: string[];
  website: string;
  nodes: NodeWithAliases[];
}

interface NodeWithAliases {
  node_id: string;
  node_name: string;
  entity_id: string;
  entity_name: string;
  node_category: string;
  node_aliases: string[];
  is_active: boolean;
}

interface AliasSuggestion {
  type: 'entity' | 'node';
  target_id: string;
  target_name: string;
  suggested_alias: string;
  source: string;
  confidence: number;
  reason: string;
}

const AliasManager: React.FC<AliasManagerProps> = ({ onAliasUpdate }) => {
  const { getEntities, getNodes, updateEntity, updateNode, loading, error } = useNodesApi();
  
  const [entities, setEntities] = useState<EntityWithAliases[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<EntityWithAliases[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'entities' | 'nodes'>('all');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ type: 'entity' | 'node', id: string } | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [suggestions, setSuggestions] = useState<AliasSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [entitiesData, nodesData] = await Promise.all([
        getEntities(),
        getNodes()
      ]);

      // Combine entities with their nodes
      const entitiesWithNodes: EntityWithAliases[] = entitiesData.map(entity => ({
        ...entity,
        nodes: nodesData.filter(node => node.entity_id === entity.entity_id)
      }));

      setEntities(entitiesWithNodes);
      generateAliasSuggestions(entitiesWithNodes, nodesData);
    } catch (err) {
      console.error('Failed to load alias data:', err);
    }
  }, [getEntities, getNodes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter and search
  useEffect(() => {
    let filtered = entities;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = entities.filter(entity => {
        const entityMatch = entity.master_entity_name.toLowerCase().includes(term) ||
                           entity.alternate_names.some(alias => alias.toLowerCase().includes(term));
        
        const nodeMatch = entity.nodes.some(node => 
          node.node_name.toLowerCase().includes(term) ||
          node.node_aliases.some(alias => alias.toLowerCase().includes(term))
        );

        return entityMatch || nodeMatch;
      });
    }

    if (filterType !== 'all') {
      if (filterType === 'entities') {
        filtered = filtered.filter(entity => entity.alternate_names.length > 0);
      } else if (filterType === 'nodes') {
        filtered = filtered.filter(entity => 
          entity.nodes.some(node => node.node_aliases.length > 0)
        );
      }
    }

    setFilteredEntities(filtered);
  }, [entities, searchTerm, filterType]);

  // Generate alias suggestions
  const generateAliasSuggestions = useCallback((entitiesData: EntityWithAliases[], nodesData: any[]) => {
    const suggestions: AliasSuggestion[] = [];

    // Suggest entity aliases based on domain variations
    entitiesData.forEach(entity => {
      if (entity.website) {
        const domain = entity.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
        
        // Suggest domain-based aliases
        if (domain !== entity.master_entity_name.toLowerCase()) {
          suggestions.push({
            type: 'entity',
            target_id: entity.entity_id,
            target_name: entity.master_entity_name,
            suggested_alias: domain.charAt(0).toUpperCase() + domain.slice(1),
            source: 'domain_analysis',
            confidence: 0.8,
            reason: 'Derived from website domain'
          });
        }
      }

      // Suggest entity aliases based on node names
      entity.nodes.forEach(node => {
        const entityWords = entity.master_entity_name.toLowerCase().split(' ');
        const nodeWords = node.node_name.toLowerCase().split(' ');
        
        // Find common variations
        nodeWords.forEach(word => {
          if (word.length > 3 && !entityWords.includes(word) && 
              !entity.alternate_names.map(a => a.toLowerCase()).includes(word)) {
            suggestions.push({
              type: 'entity',
              target_id: entity.entity_id,
              target_name: entity.master_entity_name,
              suggested_alias: word.charAt(0).toUpperCase() + word.slice(1),
              source: 'node_analysis',
              confidence: 0.6,
              reason: `Found in node name: ${node.node_name}`
            });
          }
        });
      });
    });

    // Suggest node aliases based on category patterns
    nodesData.forEach(node => {
      const categoryAliases = {
        'PMS': ['Property Management', 'Hotel System'],
        'CRS': ['Reservation System', 'Booking System'],
        'CM': ['Channel Manager', 'Distribution'],
        'OTA': ['Online Travel', 'Booking Platform']
      };

      const aliases = categoryAliases[node.node_category as keyof typeof categoryAliases];
      if (aliases) {
        aliases.forEach(alias => {
          if (!node.node_aliases.includes(alias)) {
            suggestions.push({
              type: 'node',
              target_id: node.node_id,
              target_name: node.node_name,
              suggested_alias: alias,
              source: 'category_pattern',
              confidence: 0.7,
              reason: `Common alias for ${node.node_category} systems`
            });
          }
        });
      }
    });

    // Sort by confidence and limit
    suggestions.sort((a, b) => b.confidence - a.confidence);
    setSuggestions(suggestions.slice(0, 20));
  }, []);

  const handleAddAlias = async (type: 'entity' | 'node', id: string, alias: string) => {
    if (!alias.trim()) return;

    try {
      if (type === 'entity') {
        const entity = entities.find(e => e.entity_id === id);
        if (entity) {
          const updatedAliases = [...entity.alternate_names, alias.trim()];
          await updateEntity({
            entity_id: id,
            alternate_names: updatedAliases
          });
        }
      } else {
        const entity = entities.find(e => e.nodes.some(n => n.node_id === id));
        const node = entity?.nodes.find(n => n.node_id === id);
        if (node) {
          const updatedAliases = [...node.node_aliases, alias.trim()];
          await updateNode({
            node_id: id,
            node_aliases: updatedAliases
          });
        }
      }

      await loadData();
      setNewAlias('');
      setEditingItem(null);
      
      if (onAliasUpdate) {
        onAliasUpdate(type === 'entity' ? id : '', type === 'node' ? id : '');
      }
    } catch (err) {
      console.error('Failed to add alias:', err);
    }
  };

  const handleRemoveAlias = async (type: 'entity' | 'node', id: string, aliasToRemove: string) => {
    try {
      if (type === 'entity') {
        const entity = entities.find(e => e.entity_id === id);
        if (entity) {
          const updatedAliases = entity.alternate_names.filter(alias => alias !== aliasToRemove);
          await updateEntity({
            entity_id: id,
            alternate_names: updatedAliases
          });
        }
      } else {
        const entity = entities.find(e => e.nodes.some(n => n.node_id === id));
        const node = entity?.nodes.find(n => n.node_id === id);
        if (node) {
          const updatedAliases = node.node_aliases.filter(alias => alias !== aliasToRemove);
          await updateNode({
            node_id: id,
            node_aliases: updatedAliases
          });
        }
      }

      await loadData();
      
      if (onAliasUpdate) {
        onAliasUpdate(type === 'entity' ? id : '', type === 'node' ? id : '');
      }
    } catch (err) {
      console.error('Failed to remove alias:', err);
    }
  };

  const handleApplySuggestion = async (suggestion: AliasSuggestion) => {
    await handleAddAlias(suggestion.type, suggestion.target_id, suggestion.suggested_alias);
    setSuggestions(prev => prev.filter(s => s !== suggestion));
  };

  const handleBulkAddAliases = async (aliasText: string) => {
    const aliases = aliasText.split('\n').map(alias => alias.trim()).filter(alias => alias);
    
    for (const itemId of selectedItems) {
      // Determine if it's entity or node
      const entity = entities.find(e => e.entity_id === itemId);
      const isEntity = !!entity;
      
      if (!isEntity) {
        // Find node
        for (const ent of entities) {
          const node = ent.nodes.find(n => n.node_id === itemId);
          if (node) {
            for (const alias of aliases) {
              if (!node.node_aliases.includes(alias)) {
                await handleAddAlias('node', itemId, alias);
              }
            }
            break;
          }
        }
      } else {
        for (const alias of aliases) {
          if (!entity.alternate_names.includes(alias)) {
            await handleAddAlias('entity', itemId, alias);
          }
        }
      }
    }
    
    setBulkEditMode(false);
    setSelectedItems(new Set());
  };

  const renderEntityCard = (entity: EntityWithAliases) => (
    <div key={entity.entity_id} className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">{entity.master_entity_name}</h3>
            {bulkEditMode && (
              <input
                type="checkbox"
                checked={selectedItems.has(entity.entity_id)}
                onChange={(e) => {
                  const newSelected = new Set(selectedItems);
                  if (e.target.checked) {
                    newSelected.add(entity.entity_id);
                  } else {
                    newSelected.delete(entity.entity_id);
                  }
                  setSelectedItems(newSelected);
                }}
                className="h-4 w-4 text-iol-red focus:ring-iol-red border-gray-300 rounded"
              />
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{entity.website}</p>
        </div>
        
        <button
          onClick={() => setSelectedEntity(selectedEntity === entity.entity_id ? null : entity.entity_id)}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowRight className={`h-4 w-4 transition-transform ${selectedEntity === entity.entity_id ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Entity Aliases */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">Entity Aliases</h4>
          <button
            onClick={() => setEditingItem({ type: 'entity', id: entity.entity_id })}
            className="text-sm text-iol-red hover:text-red-700"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {entity.alternate_names.map((alias, index) => (
            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {alias}
              <button
                onClick={() => handleRemoveAlias('entity', entity.entity_id, alias)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {entity.alternate_names.length === 0 && (
            <span className="text-xs text-gray-400">No aliases defined</span>
          )}
        </div>
        
        {editingItem?.type === 'entity' && editingItem.id === entity.entity_id && (
          <div className="mt-2 flex space-x-2">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
              placeholder="Enter new alias..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddAlias('entity', entity.entity_id, newAlias);
                }
              }}
            />
            <button
              onClick={() => handleAddAlias('entity', entity.entity_id, newAlias)}
              className="px-3 py-1 text-sm bg-iol-red text-white rounded-md hover:bg-red-700"
            >
              <Save className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                setEditingItem(null);
                setNewAlias('');
              }}
              className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Nodes */}
      {selectedEntity === entity.entity_id && entity.nodes.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Nodes</h4>
          <div className="space-y-3">
            {entity.nodes.map(node => (
              <div key={node.node_id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-900">{node.node_name}</span>
                    <span className="text-xs text-gray-500">({node.node_category})</span>
                    {bulkEditMode && (
                      <input
                        type="checkbox"
                        checked={selectedItems.has(node.node_id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedItems);
                          if (e.target.checked) {
                            newSelected.add(node.node_id);
                          } else {
                            newSelected.delete(node.node_id);
                          }
                          setSelectedItems(newSelected);
                        }}
                        className="h-3 w-3 text-iol-red focus:ring-iol-red border-gray-300 rounded"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => setEditingItem({ type: 'node', id: node.node_id })}
                    className="text-xs text-iol-red hover:text-red-700"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {node.node_aliases.map((alias, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {alias}
                      <button
                        onClick={() => handleRemoveAlias('node', node.node_id, alias)}
                        className="ml-1 text-purple-600 hover:text-purple-800"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </span>
                  ))}
                  {node.node_aliases.length === 0 && (
                    <span className="text-xs text-gray-400">No aliases defined</span>
                  )}
                </div>

                {editingItem?.type === 'node' && editingItem.id === node.node_id && (
                  <div className="mt-2 flex space-x-2">
                    <input
                      type="text"
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
                      placeholder="Enter new alias..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddAlias('node', node.node_id, newAlias);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddAlias('node', node.node_id, newAlias)}
                      className="px-2 py-1 text-xs bg-iol-red text-white rounded-md hover:bg-red-700"
                    >
                      <Save className="h-2 w-2" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setNewAlias('');
                      }}
                      className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSuggestions = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900">Alias Suggestions</h3>
        </div>
        <span className="text-sm text-gray-500">{suggestions.length} suggestions</span>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2" />
          <p className="text-gray-600">No new alias suggestions at this time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.slice(0, 5).map((suggestion, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  {suggestion.type === 'entity' ? (
                    <Building2 className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Users className="h-4 w-4 text-purple-600" />
                  )}
                  <span className="font-medium text-gray-900">{suggestion.target_name}</span>
                  <span className="text-sm text-gray-500">→</span>
                  <span className="text-sm font-medium text-iol-red">{suggestion.suggested_alias}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{suggestion.reason}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-500">Confidence:</span>
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i} 
                        className={`h-3 w-3 ${i < suggestion.confidence * 5 ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleApplySuggestion(suggestion)}
                  className="px-3 py-1 text-xs bg-iol-red text-white rounded-md hover:bg-red-700"
                >
                  Apply
                </button>
                <button
                  onClick={() => setSuggestions(prev => prev.filter(s => s !== suggestion))}
                  className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
          
          {suggestions.length > 5 && (
            <button
              onClick={() => setShowSuggestions(true)}
              className="w-full text-center text-sm text-iol-red hover:text-red-700 py-2"
            >
              Show {suggestions.length - 5} more suggestions
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Alias Management</h2>
        <p className="text-gray-600">Manage entity and node aliases to improve search and matching</p>
      </div>

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
                placeholder="Search entities or nodes..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
            >
              <option value="all">All Items</option>
              <option value="entities">Entities with Aliases</option>
              <option value="nodes">Nodes with Aliases</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actions</label>
            <div className="flex space-x-2">
              <button
                onClick={() => setBulkEditMode(!bulkEditMode)}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  bulkEditMode 
                    ? 'bg-iol-red text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Bulk Edit
              </button>
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="px-3 py-2 text-sm bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200"
              >
                Suggestions
              </button>
            </div>
          </div>

          {bulkEditMode && selectedItems.size > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bulk Actions ({selectedItems.size} selected)
              </label>
              <button
                onClick={() => {
                  const aliases = prompt('Enter aliases (one per line):');
                  if (aliases) handleBulkAddAliases(aliases);
                }}
                className="px-3 py-2 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200"
              >
                Add Aliases
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions Panel */}
      {showSuggestions && (
        <div className="mb-6">
          {renderSuggestions()}
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-iol-red border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Loading alias data...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Failed to Load Data</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Found</h3>
          <p className="text-gray-600">
            {searchTerm || filterType !== 'all' 
              ? 'No entities match your current search or filters.' 
              : 'No entities available. Import some data first.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredEntities.map(renderEntityCard)}
        </div>
      )}

      {/* Statistics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{entities.length}</div>
          <div className="text-sm text-gray-500">Total Entities</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {entities.reduce((acc, entity) => acc + entity.alternate_names.length, 0)}
          </div>
          <div className="text-sm text-gray-500">Entity Aliases</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {entities.reduce((acc, entity) => 
              acc + entity.nodes.reduce((nodeAcc, node) => nodeAcc + node.node_aliases.length, 0), 0
            )}
          </div>
          <div className="text-sm text-gray-500">Node Aliases</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{suggestions.length}</div>
          <div className="text-sm text-gray-500">Pending Suggestions</div>
        </div>
      </div>
    </div>
  );
};

export default AliasManager; 