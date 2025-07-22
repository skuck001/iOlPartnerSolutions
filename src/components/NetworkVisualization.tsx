import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Settings,
  Filter,
  Eye,
  EyeOff,
  Maximize2,
  Info,
  Search,
  Target,
  Share2,
  GitBranch,
  Activity
} from 'lucide-react';
import { useNodesApi } from '../hooks/useNodesApi';
import type { Node, Entity, NodeCategory, Direction } from '../types';

interface NetworkVisualizationProps {
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
}

interface NetworkNode {
  id: string;
  label: string;
  category: NodeCategory;
  direction: Direction;
  entity_id: string;
  entity_name: string;
  size: number;
  color: string;
  x?: number;
  y?: number;
  connections: number;
  is_active: boolean;
}

interface NetworkEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  width: number;
  color: string;
  type: 'connectivity' | 'entity_relationship' | 'protocol';
}

interface FilterOptions {
  categories: NodeCategory[];
  directions: Direction[];
  entities: string[];
  showInactive: boolean;
  minConnections: number;
  maxConnections: number;
}

const NetworkVisualization: React.FC<NetworkVisualizationProps> = ({ 
  selectedNodeId, 
  onNodeSelect 
}) => {
  const { getNodes, getEntities, loading, error } = useNodesApi();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [edges, setEdges] = useState<NetworkEdge[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<NetworkNode[]>([]);
  const [filteredEdges, setFilteredEdges] = useState<NetworkEdge[]>([]);
  
  const [viewMode, setViewMode] = useState<'force' | 'hierarchical' | 'circular'>('force');
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    directions: [],
    entities: [],
    showInactive: true,
    minConnections: 0,
    maxConnections: 100
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Category colors and sizes
  const categoryConfig = {
    PMS: { color: '#3B82F6', size: 12 },
    CRS: { color: '#10B981', size: 12 },
    CM: { color: '#8B5CF6', size: 10 },
    BookingEngine: { color: '#F59E0B', size: 10 },
    RMS: { color: '#EF4444', size: 8 },
    Switch: { color: '#6B7280', size: 15 },
    Aggregator: { color: '#EC4899', size: 14 },
    Distributor: { color: '#06B6D4', size: 12 },
    Meta: { color: '#84CC16', size: 10 },
    OTA: { color: '#F97316', size: 14 },
    Wholesaler: { color: '#8B5CF6', size: 12 },
    CMS: { color: '#6366F1', size: 8 },
    Enrichment: { color: '#14B8A6', size: 8 },
    PaymentGateway: { color: '#F59E0B', size: 10 },
    Other: { color: '#64748B', size: 8 }
  };

  // Load and process data
  const loadNetworkData = useCallback(async () => {
    try {
      const [nodesData, entitiesData] = await Promise.all([
        getNodes(),
        getEntities()
      ]);

      // Create network nodes
      const networkNodes: NetworkNode[] = nodesData.map(node => {
        const config = categoryConfig[node.node_category] || categoryConfig.Other;
        const connections = node.connects_to?.length || 0;
        
        return {
          id: node.node_id,
          label: node.node_name,
          category: node.node_category,
          direction: node.direction,
          entity_id: node.entity_id,
          entity_name: node.entity_name,
          size: config.size + Math.min(connections * 2, 10),
          color: config.color,
          connections,
          is_active: node.is_active
        };
      });

      // Create network edges
      const networkEdges: NetworkEdge[] = [];
      const edgeMap = new Set<string>();

      nodesData.forEach(node => {
        if (node.connects_to) {
          node.connects_to.forEach(targetId => {
            const targetNode = nodesData.find(n => n.node_id === targetId);
            if (targetNode) {
              const edgeId = `${node.node_id}-${targetId}`;
              const reverseEdgeId = `${targetId}-${node.node_id}`;
              
              if (!edgeMap.has(edgeId) && !edgeMap.has(reverseEdgeId)) {
                networkEdges.push({
                  id: edgeId,
                  from: node.node_id,
                  to: targetId,
                  width: 2,
                  color: '#6B7280',
                  type: 'connectivity'
                });
                edgeMap.add(edgeId);
              }
            }
          });
        }
      });

      // Add entity relationship edges
      const entityGroups: Record<string, NetworkNode[]> = {};
      networkNodes.forEach(node => {
        if (!entityGroups[node.entity_id]) {
          entityGroups[node.entity_id] = [];
        }
        entityGroups[node.entity_id].push(node);
      });

      Object.values(entityGroups).forEach(entityNodes => {
        if (entityNodes.length > 1) {
          for (let i = 0; i < entityNodes.length; i++) {
            for (let j = i + 1; j < entityNodes.length; j++) {
              const edgeId = `entity-${entityNodes[i].id}-${entityNodes[j].id}`;
              networkEdges.push({
                id: edgeId,
                from: entityNodes[i].id,
                to: entityNodes[j].id,
                width: 1,
                color: '#D1D5DB',
                type: 'entity_relationship'
              });
            }
          }
        }
      });

      setNodes(networkNodes);
      setEdges(networkEdges);
      
      // Initialize layout
      initializeLayout(networkNodes);
      
    } catch (err) {
      console.error('Failed to load network data:', err);
    }
  }, [getNodes, getEntities]);

  useEffect(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  // Initialize node positions
  const initializeLayout = useCallback((networkNodes: NetworkNode[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    if (viewMode === 'circular') {
      const radius = Math.min(width, height) * 0.3;
      networkNodes.forEach((node, index) => {
        const angle = (index / networkNodes.length) * 2 * Math.PI;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      });
    } else if (viewMode === 'hierarchical') {
      const categories = [...new Set(networkNodes.map(n => n.category))];
      const levelHeight = height / (categories.length + 1);
      
      categories.forEach((category, levelIndex) => {
        const levelNodes = networkNodes.filter(n => n.category === category);
        const levelWidth = width / (levelNodes.length + 1);
        
        levelNodes.forEach((node, nodeIndex) => {
          node.x = (nodeIndex + 1) * levelWidth;
          node.y = (levelIndex + 1) * levelHeight;
        });
      });
    } else {
      // Force-directed layout (simplified)
      networkNodes.forEach(node => {
        node.x = centerX + (Math.random() - 0.5) * width * 0.6;
        node.y = centerY + (Math.random() - 0.5) * height * 0.6;
      });
      
      // Simple force simulation
      for (let iteration = 0; iteration < 100; iteration++) {
        simulateForces(networkNodes);
      }
    }
  }, [viewMode]);

  // Simple force simulation
  const simulateForces = useCallback((networkNodes: NetworkNode[]) => {
    const repulsionStrength = 1000;
    const attractionStrength = 0.01;
    
    networkNodes.forEach(nodeA => {
      let fx = 0, fy = 0;
      
      networkNodes.forEach(nodeB => {
        if (nodeA.id !== nodeB.id) {
          const dx = (nodeA.x || 0) - (nodeB.x || 0);
          const dy = (nodeA.y || 0) - (nodeB.y || 0);
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Repulsion
          const repulsion = repulsionStrength / (distance * distance);
          fx += (dx / distance) * repulsion;
          fy += (dy / distance) * repulsion;
        }
      });
      
      // Attraction for connected nodes
      edges.forEach(edge => {
        if (edge.from === nodeA.id || edge.to === nodeA.id) {
          const connectedNodeId = edge.from === nodeA.id ? edge.to : edge.from;
          const connectedNode = networkNodes.find(n => n.id === connectedNodeId);
          
          if (connectedNode) {
            const dx = (connectedNode.x || 0) - (nodeA.x || 0);
            const dy = (connectedNode.y || 0) - (nodeA.y || 0);
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            fx += dx * attractionStrength;
            fy += dy * attractionStrength;
          }
        }
      });
      
      // Apply forces
      nodeA.x = (nodeA.x || 0) + fx * 0.01;
      nodeA.y = (nodeA.y || 0) + fy * 0.01;
    });
  }, [edges]);

  // Apply filters
  useEffect(() => {
    let filtered = nodes;

    if (filters.categories.length > 0) {
      filtered = filtered.filter(node => filters.categories.includes(node.category));
    }

    if (filters.directions.length > 0) {
      filtered = filtered.filter(node => filters.directions.includes(node.direction));
    }

    if (filters.entities.length > 0) {
      filtered = filtered.filter(node => filters.entities.includes(node.entity_id));
    }

    if (!filters.showInactive) {
      filtered = filtered.filter(node => node.is_active);
    }

    filtered = filtered.filter(node => 
      node.connections >= filters.minConnections && 
      node.connections <= filters.maxConnections
    );

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(node =>
        node.label.toLowerCase().includes(term) ||
        node.entity_name.toLowerCase().includes(term)
      );
    }

    setFilteredNodes(filtered);
    
    // Filter edges to only show connections between visible nodes
    const visibleNodeIds = new Set(filtered.map(n => n.id));
    const filteredEdgeList = edges.filter(edge =>
      visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
    );
    setFilteredEdges(filteredEdgeList);
  }, [nodes, edges, filters, searchTerm]);

  // Canvas rendering
  const renderNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    filteredEdges.forEach(edge => {
      const fromNode = filteredNodes.find(n => n.id === edge.from);
      const toNode = filteredNodes.find(n => n.id === edge.to);
      
      if (fromNode && toNode && fromNode.x && fromNode.y && toNode.x && toNode.y) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.strokeStyle = edge.color;
        ctx.lineWidth = edge.width;
        ctx.stroke();
      }
    });

    // Draw nodes
    filteredNodes.forEach(node => {
      if (node.x && node.y) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
        
        // Node fill
        ctx.fillStyle = node.color;
        if (!node.is_active) {
          ctx.fillStyle = ctx.fillStyle + '80'; // Add transparency
        }
        ctx.fill();
        
        // Node border
        if (selectedNode?.id === node.id) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 3;
        } else if (hoveredNode?.id === node.id) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
        }
        ctx.stroke();
        
        // Node label
        if (zoom > 0.5) {
          ctx.fillStyle = '#374151';
          ctx.font = `${Math.max(10, node.size)}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y + node.size + 15);
        }
      }
    });

    ctx.restore();
  }, [filteredNodes, filteredEdges, selectedNode, hoveredNode, zoom, pan]);

  useEffect(() => {
    renderNetwork();
  }, [renderNetwork]);

  // Canvas event handlers
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - pan.x) / zoom;
    const y = (event.clientY - rect.top - pan.y) / zoom;

    // Find clicked node
    const clickedNode = filteredNodes.find(node => {
      if (!node.x || !node.y) return false;
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= node.size;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode);
      if (onNodeSelect) {
        onNodeSelect(clickedNode.id);
      }
    } else {
      setSelectedNode(null);
    }
  }, [filteredNodes, zoom, pan, onNodeSelect]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - pan.x) / zoom;
    const y = (event.clientY - rect.top - pan.y) / zoom;

    // Find hovered node
    const hoveredNodeFound = filteredNodes.find(node => {
      if (!node.x || !node.y) return false;
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= node.size;
    });

    setHoveredNode(hoveredNodeFound || null);
    canvas.style.cursor = hoveredNodeFound ? 'pointer' : 'default';
  }, [filteredNodes, zoom, pan]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const exportNetwork = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `network_visualization_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  // Resize canvas
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        renderNetwork();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [renderNetwork]);

  const renderControls = () => (
    <div className="absolute top-4 left-4 space-y-2">
      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Reset View"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('force')}
            className={`p-2 rounded-md text-xs ${viewMode === 'force' ? 'bg-iol-red text-white' : 'hover:bg-gray-100'}`}
          >
            Force
          </button>
          <button
            onClick={() => setViewMode('hierarchical')}
            className={`p-2 rounded-md text-xs ${viewMode === 'hierarchical' ? 'bg-iol-red text-white' : 'hover:bg-gray-100'}`}
          >
            Hierarchy
          </button>
          <button
            onClick={() => setViewMode('circular')}
            className={`p-2 rounded-md text-xs ${viewMode === 'circular' ? 'bg-iol-red text-white' : 'hover:bg-gray-100'}`}
          >
            Circular
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-md ${showFilters ? 'bg-iol-red text-white' : 'hover:bg-gray-100'}`}
            title="Filters"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`p-2 rounded-md ${showLegend ? 'bg-iol-red text-white' : 'hover:bg-gray-100'}`}
            title="Legend"
          >
            {showLegend ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={exportNetwork}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Export"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderFilters = () => showFilters && (
    <div className="absolute top-4 right-4 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Network Filters</h3>
        <button
          onClick={() => setShowFilters(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-iol-red focus:border-iol-red text-sm"
              placeholder="Search nodes..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {Object.keys(categoryConfig).map(category => (
              <label key={category} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category as NodeCategory)}
                  onChange={(e) => {
                    const newCategories = e.target.checked
                      ? [...filters.categories, category as NodeCategory]
                      : filters.categories.filter(c => c !== category);
                    setFilters(prev => ({ ...prev, categories: newCategories }));
                  }}
                  className="h-4 w-4 text-iol-red focus:ring-iol-red border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{category}</span>
                <div
                  className="ml-auto w-3 h-3 rounded-full"
                  style={{ backgroundColor: categoryConfig[category as keyof typeof categoryConfig].color }}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.showInactive}
              onChange={(e) => setFilters(prev => ({ ...prev, showInactive: e.target.checked }))}
              className="h-4 w-4 text-iol-red focus:ring-iol-red border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Show inactive nodes</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Connections: {filters.minConnections} - {filters.maxConnections}
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max="20"
              value={filters.minConnections}
              onChange={(e) => setFilters(prev => ({ ...prev, minConnections: parseInt(e.target.value) }))}
              className="flex-1"
            />
            <input
              type="range"
              min="0"
              max="20"
              value={filters.maxConnections}
              onChange={(e) => setFilters(prev => ({ ...prev, maxConnections: parseInt(e.target.value) }))}
              className="flex-1"
            />
          </div>
        </div>

        <button
          onClick={() => setFilters({
            categories: [],
            directions: [],
            entities: [],
            showInactive: true,
            minConnections: 0,
            maxConnections: 100
          })}
          className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );

  const renderLegend = () => showLegend && (
    <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Node Categories</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(categoryConfig).slice(0, 8).map(([category, config]) => (
          <div key={category} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-gray-700">{category}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderNodeDetails = () => selectedNode && (
    <div className="absolute top-4 right-4 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Node Details</h3>
        <button
          onClick={() => setSelectedNode(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: selectedNode.color }}
            />
            <span className="font-medium text-gray-900">{selectedNode.label}</span>
          </div>
          <p className="text-sm text-gray-600">{selectedNode.entity_name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Category:</span>
            <p className="font-medium">{selectedNode.category}</p>
          </div>
          <div>
            <span className="text-gray-500">Direction:</span>
            <p className="font-medium">{selectedNode.direction}</p>
          </div>
          <div>
            <span className="text-gray-500">Connections:</span>
            <p className="font-medium">{selectedNode.connections}</p>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <p className={`font-medium ${selectedNode.is_active ? 'text-green-600' : 'text-gray-500'}`}>
              {selectedNode.is_active ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        className="w-full h-full cursor-default"
        style={{ minHeight: '600px' }}
      />
      
      {renderControls()}
      {renderFilters()}
      {renderLegend()}
      {!showFilters && renderNodeDetails()}
      
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-iol-red border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Loading network...</span>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-2">Failed to load network data</p>
            <button
              onClick={loadNetworkData}
              className="px-4 py-2 bg-iol-red text-white rounded-md hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkVisualization; 