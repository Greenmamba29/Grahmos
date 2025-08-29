/**
 * Grahmos Admin Dashboard - User Management & System Configuration
 * Phase 11: Enterprise Security & User Management
 * 
 * Features:
 * - User management interface
 * - Role and permission management
 * - SSO provider configuration
 * - System security monitoring
 * - Audit log viewing
 * - Security policy configuration
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  Settings, 
  Activity, 
  Lock, 
  Eye, 
  Edit, 
  Trash2, 
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

// Types
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username: string;
  roles: string[];
  isActive: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  loginAttempts: number;
  metadata?: {
    ssoProvider?: string;
    lastSSOLogin?: Date;
    [key: string]: any;
  };
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  parentRoles: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  success: boolean;
}

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc';
  enabled: boolean;
  configuration: any;
  userMapping: any;
  createdAt: Date;
  updatedAt: Date;
}

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  totalSSOProviders: number;
  failedLogins24h: number;
  successfulLogins24h: number;
  mfaEnabledUsers: number;
  ssoUsers: number;
}

// Main Admin Dashboard Component
export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'roles' | 'sso' | 'audit' | 'security'>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Grahmos Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                System Health
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">All Systems Operational</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <TabButton
              icon={Activity}
              label="Overview"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            />
            <TabButton
              icon={Users}
              label="Users"
              active={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
            />
            <TabButton
              icon={Shield}
              label="Roles"
              active={activeTab === 'roles'}
              onClick={() => setActiveTab('roles')}
            />
            <TabButton
              icon={Lock}
              label="SSO"
              active={activeTab === 'sso'}
              onClick={() => setActiveTab('sso')}
            />
            <TabButton
              icon={Eye}
              label="Audit Logs"
              active={activeTab === 'audit'}
              onClick={() => setActiveTab('audit')}
            />
            <TabButton
              icon={Settings}
              label="Security"
              active={activeTab === 'security'}
              onClick={() => setActiveTab('security')}
            />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'sso' && <SSOTab />}
        {activeTab === 'audit' && <AuditLogsTab />}
        {activeTab === 'security' && <SecurityTab />}
      </main>
    </div>
  );
};

// Tab Button Component
interface TabButtonProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
      active
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

// Overview Tab
const OverviewTab: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data - would be replaced with actual API calls
    setTimeout(() => {
      setStats({
        totalUsers: 1247,
        activeUsers: 1156,
        totalRoles: 12,
        totalSSOProviders: 3,
        failedLogins24h: 23,
        successfulLogins24h: 4567,
        mfaEnabledUsers: 892,
        ssoUsers: 634
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading || !stats) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            change="+12 this month"
            changeType="positive"
            icon={Users}
          />
          <StatCard
            title="Active Users"
            value={stats.activeUsers.toLocaleString()}
            change={`${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}% active`}
            changeType="neutral"
            icon={Activity}
          />
          <StatCard
            title="MFA Enabled"
            value={stats.mfaEnabledUsers.toLocaleString()}
            change={`${((stats.mfaEnabledUsers / stats.totalUsers) * 100).toFixed(1)}% coverage`}
            changeType="positive"
            icon={Shield}
          />
          <StatCard
            title="SSO Users"
            value={stats.ssoUsers.toLocaleString()}
            change={`${((stats.ssoUsers / stats.totalUsers) * 100).toFixed(1)}% of users`}
            changeType="neutral"
            icon={Lock}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Security Metrics (Last 24h)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Successful Logins"
            value={stats.successfulLogins24h.toLocaleString()}
            change="Normal activity"
            changeType="positive"
            icon={CheckCircle}
          />
          <StatCard
            title="Failed Logins"
            value={stats.failedLogins24h.toLocaleString()}
            change="Within normal range"
            changeType={stats.failedLogins24h > 100 ? 'negative' : 'neutral'}
            icon={XCircle}
          />
          <StatCard
            title="SSO Providers"
            value={stats.totalSSOProviders.toString()}
            change="All operational"
            changeType="positive"
            icon={Settings}
          />
          <StatCard
            title="System Roles"
            value={stats.totalRoles.toString()}
            change="No changes"
            changeType="neutral"
            icon={Shield}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Security Events</h3>
        <div className="space-y-3">
          <SecurityEvent
            type="info"
            message="User john.doe@company.com enabled MFA"
            timestamp={new Date(Date.now() - 1000 * 60 * 15)}
          />
          <SecurityEvent
            type="warning"
            message="Multiple failed login attempts detected for user@example.com"
            timestamp={new Date(Date.now() - 1000 * 60 * 45)}
          />
          <SecurityEvent
            type="success"
            message="SSO provider 'Azure AD' configuration updated successfully"
            timestamp={new Date(Date.now() - 1000 * 60 * 120)}
          />
        </div>
      </div>
    </div>
  );
};

// Users Tab
const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // Mock data - would be replaced with actual API calls
    setTimeout(() => {
      setUsers([
        {
          id: '1',
          email: 'admin@grahmos.com',
          firstName: 'Admin',
          lastName: 'User',
          username: 'admin',
          roles: ['admin', 'user'],
          isActive: true,
          emailVerified: true,
          mfaEnabled: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
          lastLogin: new Date('2024-01-15'),
          loginAttempts: 0
        },
        {
          id: '2',
          email: 'john.doe@company.com',
          firstName: 'John',
          lastName: 'Doe',
          username: 'john.doe',
          roles: ['user'],
          isActive: true,
          emailVerified: true,
          mfaEnabled: false,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-14'),
          lastLogin: new Date('2024-01-14'),
          loginAttempts: 0,
          metadata: {
            ssoProvider: 'azure-ad',
            lastSSOLogin: new Date('2024-01-14')
          }
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !selectedRole || user.roles.includes(selectedRole);
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">User Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create User</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MFA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateUserModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};

// User Row Component
const UserRow: React.FC<{ user: User }> = ({ user }) => (
  <tr>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="flex items-center">
        <div className="flex-shrink-0 h-10 w-10">
          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </span>
          </div>
        </div>
        <div className="ml-4">
          <div className="text-sm font-medium text-gray-900">{user.email}</div>
          <div className="text-sm text-gray-500">
            {user.firstName} {user.lastName}
            {user.metadata?.ssoProvider && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                SSO
              </span>
            )}
          </div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="flex flex-wrap gap-1">
        {user.roles.map((role) => (
          <span
            key={role}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
          >
            {role}
          </span>
        ))}
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        user.isActive 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {user.isActive ? 'Active' : 'Inactive'}
      </span>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        user.mfaEnabled 
          ? 'bg-green-100 text-green-800' 
          : 'bg-yellow-100 text-yellow-800'
      }`}>
        {user.mfaEnabled ? 'Enabled' : 'Disabled'}
      </span>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
      {user.lastLogin ? user.lastLogin.toLocaleDateString() : 'Never'}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
      <div className="flex items-center space-x-2">
        <button className="text-blue-600 hover:text-blue-900">
          <Eye className="w-4 h-4" />
        </button>
        <button className="text-gray-600 hover:text-gray-900">
          <Edit className="w-4 h-4" />
        </button>
        <button className="text-red-600 hover:text-red-900">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </td>
  </tr>
);

// Roles Tab (simplified)
const RolesTab: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">Role Management</h2>
    <p className="text-gray-600">Role management interface would be implemented here.</p>
  </div>
);

// SSO Tab (simplified)
const SSOTab: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">SSO Provider Configuration</h2>
    <p className="text-gray-600">SSO provider configuration interface would be implemented here.</p>
  </div>
);

// Audit Logs Tab (simplified)
const AuditLogsTab: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">Audit Logs</h2>
    <p className="text-gray-600">Audit log viewing interface would be implemented here.</p>
  </div>
);

// Security Tab (simplified)
const SecurityTab: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">Security Configuration</h2>
    <p className="text-gray-600">Security policy configuration interface would be implemented here.</p>
  </div>
);

// Utility Components
interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ElementType;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, changeType, icon: Icon }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <div className="ml-5 w-0 flex-1">
        <dl>
          <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
          <dd>
            <div className="text-lg font-medium text-gray-900">{value}</div>
            <div className={`text-sm ${
              changeType === 'positive' ? 'text-green-600' :
              changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {change}
            </div>
          </dd>
        </dl>
      </div>
    </div>
  </div>
);

interface SecurityEventProps {
  type: 'info' | 'warning' | 'success';
  message: string;
  timestamp: Date;
}

const SecurityEvent: React.FC<SecurityEventProps> = ({ type, message, timestamp }) => (
  <div className="flex items-start space-x-3">
    <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
      type === 'success' ? 'bg-green-400' :
      type === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
    }`} />
    <div className="min-w-0 flex-1">
      <p className="text-sm text-gray-900">{message}</p>
      <p className="text-sm text-gray-500">{timestamp.toLocaleString()}</p>
    </div>
  </div>
);

// Create User Modal (simplified)
const CreateUserModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <div className="mt-3">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
        <p className="text-gray-600 mb-4">User creation form would be implemented here.</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Create User
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default AdminDashboard;
