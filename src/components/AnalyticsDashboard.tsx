import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Users,
  Building2,
  Globe,
  Target,
  Star,
  Download,
  Calendar,
  Filter,
  Info,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { useNodesApi } from '../hooks/useNodesApi';
import type { Node, Entity, NodeCategory, Direction } from '../types';

interface AnalyticsDashboardProps {
  selectedTimeRange?: string;
  selectedFilters?: any;
}

interface NetworkMetrics {
  totalNodes: number;
  totalEntities: number;
  activeNodes: number;
  totalConnections: number;
  averageConnectionsPerNode: number;
  networkDensity: number;
  mostConnectedNode: string;
  largestEntity: string;
}

interface CategoryAnalytics {
  category: NodeCategory;
  count: number;
  percentage: number;
  activeCount: number;
  avgConnections: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface DirectionAnalytics {
  direction: Direction;
  count: number;
  percentage: number;
  avgConnections: number;
}

interface ConnectivityInsight {
  type: 'hub' | 'bridge' | 'cluster' | 'isolated';
  nodeId: string;
  nodeName: string;
  score: number;
  description: string;
}

interface TrendData {
  period: string;
  nodes: number;
  entities: number;
  connections: number;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  selectedTimeRange = '30d',
  selectedFilters 
}) => {
  const { getNodes, getEntities, getBatchLogs, loading, error } = useNodesApi();
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [categoryAnalytics, setCategoryAnalytics] = useState<CategoryAnalytics[]>([]);
  const [directionAnalytics, setDirectionAnalytics] = useState<DirectionAnalytics[]>([]);
  const [connectivityInsights, setConnectivityInsights] = useState<ConnectivityInsight[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [timeRange, setTimeRange] = useState(selectedTimeRange);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load data and calculate metrics
  const loadAnalyticsData = useCallback(async () => {
    try {
      const [nodesData, entitiesData, batchData] = await Promise.all([
        getNodes(),
        getEntities(),
        getBatchLogs()
      ]);

      setNodes(nodesData);
      setEntities(entitiesData);
      
      // Calculate network metrics
      calculateNetworkMetrics(nodesData, entitiesData);
      
      // Calculate category analytics
      calculateCategoryAnalytics(nodesData);
      
      // Calculate direction analytics
      calculateDirectionAnalytics(nodesData);
      
      // Calculate connectivity insights
      calculateConnectivityInsights(nodesData);
      
      // Generate trend data
      generateTrendData(batchData, nodesData, entitiesData);
      
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    }
  }, [getNodes, getEntities, getBatchLogs]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const calculateNetworkMetrics = useCallback((nodesData: Node[], entitiesData: Entity[]) => {
    const totalConnections = nodesData.reduce((sum, node) => sum + (node.connects_to?.length || 0), 0);
    const activeNodes = nodesData.filter(node => node.is_active).length;
    const maxPossibleConnections = nodesData.length * (nodesData.length - 1) / 2;
    
    // Find most connected node
    const mostConnected = nodesData.reduce((max, node) => 
      (node.connects_to?.length || 0) > (max.connects_to?.length || 0) ? node : max
    );
    
    // Find largest entity by node count
    const entityNodeCounts = entitiesData.map(entity => ({
      entity,
      nodeCount: nodesData.filter(node => node.entity_id === entity.entity_id).length
    }));
    const largestEntity = entityNodeCounts.reduce((max, current) => 
      current.nodeCount > max.nodeCount ? current : max
    );

    setMetrics({
      totalNodes: nodesData.length,
      totalEntities: entitiesData.length,
      activeNodes,
      totalConnections,
      averageConnectionsPerNode: totalConnections / nodesData.length,
      networkDensity: totalConnections / maxPossibleConnections,
      mostConnectedNode: mostConnected.node_name,
      largestEntity: largestEntity.entity.master_entity_name
    });
  }, []);

  const calculateCategoryAnalytics = useCallback((nodesData: Node[]) => {
    const categories = [...new Set(nodesData.map(node => node.node_category))];
    
    const analytics: CategoryAnalytics[] = categories.map(category => {
      const categoryNodes = nodesData.filter(node => node.node_category === category);
      const activeCount = categoryNodes.filter(node => node.is_active).length;
      const totalConnections = categoryNodes.reduce((sum, node) => sum + (node.connects_to?.length || 0), 0);
      
      return {
        category,
        count: categoryNodes.length,
        percentage: (categoryNodes.length / nodesData.length) * 100,
        activeCount,
        avgConnections: totalConnections / categoryNodes.length || 0,
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
        trendValue: Math.random() * 20
      };
    });

    analytics.sort((a, b) => b.count - a.count);
    setCategoryAnalytics(analytics);
  }, []);

  const calculateDirectionAnalytics = useCallback((nodesData: Node[]) => {
    const directions = [...new Set(nodesData.map(node => node.direction))];
    
    const analytics: DirectionAnalytics[] = directions.map(direction => {
      const directionNodes = nodesData.filter(node => node.direction === direction);
      const totalConnections = directionNodes.reduce((sum, node) => sum + (node.connects_to?.length || 0), 0);
      
      return {
        direction,
        count: directionNodes.length,
        percentage: (directionNodes.length / nodesData.length) * 100,
        avgConnections: totalConnections / directionNodes.length || 0
      };
    });

    analytics.sort((a, b) => b.count - a.count);
    setDirectionAnalytics(analytics);
  }, []);

  const calculateConnectivityInsights = useCallback((nodesData: Node[]) => {
    const insights: ConnectivityInsight[] = [];
    
    // Find hubs (highly connected nodes)
    const hubs = nodesData
      .filter(node => (node.connects_to?.length || 0) > 5)
      .sort((a, b) => (b.connects_to?.length || 0) - (a.connects_to?.length || 0))
      .slice(0, 3)
      .map(node => ({
        type: 'hub' as const,
        nodeId: node.node_id,
        nodeName: node.node_name,
        score: node.connects_to?.length || 0,
        description: `Highly connected ${node.node_category} with ${node.connects_to?.length || 0} connections`
      }));
    
    insights.push(...hubs);
    
    // Find isolated nodes
    const isolated = nodesData
      .filter(node => (node.connects_to?.length || 0) === 0)
      .slice(0, 3)
      .map(node => ({
        type: 'isolated' as const,
        nodeId: node.node_id,
        nodeName: node.node_name,
        score: 0,
        description: `${node.node_category} with no connections - potential integration opportunity`
      }));
    
    insights.push(...isolated);
    
    // Find potential bridges (nodes connecting different categories)
    const bridges = nodesData
      .filter(node => {
        if (!node.connects_to || node.connects_to.length < 2) return false;
        const connectedCategories = new Set(
          node.connects_to
            .map(id => nodesData.find(n => n.node_id === id)?.node_category)
            .filter(Boolean)
        );
        return connectedCategories.size > 1;
      })
      .slice(0, 2)
      .map(node => ({
        type: 'bridge' as const,
        nodeId: node.node_id,
        nodeName: node.node_name,
        score: node.connects_to?.length || 0,
        description: `Bridges multiple system categories - key integration point`
      }));
    
    insights.push(...bridges);
    
    setConnectivityInsights(insights);
  }, []);

  const generateTrendData = useCallback((batchData: any[], nodesData: Node[], entitiesData: Entity[]) => {
    // Simulate trend data - in real implementation, this would come from historical data
    const periods = [];
    const currentDate = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - i);
      
      // Simulate growth
      const baseNodes = Math.max(0, nodesData.length - (i * 2));
      const baseEntities = Math.max(0, entitiesData.length - Math.floor(i * 1.5));
      const baseConnections = Math.max(0, (nodesData.reduce((sum, node) => sum + (node.connects_to?.length || 0), 0)) - (i * 3));
      
      periods.push({
        period: date.toISOString().split('T')[0],
        nodes: baseNodes + Math.floor(Math.random() * 5),
        entities: baseEntities + Math.floor(Math.random() * 3),
        connections: baseConnections + Math.floor(Math.random() * 10)
      });
    }
    
    setTrendData(periods);
  }, []);

  const exportAnalytics = useCallback(() => {
    const analyticsData = {
      timestamp: new Date().toISOString(),
      metrics,
      categoryAnalytics,
      directionAnalytics,
      connectivityInsights,
      trendData
    };

    const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network_analytics_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [metrics, categoryAnalytics, directionAnalytics, connectivityInsights, trendData]);

  const getCategoryIcon = (category: NodeCategory) => {
    const icons = {
      PMS: Building2,
      CRS: Calendar,
      CM: Activity,
      BookingEngine: Globe,
      OTA: Target,
      Switch: Star,
      Aggregator: BarChart3,
      Distributor: TrendingUp,
      Meta: Users,
      Wholesaler: Building2,
      RMS: Activity,
      CMS: Users,
      Enrichment: Star,
      PaymentGateway: Target,
      Other: Users
    };
    return icons[category] || Users;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-500" />;
      case 'stable': return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const renderMetricsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Nodes</p>
            <p className="text-3xl font-bold text-gray-900">{metrics?.totalNodes || 0}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-full">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
          <span className="text-green-500">+12%</span>
          <span className="text-gray-500 ml-1">from last month</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Active Nodes</p>
            <p className="text-3xl font-bold text-gray-900">{metrics?.activeNodes || 0}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-full">
            <Activity className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-gray-500">
            {metrics ? Math.round((metrics.activeNodes / metrics.totalNodes) * 100) : 0}% of total
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Entities</p>
            <p className="text-3xl font-bold text-gray-900">{metrics?.totalEntities || 0}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-full">
            <Building2 className="h-6 w-6 text-purple-600" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
          <span className="text-green-500">+8%</span>
          <span className="text-gray-500 ml-1">from last month</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Connections</p>
            <p className="text-3xl font-bold text-gray-900">{metrics?.totalConnections || 0}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-full">
            <Star className="h-6 w-6 text-orange-600" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-gray-500">
            Avg: {metrics ? metrics.averageConnectionsPerNode.toFixed(1) : 0} per node
          </span>
        </div>
      </div>
    </div>
  );

  const renderCategoryAnalytics = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Category Distribution</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-iol-red hover:text-red-700"
        >
          {showAdvanced ? 'Show Less' : 'Show More'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category List */}
        <div className="space-y-4">
          {categoryAnalytics.slice(0, showAdvanced ? undefined : 6).map(category => {
            const Icon = getCategoryIcon(category.category);
            return (
              <div key={category.category} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Icon className="h-5 w-5 text-gray-600" />
                  <div>
                    <div className="font-medium text-gray-900">{category.category}</div>
                    <div className="text-sm text-gray-500">
                      {category.activeCount} active of {category.count} total
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{category.percentage.toFixed(1)}%</span>
                    {getTrendIcon(category.trend)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {category.avgConnections.toFixed(1)} avg connections
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual Chart Placeholder */}
        <div className="flex items-center justify-center bg-gray-50 rounded-lg h-64">
          <div className="text-center">
            <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Category Distribution Chart</p>
            <p className="text-sm text-gray-400">Visual chart would be rendered here</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDirectionAnalytics = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Direction Analysis</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {directionAnalytics.map(direction => (
          <div key={direction.direction} className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{direction.count}</div>
            <div className="text-sm text-gray-600 mb-2">{direction.direction}</div>
            <div className="text-xs text-gray-500">
              {direction.percentage.toFixed(1)}% • {direction.avgConnections.toFixed(1)} avg conn.
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConnectivityInsights = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Connectivity Insights</h3>
        <Info className="h-5 w-5 text-gray-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectivityInsights.map((insight, index) => {
          const getInsightColor = () => {
            switch (insight.type) {
              case 'hub': return 'border-blue-200 bg-blue-50';
              case 'bridge': return 'border-purple-200 bg-purple-50';
              case 'isolated': return 'border-yellow-200 bg-yellow-50';
              case 'cluster': return 'border-green-200 bg-green-50';
              default: return 'border-gray-200 bg-gray-50';
            }
          };

          const getInsightIcon = () => {
            switch (insight.type) {
              case 'hub': return <Star className="h-5 w-5 text-blue-600" />;
              case 'bridge': return <Activity className="h-5 w-5 text-purple-600" />;
              case 'isolated': return <Users className="h-5 w-5 text-yellow-600" />;
              case 'cluster': return <Target className="h-5 w-5 text-green-600" />;
              default: return <Info className="h-5 w-5 text-gray-600" />;
            }
          };

          return (
            <div key={index} className={`border rounded-lg p-4 ${getInsightColor()}`}>
              <div className="flex items-start space-x-3">
                {getInsightIcon()}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{insight.nodeName}</div>
                  <div className="text-sm text-gray-600 mt-1">{insight.description}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Score: {insight.score} • Type: {insight.type}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTrendChart = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Growth Trends</h3>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-iol-red focus:border-iol-red"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={exportAnalytics}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Export Analytics"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Trend Chart Placeholder */}
      <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Trend Chart</p>
          <p className="text-sm text-gray-400">Interactive chart showing growth over time</p>
        </div>
      </div>

      {/* Trend Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-lg font-semibold text-blue-900">Nodes</div>
          <div className="text-sm text-blue-700">
            {trendData.length > 0 && (
              <>
                {trendData[trendData.length - 1].nodes - trendData[0].nodes > 0 ? '+' : ''}
                {trendData[trendData.length - 1].nodes - trendData[0].nodes} this period
              </>
            )}
          </div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-lg font-semibold text-green-900">Entities</div>
          <div className="text-sm text-green-700">
            {trendData.length > 0 && (
              <>
                {trendData[trendData.length - 1].entities - trendData[0].entities > 0 ? '+' : ''}
                {trendData[trendData.length - 1].entities - trendData[0].entities} this period
              </>
            )}
          </div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-lg font-semibold text-purple-900">Connections</div>
          <div className="text-sm text-purple-700">
            {trendData.length > 0 && (
              <>
                {trendData[trendData.length - 1].connections - trendData[0].connections > 0 ? '+' : ''}
                {trendData[trendData.length - 1].connections - trendData[0].connections} this period
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-iol-red border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Network Analytics</h2>
        <p className="text-gray-600">Insights and metrics for your travel technology ecosystem</p>
      </div>

      {renderMetricsCards()}
      {renderCategoryAnalytics()}
      {renderDirectionAnalytics()}
      {renderConnectivityInsights()}
      {renderTrendChart()}
    </div>
  );
};

export default AnalyticsDashboard; 