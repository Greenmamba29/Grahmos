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
import { createHash } from 'crypto';
import * as saml2 from 'saml2-js';
import { Issuer, generators } from 'openid-client';
export class SSOService {
    providers = new Map();
    samlProviders = new Map();
    oidcClients = new Map();
    jitConfig;
    constructor(jitConfig) {
        this.jitConfig = jitConfig;
        this.initializeDefaultProviders();
    }
    // Initialize default enterprise providers
    initializeDefaultProviders() {
        // These would typically be loaded from configuration
        const defaultProviders = [
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
                const fullProvider = {
                    ...provider,
                    configuration: this.getDefaultConfiguration(provider.type, provider.id),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                this.providers.set(provider.id, fullProvider);
            }
        });
    }
    getDefaultConfiguration(type, providerId) {
        if (type === 'saml') {
            return {
                entityId: `grahmos-${providerId}`,
                ssoUrl: `https://${providerId}.example.com/sso`,
                certificate: '', // Would be loaded from secure configuration
                signRequests: true,
                wantAssertionsSigned: true,
                nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
                attributeMapping: {}
            };
        }
        else {
            return {
                clientId: '', // Would be loaded from secure configuration
                clientSecret: '', // Would be loaded from secure configuration
                discoveryUrl: this.getDiscoveryUrl(providerId),
                redirectUri: `${process.env.BASE_URL}/auth/sso/callback/${providerId}`,
                scopes: ['openid', 'email', 'profile'],
                responseType: 'code',
                grantType: 'authorization_code',
                pkceMethod: 'S256'
            };
        }
    }
    getDiscoveryUrl(providerId) {
        const discoveryUrls = {
            'azure-ad': 'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
            'google-workspace': 'https://accounts.google.com/.well-known/openid-configuration',
            'okta': 'https://your-domain.okta.com/.well-known/openid_configuration'
        };
        return discoveryUrls[providerId] || '';
    }
    // Provider management
    async createProvider(provider) {
        const id = provider.name.toLowerCase().replace(/\s+/g, '-');
        const newProvider = {
            ...provider,
            id,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.providers.set(id, newProvider);
        await this.initializeProviderClient(newProvider);
        return newProvider;
    }
    getProvider(id) {
        return this.providers.get(id) || null;
    }
    listProviders() {
        return Array.from(this.providers.values());
    }
    getEnabledProviders() {
        return Array.from(this.providers.values()).filter(p => p.enabled);
    }
    async updateProvider(id, updates) {
        const provider = this.providers.get(id);
        if (!provider)
            return null;
        const updated = { ...provider, ...updates, id, updatedAt: new Date() };
        this.providers.set(id, updated);
        // Re-initialize client if configuration changed
        if (updates.configuration) {
            await this.initializeProviderClient(updated);
        }
        return updated;
    }
    deleteProvider(id) {
        const deleted = this.providers.delete(id);
        if (deleted) {
            this.samlProviders.delete(id);
            this.oidcClients.delete(id);
        }
        return deleted;
    }
    // Initialize SSO clients
    async initializeProviderClient(provider) {
        if (provider.type === 'saml') {
            this.initializeSAMLProvider(provider);
        }
        else if (provider.type === 'oidc') {
            await this.initializeOIDCProvider(provider);
        }
    }
    initializeSAMLProvider(provider) {
        const config = provider.configuration;
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
    async initializeOIDCProvider(provider) {
        try {
            const config = provider.configuration;
            const issuer = await Issuer.discover(config.discoveryUrl);
            const client = new issuer.Client({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uris: [config.redirectUri],
                response_types: [config.responseType],
                grant_types: [config.grantType]
            });
            this.oidcClients.set(provider.id, client);
        }
        catch (error) {
            console.error(`Failed to initialize OIDC provider ${provider.id}:`, error);
        }
    }
    // SAML Authentication
    async initiateSAMLAuth(providerId, relayState) {
        const provider = this.providers.get(providerId);
        if (!provider || provider.type !== 'saml') {
            throw new Error('Invalid SAML provider');
        }
        const samlProvider = this.samlProviders.get(providerId);
        if (!samlProvider) {
            throw new Error('SAML provider not initialized');
        }
        return new Promise((resolve, reject) => {
            samlProvider.sp.create_login_request_url(samlProvider.idp, { relay_state: relayState }, (error, loginUrl) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(loginUrl);
                }
            });
        });
    }
    async handleSAMLResponse(providerId, samlResponse, relayState) {
        const provider = this.providers.get(providerId);
        if (!provider || provider.type !== 'saml') {
            return { success: false, error: 'Invalid SAML provider' };
        }
        const samlProvider = this.samlProviders.get(providerId);
        if (!samlProvider) {
            return { success: false, error: 'SAML provider not initialized' };
        }
        return new Promise((resolve) => {
            samlProvider.sp.post_assert(samlProvider.idp, { request_body: { SAMLResponse: samlResponse, RelayState: relayState } }, async (error, samlAssertions) => {
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
                }
                catch (processingError) {
                    resolve({
                        success: false,
                        error: `User processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`
                    });
                }
            });
        });
    }
    // OIDC Authentication
    async initiateOIDCAuth(providerId, state) {
        const provider = this.providers.get(providerId);
        if (!provider || provider.type !== 'oidc') {
            throw new Error('Invalid OIDC provider');
        }
        const client = this.oidcClients.get(providerId);
        if (!client) {
            throw new Error('OIDC client not initialized');
        }
        const config = provider.configuration;
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
    async handleOIDCCallback(providerId, code, state) {
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
            const tokenSet = await client.callback(provider.configuration.redirectUri, { code, state }, { code_verifier: codeVerifier });
            const userinfo = await client.userinfo(tokenSet);
            const user = await this.processUserAttributes(provider, userinfo);
            return {
                success: true,
                user,
                attributes: userinfo,
                sessionId: tokenSet.session_state
            };
        }
        catch (error) {
            return {
                success: false,
                error: `OIDC callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    // User attribute processing and JIT provisioning
    async processUserAttributes(provider, attributes) {
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
        const user = {
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
    extractAttribute(attributes, path) {
        // Handle dot notation for nested attributes
        if (path.includes('.')) {
            const parts = path.split('.');
            let value = attributes;
            for (const part of parts) {
                if (value && typeof value === 'object') {
                    value = value[part];
                }
                else {
                    return undefined;
                }
            }
            return value;
        }
        return attributes[path];
    }
    mapRolesToGroups(groups, provider) {
        if (!this.jitConfig.enabled || !this.jitConfig.roleMappingRules.length) {
            return [];
        }
        const groupArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
        const mappedRoles = [];
        for (const rule of this.jitConfig.roleMappingRules) {
            const { condition, roles } = rule;
            let matches = false;
            switch (condition.operator) {
                case 'eq':
                    matches = groupArray.includes(condition.value);
                    break;
                case 'in':
                    matches = Array.isArray(condition.value) &&
                        condition.value.some((val) => groupArray.includes(val));
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
    async initiateSAMLLogout(providerId, sessionId) {
        const provider = this.providers.get(providerId);
        if (!provider || provider.type !== 'saml') {
            return null;
        }
        const samlProvider = this.samlProviders.get(providerId);
        if (!samlProvider) {
            return null;
        }
        const config = provider.configuration;
        if (!config.sloUrl) {
            return null; // SLO not supported by this provider
        }
        return new Promise((resolve, reject) => {
            samlProvider.sp.create_logout_request_url(samlProvider.idp, { name_id: sessionId }, (error, logoutUrl) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(logoutUrl);
                }
            });
        });
    }
    async initiateOIDCLogout(providerId) {
        const client = this.oidcClients.get(providerId);
        if (!client) {
            return null;
        }
        try {
            return client.endSessionUrl({
                post_logout_redirect_uri: `${process.env.BASE_URL}/auth/logout/callback`
            });
        }
        catch (error) {
            console.error('OIDC logout initiation failed:', error);
            return null;
        }
    }
    // Provider metadata
    getSAMLMetadata(providerId) {
        const samlProvider = this.samlProviders.get(providerId);
        if (!samlProvider) {
            return null;
        }
        return samlProvider.sp.create_metadata();
    }
    // Configuration validation
    async validateProviderConfiguration(provider) {
        const errors = [];
        if (provider.type === 'saml') {
            const config = provider.configuration;
            if (!config.entityId) {
                errors.push('SAML Entity ID is required');
            }
            if (!config.ssoUrl) {
                errors.push('SAML SSO URL is required');
            }
            if (!config.certificate) {
                errors.push('SAML Certificate is required');
            }
        }
        else if (provider.type === 'oidc') {
            const config = provider.configuration;
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
            }
            catch (error) {
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
    async checkProviderHealth() {
        const healthStatus = {};
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
                }
                else if (provider.type === 'oidc') {
                    // For OIDC, we can test the discovery endpoint
                    const config = provider.configuration;
                    await Issuer.discover(config.discoveryUrl);
                    healthStatus[providerId] = { status: 'healthy' };
                }
            }
            catch (error) {
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
export function createSSOMiddleware(ssoService) {
    return {
        // Initialize SAML auth
        initiateSAML: async (req, res, next) => {
            try {
                const { providerId } = req.params;
                const relayState = req.query.RelayState;
                const loginUrl = await ssoService.initiateSAMLAuth(providerId, relayState);
                res.redirect(loginUrl);
            }
            catch (error) {
                next(error);
            }
        },
        // Handle SAML callback
        handleSAMLCallback: async (req, res, next) => {
            try {
                const { providerId } = req.params;
                const { SAMLResponse, RelayState } = req.body;
                const result = await ssoService.handleSAMLResponse(providerId, SAMLResponse, RelayState);
                if (result.success) {
                    req.ssoUser = result.user;
                    req.ssoAttributes = result.attributes;
                    next();
                }
                else {
                    res.status(400).json({ error: result.error });
                }
            }
            catch (error) {
                next(error);
            }
        },
        // Initialize OIDC auth
        initiateOIDC: async (req, res, next) => {
            try {
                const { providerId } = req.params;
                const state = req.query.state;
                const authUrl = await ssoService.initiateOIDCAuth(providerId, state);
                res.redirect(authUrl);
            }
            catch (error) {
                next(error);
            }
        },
        // Handle OIDC callback
        handleOIDCCallback: async (req, res, next) => {
            try {
                const { providerId } = req.params;
                const { code, state } = req.query;
                const result = await ssoService.handleOIDCCallback(providerId, code, state);
                if (result.success) {
                    req.ssoUser = result.user;
                    req.ssoAttributes = result.attributes;
                    next();
                }
                else {
                    res.status(400).json({ error: result.error });
                }
            }
            catch (error) {
                next(error);
            }
        }
    };
}
export default SSOService;
//# sourceMappingURL=sso-service.js.map