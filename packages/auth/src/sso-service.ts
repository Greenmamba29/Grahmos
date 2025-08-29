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

import { randomBytes, createHash } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import * as saml2 from 'saml2-js';
import { Issuer, Client, generators, TokenSet } from 'openid-client';
import type { User } from './auth-service';

// SSO Provider Types
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

export class SSOService {
  private providers: Map<string, SSOProvider> = new Map();
  private samlProviders: Map<string, any> = new Map();
  private oidcClients: Map<string, Client> = new Map();
  private jitConfig: JITProvisioningConfig;

  constructor(jitConfig: JITProvisioningConfig) {
    this.jitConfig = jitConfig;
    this.initializeDefaultProviders();
  }

  // Initialize default enterprise providers
  private initializeDefaultProviders() {
    // These would typically be loaded from configuration
    const defaultProviders: Partial<SSOProvider>[] = [
      {
        id: 'okta',
        name: 'Okta',
        type: 'saml',
        enabled: false,
        userMapping: {
          email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
        }
      },
      {
        id: 'azure-ad',
        name: 'Azure Active Directory',
        type: 'oidc',
        enabled: false,
        userMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          username: 'preferred_username',
          groups: 'groups'
        }
      },
      {
        id: 'google-workspace',
        name: 'Google Workspace',
        type: 'oidc',
        enabled: false,
        userMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          username: 'email'
        }
      }
    ];

    // Initialize with default configurations (would be properly configured in production)
    defaultProviders.forEach(provider => {
      if (provider.id) {
        const fullProvider: SSOProvider = {
          ...provider as SSOProvider,
          configuration: this.getDefaultConfiguration(provider.type!, provider.id),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.providers.set(provider.id, fullProvider);
      }
    });
  }

  private getDefaultConfiguration(type: string, providerId: string): SAMLConfiguration | OIDCConfiguration {
    if (type === 'saml') {
      return {
        entityId: `grahmos-${providerId}`,
        ssoUrl: `https://${providerId}.example.com/sso`,
        certificate: '', // Would be loaded from secure configuration
        signRequests: true,
        wantAssertionsSigned: true,
        nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
        attributeMapping: {}
      } as SAMLConfiguration;
    } else {
      return {
        clientId: '', // Would be loaded from secure configuration
        clientSecret: '', // Would be loaded from secure configuration
        discoveryUrl: this.getDiscoveryUrl(providerId),
        redirectUri: `${process.env.BASE_URL}/auth/sso/callback/${providerId}`,
        scopes: ['openid', 'email', 'profile'],
        responseType: 'code',
        grantType: 'authorization_code',
        pkceMethod: 'S256'
      } as OIDCConfiguration;
    }
  }

  private getDiscoveryUrl(providerId: string): string {
    const discoveryUrls: Record<string, string> = {
      'azure-ad': 'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
      'google-workspace': 'https://accounts.google.com/.well-known/openid-configuration',
      'okta': 'https://your-domain.okta.com/.well-known/openid_configuration'
    };
    return discoveryUrls[providerId] || '';
  }

  // Provider management
  async createProvider(provider: Omit<SSOProvider, 'id' | 'createdAt' | 'updatedAt'>): Promise<SSOProvider> {
    const id = provider.name.toLowerCase().replace(/\s+/g, '-');
    const newProvider: SSOProvider = {
      ...provider,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.providers.set(id, newProvider);
    await this.initializeProviderClient(newProvider);
    
    return newProvider;
  }

  getProvider(id: string): SSOProvider | null {
    return this.providers.get(id) || null;
  }

  listProviders(): SSOProvider[] {
    return Array.from(this.providers.values());
  }

  getEnabledProviders(): SSOProvider[] {
    return Array.from(this.providers.values()).filter(p => p.enabled);
  }

  async updateProvider(id: string, updates: Partial<SSOProvider>): Promise<SSOProvider | null> {
    const provider = this.providers.get(id);
    if (!provider) return null;

    const updated = { ...provider, ...updates, id, updatedAt: new Date() };
    this.providers.set(id, updated);
    
    // Re-initialize client if configuration changed
    if (updates.configuration) {
      await this.initializeProviderClient(updated);
    }
    
    return updated;
  }

  deleteProvider(id: string): boolean {
    const deleted = this.providers.delete(id);
    if (deleted) {
      this.samlProviders.delete(id);
      this.oidcClients.delete(id);
    }
    return deleted;
  }

  // Initialize SSO clients
  private async initializeProviderClient(provider: SSOProvider): Promise<void> {
    if (provider.type === 'saml') {
      this.initializeSAMLProvider(provider);
    } else if (provider.type === 'oidc') {
      await this.initializeOIDCProvider(provider);
    }
  }

  private initializeSAMLProvider(provider: SSOProvider): void {
    const config = provider.configuration as SAMLConfiguration;
    
    const sp = new saml2.ServiceProvider({
      entity_id: config.entityId,
      private_key: config.privateKey || '',
      certificate: config.certificate,
      assert_endpoint: `${process.env.BASE_URL}/auth/sso/saml/callback/${provider.id}`,
      sign_get_request: config.signRequests,
      nameid_format: config.nameIdFormat
    });

    const idp = new saml2.IdentityProvider({
      sso_login_url: config.ssoUrl,
      sso_logout_url: config.sloUrl || '',
      certificates: [config.certificate]
    });

    this.samlProviders.set(provider.id, { sp, idp });
  }

  private async initializeOIDCProvider(provider: SSOProvider): Promise<void> {
    try {
      const config = provider.configuration as OIDCConfiguration;
      const issuer = await Issuer.discover(config.discoveryUrl);
      
      const client = new issuer.Client({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uris: [config.redirectUri],
        response_types: [config.responseType],
        grant_types: [config.grantType]
      });

      this.oidcClients.set(provider.id, client);
    } catch (error) {
      console.error(`Failed to initialize OIDC provider ${provider.id}:`, error);
    }
  }

  // SAML Authentication
  async initiateSAMLAuth(providerId: string, relayState?: string): Promise<string> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'saml') {
      throw new Error('Invalid SAML provider');
    }

    const samlProvider = this.samlProviders.get(providerId);
    if (!samlProvider) {
      throw new Error('SAML provider not initialized');
    }

    return new Promise((resolve, reject) => {
      samlProvider.sp.create_login_request_url(
        samlProvider.idp,
        { relay_state: relayState },
        (error: any, loginUrl: string) => {
          if (error) {
            reject(error);
          } else {
            resolve(loginUrl);
          }
        }
      );
    });
  }

  async handleSAMLResponse(providerId: string, samlResponse: string, relayState?: string): Promise<SSOAuthResponse> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'saml') {
      return { success: false, error: 'Invalid SAML provider' };
    }

    const samlProvider = this.samlProviders.get(providerId);
    if (!samlProvider) {
      return { success: false, error: 'SAML provider not initialized' };
    }

    return new Promise((resolve) => {
      samlProvider.sp.post_assert(
        samlProvider.idp,
        { request_body: { SAMLResponse: samlResponse, RelayState: relayState } },
        async (error: any, samlAssertions: any) => {
          if (error) {
            resolve({ success: false, error: error.message });
            return;
          }

          try {
            const user = await this.processUserAttributes(provider, samlAssertions.user);
            resolve({
              success: true,
              user,
              attributes: samlAssertions.user,
              sessionId: samlAssertions.response_header?.id
            });
          } catch (processingError) {
            resolve({
              success: false,
              error: `User processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`
            });
          }
        }
      );
    });
  }

  // OIDC Authentication
  async initiateOIDCAuth(providerId: string, state?: string): Promise<string> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'oidc') {
      throw new Error('Invalid OIDC provider');
    }

    const client = this.oidcClients.get(providerId);
    if (!client) {
      throw new Error('OIDC client not initialized');
    }

    const config = provider.configuration as OIDCConfiguration;
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // Store code verifier for later use (in production, use secure session storage)
    // For now, we'll include it in the state parameter (not secure for production)
    const stateData = {
      providerId,
      codeVerifier,
      originalState: state,
      timestamp: Date.now()
    };

    const authUrl = client.authorizationUrl({
      scope: config.scopes.join(' '),
      state: Buffer.from(JSON.stringify(stateData)).toString('base64'),
      code_challenge: codeChallenge,
      code_challenge_method: config.pkceMethod || 'S256'
    });

    return authUrl;
  }

  async handleOIDCCallback(providerId: string, code: string, state: string): Promise<SSOAuthResponse> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'oidc') {
      return { success: false, error: 'Invalid OIDC provider' };
    }

    const client = this.oidcClients.get(providerId);
    if (!client) {
      return { success: false, error: 'OIDC client not initialized' };
    }

    try {
      // Decode state to get code verifier
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { codeVerifier } = stateData;

      const tokenSet = await client.callback(
        (provider.configuration as OIDCConfiguration).redirectUri,
        { code, state },
        { code_verifier: codeVerifier }
      );

      const userinfo = await client.userinfo(tokenSet);
      const user = await this.processUserAttributes(provider, userinfo);

      return {
        success: true,
        user,
        attributes: userinfo,
        sessionId: tokenSet.session_state
      };
    } catch (error) {
      return {
        success: false,
        error: `OIDC callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // User attribute processing and JIT provisioning
  private async processUserAttributes(provider: SSOProvider, attributes: Record<string, any>): Promise<User> {
    const mapping = provider.userMapping;
    
    // Extract mapped attributes
    const email = this.extractAttribute(attributes, mapping.email);
    const firstName = mapping.firstName ? this.extractAttribute(attributes, mapping.firstName) : undefined;
    const lastName = mapping.lastName ? this.extractAttribute(attributes, mapping.lastName) : undefined;
    const username = mapping.username ? this.extractAttribute(attributes, mapping.username) : email;
    const groups = mapping.groups ? this.extractAttribute(attributes, mapping.groups) : [];

    if (!email) {
      throw new Error('Email attribute is required but not found in SSO response');
    }

    // Map roles from groups/attributes
    const roles = this.mapRolesToGroups(groups, provider);

    // Create or update user based on JIT provisioning configuration
    const user: User = {
      id: createHash('sha256').update(email).digest('hex').substring(0, 16),
      email,
      firstName,
      lastName,
      username,
      roles: roles.length > 0 ? roles : this.jitConfig.defaultRoles,
      isActive: true,
      emailVerified: true, // SSO users are considered verified
      mfaEnabled: false, // SSO handles authentication
      createdAt: new Date(),
      updatedAt: new Date(),
      loginAttempts: 0,
      metadata: {
        ssoProvider: provider.id,
        ssoAttributes: attributes,
        lastSSOLogin: new Date()
      }
    };

    return user;
  }

  private extractAttribute(attributes: Record<string, any>, path: string): any {
    // Handle dot notation for nested attributes
    if (path.includes('.')) {
      const parts = path.split('.');
      let value = attributes;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return undefined;
        }
      }
      return value;
    }
    
    return attributes[path];
  }

  private mapRolesToGroups(groups: string | string[], provider: SSOProvider): string[] {
    if (!this.jitConfig.enabled || !this.jitConfig.roleMappingRules.length) {
      return [];
    }

    const groupArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
    const mappedRoles: string[] = [];

    for (const rule of this.jitConfig.roleMappingRules) {
      const { condition, roles } = rule;
      let matches = false;

      switch (condition.operator) {
        case 'eq':
          matches = groupArray.includes(condition.value);
          break;
        case 'in':
          matches = Array.isArray(condition.value) && 
                   condition.value.some((val: string) => groupArray.includes(val));
          break;
        case 'contains':
          matches = groupArray.some(group => group.includes(condition.value));
          break;
        case 'regex':
          const regex = new RegExp(condition.value);
          matches = groupArray.some(group => regex.test(group));
          break;
      }

      if (matches) {
        mappedRoles.push(...roles);
      }
    }

    return Array.from(new Set(mappedRoles));
  }

  // SSO Logout
  async initiateSAMLLogout(providerId: string, sessionId: string): Promise<string | null> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.type !== 'saml') {
      return null;
    }

    const samlProvider = this.samlProviders.get(providerId);
    if (!samlProvider) {
      return null;
    }

    const config = provider.configuration as SAMLConfiguration;
    if (!config.sloUrl) {
      return null; // SLO not supported by this provider
    }

    return new Promise((resolve, reject) => {
      samlProvider.sp.create_logout_request_url(
        samlProvider.idp,
        { name_id: sessionId },
        (error: any, logoutUrl: string) => {
          if (error) {
            reject(error);
          } else {
            resolve(logoutUrl);
          }
        }
      );
    });
  }

  async initiateOIDCLogout(providerId: string): Promise<string | null> {
    const client = this.oidcClients.get(providerId);
    if (!client) {
      return null;
    }

    try {
      return client.endSessionUrl({
        post_logout_redirect_uri: `${process.env.BASE_URL}/auth/logout/callback`
      });
    } catch (error) {
      console.error('OIDC logout initiation failed:', error);
      return null;
    }
  }

  // Provider metadata
  getSAMLMetadata(providerId: string): string | null {
    const samlProvider = this.samlProviders.get(providerId);
    if (!samlProvider) {
      return null;
    }

    return samlProvider.sp.create_metadata();
  }

  // Configuration validation
  async validateProviderConfiguration(provider: SSOProvider): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (provider.type === 'saml') {
      const config = provider.configuration as SAMLConfiguration;
      
      if (!config.entityId) {
        errors.push('SAML Entity ID is required');
      }
      
      if (!config.ssoUrl) {
        errors.push('SAML SSO URL is required');
      }
      
      if (!config.certificate) {
        errors.push('SAML Certificate is required');
      }
    } else if (provider.type === 'oidc') {
      const config = provider.configuration as OIDCConfiguration;
      
      if (!config.clientId) {
        errors.push('OIDC Client ID is required');
      }
      
      if (!config.clientSecret) {
        errors.push('OIDC Client Secret is required');
      }
      
      if (!config.discoveryUrl) {
        errors.push('OIDC Discovery URL is required');
      }

      // Test OIDC discovery endpoint
      try {
        await Issuer.discover(config.discoveryUrl);
      } catch (error) {
        errors.push('OIDC Discovery endpoint is not accessible');
      }
    }

    // Validate user mapping
    if (!provider.userMapping.email) {
      errors.push('Email attribute mapping is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Health check for SSO providers
  async checkProviderHealth(): Promise<Record<string, { status: 'healthy' | 'unhealthy'; error?: string }>> {
    const healthStatus: Record<string, { status: 'healthy' | 'unhealthy'; error?: string }> = {};

    for (const [providerId, provider] of this.providers.entries()) {
      if (!provider.enabled) {
        healthStatus[providerId] = { status: 'healthy' };
        continue;
      }

      try {
        if (provider.type === 'saml') {
          // For SAML, we can check if the provider is initialized
          healthStatus[providerId] = {
            status: this.samlProviders.has(providerId) ? 'healthy' : 'unhealthy',
            error: !this.samlProviders.has(providerId) ? 'SAML provider not initialized' : undefined
          };
        } else if (provider.type === 'oidc') {
          // For OIDC, we can test the discovery endpoint
          const config = provider.configuration as OIDCConfiguration;
          await Issuer.discover(config.discoveryUrl);
          healthStatus[providerId] = { status: 'healthy' };
        }
      } catch (error) {
        healthStatus[providerId] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return healthStatus;
  }
}

// Express.js middleware for SSO
export function createSSOMiddleware(ssoService: SSOService) {
  return {
    // Initialize SAML auth
    initiateSAML: async (req: any, res: any, next: any) => {
      try {
        const { providerId } = req.params;
        const relayState = req.query.RelayState;
        
        const loginUrl = await ssoService.initiateSAMLAuth(providerId, relayState);
        res.redirect(loginUrl);
      } catch (error) {
        next(error);
      }
    },

    // Handle SAML callback
    handleSAMLCallback: async (req: any, res: any, next: any) => {
      try {
        const { providerId } = req.params;
        const { SAMLResponse, RelayState } = req.body;
        
        const result = await ssoService.handleSAMLResponse(providerId, SAMLResponse, RelayState);
        
        if (result.success) {
          req.ssoUser = result.user;
          req.ssoAttributes = result.attributes;
          next();
        } else {
          res.status(400).json({ error: result.error });
        }
      } catch (error) {
        next(error);
      }
    },

    // Initialize OIDC auth
    initiateOIDC: async (req: any, res: any, next: any) => {
      try {
        const { providerId } = req.params;
        const state = req.query.state;
        
        const authUrl = await ssoService.initiateOIDCAuth(providerId, state);
        res.redirect(authUrl);
      } catch (error) {
        next(error);
      }
    },

    // Handle OIDC callback
    handleOIDCCallback: async (req: any, res: any, next: any) => {
      try {
        const { providerId } = req.params;
        const { code, state } = req.query;
        
        const result = await ssoService.handleOIDCCallback(providerId, code, state);
        
        if (result.success) {
          req.ssoUser = result.user;
          req.ssoAttributes = result.attributes;
          next();
        } else {
          res.status(400).json({ error: result.error });
        }
      } catch (error) {
        next(error);
      }
    }
  };
}

export default SSOService;
