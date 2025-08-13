# Release Guide

This guide explains the release process for Grahmos, including release candidate (RC) creation and promotion to stable releases.

## Release Workflow

The project follows a two-stage release process:

1. **Release Candidate (RC)**: Pre-release version for testing and validation
2. **Stable Release**: Promoted from RC after verification

## Release Candidate Process

### Creating an RC

Release candidates are created automatically or manually:

**Automatic RC (recommended):**
```bash
pnpm release:rc
```

This creates a timestamped RC tag like `v0.1.0-rc1632` using the current time.

**Manual RC:**
```bash
git tag -a v0.1.0-rc1 -m "Release candidate v0.1.0-rc1"
git push origin v0.1.0-rc1
```

### RC Validation

Before promoting an RC to stable, verify:

1. **Build Success**: All packages build without errors
   ```bash
   pnpm build
   ```

2. **Tests Pass**: All automated tests complete successfully
   ```bash
   pnpm test:e2e
   ```

3. **Manual Testing**: Key user flows work as expected
   - Pack management (install, verify, remove)
   - P2P sync functionality
   - Purchase and receipt verification
   - Offline article viewing

4. **Deployment Testing**: RC deploys successfully
   - GitHub Pages deployment works
   - Cloudflare Workers deploy correctly
   - No critical deployment errors

## Stable Release Promotion

### Using the Promotion Script

The automated script generates changelogs and creates release tags:

```bash
# Dry run to preview changes
pnpm release:promote -- --from v0.1.0-rc1 --to v0.1.0 --dry-run

# Actual promotion
pnpm release:promote -- --from v0.1.0-rc1 --to v0.1.0
```

### What the Script Does

1. **Changelog Generation**: Extracts commits between RC and target version
2. **Categorization**: Sorts commits into Added, Fixed, and Changed sections
3. **CHANGELOG.md Update**: Inserts new release section with proper formatting
4. **Git Tag Creation**: Creates annotated tag with release message

### Manual Promotion (if needed)

If the script fails or you prefer manual control:

1. **Update CHANGELOG.md**:
   ```bash
   git log --pretty=format:"- %s (%h)" v0.1.0-rc1..HEAD
   ```
   Copy output and categorize into CHANGELOG.md

2. **Create Release Tag**:
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   ```

3. **Push Changes**:
   ```bash
   git add CHANGELOG.md
   git commit -m "Update changelog for v0.1.0"
   git push origin main
   git push origin v0.1.0
   ```

## CI/CD Integration

### GitHub Actions

The release process integrates with CI/CD:

**On RC Tags (`v*-rc*`)**:
- Builds and tests all packages
- Deploys to preview/staging environments
- Runs comprehensive E2E tests

**On Stable Tags (`v*`)**:
- Builds and tests all packages  
- Deploys to production environments
- Creates GitHub release with changelog
- Notifies stakeholders of release

### Deployment Environments

| Environment | Trigger | Purpose |
|-------------|---------|---------|
| Preview | RC tags | Testing and validation |
| Staging | RC tags | Pre-production verification |  
| Production | Stable tags | Live deployment |

## Release Checklist

### Before RC Creation
- [ ] All features complete and merged to main
- [ ] Tests passing locally and in CI
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Dependencies updated and audited

### RC Validation
- [ ] RC builds successfully in CI
- [ ] All automated tests pass
- [ ] Manual smoke tests complete
- [ ] Performance regression tests pass
- [ ] Security scan passes
- [ ] Preview deployment works correctly

### Stable Release
- [ ] RC validation complete
- [ ] Changelog generated and reviewed
- [ ] Release notes written
- [ ] Production deployment verified
- [ ] Release announcement prepared
- [ ] GitHub release created

## Troubleshooting

### Common Issues

**Script Fails to Find Commits:**
- Verify RC tag exists: `git tag -l | grep rc`
- Check tag spelling and format
- Ensure commits exist between tags

**Changelog Not Generated:**
- Run with `--dry-run` to see what would be generated
- Check git log output manually
- Verify CHANGELOG.md permissions

**Tag Creation Fails:**
- Check if tag already exists: `git tag -l v0.1.0`  
- Verify git repository is clean
- Check permissions for tag creation

**Deployment Issues:**
- Review GitHub Actions logs
- Check required secrets are set
- Verify wrangler.toml configuration

### Recovery Procedures

**Rollback Release:**
```bash
git tag -d v0.1.0           # Delete local tag
git push origin :v0.1.0     # Delete remote tag
```

**Fix Release Issues:**
```bash  
git tag -d v0.1.0           # Delete bad tag
# Fix issues, commit changes
git tag -a v0.1.0 -m "Release v0.1.0"  # Recreate tag
git push origin v0.1.0      # Push corrected tag
```

## Best Practices

1. **Consistent Tagging**: Use semantic versioning (vMAJOR.MINOR.PATCH)
2. **Clear Messages**: Write descriptive commit messages for changelog generation
3. **Test Before Release**: Never skip RC validation steps
4. **Document Changes**: Keep CHANGELOG.md up to date
5. **Communicate**: Announce releases to stakeholders
6. **Monitor**: Watch deployment and error metrics after release

## Next Steps

After a successful release:

1. **Monitor Production**: Watch for errors or performance issues
2. **Update Documentation**: Ensure docs reflect new features
3. **Plan Next Release**: Identify features for next version
4. **Gather Feedback**: Collect user feedback on new features
5. **Archive RC**: Clean up old RC tags if not needed
