import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Package,
  Users, 
  Target, 
  CheckSquare,
  LogOut,
  ChevronDown,
  Calendar,
  TrendingUp,
  ClipboardList,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getDocument } from '../lib/firestore';
import { Timestamp } from 'firebase/firestore';
import type { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: Building2 },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Opportunities', href: '/opportunities', icon: Target },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<User | null>(null);

  useEffect(() => {
    // Skip Firestore user profile fetching for now to isolate the issue
    // const fetchUserProfile = async () => {
    //   if (currentUser) {
    //     try {
    //       const profile = await getDocument('users', currentUser.uid);
    //       setUserProfile(profile as User);
    //     } catch (error) {
    //       console.error('Error fetching user profile:', error);
    //     }
    //   }
    // };

    // fetchUserProfile();
    
    // Use basic user data without Firestore
    if (currentUser) {
      setUserProfile({
        id: currentUser.uid,
        email: currentUser.email!,
        displayName: currentUser.displayName,
        role: 'user',
        permissions: [],
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now()
      });
    }
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const formatRole = (role?: string) => {
    if (!role) return 'User';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="flex-shrink-0 w-64 bg-black text-white border-r border-gray-800">
        <div className="flex flex-col h-full text-white">
          {/* Logo/Header */}
          <div className="flex items-center gap-3 p-6 border-b border-gray-800">
            <div className="w-10 h-10 flex items-center justify-center">
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/iol-partner-solutions.firebasestorage.app/o/Logo%2Fiol-white-TABLET-154511D6.png?alt=media&token=1220692d-480d-468d-beb5-f19f98e5b8cc"
                alt="iOL Logo"
                className="h-8 w-auto"
              />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-white">Partner Solutions</h1>
            </div>
          </div>

          {/* User Info */}
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-iol-red rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {currentUser?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium truncate max-w-32 text-white" title={currentUser?.email || ''}>
                    {currentUser?.email}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatRole(userProfile?.role)}
                  </p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6">
            <div className="px-3 space-y-1">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `sidebar-item ${
                      isActive ? 'sidebar-item-active-iol' : 'sidebar-item-inactive-iol'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </NavLink>
              ))}
            </div>

            {/* Secondary Navigation */}
            <div className="mt-8 px-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Insights
              </h3>
              <div className="space-y-1">
                <NavLink
                  to="/weekly-report"
                  className={({ isActive }) =>
                    `sidebar-item ${
                      isActive ? 'sidebar-item-active-iol' : 'sidebar-item-inactive-iol'
                    }`
                  }
                >
                  <ClipboardList className="h-5 w-5 mr-3" />
                  Weekly Report
                </NavLink>
                <NavLink
                  to="/opportunity-insights"
                  className={({ isActive }) =>
                    `sidebar-item ${
                      isActive ? 'sidebar-item-active-iol' : 'sidebar-item-inactive-iol'
                    }`
                  }
                >
                  <BarChart3 className="h-5 w-5 mr-3" />
                  Opportunity Rundown
                </NavLink>
                <a href="#" className="sidebar-item sidebar-item-inactive-iol">
                  <TrendingUp className="h-5 w-5 mr-3" />
                  Roadmap
                </a>
                <a href="#" className="sidebar-item sidebar-item-inactive-iol">
                  <Target className="h-5 w-5 mr-3" />
                  Goals
                </a>
                <a href="#" className="sidebar-item sidebar-item-inactive-iol">
                  <CheckSquare className="h-5 w-5 mr-3" />
                  Approvals
                </a>
              </div>
            </div>
          </nav>

          {/* Logout */}
          <div className="p-6 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full sidebar-item sidebar-item-inactive-iol justify-center"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {children}
      </div>
    </div>
  );
}; 