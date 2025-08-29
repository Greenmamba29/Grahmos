/**
 * Grahmos Role-Based Access Control (RBAC) System
 * Phase 11: Enterprise Security & User Management
 * 
 * Features:
 * - Hierarchical roles with inheritance
 * - Fine-grained permissions
 * - Resource-level access control
 * - Dynamic permission evaluation
 * - Attribute-based access control (ABAC) support
 */

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  conditions?: PermissionCondition[];
  metadata?: Record<string, any>;
}

export interface PermissionCondition {
  type: 'attribute' | 'time' | 'location' | 'custom';
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  parentRoles?: string[];
  permissions: string[];
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  parentResource?: string;
  attributes?: Record<string, any>;
  ownerId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  context?: AccessContext;
}

export interface AccessContext {
  userAttributes?: Record<string, any>;
  resourceAttributes?: Record<string, any>;
  environment?: {
    timestamp?: Date;
    ipAddress?: string;
    userAgent?: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
    [key: string]: any;
  };
  sessionAttributes?: Record<string, any>;
}

export interface AccessResult {
  granted: boolean;
  reason: string;
  appliedPermissions: Permission[];
  denyReasons?: string[];
  warnings?: string[];
}

export class RBACService {
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();
  private resources: Map<string, Resource> = new Map();
  private userRoles: Map<string, string[]> = new Map();
  
  constructor() {
    this.initializeSystemRoles();
    this.initializeSystemPermissions();
  }

