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
export declare class RBACService {
    private permissions;
    private roles;
    private resources;
    private userRoles;
    constructor();
    private initializeSystemRoles;
    private initializeSystemPermissions;
    createPermission(permission: Omit<Permission, 'id'>): Permission;
    getPermission(id: string): Permission | null;
    listPermissions(): Permission[];
    updatePermission(id: string, updates: Partial<Permission>): Permission | null;
    deletePermission(id: string): boolean;
    createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Role;
    getRole(id: string): Role | null;
    listRoles(): Role[];
    updateRole(id: string, updates: Partial<Role>): Role | null;
    deleteRole(id: string): boolean;
    getRolePermissions(roleId: string, visited?: Set<string>): Permission[];
    assignUserRole(userId: string, roleId: string): boolean;
    removeUserRole(userId: string, roleId: string): boolean;
    getUserRoles(userId: string): Role[];
    getUserPermissions(userId: string): Permission[];
    createResource(resource: Omit<Resource, 'id'>): Resource;
    getResource(id: string): Resource | null;
    private evaluateConditions;
    private evaluateCondition;
    private resolveTemplate;
    checkAccess(request: AccessRequest): Promise<AccessResult>;
    canRead(userId: string, resource: string, context?: AccessContext): Promise<boolean>;
    canWrite(userId: string, resource: string, context?: AccessContext): Promise<boolean>;
    canDelete(userId: string, resource: string, context?: AccessContext): Promise<boolean>;
    canCreate(userId: string, resource: string, context?: AccessContext): Promise<boolean>;
    checkBulkAccess(requests: AccessRequest[]): Promise<AccessResult[]>;
    getEffectivePermissions(userId: string, context?: AccessContext): Promise<{
        permissions: Permission[];
        roles: Role[];
        resources: string[];
    }>;
}
export declare function createRBACMiddleware(rbacService: RBACService): {
    requirePermission: (resource: string, action: string) => (req: any, res: any, next: any) => Promise<any>;
    requireRole: (...roleIds: string[]) => (req: any, res: any, next: any) => any;
};
export default RBACService;
//# sourceMappingURL=rbac.d.ts.map