import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Users, Target, Calendar, MapPin } from 'lucide-react';
import type { Opportunity } from '../types';
import { getDocuments } from '../lib/firestore';
import { format } from 'date-fns';

interface MetricCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: React.ComponentType<{ className?: string }>;
}

export const Dashboard: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const opps = await getDocuments('opportunities');
        setOpportunities(opps as Opportunity[]);
      } catch (error) {
        console.error('Error fetching opportunities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate metrics
  const totalDealValue = opportunities.reduce((sum, opp) => sum + (opp.estimatedDealValue || 0), 0);
  const activeOpportunities = opportunities.filter(opp => 
    !['Closed-Won', 'Closed-Lost'].includes(opp.stage)
  );
  
  const metrics: MetricCard[] = [
    {
      title: 'Total Deal Value',
      value: `$${totalDealValue.toLocaleString()}`,
      change: '↑ 23%',
      changeType: 'positive',
      icon: DollarSign
    },
    {
      title: 'Active Opportunities',
      value: activeOpportunities.length.toString(),
      change: '↑ 15%',
      changeType: 'positive',
      icon: Target
    },
    {
      title: 'Partners Engaged',
      value: '12',
      change: '↑ 8%',
      changeType: 'positive',
      icon: Users
    },
    {
      title: 'Meetings This Week',
      value: '8',
      change: '↓ 5%',
      changeType: 'negative',
      icon: Calendar
    }
  ];

  const topOpportunities = opportunities
    .sort((a, b) => (b.estimatedDealValue || 0) - (a.estimatedDealValue || 0))
    .slice(0, 6);

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Discovery': return 'bg-blue-100 text-blue-800';
      case 'Proposal': return 'bg-yellow-100 text-yellow-800';
      case 'Negotiation': return 'bg-orange-100 text-orange-800';
      case 'Closed-Won': return 'bg-green-100 text-green-800';
      case 'Closed-Lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your partnerships.</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric) => (
            <div key={metric.title} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                  <p className={`text-sm mt-1 ${
                    metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change}
                  </p>
                </div>
                <div className="p-3 bg-iol-red/10 rounded-lg">
                  <metric.icon className="h-6 w-6 text-iol-red" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Top Opportunities */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Top Enterprise Themes and Opportunities</h2>
            <span className="text-iol-red font-medium">Deal Value</span>
          </div>

          <div className="space-y-4">
            {topOpportunities.map((opportunity) => (
              <div key={opportunity.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">{opportunity.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(opportunity.stage)}`}>
                        {opportunity.stage}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{opportunity.summary}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {opportunity.region || 'No region'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {opportunity.createdAt ? format(opportunity.createdAt.toDate(), 'MMM d, yyyy') : 'No date'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <p className="text-xl font-bold text-gray-900">
                      ${(opportunity.estimatedDealValue || 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-green-600">↑ Deal value</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {topOpportunities.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No opportunities found. Add some opportunities to see them here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 