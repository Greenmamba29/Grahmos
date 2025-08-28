#!/bin/bash
# Grahmos V1+V2 Unified - Quick Fix Script
# Purpose: Rapidly fix common CI/CD pipeline errors
# Usage: ./quick-fix.sh

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Fix functions
fix_pnpm_installation() {
    log_section "Fixing pnpm Installation"
    
    if ! command -v pnpm &> /dev/null; then
        log_info "Installing pnpm globally..."
        npm install -g pnpm@8.15.4
    fi
    
    log_info "✓ pnpm is installed: $(pnpm -v)"
}

fix_node_modules() {
    log_section "Fixing node_modules"
    
    log_info "Cleaning node_modules..."
    find "$PROJECT_ROOT" -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
    
    log_info "Cleaning pnpm cache..."
    pnpm store prune
    
    log_info "Installing fresh dependencies..."
    cd "$PROJECT_ROOT"
    pnpm install --frozen-lockfile
    
    log_info "✓ Dependencies reinstalled successfully"
}

fix_typescript_errors() {
    log_section "Fixing TypeScript Errors"
    
    # Ensure all tsconfig.json files exist
    local apps=("edge-api" "edge-functions" "pwa-shell")
    
    for app in "${apps[@]}"; do
        if [ -d "$PROJECT_ROOT/apps/$app" ] && [ ! -f "$PROJECT_ROOT/apps/$app/tsconfig.json" ]; then
            log_warning "Missing tsconfig.json for $app, creating default..."
            cat > "$PROJECT_ROOT/apps/$app/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF
            log_info "✓ Created tsconfig.json for $app"
        fi
    done
}

fix_eslint_configuration() {
    log_section "Fixing ESLint Configuration"
    
    # Check if .eslintrc exists in root
    if [ ! -f "$PROJECT_ROOT/.eslintrc.json" ] && [ ! -f "$PROJECT_ROOT/.eslintrc.js" ]; then
        log_info "Creating ESLint configuration..."
        cat > "$PROJECT_ROOT/.eslintrc.json" << 'EOF'
{
  "extends": ["eslint:recommended"],
  "env": {
    "node": true,
    "es2022": true
  },
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "warn"
  },
  "overrides": [
    {
      "files": ["*.ts", "*.tsx"],
      "parser": "@typescript-eslint/parser",
      "plugins": ["@typescript-eslint"],
      "extends": [
        "plugin:@typescript-eslint/recommended"
      ]
    }
  ]
}
EOF
        log_info "✓ Created .eslintrc.json"
    fi
}

fix_docker_issues() {
    log_section "Fixing Docker Issues"
    
    # Ensure Docker daemon is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker and try again."
        return 1
    fi
    
    # Clean up Docker resources
    log_info "Cleaning Docker resources..."
    docker system prune -f || true
    
    # Remove problematic images
    docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
    
    log_info "✓ Docker cleanup completed"
}

fix_permissions() {
    log_section "Fixing File Permissions"
    
    # Make all scripts executable
    log_info "Making scripts executable..."
    find "$PROJECT_ROOT/scripts" -name "*.sh" -type f -exec chmod +x {} \;
    
    # Fix ownership issues
    if [ -n "${GITHUB_WORKSPACE:-}" ]; then
        log_info "Fixing ownership for CI environment..."
        sudo chown -R $(whoami) "$PROJECT_ROOT" || true
    fi
    
    log_info "✓ Permissions fixed"
}

fix_missing_env_files() {
    log_section "Fixing Environment Files"
    
    # Create .env from .env.example if missing
    if [ -f "$PROJECT_ROOT/.env.example" ] && [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_info "Creating .env from .env.example..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        log_info "✓ Created .env file"
    fi
}

run_validation() {
    log_section "Running Validation"
    
    if [ -f "$PROJECT_ROOT/scripts/ci-cd-validation.sh" ]; then
        log_info "Running CI/CD validation script..."
        "$PROJECT_ROOT/scripts/ci-cd-validation.sh" || true
    else
        log_warning "Validation script not found"
    fi
}

quick_build_test() {
    log_section "Quick Build Test"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running quick build test..."
    if pnpm build; then
        log_info "✓ Build successful"
    else
        log_error "Build failed - check error messages above"
        return 1
    fi
}

# Main menu
show_menu() {
    echo
    echo "Grahmos Quick Fix Menu"
    echo "======================"
    echo "1. Fix all common issues (recommended)"
    echo "2. Fix pnpm installation only"
    echo "3. Fix node_modules issues"
    echo "4. Fix TypeScript configuration"
    echo "5. Fix ESLint configuration"
    echo "6. Fix Docker issues"
    echo "7. Fix file permissions"
    echo "8. Fix environment files"
    echo "9. Run validation only"
    echo "0. Exit"
    echo
}

# Main execution
main() {
    log_info "Grahmos V1+V2 Quick Fix Tool"
    log_info "============================"
    
    # If no arguments, show menu
    if [ $# -eq 0 ]; then
        while true; do
            show_menu
            read -p "Select option (0-9): " choice
            
            case $choice in
                1)
                    log_info "Running all fixes..."
                    fix_pnpm_installation
                    fix_node_modules
                    fix_typescript_errors
                    fix_eslint_configuration
                    fix_permissions
                    fix_missing_env_files
                    quick_build_test
                    run_validation
                    ;;
                2) fix_pnpm_installation ;;
                3) fix_node_modules ;;
                4) fix_typescript_errors ;;
                5) fix_eslint_configuration ;;
                6) fix_docker_issues ;;
                7) fix_permissions ;;
                8) fix_missing_env_files ;;
                9) run_validation ;;
                0) 
                    log_info "Exiting..."
                    exit 0
                    ;;
                *)
                    log_error "Invalid option"
                    ;;
            esac
            
            echo
            read -p "Press Enter to continue..."
        done
    else
        # Run specific fix if provided as argument
        case "$1" in
            all)
                fix_pnpm_installation
                fix_node_modules
                fix_typescript_errors
                fix_eslint_configuration
                fix_permissions
                fix_missing_env_files
                quick_build_test
                run_validation
                ;;
            pnpm) fix_pnpm_installation ;;
            deps|dependencies) fix_node_modules ;;
            typescript|ts) fix_typescript_errors ;;
            eslint|lint) fix_eslint_configuration ;;
            docker) fix_docker_issues ;;
            permissions|perms) fix_permissions ;;
            env) fix_missing_env_files ;;
            validate) run_validation ;;
            build) quick_build_test ;;
            *)
                log_error "Unknown command: $1"
                echo "Usage: $0 [all|pnpm|deps|typescript|eslint|docker|permissions|env|validate|build]"
                exit 1
                ;;
        esac
    fi
    
    log_info "Quick fix completed!"
}

# Execute main function
main "$@"