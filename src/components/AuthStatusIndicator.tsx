import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const AuthStatusIndicator: React.FC = () => {
  const { authError } = useAuth();
  const isOnline = navigator.onLine;

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!authError && isOnline) {
    return null; // Don't show anything when everything is fine
  }

  const showRefreshButton = authError?.includes('attempt 3/3') || authError?.includes('expired');

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium
        ${authError?.includes('expired') 
          ? 'bg-red-100 text-red-800 border border-red-200' 
          : authError?.includes('Offline')
          ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
          : 'bg-blue-100 text-blue-800 border border-blue-200'
        }
      `}>
        {!isOnline ? (
          <WifiOff className="w-4 h-4" />
        ) : authError?.includes('expired') ? (
          <AlertTriangle className="w-4 h-4" />
        ) : (
          <Wifi className="w-4 h-4" />
        )}
        
        <span>
          {!isOnline 
            ? 'Offline - session preserved' 
            : authError || 'Connection restored'
          }
        </span>

        {showRefreshButton && (
          <button
            onClick={handleRefresh}
            className="ml-2 p-1 hover:bg-white hover:bg-opacity-30 rounded transition-colors"
            title="Refresh to restore connection"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};