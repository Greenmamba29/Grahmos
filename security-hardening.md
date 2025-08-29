# Grahmos Security Hardening & Compliance Configuration
## Phase 11: Enterprise Security & User Management

This document outlines the comprehensive security hardening measures and compliance configurations implemented for the Grahmos platform.

## Table of Contents

1. [Infrastructure Security](#infrastructure-security)
2. [Application Security](#application-security) 
3. [Authentication & Authorization](#authentication--authorization)
4. [Data Protection](#data-protection)
5. [Network Security](#network-security)
6. [Monitoring & Logging](#monitoring--logging)
7. [Compliance Frameworks](#compliance-frameworks)
8. [Incident Response](#incident-response)
9. [Security Policies](#security-policies)
10. [Continuous Security](#continuous-security)

## Infrastructure Security

### Container Security
```yaml
# Container security baseline
security:
  runAsNonRoot: true
  runAsUser: 1001
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE
  seccompProfile:
    type: RuntimeDefault
  seLinuxOptions:
    level: s0:c123,c456
```

### Kubernetes Security Policies
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: grahmos-restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grahmos-network-policy
spec:
  podSelector:
    matchLabels:
      app: grahmos
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: grahmos-system
        - podSelector:
            matchLabels:
              role: frontend
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: grahmos-system
      ports:
        - protocol: TCP
          port: 5432
```

## Application Security

### Security Headers Configuration
```typescript
// Express security middleware
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);
```

### Input Validation & Sanitization
```typescript
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Zod schemas for validation
export const userSchema = z.object({
  email: z.string().email().max(254),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  password: z.string().min(12).max(128).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  )
});

// Sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  Object.keys(req.body).forEach(key => {
    if (typeof req.body[key] === 'string') {
      req.body[key] = DOMPurify.sanitize(req.body[key]);
    }
  });
  next();
};
```

### SQL Injection Prevention
```typescript
// Using parameterized queries with Prisma
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Safe query example
export const getUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      roles: true,
      isActive: true
    }
  });
};

// Additional query validation
const validateQuery = (query: any) => {
  const dangerousPatterns = [
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT( +INTO)?|MERGE|SELECT|UNION( +ALL)?|UPDATE)\b)/gi,
    /(\b(AND|OR)\b.{1,6}?(=|>|<|\!=|<>|<<=|>>=|\|\|))/gi,
    /(['"]\s*(;|--|\||#))/gi
  ];
  
  const queryString = JSON.stringify(query);
  return dangerousPatterns.some(pattern => pattern.test(queryString));
};
```

## Authentication & Authorization

### JWT Security Configuration
```typescript
// JWT configuration with security best practices
export const jwtConfig = {
  algorithm: 'RS256' as const,
  expiresIn: '15m',
  issuer: 'grahmos-auth',
  audience: 'grahmos-api',
  keyid: process.env.JWT_KEY_ID,
  // Rotate keys every 30 days
  keyRotationInterval: 30 * 24 * 60 * 60 * 1000,
  // Use different keys for signing and verification
  publicKey: process.env.JWT_PUBLIC_KEY,
  privateKey: process.env.JWT_PRIVATE_KEY,
};

// Token blacklist for logout/revocation
class TokenBlacklist {
  private blacklistedTokens = new Set<string>();
  
  async addToBlacklist(tokenId: string, expiresAt: Date) {
    this.blacklistedTokens.add(tokenId);
    // Remove from blacklist after expiration
    setTimeout(() => {
      this.blacklistedTokens.delete(tokenId);
    }, expiresAt.getTime() - Date.now());
  }
  
  isBlacklisted(tokenId: string): boolean {
    return this.blacklistedTokens.has(tokenId);
  }
}
```

### MFA Implementation
```typescript
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

export class MFAService {
  async generateSecret(userId: string): Promise<{ secret: string; qrCode: string }> {
    const secret = speakeasy.generateSecret({
      name: `Grahmos (${userId})`,
      issuer: 'Grahmos',
      length: 32
    });
    
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    
    // Store secret securely (encrypted)
    await this.storeEncryptedSecret(userId, secret.base32);
    
    return {
      secret: secret.base32,
      qrCode
    };
  }
  
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const secret = await this.getDecryptedSecret(userId);
    
    return speakeasy.totp.verify({
      secret,
      token,
      window: 2, // Allow 2 time steps before/after
      step: 30
    });
  }
  
  private async storeEncryptedSecret(userId: string, secret: string): Promise<void> {
    const encryptedSecret = await this.encrypt(secret);
    // Store in secure database
  }
  
  private async getDecryptedSecret(userId: string): Promise<string> {
    const encryptedSecret = await this.getStoredSecret(userId);
    return await this.decrypt(encryptedSecret);
  }
}
```

## Data Protection

### Encryption at Rest
```yaml
# Database encryption configuration
apiVersion: v1
kind: Secret
metadata:
  name: database-encryption-keys
