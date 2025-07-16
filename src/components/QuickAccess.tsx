import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Target, 
  Package,
  Clock,
  RefreshCw
} from 'lucide-react';
import { getRecentlyUpdatedItems, type RecentlyUpdatedItem } from '../lib/firestore';
import { formatDistanceToNow } from 'date-fns';

export const QuickAccess: React.FC = () => {
  const [recentItems, setRecentItems] = useState<RecentlyUpdatedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentItems();
  }, []);

  const fetchRecentItems = async () => {
    setLoading(true);
    try {
      const items = await getRecentlyUpdatedItems(5);
      setRecentItems(items);
    } catch (error) {
      console.error('Error fetching recent items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: RecentlyUpdatedItem['type']) => {
    switch (type) {
      case 'account':
        return Building2;
      case 'contact':
        return Users;
      case 'opportunity':
        return Target;
      case 'product':
        return Package;
      default:
        return Clock;
    }
  };

  const getTypeLabel = (type: RecentlyUpdatedItem['type']) => {
    switch (type) {
      case 'account':
        return 'Account';
      case 'contact':
        return 'Contact';
      case 'opportunity':
        return 'Opportunity';
      case 'product':
        return 'Product';
      default:
        return 'Item';
    }
  };

  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center px-3 py-2 bg-transparent">
            <div className="w-5 h-5 bg-gray-600 rounded animate-pulse mr-3"></div>
            <div className="flex-1">
              <div className="w-24 h-3 bg-gray-600 rounded animate-pulse mb-1"></div>
              <div className="w-16 h-2 bg-gray-600 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recentItems.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-gray-400 text-center bg-transparent">
        No recent updates
      </div>
    );
  }

  return (
    <div className="space-y-1" style={{ backgroundColor: 'transparent' }}>
      {recentItems.map((item) => {
        const Icon = getIcon(item.type);
        
        return (
          <NavLink
            key={`${item.type}-${item.id}`}
            to={item.href}
            className={({ isActive }) =>
              `sidebar-item ${
                isActive ? 'sidebar-item-active-iol' : 'sidebar-item-inactive-iol'
              } group`
            }
            title={`${getTypeLabel(item.type)}: ${item.title}`}
          >
            <div className="flex-shrink-0 w-4 h-4 mr-3 flex items-center justify-center">
              <Icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">
                {item.title}
              </div>
              <div className="text-xs text-gray-400 flex items-center justify-between">
                <span className="truncate">
                  {item.subtitle && `${item.subtitle} • `}
                  {getTypeLabel(item.type)}
                </span>
                <span className="text-xs text-gray-500 ml-1 flex-shrink-0">
                  {formatDistanceToNow(item.updatedAt.toDate(), { addSuffix: true })}
                </span>
              </div>
            </div>
          </NavLink>
        );
      })}
      
      {/* Refresh button */}
      <button
        onClick={fetchRecentItems}
        className="w-full flex items-center justify-center px-3 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors bg-transparent hover:bg-gray-800"
        title="Refresh quick access"
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Refresh
      </button>
    </div>
  );
}; 