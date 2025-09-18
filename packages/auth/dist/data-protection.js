/**
 * Grahmos Data Protection and Encryption Services
 * Comprehensive data protection, classification, and encryption implementation
 */
import crypto from 'crypto';
import { promisify } from 'util';
import { createHmac, randomBytes, scrypt as scryptCallback } from 'crypto';
const scrypt = promisify(scryptCallback);
// Data Classification System
export var DataClassification;
(function (DataClassification) {
    DataClassification["PUBLIC"] = "PUBLIC";
    DataClassification["INTERNAL"] = "INTERNAL";
    DataClassification["CONFIDENTIAL"] = "CONFIDENTIAL";
    DataClassification["RESTRICTED"] = "RESTRICTED";
})(DataClassification || (DataClassification = {}));
export var DataType;
(function (DataType) {
    DataType["PII"] = "PII";
    DataType["PHI"] = "PHI";
    DataType["FINANCIAL"] = "FINANCIAL";
    DataType["CREDENTIALS"] = "CREDENTIALS";
    DataType["BIOMETRIC"] = "BIOMETRIC";
    DataType["BEHAVIORAL"] = "BEHAVIORAL";
    DataType["TECHNICAL"] = "TECHNICAL";
    DataType["BUSINESS"] = "BUSINESS"; // Business data
})(DataType || (DataType = {}));
// Data Handling Policies Configuration
const dataHandlingPolicies = {
    [`${DataClassification.RESTRICTED}_${DataType.PII}`]: {
        classification: DataClassification.RESTRICTED,
        dataType: DataType.PII,
        encryptionRequired: true,
        encryptionAlgorithm: 'AES-256-GCM',
        keyRotationDays: 30,
        accessLogging: true,
        auditTrail: true,
        retentionDays: 90,
        backupEncryption: true,
        geographicRestrictions: ['EU', 'US'],
        minimumSecurityClearance: 'HIGH',
        anonymizationRequired: true,
        pseudonymizationAllowed: true
    },
    [`${DataClassification.RESTRICTED}_${DataType.CREDENTIALS}`]: {
        classification: DataClassification.RESTRICTED,
        dataType: DataType.CREDENTIALS,
        encryptionRequired: true,
        encryptionAlgorithm: 'ChaCha20-Poly1305',
        keyRotationDays: 7,
        accessLogging: true,
        auditTrail: true,
        retentionDays: 30,
        backupEncryption: true,
        geographicRestrictions: [],
        minimumSecurityClearance: 'CRITICAL',
        anonymizationRequired: false,
        pseudonymizationAllowed: false
    },
    [`${DataClassification.CONFIDENTIAL}_${DataType.FINANCIAL}`]: {
        classification: DataClassification.CONFIDENTIAL,
        dataType: DataType.FINANCIAL,
        encryptionRequired: true,
        encryptionAlgorithm: 'AES-256-GCM',
        keyRotationDays: 90,
        accessLogging: true,
        auditTrail: true,
        retentionDays: 2555, // 7 years
        backupEncryption: true,
        geographicRestrictions: ['US', 'CA'],
        minimumSecurityClearance: 'MEDIUM',
        anonymizationRequired: false,
        pseudonymizationAllowed: true
    },
    [`${DataClassification.INTERNAL}_${DataType.BUSINESS}`]: {
        classification: DataClassification.INTERNAL,
        dataType: DataType.BUSINESS,
        encryptionRequired: true,
        encryptionAlgorithm: 'AES-256-CBC',
        keyRotationDays: 180,
        accessLogging: false,
        auditTrail: false,
        retentionDays: 1825, // 5 years
        backupEncryption: false,
        geographicRestrictions: [],
        minimumSecurityClearance: 'LOW',
        anonymizationRequired: false,
        pseudonymizationAllowed: false
    },
    [`${DataClassification.PUBLIC}_${DataType.TECHNICAL}`]: {
        classification: DataClassification.PUBLIC,
        dataType: DataType.TECHNICAL,
        encryptionRequired: false,
        encryptionAlgorithm: 'AES-256-CBC',
        keyRotationDays: 365,
        accessLogging: false,
        auditTrail: false,
        retentionDays: 365,
        backupEncryption: false,
        geographicRestrictions: [],
        minimumSecurityClearance: 'NONE',
        anonymizationRequired: false,
        pseudonymizationAllowed: false
    }
};
// Master Key Management Service
class KeyManagementService {
    masterKeys = new Map();
    keyVersions = new Map();
    keyRotationSchedule = new Map();
    constructor() {
        this.initializeMasterKeys();
    }
    initializeMasterKeys() {
        // In production, these would be loaded from a secure key management system (AWS KMS, HashiCorp Vault, etc.)
        const masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY || this.generateSecureKey(), 'hex');
        const backupKey = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || this.generateSecureKey(), 'hex');
        this.masterKeys.set('primary', masterKey);
        this.masterKeys.set('backup', backupKey);
        this.keyVersions.set('primary', '1.0');
        this.keyVersions.set('backup', '1.0');
        // Schedule key rotation
        this.keyRotationSchedule.set('primary', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
        this.keyRotationSchedule.set('backup', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));
    }
    generateSecureKey() {
        return randomBytes(32).toString('hex');
    }
    async deriveKey(context, salt, keyLength = 32) {
        const masterKey = this.masterKeys.get('primary');
        if (!masterKey) {
            throw new Error('Master key not available');
        }
        const contextBuffer = Buffer.from(context, 'utf8');
        const derivationSalt = Buffer.concat([salt, contextBuffer]);
        const result = await scrypt(masterKey, derivationSalt, keyLength);
        return result;
    }
    getKeyVersion(keyName = 'primary') {
        return this.keyVersions.get(keyName) || '1.0';
    }
    async rotateKey(keyName = 'primary') {
        const newKey = Buffer.from(this.generateSecureKey(), 'hex');
        const currentVersion = this.getKeyVersion(keyName);
        const newVersion = this.incrementVersion(currentVersion);
        // Store old key with version suffix for decryption of existing data
        this.masterKeys.set(`${keyName}_${currentVersion}`, this.masterKeys.get(keyName));
        // Update to new key
        this.masterKeys.set(keyName, newKey);
        this.keyVersions.set(keyName, newVersion);
        // Schedule next rotation
        const policy = this.getKeyRotationPolicy(keyName);
        this.keyRotationSchedule.set(keyName, new Date(Date.now() + policy.rotationDays * 24 * 60 * 60 * 1000));
        console.log(`Key ${keyName} rotated to version ${newVersion}`);
    }
    incrementVersion(version) {
        const [major, minor] = version.split('.').map(Number);
        return `${major}.${minor + 1}`;
    }
    getKeyRotationPolicy(keyName) {
        // Default rotation policy
        return { rotationDays: 30 };
    }
    async checkRotationSchedule() {
        const now = new Date();
        for (const [keyName, rotationDate] of this.keyRotationSchedule.entries()) {
            if (now >= rotationDate) {
                await this.rotateKey(keyName);
            }
        }
    }
}
// Advanced Encryption Service
class AdvancedEncryptionService {
    keyManager;
    constructor(keyManager) {
        this.keyManager = keyManager;
    }
    async encryptData(data, classification, dataType, context = 'default') {
        const policy = this.getDataHandlingPolicy(classification, dataType);
        if (!policy.encryptionRequired) {
            return {
                encryptedData: data,
                metadata: {
                    algorithm: 'none',
                    keyVersion: '0.0',
                    iv: '',
                    salt: '',
                    timestamp: new Date(),
                    dataType,
                    classification
                }
            };
        }
        const salt = randomBytes(16);
        const iv = randomBytes(16);
        const key = await this.keyManager.deriveKey(context, salt);
        let encryptedBuffer;
        let authTag;
        switch (policy.encryptionAlgorithm) {
            case 'AES-256-GCM':
                ({ encryptedBuffer, authTag } = this.encryptAESGCM(data, key, iv));
                break;
            case 'ChaCha20-Poly1305':
                ({ encryptedBuffer, authTag } = this.encryptChaCha20Poly1305(data, key, iv));
                break;
            case 'AES-256-CBC':
                encryptedBuffer = this.encryptAESCBC(data, key, iv);
                break;
            default:
                throw new Error(`Unsupported encryption algorithm: ${policy.encryptionAlgorithm}`);
        }
        const metadata = {
            algorithm: policy.encryptionAlgorithm,
            keyVersion: this.keyManager.getKeyVersion(),
            iv: iv.toString('hex'),
            authTag: authTag?.toString('hex'),
            salt: salt.toString('hex'),
            timestamp: new Date(),
            dataType,
            classification
        };
        return {
            encryptedData: encryptedBuffer.toString('base64'),
            metadata
        };
    }
    async decryptData(encryptedData, metadata, context = 'default', decryptionContext) {
        // Log access if required by policy
        const policy = this.getDataHandlingPolicy(metadata.classification, metadata.dataType);
        if (policy.accessLogging && decryptionContext) {
            await this.logDataAccess(metadata, decryptionContext);
        }
        if (metadata.algorithm === 'none') {
            return encryptedData;
        }
        const salt = Buffer.from(metadata.salt, 'hex');
        const iv = Buffer.from(metadata.iv, 'hex');
        const authTag = metadata.authTag ? Buffer.from(metadata.authTag, 'hex') : undefined;
        const encryptedBuffer = Buffer.from(encryptedData, 'base64');
        const key = await this.keyManager.deriveKey(context, salt);
        let decryptedData;
        switch (metadata.algorithm) {
            case 'AES-256-GCM':
                if (!authTag)
                    throw new Error('Auth tag required for AES-GCM');
                decryptedData = this.decryptAESGCM(encryptedBuffer, key, iv, authTag);
                break;
            case 'ChaCha20-Poly1305':
                if (!authTag)
                    throw new Error('Auth tag required for ChaCha20-Poly1305');
                decryptedData = this.decryptChaCha20Poly1305(encryptedBuffer, key, iv, authTag);
                break;
            case 'AES-256-CBC':
                decryptedData = this.decryptAESCBC(encryptedBuffer, key, iv);
                break;
            default:
                throw new Error(`Unsupported decryption algorithm: ${metadata.algorithm}`);
        }
        return decryptedData;
    }
    encryptAESGCM(data, key, iv) {
        const cipher = crypto.createCipher('aes-256-gcm', key);
        let encrypted = cipher.update(data, 'utf8');
        const final = cipher.final();
        const encryptedBuffer = Buffer.concat([encrypted, final]);
        const authTag = cipher.getAuthTag();
        return { encryptedBuffer, authTag };
    }
    decryptAESGCM(encryptedBuffer, key, iv, authTag) {
        const decipher = crypto.createDecipher('aes-256-gcm', key);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedBuffer);
        const final = decipher.final();
        return Buffer.concat([decrypted, final]).toString('utf8');
    }
    encryptChaCha20Poly1305(data, key, iv) {
        // Note: Using AES-GCM as fallback since ChaCha20-Poly1305 requires additional library
        // In production, use a library like 'node-sodium' or 'tweetnacl'
        const cipher = crypto.createCipher('aes-256-gcm', key);
        let encrypted = cipher.update(data, 'utf8');
        const final = cipher.final();
        const encryptedBuffer = Buffer.concat([encrypted, final]);
        const authTag = cipher.getAuthTag();
        return { encryptedBuffer, authTag };
    }
    decryptChaCha20Poly1305(encryptedBuffer, key, iv, authTag) {
        // Note: Using AES-GCM as fallback since ChaCha20-Poly1305 requires additional library
        const decipher = crypto.createDecipher('aes-256-gcm', key);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedBuffer);
        const final = decipher.final();
        return Buffer.concat([decrypted, final]).toString('utf8');
    }
    encryptAESCBC(data, key, iv) {
        const cipher = crypto.createCipher('aes-256-cbc', key.toString('hex'));
        let encrypted = cipher.update(data, 'utf8');
        const final = cipher.final();
        return Buffer.concat([encrypted, final]);
    }
    decryptAESCBC(encryptedBuffer, key, iv) {
        const decipher = crypto.createDecipher('aes-256-cbc', key.toString('hex'));
        let decrypted = decipher.update(encryptedBuffer);
        const final = decipher.final();
        return Buffer.concat([decrypted, final]).toString('utf8');
    }
    getDataHandlingPolicy(classification, dataType) {
        const key = `${classification}_${dataType}`;
        return dataHandlingPolicies[key] || dataHandlingPolicies[`${DataClassification.INTERNAL}_${DataType.BUSINESS}`];
    }
    async logDataAccess(metadata, context) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            dataType: metadata.dataType,
            classification: metadata.classification,
            algorithm: metadata.algorithm,
            keyVersion: metadata.keyVersion,
            userId: context.userId,
            purpose: context.purpose,
            accessLevel: context.accessLevel,
            ipAddress: context.ipAddress,
            sessionId: context.sessionId
        };
        // In production, send to audit logging service
        console.log('[DATA ACCESS LOG]', JSON.stringify(logEntry));
    }
}
// PII Protection and Anonymization Service
class PIIProtectionService {
    encryptionService;
    constructor(encryptionService) {
        this.encryptionService = encryptionService;
    }
    async protectPII(data, classification = DataClassification.RESTRICTED) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        const protectedData = { ...data };
        // Define PII fields that need protection
        const piiFields = [
            'email', 'phone', 'ssn', 'creditCard', 'bankAccount',
            'firstName', 'lastName', 'address', 'zipCode', 'dateOfBirth'
        ];
        for (const field of piiFields) {
            if (protectedData[field]) {
                const { encryptedData, metadata } = await this.encryptionService.encryptData(String(protectedData[field]), classification, DataType.PII, `pii_${field}`);
                protectedData[field] = {
                    encrypted: encryptedData,
                    metadata: metadata
                };
            }
        }
        return protectedData;
    }
    async unprotectPII(data, context) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        const unprotected = { ...data };
        for (const [key, value] of Object.entries(unprotected)) {
            if (value && typeof value === 'object' && 'encrypted' in value && 'metadata' in value) {
                try {
                    unprotected[key] = await this.encryptionService.decryptData(value.encrypted, value.metadata, `pii_${key}`, context);
                }
                catch (error) {
                    console.error(`Failed to decrypt PII field ${key}:`, error);
                    unprotected[key] = '[DECRYPTION_FAILED]';
                }
            }
        }
        return unprotected;
    }
    anonymizeData(data, anonymizationLevel = 'partial') {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        const anonymized = { ...data };
        // Define anonymization rules
        const anonymizationRules = {
            email: (email) => this.anonymizeEmail(email, anonymizationLevel),
            phone: (phone) => this.anonymizePhone(phone, anonymizationLevel),
            ssn: (ssn) => this.anonymizeSSN(ssn),
            creditCard: (cc) => this.anonymizeCreditCard(cc),
            firstName: (name) => anonymizationLevel === 'full' ? 'REDACTED' : name[0] + '*'.repeat(name.length - 1),
            lastName: (name) => anonymizationLevel === 'full' ? 'REDACTED' : name[0] + '*'.repeat(name.length - 1),
            address: () => anonymizationLevel === 'full' ? 'REDACTED' : 'PARTIAL_ADDRESS',
            zipCode: (zip) => anonymizationLevel === 'full' ? 'REDACTED' : zip.substring(0, 3) + 'XX'
        };
        for (const [field, rule] of Object.entries(anonymizationRules)) {
            if (anonymized[field] && typeof anonymized[field] === 'string') {
                anonymized[field] = rule(anonymized[field]);
            }
        }
        return anonymized;
    }
    anonymizeEmail(email, level) {
        if (level === 'full')
            return 'REDACTED@REDACTED.com';
        const [local, domain] = email.split('@');
        const anonymizedLocal = local[0] + '*'.repeat(Math.max(local.length - 2, 0)) + (local.length > 1 ? local[local.length - 1] : '');
        const [domainName, tld] = domain.split('.');
        const anonymizedDomain = domainName[0] + '*'.repeat(Math.max(domainName.length - 2, 0)) + (domainName.length > 1 ? domainName[domainName.length - 1] : '');
        return `${anonymizedLocal}@${anonymizedDomain}.${tld}`;
    }
    anonymizePhone(phone, level) {
        if (level === 'full')
            return 'REDACTED';
        const digits = phone.replace(/\D/g, '');
        if (digits.length >= 10) {
            return `${digits.substring(0, 3)}-XXX-${digits.substring(digits.length - 4)}`;
        }
        return 'XXX-XXX-XXXX';
    }
    anonymizeSSN(ssn) {
        const digits = ssn.replace(/\D/g, '');
        if (digits.length === 9) {
            return `XXX-XX-${digits.substring(5)}`;
        }
        return 'XXX-XX-XXXX';
    }
    anonymizeCreditCard(cc) {
        const digits = cc.replace(/\D/g, '');
        if (digits.length >= 13) {
            return `XXXX-XXXX-XXXX-${digits.substring(digits.length - 4)}`;
        }
        return 'XXXX-XXXX-XXXX-XXXX';
    }
    pseudonymizeData(data, salt = 'default') {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        const pseudonymized = { ...data };
        // Define fields that should be pseudonymized
        const pseudonymizableFields = ['email', 'phone', 'username', 'userId'];
        for (const field of pseudonymizableFields) {
            if (pseudonymized[field] && typeof pseudonymized[field] === 'string') {
                pseudonymized[field] = this.generatePseudonym(pseudonymized[field], salt);
            }
        }
        return pseudonymized;
    }
    generatePseudonym(value, salt) {
        const hash = createHmac('sha256', salt).update(value).digest('hex');
        return `pseudo_${hash.substring(0, 16)}`;
    }
}
// Data Loss Prevention Service
class DataLossPreventionService {
    sensitivePatterns = new Map();
    constructor() {
        this.initializeSensitivePatterns();
    }
    initializeSensitivePatterns() {
        this.sensitivePatterns.set(DataType.PII, [
            /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
            /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
            /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g // Date of Birth
        ]);
        this.sensitivePatterns.set(DataType.FINANCIAL, [
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit Card
            /\b\d{9,18}\b/g, // Bank Account
            /\$\d{1,3}(,\d{3})*(\.\d{2})?\b/g // Currency amounts
        ]);
        this.sensitivePatterns.set(DataType.CREDENTIALS, [
            /password[:\s]*[^\s\n]+/gi, // Passwords
            /token[:\s]*[^\s\n]+/gi, // Tokens
            /key[:\s]*[^\s\n]+/gi, // API Keys
            /secret[:\s]*[^\s\n]+/gi // Secrets
        ]);
    }
    scanForSensitiveData(content) {
        const violations = [];
        for (const [dataType, patterns] of this.sensitivePatterns.entries()) {
            const matches = [];
            for (const pattern of patterns) {
                const found = content.match(pattern);
                if (found) {
                    matches.push(...found);
                }
            }
            if (matches.length > 0) {
                violations.push({ type: dataType, matches });
            }
        }
        return {
            found: violations.length > 0,
            violations
        };
    }
    sanitizeContent(content, redactionLevel = 'mask') {
        let sanitized = content;
        for (const [dataType, patterns] of this.sensitivePatterns.entries()) {
            for (const pattern of patterns) {
                if (redactionLevel === 'remove') {
                    sanitized = sanitized.replace(pattern, '');
                }
                else {
                    sanitized = sanitized.replace(pattern, (match) => '[REDACTED]');
                }
            }
        }
        return sanitized;
    }
    classifyDataSensitivity(data) {
        const content = JSON.stringify(data);
        const scanResult = this.scanForSensitiveData(content);
        if (!scanResult.found) {
            return DataClassification.PUBLIC;
        }
        // Check for restricted data types
        const hasRestrictedData = scanResult.violations.some(v => [DataType.PII, DataType.PHI, DataType.CREDENTIALS, DataType.BIOMETRIC].includes(v.type));
        if (hasRestrictedData) {
            return DataClassification.RESTRICTED;
        }
        // Check for confidential data types
        const hasConfidentialData = scanResult.violations.some(v => [DataType.FINANCIAL].includes(v.type));
        if (hasConfidentialData) {
            return DataClassification.CONFIDENTIAL;
        }
        return DataClassification.INTERNAL;
    }
}
// Secure Data Storage Service
class SecureDataStorageService {
    encryptionService;
    piiService;
    dlpService;
    constructor(encryptionService, piiService, dlpService) {
        this.encryptionService = encryptionService;
        this.piiService = piiService;
        this.dlpService = dlpService;
    }
    async secureStore(data, dataType, userContext) {
        // Classify data sensitivity
        const classification = this.dlpService.classifyDataSensitivity(data);
        // Protect PII data
        let securedData = data;
        if (dataType === DataType.PII || classification === DataClassification.RESTRICTED) {
            securedData = await this.piiService.protectPII(data, classification);
        }
        // Encrypt if required by policy
        const policy = this.getDataHandlingPolicy(classification, dataType);
        if (policy.encryptionRequired) {
            const { encryptedData, metadata } = await this.encryptionService.encryptData(JSON.stringify(securedData), classification, dataType, userContext || 'default');
            return {
                encrypted: true,
                data: encryptedData,
                metadata,
                classification,
                dataType,
                storedAt: new Date()
            };
        }
        return {
            encrypted: false,
            data: securedData,
            classification,
            dataType,
            storedAt: new Date()
        };
    }
    async secureRetrieve(storedData, context) {
        if (!storedData.encrypted) {
            return storedData.data;
        }
        // Decrypt data
        const decryptedJson = await this.encryptionService.decryptData(storedData.data, storedData.metadata, 'default', context);
        let parsedData = JSON.parse(decryptedJson);
        // Unprotect PII if applicable
        if (storedData.dataType === DataType.PII || storedData.classification === DataClassification.RESTRICTED) {
            parsedData = await this.piiService.unprotectPII(parsedData, context);
        }
        return parsedData;
    }
    getDataHandlingPolicy(classification, dataType) {
        const key = `${classification}_${dataType}`;
        return dataHandlingPolicies[key] || dataHandlingPolicies[`${DataClassification.INTERNAL}_${DataType.BUSINESS}`];
    }
}
// Create and export service instances
const keyManager = new KeyManagementService();
const encryptionService = new AdvancedEncryptionService(keyManager);
const piiService = new PIIProtectionService(encryptionService);
const dlpService = new DataLossPreventionService();
const secureStorage = new SecureDataStorageService(encryptionService, piiService, dlpService);
// Export everything
export { KeyManagementService, AdvancedEncryptionService, PIIProtectionService, DataLossPreventionService, SecureDataStorageService, keyManager, encryptionService, piiService, dlpService, secureStorage };
//# sourceMappingURL=data-protection.js.map