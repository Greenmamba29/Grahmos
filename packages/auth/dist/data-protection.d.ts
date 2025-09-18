/**
 * Grahmos Data Protection and Encryption Services
 * Comprehensive data protection, classification, and encryption implementation
 */
export declare enum DataClassification {
    PUBLIC = "PUBLIC",
    INTERNAL = "INTERNAL",
    CONFIDENTIAL = "CONFIDENTIAL",
    RESTRICTED = "RESTRICTED"
}
export declare enum DataType {
    PII = "PII",// Personally Identifiable Information
    PHI = "PHI",// Protected Health Information
    FINANCIAL = "FINANCIAL",// Financial data
    CREDENTIALS = "CREDENTIALS",// Passwords, tokens, keys
    BIOMETRIC = "BIOMETRIC",// Biometric data
    BEHAVIORAL = "BEHAVIORAL",// User behavior data
    TECHNICAL = "TECHNICAL",// Technical system data
    BUSINESS = "BUSINESS"
}
export interface DataHandlingPolicy {
    classification: DataClassification;
    dataType: DataType;
    encryptionRequired: boolean;
    encryptionAlgorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305' | 'AES-256-CBC';
    keyRotationDays: number;
    accessLogging: boolean;
    auditTrail: boolean;
    retentionDays: number;
    backupEncryption: boolean;
    geographicRestrictions: string[];
    minimumSecurityClearance: string;
    anonymizationRequired: boolean;
    pseudonymizationAllowed: boolean;
}
export interface EncryptionMetadata {
    algorithm: string;
    keyVersion: string;
    iv: string;
    authTag?: string;
    salt: string;
    timestamp: Date;
    dataType: DataType;
    classification: DataClassification;
}
export interface DecryptionContext {
    userId?: string;
    purpose: string;
    accessLevel: string;
    ipAddress: string;
    sessionId: string;
}
declare class KeyManagementService {
    private masterKeys;
    private keyVersions;
    private keyRotationSchedule;
    constructor();
    private initializeMasterKeys;
    private generateSecureKey;
    deriveKey(context: string, salt: Buffer, keyLength?: number): Promise<Buffer>;
    getKeyVersion(keyName?: string): string;
    rotateKey(keyName?: string): Promise<void>;
    private incrementVersion;
    private getKeyRotationPolicy;
    checkRotationSchedule(): Promise<void>;
}
declare class AdvancedEncryptionService {
    private keyManager;
    constructor(keyManager: KeyManagementService);
    encryptData(data: string, classification: DataClassification, dataType: DataType, context?: string): Promise<{
        encryptedData: string;
        metadata: EncryptionMetadata;
    }>;
    decryptData(encryptedData: string, metadata: EncryptionMetadata, context?: string, decryptionContext?: DecryptionContext): Promise<string>;
    private encryptAESGCM;
    private decryptAESGCM;
    private encryptChaCha20Poly1305;
    private decryptChaCha20Poly1305;
    private encryptAESCBC;
    private decryptAESCBC;
    private getDataHandlingPolicy;
    private logDataAccess;
}
declare class PIIProtectionService {
    private encryptionService;
    constructor(encryptionService: AdvancedEncryptionService);
    protectPII(data: any, classification?: DataClassification): Promise<any>;
    unprotectPII(data: any, context?: DecryptionContext): Promise<any>;
    anonymizeData(data: any, anonymizationLevel?: 'partial' | 'full'): any;
    private anonymizeEmail;
    private anonymizePhone;
    private anonymizeSSN;
    private anonymizeCreditCard;
    pseudonymizeData(data: any, salt?: string): any;
    private generatePseudonym;
}
declare class DataLossPreventionService {
    private sensitivePatterns;
    constructor();
    private initializeSensitivePatterns;
    scanForSensitiveData(content: string): {
        found: boolean;
        violations: Array<{
            type: DataType;
            matches: string[];
        }>;
    };
    sanitizeContent(content: string, redactionLevel?: 'mask' | 'remove'): string;
    classifyDataSensitivity(data: any): DataClassification;
}
declare class SecureDataStorageService {
    private encryptionService;
    private piiService;
    private dlpService;
    constructor(encryptionService: AdvancedEncryptionService, piiService: PIIProtectionService, dlpService: DataLossPreventionService);
    secureStore(data: any, dataType: DataType, userContext?: string): Promise<any>;
    secureRetrieve(storedData: any, context?: DecryptionContext): Promise<any>;
    private getDataHandlingPolicy;
}
declare const keyManager: KeyManagementService;
declare const encryptionService: AdvancedEncryptionService;
declare const piiService: PIIProtectionService;
declare const dlpService: DataLossPreventionService;
declare const secureStorage: SecureDataStorageService;
export { KeyManagementService, AdvancedEncryptionService, PIIProtectionService, DataLossPreventionService, SecureDataStorageService, keyManager, encryptionService, piiService, dlpService, secureStorage };
//# sourceMappingURL=data-protection.d.ts.map