type: Opaque
data:
  master-key: <base64-encoded-key>
  data-key: <base64-encoded-key>

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  template:
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine
          env:
            - name: POSTGRES_DB
              value: grahmos
            - name: PGCRYPTO_EXTENSION
              value: "true"
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
          # Encrypted volume
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
```

### Data Classification & Handling
```typescript
// Data classification system
export enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED'
}

export interface DataHandlingPolicy {
  classification: DataClassification;
  encryptionRequired: boolean;
  accessLogging: boolean;
  retentionDays: number;
  backupEncryption: boolean;
  geographicRestrictions: string[];
}

const dataHandlingPolicies: Record<DataClassification, DataHandlingPolicy> = {
  [DataClassification.PUBLIC]: {
    classification: DataClassification.PUBLIC,
    encryptionRequired: false,
    accessLogging: false,
    retentionDays: 365,
    backupEncryption: false,
    geographicRestrictions: []
  },
  [DataClassification.RESTRICTED]: {
    classification: DataClassification.RESTRICTED,
    encryptionRequired: true,
    accessLogging: true,
    retentionDays: 90,
    backupEncryption: true,
    geographicRestrictions: ['EU', 'US']
  }
};
```

### PII Data Protection
```typescript
import crypto from 'crypto';

// PII encryption service
export class PIIProtectionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivation = 'scrypt';
  
  async encryptPII(data: string, userId: string): Promise<string> {
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    // Derive key from master key + user-specific salt
    const key = await this.deriveKey(userId, salt);
    
    const cipher = crypto.createCipher(this.algorithm, key, { iv });
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }
  
  async decryptPII(encryptedData: string, userId: string): Promise<string> {
    const { encrypted, salt, iv, authTag } = JSON.parse(encryptedData);
    
    const key = await this.deriveKey(userId, Buffer.from(salt, 'hex'));
    
    const decipher = crypto.createDecipher(this.algorithm, key, {
      iv: Buffer.from(iv, 'hex')
    });
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  private async deriveKey(userId: string, salt: Buffer): Promise<Buffer> {
    const masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY!, 'hex');
    const userSalt = Buffer.concat([salt, Buffer.from(userId, 'utf8')]);
    
    return new Promise((resolve, reject) => {
      crypto.scrypt(masterKey, userSalt, 32, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }
}
```

## Network Security

### TLS Configuration
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grahmos-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-RSA-AES128-GCM-SHA256,ECDHE-RSA-AES256-GCM-SHA384,ECDHE-RSA-AES128-SHA256,ECDHE-RSA-AES256-SHA384"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - api.grahmos.com
        - app.grahmos.com
      secretName: grahmos-tls
  rules:
    - host: api.grahmos.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: grahmos-api
                port:
                  number: 8080
```

### Web Application Firewall (WAF)
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: waf-filter
spec:
  configPatches:
    - applyTo: HTTP_FILTER
      match:
        context: SIDECAR_INBOUND
        listener:
          filterChain:
            filter:
              name: "envoy.filters.network.http_connection_manager"
      patch:
        operation: INSERT_BEFORE
        value:
          name: envoy.filters.http.wasm
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.filters.http.wasm.v3.Wasm
            config:
              name: "waf"
              root_id: "waf_root"
              configuration:
                "@type": type.googleapis.com/google.protobuf.StringValue
                value: |
                  {
                    "rules": [
                      {
                        "id": 1,
                        "msg": "SQL Injection Attack",
                        "regex": "(?i)(union|select|insert|delete|update|create|drop|exec|script)",
                        "action": "block"
                      },
                      {
                        "id": 2,
                        "msg": "XSS Attack",
                        "regex": "(?i)(<script|javascript:|onload=|onerror=)",
                        "action": "block"
                      }
                    ]
                  }
```

## Monitoring & Logging

### Security Event Monitoring
```typescript
// Security event logger
export class SecurityEventLogger {
  private readonly logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'grahmos-security' },
    transports: [
      new winston.transports.File({ filename: 'security-events.log' }),
      new winston.transports.Console()
    ]
  });

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      severity: event.severity,
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      success: event.success,
      details: event.details,
      geolocation: await this.getGeolocation(event.ipAddress)
    };

    this.logger.info('Security Event', logEntry);

    // Send to SIEM if high severity
    if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
      await this.sendToSIEM(logEntry);
    }

    // Trigger alerts for suspicious activity
    if (this.isSuspiciousActivity(event)) {
      await this.triggerSecurityAlert(logEntry);
    }
  }

  private isSuspiciousActivity(event: SecurityEvent): boolean {
    // Multiple failed logins
    if (event.type === 'LOGIN_FAILED') {
      return this.checkFailedLoginThreshold(event.userId, event.ipAddress);
    }

    // Privilege escalation attempts
    if (event.type === 'PERMISSION_DENIED' && event.details.attemptedAction === 'admin') {
      return true;
    }

    // Unusual access patterns
    if (event.type === 'DATA_ACCESS') {
      return this.checkUnusualAccessPattern(event.userId, event.resource);
    }

    return false;
  }
}

