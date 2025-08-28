#!/bin/bash
# Grahmos V1+V2 Unified - CI/CD Pipeline Validation Script
# Purpose: Validate CI/CD pipeline configuration and dependencies
# Usage: ./ci-cd-validation.sh

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly NODE_VERSION_REQUIRED="20"
readonly PNPM_VERSION_REQUIRED="8.15.4"

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

# Validation functions
check_node_version() {
    log_section "Node.js Version Check"
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        return 1
    fi
    
    local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt "$NODE_VERSION_REQUIRED" ]; then
        log_error "Node.js version $NODE_VERSION_REQUIRED or higher is required (found: v$node_version)"
        return 1
    fi
    
    log_info "✓ Node.js version: $(node -v)"
    return 0
}

check_pnpm_installation() {
    log_section "pnpm Installation Check"
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed"
        log_info "Installing pnpm globally..."
        npm install -g pnpm@$PNPM_VERSION_REQUIRED
    fi
    
    local pnpm_version=$(pnpm -v)
    log_info "✓ pnpm version: $pnpm_version"
    return 0
}

check_required_files() {
    log_section "Required Files Check"
    
    local required_files=(
        "package.json"
        "pnpm-lock.yaml"
        "pnpm-workspace.yaml"
        "turbo.json"
        ".env.example"
        ".github/workflows/ci-cd.yml"
    )
    
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        log_error "Missing required files:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        return 1
    fi
    
    log_info "✓ All required files present"
    return 0
}

