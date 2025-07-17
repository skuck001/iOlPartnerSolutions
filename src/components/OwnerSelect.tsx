import React, { useState, useEffect } from 'react';
import { ChevronDown, User, Search } from 'lucide-react';
import { useUsersApi } from '../hooks/useUsersApi';
import type { User as UserType } from '../types';

interface OwnerSelectProps {
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}

export const OwnerSelect: React.FC<OwnerSelectProps> = ({
  value,
  onChange,
  placeholder = "Select owner...",
  disabled = false,
  className = "",
  label,
  required = false
}) => {
  const { getAllUsers, getUserDisplayName, getUserInitials } = useUsersApi();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log('OwnerSelect: Starting to fetch users...');
        const allUsers = await getAllUsers();
        console.log('OwnerSelect: Received users:', allUsers.length, allUsers);
        setUsers(allUsers);
        
        // Find and set the selected user
        const currentUser = allUsers.find(user => user.id === value);
        console.log('OwnerSelect: Current value:', value, 'Found user:', currentUser);
        setSelectedUser(currentUser || null);
      } catch (error) {
        console.error('OwnerSelect: Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [value, getAllUsers]);

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    
    const displayName = getUserDisplayName(user).toLowerCase();
    const email = user.email?.toLowerCase() || '';
    const searchLower = searchTerm.toLowerCase();
    
    return displayName.includes(searchLower) || email.includes(searchLower);
  });

  const handleUserSelect = (user: UserType) => {
    setSelectedUser(user);
    onChange(user.id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const UserOption: React.FC<{ user: UserType; isSelected?: boolean }> = ({ user, isSelected = false }) => (
    <div
      onClick={() => handleUserSelect(user)}
      className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 ${
        isSelected ? 'bg-iol-red bg-opacity-10 text-iol-red' : 'text-gray-900'
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white mr-3 ${
        isSelected ? 'bg-iol-red' : 'bg-gray-400'
      }`}>
        {getUserInitials(user)}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{getUserDisplayName(user)}</div>
        <div className="text-xs text-gray-500">{user.email}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
            <span className="text-gray-500">Loading users...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-iol-red focus:border-transparent ${
            disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white hover:border-gray-400'
          }`}
        >
          <div className="flex items-center justify-between">
            {selectedUser ? (
              <div className="flex items-center">
                <div className="w-6 h-6 bg-iol-red rounded-full flex items-center justify-center text-xs font-medium text-white mr-2">
                  {getUserInitials(selectedUser)}
                </div>
                <span className="text-gray-900">{getUserDisplayName(selectedUser)}</span>
              </div>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
            {/* Search input */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-iol-red focus:border-transparent"
                />
              </div>
            </div>

            {/* User list */}
            <div className="max-h-48 overflow-y-auto">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <UserOption 
                    key={user.id} 
                    user={user} 
                    isSelected={user.id === value}
                  />
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No users found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}; 