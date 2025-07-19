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
  TrendingUp,
  ClipboardList,
  Settings,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from '../types';
import { QuickAccess } from './QuickAccess';

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
  { name: 'Assignments', href: '/assignments', icon: FileCheck },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as User);
          } else {
            // Fallback to basic user data if document doesn't exist
            setUserProfile({
              id: currentUser.uid,
              email: currentUser.email!,
              displayName: currentUser.displayName || undefined,
              role: 'user',
              permissions: [],
              createdAt: Timestamp.now(),
              lastLoginAt: Timestamp.now()
            });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          // Fallback to basic user data on error
          setUserProfile({
            id: currentUser.uid,
            email: currentUser.email!,
            displayName: currentUser.displayName || undefined,
            role: 'user',
            permissions: [],
            createdAt: Timestamp.now(),
            lastLoginAt: Timestamp.now()
          });
        }
      }
    };

    fetchUserProfile();
  }, [currentUser]);

  // Handle case where user becomes unauthenticated while on a protected page
  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleLogout = async () => {
    try {
      setShowUserMenu(false);
      await logout();
      // The logout will trigger onAuthStateChanged which will set currentUser to null
      // and the ProtectedRoute will automatically redirect to /login
      // No need to manually navigate here as the auth state change will handle it
    } catch (error) {
      console.error('Failed to log out:', error);
      // Even if logout fails, try to redirect to login
      navigate('/login');
    }
  };

  const formatRole = (role?: string) => {
    if (!role) return 'User';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="flex-shrink-0 w-64 bg-black text-white border-r border-gray-800 h-screen sticky top-0">
        <div className="flex flex-col h-full text-white bg-black">
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
          <div className="px-6 py-4 border-b border-gray-800 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-iol-red rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {currentUser?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium truncate max-w-32 text-white" title={currentUser?.email || ''}>
                    {userProfile?.firstName && userProfile?.lastName 
                      ? `${userProfile.firstName} ${userProfile.lastName}`
                      : userProfile?.displayName || currentUser?.email}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatRole(userProfile?.role)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-1 rounded hover:bg-gray-800 transition-colors"
              >
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute left-3 right-3 top-full mt-2 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50">
                <div className="py-1">
                  <NavLink
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <Settings className="h-4 w-4 mr-3" />
                    Profile Settings
                  </NavLink>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 bg-transparent overflow-y-auto scrollbar-hide">
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


              </div>
            </div>

            {/* Quick Access Section */}
            <div className="mt-8 px-3 bg-transparent">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Quick Access
              </h3>
              <QuickAccess />
            </div>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 bg-gray-50">
        {children}
      </div>
    </div>
  );
}; 