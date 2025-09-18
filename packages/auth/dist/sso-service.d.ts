/**
 * Grahmos Single Sign-On (SSO) Service
 * Phase 11: Enterprise Security & User Management
 *
 * Features:
 * - SAML 2.0 authentication
 * - OpenID Connect (OIDC) support
 * - Enterprise provider integrations (Okta, Azure AD, Google Workspace)
 * - JIT (Just-In-Time) user provisioning
 * - SSO session management
 * - Identity provider metadata configuration
 */
import type { User } from './auth-service';
export interface SSOProvider {
    id: string;
    name: string;
    type: 'saml' | 'oidc';
    enabled: boolean;
    configuration: SAMLConfiguration | OIDCConfiguration;
    userMapping: UserAttributeMapping;
    createdAt: Date;
    updatedAt: Date;
}
export interface SAMLConfiguration {
    entityId: string;
    ssoUrl: string;
    sloUrl?: string;
    certificate: string;
    privateKey?: string;
    signRequests: boolean;
    wantAssertionsSigned: boolean;
    nameIdFormat: string;
    attributeMapping: Record<string, string>;
    relayStateUrl?: string;
}
export interface OIDCConfiguration {
    clientId: string;
    clientSecret: string;
    discoveryUrl: string;
    redirectUri: string;
    scopes: string[];
    responseType: string;
    grantType: string;
    pkceMethod?: 'S256' | 'plain';
}
export interface UserAttributeMapping {
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    roles?: string;
    groups?: string;
    department?: string;
    title?: string;
}
export interface SSOAuthRequest {
    providerId: string;
    relayState?: string;
    forceAuth?: boolean;
    redirectUrl?: string;
}
export interface SSOAuthResponse {
    success: boolean;
    user?: User;
    error?: string;
    attributes?: Record<string, any>;
    sessionId?: string;
}
export interface JITProvisioningConfig {
    enabled: boolean;
    autoCreateUsers: boolean;
    updateExistingUsers: boolean;
    defaultRoles: string[];
    roleMappingRules: RoleMappingRule[];
}
export interface RoleMappingRule {
    condition: {
        attribute: string;
        operator: 'eq' | 'in' | 'contains' | 'regex';
        value: any;
    };
    roles: string[];
}
export declare class SSOService {
    private providers;
    private samlProviders;
    private oidcClients;
    private jitConfig;
    constructor(jitConfig: JITProvisioningConfig);
    private initializeDefaultProviders;
    private getDefaultConfiguration;
    private getDiscoveryUrl;
    createProvider(provider: Omit<SSOProvider, 'id' | 'createdAt' | 'updatedAt'>): Promise<SSOProvider>;
    getProvider(id: string): SSOProvider | null;
    listProviders(): SSOProvider[];
    getEnabledProviders(): SSOProvider[];
    updateProvider(id: string, updates: Partial<SSOProvider>): Promise<SSOProvider | null>;
    deleteProvider(id: string): boolean;
    private initializeProviderClient;
    private initializeSAMLProvider;
    private initializeOIDCProvider;
    initiateSAMLAuth(providerId: string, relayState?: string): Promise<string>;
    handleSAMLResponse(providerId: string, samlResponse: string, relayState?: string): Promise<SSOAuthResponse>;
    initiateOIDCAuth(providerId: string, state?: string): Promise<string>;
    handleOIDCCallback(providerId: string, code: string, state: string): Promise<SSOAuthResponse>;
    private processUserAttributes;
    private extractAttribute;
    private mapRolesToGroups;
    initiateSAMLLogout(providerId: string, sessionId: string): Promise<string | null>;
    initiateOIDCLogout(providerId: string): Promise<string | null>;
    getSAMLMetadata(providerId: string): string | null;
    validateProviderConfiguration(provider: SSOProvider): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    checkProviderHealth(): Promise<Record<string, {
        status: 'healthy' | 'unhealthy';
        error?: string;
    }>>;
}
export declare function createSSOMiddleware(ssoService: SSOService): {
    initiateSAML: (req: any, res: any, next: any) => Promise<void>;
    handleSAMLCallback: (req: any, res: any, next: any) => Promise<void>;
    initiateOIDC: (req: any, res: any, next: any) => Promise<void>;
    handleOIDCCallback: (req: any, res: any, next: any) => Promise<void>;
};
export default SSOService;
//# sourceMappingURL=sso-service.d.ts.map