interface SecurityEvent {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'PERMISSION_DENIED' | 'DATA_ACCESS' | 'SECURITY_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  resource: string;
  action: string;
  success: boolean;
  details: Record<string, any>;
}
```

### Intrusion Detection System
```typescript
// Behavioral analysis for intrusion detection
export class IntrusionDetectionSystem {
  private readonly behaviorAnalyzer = new BehaviorAnalyzer();
  private readonly alertManager = new AlertManager();

  async analyzeRequest(req: Request, user?: User): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];

    // Geographic analysis
    const geoRisk = await this.analyzeGeographicRisk(req.ip, user);
    if (geoRisk.score > 0.7) {
      riskFactors.push(geoRisk);
    }

    // Time-based analysis
    const timeRisk = this.analyzeTimeBasedRisk(user);
    if (timeRisk.score > 0.6) {
      riskFactors.push(timeRisk);
    }

    // Frequency analysis
    const frequencyRisk = await this.analyzeRequestFrequency(req.ip, user?.id);
    if (frequencyRisk.score > 0.8) {
      riskFactors.push(frequencyRisk);
    }

    // Device fingerprinting
    const deviceRisk = await this.analyzeDeviceFingerprint(req.headers, user);
    if (deviceRisk.score > 0.5) {
      riskFactors.push(deviceRisk);
    }

    const overallRisk = this.calculateOverallRisk(riskFactors);
    
    if (overallRisk.level === 'HIGH' || overallRisk.level === 'CRITICAL') {
      await this.alertManager.triggerIntrusionAlert(overallRisk, req, user);
    }

    return overallRisk;
  }

  private calculateOverallRisk(riskFactors: RiskFactor[]): RiskAssessment {
    if (riskFactors.length === 0) {
      return { level: 'LOW', score: 0, factors: [] };
    }

    const averageScore = riskFactors.reduce((sum, factor) => sum + factor.score, 0) / riskFactors.length;
    
    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (averageScore >= 0.9) level = 'CRITICAL';
    else if (averageScore >= 0.7) level = 'HIGH';
    else if (averageScore >= 0.4) level = 'MEDIUM';
    else level = 'LOW';

    return {
      level,
      score: averageScore,
      factors: riskFactors
    };
  }
}
```

## Compliance Frameworks

### GDPR Compliance
```typescript
// GDPR compliance implementation
export class GDPRComplianceService {
  async processDataSubjectRequest(request: DataSubjectRequest): Promise<DataSubjectResponse> {
    const { type, userId, email } = request;

    switch (type) {
      case 'ACCESS':
        return await this.handleDataAccessRequest(userId, email);
      
      case 'RECTIFICATION':
        return await this.handleDataRectificationRequest(userId, request.corrections);
      
      case 'ERASURE':
        return await this.handleDataErasureRequest(userId, request.retentionOverride);
      
      case 'PORTABILITY':
        return await this.handleDataPortabilityRequest(userId);
      
      case 'RESTRICTION':
        return await this.handleProcessingRestrictionRequest(userId, request.restrictions);
      
      default:
        throw new Error(`Unsupported data subject request type: ${type}`);
    }
  }