  // Initialize system roles and permissions
  private initializeSystemRoles() {
    const systemRoles: Role[] = [
      {
        id: 'super_admin',
        name: 'Super Administrator',
        description: 'Full system access with all permissions',
        permissions: ['*'],
        isSystemRole: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Administrative access to most system functions',
        parentRoles: [],
        permissions: [
          'users.create', 'users.read', 'users.update', 'users.delete',
          'roles.create', 'roles.read', 'roles.update', 'roles.delete',
          'system.read', 'system.configure',
          'audit.read',
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'moderator',
        name: 'Moderator',
        description: 'Content moderation and user management',
        permissions: [
          'users.read', 'users.update',
          'content.read', 'content.update', 'content.delete',
          'reports.read', 'reports.update',
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'user',
        name: 'User',
        description: 'Standard user with basic access rights',
        permissions: [
          'profile.read', 'profile.update',
          'search.use',
          'assistant.use',
          'mapping.view',
          'content.read',
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'guest',
        name: 'Guest',
        description: 'Limited access for unauthenticated users',
        permissions: [
          'content.read',
          'search.use',
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'api_user',
        name: 'API User',
        description: 'Programmatic access via API',
        permissions: [
          'api.search.use',
          'api.assistant.use',
          'api.data.read',
        ],
        isSystemRole: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    systemRoles.forEach(role => {
      this.roles.set(role.id, role);
    });
  }

  private initializeSystemPermissions() {
    const systemPermissions: Permission[] = [
      // User Management
      {
        id: 'users.create',
        name: 'Create Users',
        description: 'Create new user accounts',
        resource: 'users',
        action: 'create',
        effect: 'allow',
      },
      {
        id: 'users.read',
        name: 'Read Users',
        description: 'View user information',
        resource: 'users',
        action: 'read',
        effect: 'allow',
      },
      {
        id: 'users.update',
        name: 'Update Users',
        description: 'Modify user information',
        resource: 'users',
        action: 'update',
        effect: 'allow',
      },
      {
        id: 'users.delete',
        name: 'Delete Users',
        description: 'Delete user accounts',
        resource: 'users',
        action: 'delete',
        effect: 'allow',
      },
      
      // Profile Management
      {
        id: 'profile.read',
        name: 'Read Own Profile',
        description: 'View own profile information',
        resource: 'profile',
        action: 'read',
        effect: 'allow',
        conditions: [{
          type: 'attribute',
          field: 'userId',
          operator: 'eq',
          value: '${user.id}',
          description: 'User can only read their own profile'
        }],
      },
      {
        id: 'profile.update',
        name: 'Update Own Profile',
        description: 'Modify own profile information',
        resource: 'profile',
        action: 'update',
        effect: 'allow',
        conditions: [{
          type: 'attribute',
          field: 'userId',
          operator: 'eq',
          value: '${user.id}',
          description: 'User can only update their own profile'
        }],
      },

      // Role Management
      {
        id: 'roles.create',
        name: 'Create Roles',
        description: 'Create new roles',
        resource: 'roles',
        action: 'create',
        effect: 'allow',
      },
      {
        id: 'roles.read',
        name: 'Read Roles',
        description: 'View role information',
        resource: 'roles',
        action: 'read',
        effect: 'allow',
      },
      {
        id: 'roles.update',
        name: 'Update Roles',
        description: 'Modify role information',
        resource: 'roles',
        action: 'update',
        effect: 'allow',
      },
      {
        id: 'roles.delete',
        name: 'Delete Roles',
        description: 'Delete roles',
        resource: 'roles',
        action: 'delete',
        effect: 'allow',
        conditions: [{
          type: 'attribute',
          field: 'isSystemRole',
          operator: 'ne',
          value: true,
          description: 'Cannot delete system roles'
        }],
      },

      // System Management
      {
        id: 'system.read',
        name: 'Read System Info',
        description: 'View system information and metrics',
        resource: 'system',
        action: 'read',
        effect: 'allow',
      },
      {
        id: 'system.configure',
        name: 'Configure System',
        description: 'Modify system configuration',
        resource: 'system',
        action: 'configure',
        effect: 'allow',
      },

      // Content Management
      {
        id: 'content.read',
        name: 'Read Content',
        description: 'View content',
        resource: 'content',
        action: 'read',
        effect: 'allow',
      },
      {
        id: 'content.create',
        name: 'Create Content',
        description: 'Create new content',
        resource: 'content',
        action: 'create',
        effect: 'allow',
      },
      {
        id: 'content.update',
        name: 'Update Content',
        description: 'Modify content',
        resource: 'content',
        action: 'update',
        effect: 'allow',
      },
      {
        id: 'content.delete',
        name: 'Delete Content',
        description: 'Delete content',
        resource: 'content',
        action: 'delete',
        effect: 'allow',
      },

      // Search & Assistant
      {
        id: 'search.use',
        name: 'Use Search',
        description: 'Use search functionality',
        resource: 'search',
        action: 'use',
        effect: 'allow',
      },
      {
        id: 'assistant.use',
        name: 'Use AI Assistant',
        description: 'Use AI assistant functionality',
        resource: 'assistant',
        action: 'use',
        effect: 'allow',
      },
      {
        id: 'mapping.view',
        name: 'View Maps',
        description: 'View mapping and location data',
        resource: 'mapping',
        action: 'view',
        effect: 'allow',
      },

      // API Access
      {
        id: 'api.search.use',
        name: 'API Search Access',
        description: 'Use search API endpoints',
        resource: 'api.search',
        action: 'use',
        effect: 'allow',
      },
      {
        id: 'api.assistant.use',
        name: 'API Assistant Access',
        description: 'Use assistant API endpoints',
        resource: 'api.assistant',
        action: 'use',
        effect: 'allow',
      },
      {
        id: 'api.data.read',
        name: 'API Data Read',
        description: 'Read data via API',
        resource: 'api.data',
        action: 'read',
        effect: 'allow',
      },

      // Audit & Reporting
      {
        id: 'audit.read',
        name: 'Read Audit Logs',
        description: 'View audit logs and security events',
        resource: 'audit',
        action: 'read',
        effect: 'allow',
      },
      {
        id: 'reports.read',
        name: 'Read Reports',
        description: 'View reports and analytics',
        resource: 'reports',
        action: 'read',
        effect: 'allow',
      },
      {
        id: 'reports.update',
        name: 'Update Reports',
        description: 'Modify reports and analytics',
        resource: 'reports',
        action: 'update',
        effect: 'allow',
      },
    ];

    systemPermissions.forEach(permission => {
      this.permissions.set(permission.id, permission);
    });
  }

  // Permission management
  createPermission(permission: Omit<Permission, 'id'>): Permission {
    const id = `${permission.resource}.${permission.action}`;
    const newPermission: Permission = {
      ...permission,
      id,
    };
    
    this.permissions.set(id, newPermission);
    return newPermission;
  }

  getPermission(id: string): Permission | null {
    return this.permissions.get(id) || null;
  }

  listPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  updatePermission(id: string, updates: Partial<Permission>): Permission | null {
    const permission = this.permissions.get(id);
    if (!permission) return null;

    const updated = { ...permission, ...updates, id };
    this.permissions.set(id, updated);
    return updated;
  }

  deletePermission(id: string): boolean {
    return this.permissions.delete(id);
  }

  // Role management
  createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Role {
    const id = role.name.toLowerCase().replace(/\s+/g, '_');
    const newRole: Role = {
      ...role,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.roles.set(id, newRole);
    return newRole;
  }

  getRole(id: string): Role | null {
    return this.roles.get(id) || null;
  }

  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  updateRole(id: string, updates: Partial<Role>): Role | null {
    const role = this.roles.get(id);
    if (!role) return null;

    const updated = { ...role, ...updates, id, updatedAt: new Date() };
    this.roles.set(id, updated);
    return updated;
  }

  deleteRole(id: string): boolean {
    const role = this.roles.get(id);
    if (!role || role.isSystemRole) {
      return false; // Cannot delete system roles
    }
    
    return this.roles.delete(id);
  }

  // Get all permissions for a role (including inherited permissions)
  getRolePermissions(roleId: string, visited: Set<string> = new Set()): Permission[] {
    if (visited.has(roleId)) {
      return []; // Prevent circular inheritance
    }
    
    const role = this.roles.get(roleId);
    if (!role) return [];
    
    visited.add(roleId);
    
    let permissions: Permission[] = [];
    
    // Add direct permissions
    for (const permissionId of role.permissions) {
      if (permissionId === '*') {
        // Super admin permission - return all permissions
        return Array.from(this.permissions.values());
      }
      
      const permission = this.permissions.get(permissionId);
      if (permission) {
        permissions.push(permission);
      }
    }
    
    // Add inherited permissions from parent roles
    if (role.parentRoles) {
      for (const parentRoleId of role.parentRoles) {
        const parentPermissions = this.getRolePermissions(parentRoleId, visited);
        permissions = permissions.concat(parentPermissions);
      }
    }
    
    // Remove duplicates
    const uniquePermissions = new Map();
    permissions.forEach(permission => {
      uniquePermissions.set(permission.id, permission);
    });
    
    return Array.from(uniquePermissions.values());
  }

  // User role assignment
  assignUserRole(userId: string, roleId: string): boolean {
    const role = this.roles.get(roleId);
    if (!role) return false;
    
    const currentRoles = this.userRoles.get(userId) || [];
    if (!currentRoles.includes(roleId)) {
      currentRoles.push(roleId);
      this.userRoles.set(userId, currentRoles);
    }
    
    return true;
  }

  removeUserRole(userId: string, roleId: string): boolean {
    const currentRoles = this.userRoles.get(userId) || [];
    const filteredRoles = currentRoles.filter(id => id !== roleId);
    
    if (filteredRoles.length !== currentRoles.length) {
      this.userRoles.set(userId, filteredRoles);
      return true;
    }
    
    return false;
  }

  getUserRoles(userId: string): Role[] {
    const roleIds = this.userRoles.get(userId) || [];
    return roleIds
      .map(id => this.roles.get(id))
      .filter((role): role is Role => role !== undefined);
  }

  getUserPermissions(userId: string): Permission[] {
    const roles = this.getUserRoles(userId);
    const allPermissions: Permission[] = [];
    
    for (const role of roles) {
      const rolePermissions = this.getRolePermissions(role.id);
      allPermissions.push(...rolePermissions);
    }
    
    // Remove duplicates
    const uniquePermissions = new Map();
    allPermissions.forEach(permission => {
      uniquePermissions.set(permission.id, permission);
    });
    
    return Array.from(uniquePermissions.values());
  }

  // Resource management
  createResource(resource: Omit<Resource, 'id'>): Resource {
    const id = `${resource.type}:${resource.name}`;
    const newResource: Resource = {
      ...resource,
      id,
    };
    
    this.resources.set(id, newResource);
    return newResource;
  }

  getResource(id: string): Resource | null {
    return this.resources.get(id) || null;
  }

  // Access control evaluation
  private evaluateConditions(
    conditions: PermissionCondition[],
    context: AccessContext
  ): boolean {
    return conditions.every(condition => {
      return this.evaluateCondition(condition, context);
    });
  }

  private evaluateCondition(
    condition: PermissionCondition,
    context: AccessContext
  ): boolean {
    let fieldValue: any;
    
    // Extract field value from context
    if (condition.field.startsWith('user.')) {
      fieldValue = context.userAttributes?.[condition.field.substring(5)];
    } else if (condition.field.startsWith('resource.')) {
      fieldValue = context.resourceAttributes?.[condition.field.substring(9)];
    } else if (condition.field.startsWith('env.')) {
      fieldValue = context.environment?.[condition.field.substring(4)];
    } else {
      fieldValue = context.userAttributes?.[condition.field] || 
                   context.resourceAttributes?.[condition.field];
    }
    
    // Handle template variables like ${user.id}
    let expectedValue = condition.value;
    if (typeof expectedValue === 'string' && expectedValue.includes('${')) {
      expectedValue = this.resolveTemplate(expectedValue, context);
    }
    
    // Evaluate based on operator
    switch (condition.operator) {
      case 'eq':
        return fieldValue === expectedValue;
      case 'ne':
        return fieldValue !== expectedValue;
      case 'gt':
        return fieldValue > expectedValue;
      case 'gte':
        return fieldValue >= expectedValue;
      case 'lt':
        return fieldValue < expectedValue;
      case 'lte':
        return fieldValue <= expectedValue;
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'nin':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      case 'contains':
        return fieldValue && fieldValue.includes(expectedValue);
      case 'regex':
        return new RegExp(expectedValue).test(fieldValue);
      default:
        return false;
    }
  }

  private resolveTemplate(template: string, context: AccessContext): any {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const parts = path.split('.');
      let value: any = context;
      
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return match; // Return original if path doesn't exist
        }
      }
      
      return value;
    });
  }

  // Main access control method
  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    const { userId, resource, action, context = {} } = request;
    
    // Get user permissions
    const userPermissions = this.getUserPermissions(userId);
    
    // Find applicable permissions
    const applicablePermissions = userPermissions.filter(permission => {
      // Check if permission applies to this resource and action
      if (permission.resource !== resource && permission.resource !== '*') {
        return false;
      }
      
      if (permission.action !== action && permission.action !== '*') {
        return false;
      }
      
      return true;
    });
    
    if (applicablePermissions.length === 0) {
      return {
        granted: false,
        reason: 'No applicable permissions found',
        appliedPermissions: [],
        denyReasons: ['No permissions for this resource and action'],
      };
    }
    
    // Evaluate permissions
    const allowPermissions: Permission[] = [];
    const denyPermissions: Permission[] = [];
    const denyReasons: string[] = [];
    const warnings: string[] = [];
    
    for (const permission of applicablePermissions) {
      // Evaluate conditions if present
      if (permission.conditions && permission.conditions.length > 0) {
        const conditionsMatch = this.evaluateConditions(permission.conditions, context);
        
        if (!conditionsMatch) {
          warnings.push(`Permission ${permission.name} conditions not met`);
          continue;
        }
      }
      
      if (permission.effect === 'allow') {
        allowPermissions.push(permission);
      } else if (permission.effect === 'deny') {
        denyPermissions.push(permission);
        denyReasons.push(`Explicit deny: ${permission.name}`);
      }
    }
    
    // Deny takes precedence over allow
    if (denyPermissions.length > 0) {
      return {
        granted: false,
        reason: 'Explicit deny permission found',
        appliedPermissions: denyPermissions,
        denyReasons,
        warnings,
      };
    }
    
    // Check if we have any allow permissions
    if (allowPermissions.length > 0) {
      return {
        granted: true,
        reason: 'Allow permission granted',
        appliedPermissions: allowPermissions,
        warnings,
      };
    }
    
    return {
      granted: false,
      reason: 'No matching permissions after condition evaluation',
      appliedPermissions: [],
      denyReasons: ['No permissions matched conditions'],
      warnings,
    };
  }

  // Convenience methods for common access patterns
  async canRead(userId: string, resource: string, context?: AccessContext): Promise<boolean> {
    const result = await this.checkAccess({ userId, resource, action: 'read', context });
    return result.granted;
  }

  async canWrite(userId: string, resource: string, context?: AccessContext): Promise<boolean> {
    const result = await this.checkAccess({ userId, resource, action: 'update', context });
    return result.granted;
  }

  async canDelete(userId: string, resource: string, context?: AccessContext): Promise<boolean> {
    const result = await this.checkAccess({ userId, resource, action: 'delete', context });
    return result.granted;
  }

  async canCreate(userId: string, resource: string, context?: AccessContext): Promise<boolean> {
    const result = await this.checkAccess({ userId, resource, action: 'create', context });
    return result.granted;
  }

  // Bulk access check for efficiency
  async checkBulkAccess(requests: AccessRequest[]): Promise<AccessResult[]> {
    return Promise.all(requests.map(request => this.checkAccess(request)));
  }

  // Get effective permissions for a user (for UI display)
  async getEffectivePermissions(userId: string, context?: AccessContext): Promise<{
    permissions: Permission[];
    roles: Role[];
    resources: string[];
  }> {
    const roles = this.getUserRoles(userId);
    const permissions = this.getUserPermissions(userId);
    
    // Get all unique resources the user can access
    const resources = Array.from(new Set(permissions.map(p => p.resource)));
    
    return {
      permissions,
      roles,
      resources,
    };
  }
}

// Express.js middleware for RBAC
export function createRBACMiddleware(rbacService: RBACService) {
  return {
    // Check permission middleware
    requirePermission: (resource: string, action: string) => {
      return async (req: any, res: any, next: any) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const context: AccessContext = {
          userAttributes: {
            id: req.user.id,
            email: req.user.email,
            roles: req.user.roles,
          },
          environment: {
            timestamp: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          },
          sessionAttributes: req.session ? {
            sessionId: req.session.id,
            createdAt: req.session.createdAt,
          } : undefined,
        };

        const result = await rbacService.checkAccess({
          userId: req.user.id,
          resource,
          action,
          context,
        });

        if (!result.granted) {
          return res.status(403).json({ 
            error: 'Access denied',
            reason: result.reason,
            details: result.denyReasons,
          });
        }

        req.accessResult = result;
        next();
      };
    },

    // Check if user has specific role
    requireRole: (...roleIds: string[]) => {
      return (req: any, res: any, next: any) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const userRoles = rbacService.getUserRoles(req.user.id);
        const hasRole = roleIds.some(roleId =>
          userRoles.some(role => role.id === roleId)
        );

        if (!hasRole) {
          return res.status(403).json({
            error: 'Insufficient role permissions',
            requiredRoles: roleIds,
          });
        }

        next();
      };
    },
  };
}

export default RBACService;
