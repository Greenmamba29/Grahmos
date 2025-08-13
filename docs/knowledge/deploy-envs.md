# Deployment Environments

This document outlines the required secrets and environment variables for deploying Grahmos components.

## GitHub Pages (PWA Shell)

The PWA shell is deployed to GitHub Pages using static export. No additional secrets are required - GitHub Actions automatically handles the `GITHUB_TOKEN` for Pages deployment.

**Workflow**: `.github/workflows/pages.yml`
**Triggers**: Push to `main` branch, version tags (`v*`), manual dispatch
**Output**: Static site deployed to `https://{username}.github.io/{repository}/`

### Required Repository Secrets
- None (handled automatically by GitHub Pages)

## Cloudflare Workers (Edge Functions)

The edge functions are deployed to Cloudflare Workers with preview deployments.

**Workflow**: `.github/workflows/worker-preview.yml`
**Triggers**: Push to `main`, PRs to `main`, version tags (`v*`), manual dispatch
**Output**: Worker deployed to preview environment

### Required Repository Secrets

| Secret | Description | Example Value |
|--------|-------------|---------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers:Edit permissions | `1234567890abcdef...` |
| `CF_ACCOUNT_ID` | Cloudflare account ID | `a1b2c3d4e5f6...` |

### Optional Secrets

| Secret | Description | Example Value |
|--------|-------------|---------------|
| `CF_PROJECT_NAME` | Cloudflare Pages project name (if using CF Pages for static hosting) | `grahmos-pwa` |

## KV Namespaces (Production)

For production deployments, configure KV namespaces in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "ORDERS"
id = "orders_kv_production"          # Production KV namespace ID
preview_id = "orders_kv_preview"     # Preview KV namespace ID
```

## Setting Up Secrets

### GitHub Repository Secrets

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add the required secrets listed above

### Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create token with:
   - Zone: Zone:Read
   - Account: Cloudflare Workers:Edit
   - Zone Resources: Include All zones

### Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Copy the Account ID from the right sidebar

## Deployment Behavior

### With Secrets
- Workers deploy to preview environment
- Build artifacts are uploaded and deployed
- Deployment URL is provided in workflow output

### Without Secrets
- Workflow completes successfully with skip notice
- Build verification still occurs
- Clear message indicates missing secrets

## Environment Variables

The following environment variables are configured in `wrangler.toml`:

```toml
[vars]
STRIPE_MODE = "test"                 # or "live" for production
RECEIPT_KEY_ID = "key_2025_01"       # Current signing key identifier
RECEIPT_PUBLIC_KEY = "R2x0r..."      # Base64 encoded public key
RECEIPT_PRIVATE_KEY = "CO+Vq..."     # Base64 encoded private key (workers only)
```

For production, update these values in the production `wrangler.toml` configuration.

## Troubleshooting

### Common Issues

1. **Worker deployment fails**: Check API token permissions and account ID
2. **Pages deployment fails**: Verify Next.js static export configuration
3. **Build failures**: Check pnpm version and lock file consistency

### Workflow Status

Monitor deployment status in:
- GitHub Actions tab
- Cloudflare Workers dashboard
- GitHub Pages settings

### Local Testing

Test workflows locally:
```bash
# Test PWA build
cd apps/pwa-shell
pnpm build

# Test worker build  
cd apps/edge-functions
npx wrangler deploy --dry-run
```