  private async handleDataAccessRequest(userId: string, email: string): Promise<DataSubjectResponse> {
    // Collect all personal data
    const userData = await this.collectAllUserData(userId);
    
    // Log the access request
    await this.logGDPRActivity({
      type: 'DATA_ACCESS_REQUEST',
      userId,
      email,
      timestamp: new Date(),
      processingTime: Date.now()
    });

    return {
      success: true,
      data: userData,
      message: 'Personal data export completed successfully'
    };
  }

  private async handleDataErasureRequest(userId: string, retentionOverride?: boolean): Promise<DataSubjectResponse> {
    // Check legal basis for retention
    const retentionRequirements = await this.checkRetentionRequirements(userId);
    
    if (retentionRequirements.length > 0 && !retentionOverride) {
      return {
        success: false,
        message: `Data cannot be erased due to legal obligations: ${retentionRequirements.join(', ')}`
      };
    }

    // Anonymize or delete personal data
    await this.anonymizeUserData(userId);
    
    // Log the erasure request
    await this.logGDPRActivity({
      type: 'DATA_ERASURE_REQUEST',
      userId,
      timestamp: new Date(),
      processingTime: Date.now()
    });

    return {
      success: true,
      message: 'Personal data has been erased successfully'
    };
  }

  async generateGDPRReport(): Promise<GDPRComplianceReport> {
    const activities = await this.getGDPRActivities();
    const dataBreaches = await this.getDataBreaches();
    const consentRecords = await this.getConsentRecords();

    return {
      reportDate: new Date(),
      totalDataSubjects: await this.getTotalDataSubjects(),
      dataSubjectRequests: activities.length,
      dataBreaches: dataBreaches.length,
      consentWithdrawals: consentRecords.filter(c => !c.consented).length,
      averageResponseTime: this.calculateAverageResponseTime(activities),
      complianceScore: this.calculateComplianceScore()
    };
  }
}
```

### SOC 2 Compliance
```typescript
// SOC 2 compliance controls
export class SOC2ComplianceService {
  // Security controls
  async validateSecurityControls(): Promise<ControlsAssessment> {
    const controls = [
      await this.assessAccessControls(),
      await this.assessAuthenticationControls(),
      await this.assessAuthorizationControls(),
      await this.assessDataEncryptionControls(),
      await this.assessNetworkSecurityControls(),
      await this.assessVulnerabilityManagementControls()
    ];

    return {
      timestamp: new Date(),
      controls,
      overallCompliance: this.calculateCompliancePercentage(controls),
      recommendations: this.generateRecommendations(controls)
    };
  }

  // Availability controls
  async validateAvailabilityControls(): Promise<ControlsAssessment> {
    const controls = [
      await this.assessSystemMonitoring(),
      await this.assessIncidentResponse(),
      await this.assessBackupAndRecovery(),
      await this.assessCapacityPlanning(),
      await this.assessChangeManagement()
    ];

    return {
      timestamp: new Date(),
      controls,
      overallCompliance: this.calculateCompliancePercentage(controls),
      recommendations: this.generateRecommendations(controls)
    };
  }

  // Processing integrity controls
  async validateProcessingIntegrityControls(): Promise<ControlsAssessment> {
    const controls = [
      await this.assessDataValidation(),
      await this.assessErrorHandling(),
      await this.assessDataIntegrity(),
      await this.assessTransactionProcessing(),
      await this.assessSystemInterfaces()
    ];

    return {
      timestamp: new Date(),
      controls,
      overallCompliance: this.calculateCompliancePercentage(controls),
      recommendations: this.generateRecommendations(controls)
    };
  }

  // Confidentiality controls
  async validateConfidentialityControls(): Promise<ControlsAssessment> {
    const controls = [
      await this.assessDataClassification(),
      await this.assessDataHandling(),
      await this.assessDataRetention(),
      await this.assessDataDisposal(),
      await this.assessNonDisclosureAgreements()
    ];

    return {
      timestamp: new Date(),
      controls,
      overallCompliance: this.calculateCompliancePercentage(controls),
      recommendations: this.generateRecommendations(controls)
    };
  }