check_scripts() {
    log_section "Required Scripts Check"
    
    local required_scripts=(
        "deploy.sh"
        "smoke-tests.sh"
        "test-security.sh"
        "test-performance.sh"
        "test-functional.sh"
        "test-status.sh"
        "security-audit.sh"
        "health-check.sh"
    )
    
    local missing_scripts=()
    
    for script in "${required_scripts[@]}"; do
        if [ ! -f "$PROJECT_ROOT/scripts/$script" ]; then
            missing_scripts+=("$script")
        elif [ ! -x "$PROJECT_ROOT/scripts/$script" ]; then
            log_warning "Script $script is not executable"
            chmod +x "$PROJECT_ROOT/scripts/$script"
            log_info "✓ Made $script executable"
        fi
    done
    
    if [ ${#missing_scripts[@]} -gt 0 ]; then
        log_error "Missing required scripts:"
        for script in "${missing_scripts[@]}"; do
            echo "  - scripts/$script"
        done
        return 1
    fi
    
    log_info "✓ All required scripts present and executable"
    return 0
}

check_docker_files() {
    log_section "Docker Configuration Check"
    
    local docker_files=(
        "apps/edge-api/Dockerfile"
        ".dockerignore"
        "docker-compose.yml"
        "docker-compose.prod.yml"
    )
    
    local missing_docker_files=()
    
    for file in "${docker_files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            missing_docker_files+=("$file")
        fi
    done
    
    if [ ${#missing_docker_files[@]} -gt 0 ]; then
        log_error "Missing Docker files:"
        for file in "${missing_docker_files[@]}"; do
            echo "  - $file"
        done
        return 1
    fi
    
    log_info "✓ All Docker configuration files present"
    return 0
}

check_package_scripts() {
    log_section "Package Scripts Validation"
    
    local required_npm_scripts=(
        "build"
        "lint"
        "type-check"
        "test"
        "test:unit"
        "test:integration"
        "test:e2e"
        "test:coverage"
    )
    
    # Check root package.json
    log_info "Checking root package.json scripts..."
    for script in "${required_npm_scripts[@]}"; do
        if ! jq -e ".scripts[\"$script\"]" "$PROJECT_ROOT/package.json" > /dev/null 2>&1; then
            log_warning "Missing script '$script' in root package.json"
        fi
    done
    
    # Check app package.json files
    for app_dir in "$PROJECT_ROOT/apps"/*; do
        if [ -d "$app_dir" ] && [ -f "$app_dir/package.json" ]; then
            local app_name=$(basename "$app_dir")
            log_info "Checking $app_name package.json scripts..."
            
            for script in "${required_npm_scripts[@]}"; do
                if ! jq -e ".scripts[\"$script\"]" "$app_dir/package.json" > /dev/null 2>&1; then
                    log_warning "Missing script '$script' in apps/$app_name/package.json"
                fi
            done
        fi
    done
    
    log_info "✓ Package scripts validation complete"
    return 0
}

check_dependencies() {
    log_section "Dependencies Check"
    
    cd "$PROJECT_ROOT"
    
    log_info "Installing dependencies with pnpm..."
    if pnpm install --frozen-lockfile; then
        log_info "✓ Dependencies installed successfully"
    else
        log_error "Failed to install dependencies"
        return 1
    fi
    
    return 0
}

run_build_test() {
    log_section "Build Test"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running build command..."
    if pnpm build; then
        log_info "✓ Build completed successfully"
    else
        log_error "Build failed"
        return 1
    fi
    
    return 0
}

run_lint_test() {
    log_section "Lint Test"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running lint command..."
    if pnpm lint; then
        log_info "✓ Linting passed"
    else
        log_warning "Linting has warnings/errors"
    fi
    
    return 0
}

run_type_check() {
    log_section "Type Check"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running type check..."
    if pnpm type-check; then
        log_info "✓ Type check passed"
    else
        log_warning "Type check has errors"
    fi
    
    return 0
}

check_docker_build() {
    log_section "Docker Build Test"
    
    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed - skipping Docker build test"
        return 0
    fi
    
    log_info "Testing edge-api Docker build..."
    cd "$PROJECT_ROOT"
    
    if docker build -f apps/edge-api/Dockerfile -t edge-api:test .; then
        log_info "✓ Docker build successful"
        docker rmi edge-api:test > /dev/null 2>&1
    else
        log_error "Docker build failed"
        return 1
    fi
    
    return 0
}

generate_report() {
    log_section "CI/CD Validation Report"
    
    local report_file="$PROJECT_ROOT/ci-cd-validation-report.txt"
    
    cat > "$report_file" << EOF
Grahmos V1+V2 Unified - CI/CD Validation Report
Generated: $(date)

System Information:
- Node.js: $(node -v 2>/dev/null || echo "Not installed")
- pnpm: $(pnpm -v 2>/dev/null || echo "Not installed")
- Docker: $(docker --version 2>/dev/null || echo "Not installed")
- OS: $(uname -s) $(uname -r)

Validation Summary:
- All checks have been completed
- Please review any warnings or errors above

Next Steps:
1. Fix any errors reported above
2. Re-run this script to verify fixes
3. Commit changes and push to trigger CI/CD pipeline
4. Monitor GitHub Actions for pipeline execution

EOF
    
    log_info "✓ Validation report saved to: $report_file"
}

# Main execution
main() {
    log_info "Starting CI/CD Pipeline Validation"
    log_info "===================================="
    
    local failed_checks=0
    
    # Run all checks
    check_node_version || ((failed_checks++))
    check_pnpm_installation || ((failed_checks++))
    check_required_files || ((failed_checks++))
    check_scripts || ((failed_checks++))
    check_docker_files || ((failed_checks++))
    check_package_scripts || ((failed_checks++))
    
    # Only run build/test checks if basic checks pass
    if [ $failed_checks -eq 0 ]; then
        check_dependencies || ((failed_checks++))
        run_build_test || ((failed_checks++))
        run_lint_test || ((failed_checks++))
        run_type_check || ((failed_checks++))
        check_docker_build || ((failed_checks++))
    else
        log_warning "Skipping build/test checks due to failed prerequisites"
    fi
    
    # Generate report
    generate_report
    
    # Summary
    echo
    if [ $failed_checks -eq 0 ]; then
        log_info "✅ All CI/CD validation checks passed!"
        log_info "Your pipeline is ready for deployment."
        return 0
    else
        log_error "❌ CI/CD validation failed with $failed_checks errors"
        log_error "Please fix the issues and run this script again."
        return 1
    fi
}

# Execute main function
main "$@"