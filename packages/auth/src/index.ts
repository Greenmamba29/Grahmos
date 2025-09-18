/**
 * Grahmos Authentication Package
 * Main entry point for authentication, authorization, data protection, and SSO services
 */

// Authentication Service exports
export { 
  AuthenticationService,
  createAuthMiddleware,
  type User,
  type AuthTokens,
  type LoginRequest,
  type AuthSession,
  type AuthConfig
} from './auth-service.js';

// RBAC Service exports
export { 
  RBACService,
  createRBACMiddleware,
  type Permission,
  type PermissionCondition,
  type Role,
  type Resource,
  type AccessRequest,
  type AccessContext,
  type AccessResult
} from './rbac.js';

// SSO Service exports
export { 
  SSOService,
  createSSOMiddleware,
  type SSOProvider,
  type SAMLConfiguration,
  type OIDCConfiguration,
  type UserAttributeMapping,
  type SSOAuthRequest,
  type SSOAuthResponse,
  type JITProvisioningConfig,
  type RoleMappingRule
} from './sso-service.js';

// Data Protection exports
export { 
  KeyManagementService,
  AdvancedEncryptionService,
  PIIProtectionService,
  DataLossPreventionService,
  SecureDataStorageService,
  DataClassification,
  DataType,
  type DataHandlingPolicy,
  type EncryptionMetadata,
  type DecryptionContext
} from './data-protection.js';

// Default exports (using different names to avoid conflicts)
export { default as AuthService } from './auth-service.js';
export { default as RBAC } from './rbac.js';
export { default as SSO } from './sso-service.js';