  async generateSOC2Report(): Promise<SOC2Report> {
    const [security, availability, processing, confidentiality] = await Promise.all([
      this.validateSecurityControls(),
      this.validateAvailabilityControls(),
      this.validateProcessingIntegrityControls(),
      this.validateConfidentialityControls()
    ]);

    return {
      reportDate: new Date(),
      reportingPeriod: {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      },
      security,
      availability,
      processingIntegrity: processing,
      confidentiality,
      overallCompliance: (
        security.overallCompliance +
        availability.overallCompliance +
        processing.overallCompliance +
        confidentiality.overallCompliance
      ) / 4,
      auditTrail: await this.getAuditTrail(),
      exceptions: await this.getComplianceExceptions()
    };
  }
}
```

## Incident Response

### Security Incident Response Plan
```typescript
export class IncidentResponseService {
  async handleSecurityIncident(incident: SecurityIncident): Promise<IncidentResponse> {
    // 1. Detection and Analysis
    const analysis = await this.analyzeIncident(incident);
    
    // 2. Containment
    const containmentActions = await this.containIncident(incident, analysis);
    
    // 3. Eradication
    const eradicationActions = await this.eradicateThreats(incident, analysis);
    
    // 4. Recovery
    const recoveryActions = await this.recoverSystems(incident);
    
    // 5. Post-Incident Activities
    const postIncidentReport = await this.generatePostIncidentReport(
      incident,
      analysis,
      [...containmentActions, ...eradicationActions, ...recoveryActions]
    );

    // Notify stakeholders
    await this.notifyStakeholders(incident, analysis);

    return {
      incidentId: incident.id,
      status: 'RESOLVED',
      timeline: {
        detected: incident.detectedAt,
        contained: containmentActions[0]?.completedAt,
        eradicated: eradicationActions[eradicationActions.length - 1]?.completedAt,
        recovered: recoveryActions[recoveryActions.length - 1]?.completedAt,
        closed: new Date()
      },
      actions: [...containmentActions, ...eradicationActions, ...recoveryActions],
      report: postIncidentReport
    };
  }

  private async containIncident(
    incident: SecurityIncident,
    analysis: IncidentAnalysis
  ): Promise<ContainmentAction[]> {
    const actions: ContainmentAction[] = [];

    // Isolate affected systems
    if (analysis.affectedSystems.length > 0) {
      actions.push(await this.isolateSystems(analysis.affectedSystems));
    }

    // Block malicious IP addresses
    if (analysis.maliciousIPs.length > 0) {
      actions.push(await this.blockIPAddresses(analysis.maliciousIPs));
    }

    // Disable compromised accounts
    if (analysis.compromisedAccounts.length > 0) {
      actions.push(await this.disableAccounts(analysis.compromisedAccounts));
    }

    // Preserve evidence
    actions.push(await this.preserveEvidence(incident, analysis));

    return actions;
  }

  private async eradicateThreats(
    incident: SecurityIncident,
    analysis: IncidentAnalysis
  ): Promise<EradicationAction[]> {
    const actions: EradicationAction[] = [];

    // Remove malware
    if (analysis.malwareDetected) {
      actions.push(await this.removeMalware(analysis.affectedSystems));
    }

    // Close security vulnerabilities
    if (analysis.exploitedVulnerabilities.length > 0) {
      actions.push(await this.patchVulnerabilities(analysis.exploitedVulnerabilities));
    }

    // Update security controls
    actions.push(await this.updateSecurityControls(analysis));

    return actions;
  }

  private async recoverSystems(incident: SecurityIncident): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];

    // Restore from backups if necessary
    if (incident.type === 'DATA_BREACH' || incident.type === 'RANSOMWARE') {
      actions.push(await this.restoreFromBackups());
    }

    // Rebuild compromised systems
    actions.push(await this.rebuildSystems());

    // Validate system integrity
    actions.push(await this.validateSystemIntegrity());

    // Monitor for indicators of compromise
    actions.push(await this.implementEnhancedMonitoring());

    return actions;
  }
}

interface SecurityIncident {
  id: string;
  type: 'DATA_BREACH' | 'MALWARE' | 'PHISHING' | 'DDoS' | 'INSIDER_THREAT' | 'RANSOMWARE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedAt: Date;
  description: string;
  affectedSystems: string[];
  reportedBy: string;
  initialIndicators: string[];
}
```

## Security Policies

### Password Policy
```typescript
export const passwordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  prohibitCommonPasswords: true,
  prohibitPersonalInfo: true,
  historySize: 12, // Remember last 12 passwords
  maxAge: 90, // Force change every 90 days
  lockoutThreshold: 5, // Lock after 5 failed attempts
  lockoutDuration: 30 * 60, // 30 minutes lockout
  complexityScore: 60 // Minimum complexity score required
};

