import React, { useState, useEffect, useCallback } from 'react';
import { 
  Merge, 
  Building2, 
  Users, 
  ArrowRight, 
  Check, 
  X, 
  Edit3, 
  Save, 
  AlertTriangle,
  CheckCircle,
  Eye,
  Star,
  Target
} from 'lucide-react';
import { useNodesApi } from '../hooks/useNodesApi';

interface MasterMappingProps {
  onMappingComplete?: () => void;
}

interface MergeCandidate {
  id: string;
  type: 'entity' | 'node';
  name: string;
  category?: string;
  website?: string;
  aliases: string[];
  similarity: number;
  reasons: string[];
  suggested_master: string;
}

interface MergeGroup {
  master_id: string;
  master_name: string;
  master_type: 'entity' | 'node';
  candidates: MergeCandidate[];
  proposed_canonical_name: string;
  proposed_aliases: string[];
  confidence_score: number;
}

interface ConsolidationRule {
  id: string;
  name: string;
  type: 'entity' | 'node';
  pattern: string;
  action: 'merge' | 'canonicalize' | 'alias';
  enabled: boolean;
}

const MasterMapping: React.FC<MasterMappingProps> = ({ onMappingComplete }) => {
  const { getEntities, getNodes, updateEntity, updateNode, loading, error } = useNodesApi();
  
  const [entities, setEntities] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [consolidationRules, setConsolidationRules] = useState<ConsolidationRule[]>([]);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'groups' | 'rules' | 'preview'>('groups');
  const [editingCanonicalName, setEditingCanonicalName] = useState<string | null>(null);
  const [newCanonicalName, setNewCanonicalName] = useState('');

  // Load data and analyze merge opportunities
  const loadData = useCallback(async () => {
    try {
      const [entitiesData, nodesData] = await Promise.all([
        getEntities(),
        getNodes()
      ]);

      setEntities(entitiesData);
      setNodes(nodesData);
      
      // Analyze merge opportunities
      analyzeMergeOpportunities(entitiesData, nodesData);
      
      // Load or generate consolidation rules
      generateConsolidationRules(entitiesData, nodesData);
    } catch (err) {
      console.error('Failed to load master mapping data:', err);
    }
  }, [getEntities, getNodes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Analyze potential merge candidates
  const analyzeMergeOpportunities = useCallback((entitiesData: any[], nodesData: any[]) => {
    const groups: MergeGroup[] = [];

    // Group entities with similar names
    const entityGroups = groupSimilarItems(entitiesData, 'entity');
    groups.push(...entityGroups);

    // Group nodes with similar names within the same category
    const nodeCategories = [...new Set(nodesData.map(node => node.node_category))];
    nodeCategories.forEach(category => {
      const categoryNodes = nodesData.filter(node => node.node_category === category);
      const nodeGroups = groupSimilarItems(categoryNodes, 'node');
      groups.push(...nodeGroups);
    });

    // Sort by confidence score
    groups.sort((a, b) => b.confidence_score - a.confidence_score);
    setMergeGroups(groups);
  }, []);

  const groupSimilarItems = (items: any[], type: 'entity' | 'node'): MergeGroup[] => {
    const groups: MergeGroup[] = [];
    const processed = new Set<string>();

    items.forEach(item => {
      if (processed.has(item[type === 'entity' ? 'entity_id' : 'node_id'])) return;

      const similarItems = items.filter(other => {
        const otherId = other[type === 'entity' ? 'entity_id' : 'node_id'];
        if (otherId === item[type === 'entity' ? 'entity_id' : 'node_id'] || processed.has(otherId)) {
          return false;
        }

        const similarity = calculateNameSimilarity(
          item[type === 'entity' ? 'master_entity_name' : 'node_name'],
          other[type === 'entity' ? 'master_entity_name' : 'node_name']
        );

        return similarity > 0.7; // 70% similarity threshold
      });

      if (similarItems.length > 0) {
        const masterId = item[type === 'entity' ? 'entity_id' : 'node_id'];
        const masterName = item[type === 'entity' ? 'master_entity_name' : 'node_name'];

        // Mark all items as processed
        processed.add(masterId);
        similarItems.forEach(similar => {
          processed.add(similar[type === 'entity' ? 'entity_id' : 'node_id']);
        });

        const candidates: MergeCandidate[] = similarItems.map(similar => {
          const similarity = calculateNameSimilarity(masterName, similar[type === 'entity' ? 'master_entity_name' : 'node_name']);
          
          return {
            id: similar[type === 'entity' ? 'entity_id' : 'node_id'],
            type,
            name: similar[type === 'entity' ? 'master_entity_name' : 'node_name'],
            category: type === 'node' ? similar.node_category : undefined,
            website: type === 'entity' ? similar.website : undefined,
            aliases: type === 'entity' ? similar.alternate_names || [] : similar.node_aliases || [],
            similarity,
            reasons: generateMergeReasons(item, similar, type),
            suggested_master: masterId
          };
        });

        // Generate canonical name and aliases
        const allNames = [masterName, ...candidates.map(c => c.name)];
        const allAliases = candidates.reduce((acc, c) => [...acc, ...c.aliases], [] as string[]);
        
        const canonicalName = findBestCanonicalName(allNames);
        const consolidatedAliases = [...new Set([...allNames.filter(n => n !== canonicalName), ...allAliases])];

        groups.push({
          master_id: masterId,
          master_name: masterName,
          master_type: type,
          candidates,
          proposed_canonical_name: canonicalName,
          proposed_aliases: consolidatedAliases,
          confidence_score: candidates.reduce((acc, c) => acc + c.similarity, 0) / candidates.length
        });
      }
    });

    return groups;
  };

  const calculateNameSimilarity = (name1: string, name2: string): number => {
    // Simple Levenshtein distance-based similarity
    const s1 = name1.toLowerCase().trim();
    const s2 = name2.toLowerCase().trim();
    
    if (s1 === s2) return 1;

    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  };

  const generateMergeReasons = (master: any, candidate: any, type: 'entity' | 'node'): string[] => {
    const reasons: string[] = [];
    
    if (type === 'entity') {
      if (master.website && candidate.website) {
        const masterDomain = extractDomain(master.website);
        const candidateDomain = extractDomain(candidate.website);
        if (masterDomain === candidateDomain) {
          reasons.push('Same domain');
        }
      }
      
      // Check for name variations
      const masterWords = master.master_entity_name.toLowerCase().split(' ');
      const candidateWords = candidate.master_entity_name.toLowerCase().split(' ');
      const commonWords = masterWords.filter(word => candidateWords.includes(word));
      
      if (commonWords.length > 0) {
        reasons.push(`${commonWords.length} common word${commonWords.length > 1 ? 's' : ''}`);
      }
    } else {
      if (master.node_category === candidate.node_category) {
        reasons.push('Same category');
      }
      
      if (master.entity_name === candidate.entity_name) {
        reasons.push('Same entity');
      }
    }

    return reasons;
  };

  const extractDomain = (url: string): string => {
    try {
      return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    } catch {
      return '';
    }
  };

  const findBestCanonicalName = (names: string[]): string => {
    // Choose the shortest, most common name as canonical
    return names.reduce((best, current) => {
      if (current.length < best.length && !current.includes('.') && !current.includes('_')) {
        return current;
      }
      return best;
    });
  };

  const generateConsolidationRules = useCallback((entitiesData: any[], nodesData: any[]) => {
    const rules: ConsolidationRule[] = [
      {
        id: '1',
        name: 'Corporate Suffix Normalization',
        type: 'entity',
        pattern: 'Remove Ltd, Inc, Corp suffixes',
        action: 'canonicalize',
        enabled: true
      },
      {
        id: '2',
        name: 'Website Domain Mapping',
        type: 'entity',
        pattern: 'Group by same domain',
        action: 'merge',
        enabled: true
      },
      {
        id: '3',
        name: 'Node Category Standardization',
        type: 'node',
        pattern: 'Standardize category variations',
        action: 'canonicalize',
        enabled: true
      },
      {
        id: '4',
        name: 'Acronym Expansion',
        type: 'node',
        pattern: 'PMS → Property Management System',
        action: 'alias',
        enabled: false
      }
    ];

    setConsolidationRules(rules);
  }, []);

  const handleApplyMerge = async (groupId: string) => {
    const group = mergeGroups.find(g => g.master_id === groupId);
    if (!group) return;

    setProcessing(true);
    try {
      if (group.master_type === 'entity') {
        // Update master entity with consolidated aliases
        await updateEntity({
          entity_id: group.master_id,
          master_entity_name: group.proposed_canonical_name,
          alternate_names: group.proposed_aliases
        });

        // TODO: Merge or delete candidate entities
        // This would involve reassigning their nodes and then deleting them
      } else {
        // Update master node with consolidated aliases
        await updateNode({
          node_id: group.master_id,
          node_name: group.proposed_canonical_name,
          node_aliases: group.proposed_aliases
        });

        // TODO: Delete candidate nodes after merging their data
      }

      // Remove processed group
      setMergeGroups(prev => prev.filter(g => g.master_id !== groupId));
      
      if (onMappingComplete) {
        onMappingComplete();
      }
    } catch (err) {
      console.error('Failed to apply merge:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateCanonicalName = (groupId: string, newName: string) => {
    setMergeGroups(prev => prev.map(group => 
      group.master_id === groupId 
        ? { ...group, proposed_canonical_name: newName }
        : group
    ));
  };

  const renderMergeGroupCard = (group: MergeGroup) => (
    <div key={group.master_id} className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            {group.master_type === 'entity' ? (
              <Building2 className="h-5 w-5 text-blue-600" />
            ) : (
              <Users className="h-5 w-5 text-purple-600" />
            )}
            <h3 className="text-lg font-semibold text-gray-900">{group.master_name}</h3>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {group.candidates.length} merge{group.candidates.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-2 flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Confidence: {Math.round(group.confidence_score * 100)}%
            </span>
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star 
                  key={i} 
                  className={`h-3 w-3 ${i < group.confidence_score * 5 ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setSelectedGroup(selectedGroup === group.master_id ? null : group.master_id)}
            className="text-blue-600 hover:text-blue-800"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Proposed Changes */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Proposed Consolidation</h4>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-900">Canonical Name:</span>
            {editingCanonicalName === group.master_id ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newCanonicalName}
                  onChange={(e) => setNewCanonicalName(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red"
                />
                <button
                  onClick={() => {
                    handleUpdateCanonicalName(group.master_id, newCanonicalName);
                    setEditingCanonicalName(null);
                  }}
                  className="text-green-600 hover:text-green-800"
                >
                  <Save className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setEditingCanonicalName(null)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-green-800">{group.proposed_canonical_name}</span>
                <button
                  onClick={() => {
                    setEditingCanonicalName(group.master_id);
                    setNewCanonicalName(group.proposed_canonical_name);
                  }}
                  className="text-green-600 hover:text-green-800"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <div>
            <span className="text-sm font-medium text-green-900">Aliases:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {group.proposed_aliases.slice(0, 5).map((alias, index) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {alias}
                </span>
              ))}
              {group.proposed_aliases.length > 5 && (
                <span className="text-xs text-green-600">+{group.proposed_aliases.length - 5} more</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Merge Candidates */}
      {selectedGroup === group.master_id && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Merge Candidates</h4>
          <div className="space-y-2">
            {group.candidates.map((candidate, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{candidate.name}</span>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <span className="text-sm text-iol-red">{group.proposed_canonical_name}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Similarity: {Math.round(candidate.similarity * 100)}% • {candidate.reasons.join(', ')}
                  </div>
                  {candidate.aliases.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Aliases: {candidate.aliases.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <div className="text-xs text-gray-500">
          Master: {group.master_type} • {group.candidates.length} candidates
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setMergeGroups(prev => prev.filter(g => g.master_id !== group.master_id))}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={() => handleApplyMerge(group.master_id)}
            disabled={processing}
            className="px-4 py-1 text-sm bg-iol-red text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {processing ? 'Applying...' : 'Apply Merge'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderRulesView = () => (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Consolidation Rules</h3>
        <div className="space-y-3">
          {consolidationRules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => {
                      setConsolidationRules(prev => prev.map(r => 
                        r.id === rule.id ? { ...r, enabled: e.target.checked } : r
                      ));
                    }}
                    className="h-4 w-4 text-iol-red focus:ring-iol-red border-gray-300 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    <div className="text-sm text-gray-600">{rule.pattern}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  rule.type === 'entity' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {rule.type}
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  rule.action === 'merge' ? 'bg-red-100 text-red-800' :
                  rule.action === 'canonicalize' ? 'bg-green-100 text-green-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {rule.action}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Master Mapping</h2>
        <p className="text-gray-600">Consolidate similar entities and nodes under unified profiles</p>
      </div>

      {/* Navigation */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'groups', label: 'Merge Groups', icon: Merge },
            { id: 'rules', label: 'Rules', icon: Target },
            { id: 'preview', label: 'Preview', icon: Eye }
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setViewMode(item.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === item.id
                    ? 'border-iol-red text-iol-red'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-iol-red border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Analyzing merge opportunities...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Analysis Failed</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'groups' && (
            mergeGroups.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Merge Opportunities</h3>
                <p className="text-gray-600">All entities and nodes appear to be unique.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {mergeGroups.map(renderMergeGroupCard)}
              </div>
            )
          )}

          {viewMode === 'rules' && renderRulesView()}

          {viewMode === 'preview' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Merge Preview</h3>
              <p className="text-gray-600">Preview functionality will show the impact of applying all merges.</p>
            </div>
          )}
        </>
      )}

      {/* Statistics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{mergeGroups.length}</div>
          <div className="text-sm text-gray-500">Merge Groups</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {mergeGroups.filter(g => g.master_type === 'entity').length}
          </div>
          <div className="text-sm text-gray-500">Entity Merges</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {mergeGroups.filter(g => g.master_type === 'node').length}
          </div>
          <div className="text-sm text-gray-500">Node Merges</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {consolidationRules.filter(r => r.enabled).length}
          </div>
          <div className="text-sm text-gray-500">Active Rules</div>
        </div>
      </div>
    </div>
  );
};

export default MasterMapping; 