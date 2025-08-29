# Certificate Management & Code Signing Infrastructure

## Overview
This directory contains the infrastructure for managing certificates and code signing across all Grahmos platforms.

## Certificate Types Required

### 1. Apple Developer Certificates (macOS/iOS)
- **Developer ID Application Certificate**: For macOS app notarization
- **Developer ID Installer Certificate**: For macOS installer packages
- **iOS Distribution Certificate**: For App Store submissions
- **Apple Push Notification Certificate**: For mobile notifications

### 2. Microsoft Code Signing (Windows)
- **Extended Validation (EV) Certificate**: Required for Windows Smart Screen trust
- **Timestamp Server**: For long-term validity
- **Authenticode Signing**: For executables and installers

### 3. Linux Package Signing
- **GPG Keys**: For APT/YUM repository signing
- **Container Signing**: For Docker image verification
- **Release Signing**: For GitHub releases and binaries

## Directory Structure
```
infra/certificates/
├── README.md                 # This file
├── setup/                   # Setup and provisioning scripts
│   ├── apple-certificates.sh    # Apple Developer setup
│   ├── windows-certificates.sh  # Windows EV cert setup
│   └── linux-signing.sh        # GPG and package signing setup
├── scripts/                 # Signing automation scripts
│   ├── sign-macos.sh           # macOS app signing and notarization
│   ├── sign-windows.ps1        # Windows binary signing
│   ├── sign-linux.sh           # Linux package signing
│   └── verify-signatures.sh    # Signature verification
├── configs/                 # Configuration templates
│   ├── apple/                  # Apple-specific configs
│   ├── windows/                # Windows signing configs
│   └── linux/                  # Linux signing configs
└── docs/                    # Documentation
    ├── apple-setup.md          # Apple Developer setup guide
    ├── windows-setup.md        # Windows certificate setup
    └── linux-setup.md          # Linux signing setup
```

## Security Considerations

### Certificate Storage
- **Production Certificates**: Stored in hardware security modules (HSM) or secure key vaults
- **Development Certificates**: Local keychain/certificate store with encryption
- **CI/CD Integration**: Use secure environment variables and encrypted secrets

### Access Control
- **Role-Based Access**: Only designated team members can access signing certificates
- **Audit Logging**: All signing operations must be logged and auditable
- **Time-Limited Access**: Certificates should have appropriate expiration dates

### Backup and Recovery
- **Certificate Backup**: Secure backup of all certificates and private keys
- **Recovery Procedures**: Documented procedures for certificate renewal/replacement
- **Emergency Revocation**: Ability to revoke compromised certificates quickly

## Implementation Phases

### Phase 1: Certificate Provisioning
1. Register for Apple Developer Program
2. Acquire Microsoft EV certificate from trusted CA
3. Generate GPG keys for Linux package signing
4. Setup secure storage for all certificates

### Phase 2: Automation Integration
1. Integrate certificates with CI/CD pipelines
2. Create automated signing scripts
3. Setup signature verification workflows
4. Test end-to-end signing process

### Phase 3: Production Deployment
1. Deploy certificates to production infrastructure
2. Setup monitoring and alerting for certificate expiration
3. Implement automated renewal where possible
4. Create operational runbooks for certificate management

## Getting Started

1. **Prerequisites Check**:
   ```bash
   ./setup/check-requirements.sh
   ```

2. **Apple Developer Setup**:
   ```bash
   ./setup/apple-certificates.sh
   ```

3. **Windows Certificate Setup**:
   ```powershell
   .\setup\windows-certificates.ps1
   ```

4. **Linux Signing Setup**:
   ```bash
   ./setup/linux-signing.sh
   ```

5. **Verify Installation**:
   ```bash
   ./scripts/verify-signatures.sh --test
   ```

## Troubleshooting

### Common Issues
- **Certificate not found**: Check certificate installation and keychain/store access
- **Signing failed**: Verify certificate validity and permissions
- **Notarization failed**: Check Apple Developer account status and app compliance

### Support Resources
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Microsoft Code Signing Guide](https://docs.microsoft.com/en-us/windows/win32/appxpkg/how-to-sign-a-package-using-signtool)
- [GPG Package Signing](https://wiki.debian.org/SecureApt)

## Monitoring and Maintenance

### Certificate Expiration Monitoring
- Setup alerts 30/60/90 days before certificate expiration
- Automated renewal for certificates that support it
- Manual renewal procedures for EV certificates

### Security Audits
- Regular security audits of certificate storage and access
- Review of signing logs and activities
- Update security practices based on industry standards