export const validatePassword = (password: string, userInfo?: any): PasswordValidationResult => {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < passwordPolicy.minLength) {
    errors.push(`Password must be at least ${passwordPolicy.minLength} characters long`);
  } else if (password.length > passwordPolicy.maxLength) {
    errors.push(`Password must not exceed ${passwordPolicy.maxLength} characters`);
  } else {
    score += Math.min(password.length * 2, 20);
  }

  // Character requirements
  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    score += 5;
  }

  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    score += 5;
  }

  if (passwordPolicy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/\d/.test(password)) {
    score += 5;
  }

  if (passwordPolicy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 10;
  }

  // Common passwords check
  if (passwordPolicy.prohibitCommonPasswords && isCommonPassword(password)) {
    errors.push('Password is too common and easily guessed');
  }

  // Personal information check
  if (passwordPolicy.prohibitPersonalInfo && userInfo && containsPersonalInfo(password, userInfo)) {
    errors.push('Password must not contain personal information');
  }

  // Complexity score check
  if (score < passwordPolicy.complexityScore) {
    errors.push('Password does not meet complexity requirements');
  }

  return {
    isValid: errors.length === 0,
    errors,
    score,
    strength: getPasswordStrength(score)
  };
};
```

### Data Retention Policy
```typescript
export const dataRetentionPolicy = {
  userAccounts: {
    activeRetention: '7 years',
    inactiveRetention: '3 years',
    deletionGracePeriod: '30 days'
  },
  auditLogs: {
    securityLogs: '7 years',
    accessLogs: '2 years',
    applicationLogs: '1 year'
  },
  backups: {
    dailyBackups: '90 days',
    weeklyBackups: '52 weeks',
    monthlyBackups: '7 years'
  },
  personalData: {
    consentBased: 'Until consent withdrawn + 30 days',
    contractBased: 'Contract duration + 6 years',
    legalObligation: 'As required by applicable law'
  }
};

export class DataRetentionService {
  async enforceRetentionPolicy(): Promise<RetentionReport> {
    const report: RetentionReport = {
      executionDate: new Date(),
      actions: [],
      summary: {
        recordsReviewed: 0,
        recordsRetained: 0,
        recordsDeleted: 0,
        recordsArchived: 0
      }
    };

    // Review user accounts
    const userAccountActions = await this.reviewUserAccounts();
    report.actions.push(...userAccountActions);

    // Review audit logs
    const auditLogActions = await this.reviewAuditLogs();
    report.actions.push(...auditLogActions);

    // Review backups
    const backupActions = await this.reviewBackups();
    report.actions.push(...backupActions);

    // Calculate summary
    report.summary = this.calculateSummary(report.actions);

    return report;
  }
}
```

## Continuous Security

### Security Monitoring Dashboard
```typescript
export class SecurityDashboardService {
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const [
      threatIntelligence,
      vulnerabilities,
      incidents,
      compliance,
      userBehavior
    ] = await Promise.all([
      this.getThreatIntelligenceMetrics(),
      this.getVulnerabilityMetrics(),
      this.getIncidentMetrics(),
      this.getComplianceMetrics(),
      this.getUserBehaviorMetrics()
    ]);

    return {
      timestamp: new Date(),
      threatIntelligence,
      vulnerabilities,
      incidents,
      compliance,
      userBehavior,
      overallSecurityScore: this.calculateSecurityScore([
        threatIntelligence.score,
        vulnerabilities.score,
        incidents.score,
        compliance.score,
        userBehavior.score
      ])
    };
  }

  private calculateSecurityScore(scores: number[]): number {
    const weights = [0.2, 0.25, 0.2, 0.2, 0.15]; // Weighted average
    return scores.reduce((sum, score, index) => sum + (score * weights[index]), 0);
  }
}
```

### Automated Security Testing
```typescript
export class SecurityTestingService {
  async runSecurityTests(): Promise<SecurityTestResults> {
    const results: SecurityTestResults = {
      timestamp: new Date(),
      tests: []
    };

    // SAST (Static Application Security Testing)
    results.tests.push(await this.runSASTScan());

    // DAST (Dynamic Application Security Testing)
    results.tests.push(await this.runDASTScan());

    // SCA (Software Composition Analysis)
    results.tests.push(await this.runSCAScan());

    // Infrastructure security testing
    results.tests.push(await this.runInfrastructureSecurityScan());

    // Container security testing
    results.tests.push(await this.runContainerSecurityScan());

    return results;
  }
}
```

This comprehensive security hardening and compliance configuration provides enterprise-grade security for the Grahmos platform, covering all major aspects of application security, data protection, compliance, and continuous monitoring.
