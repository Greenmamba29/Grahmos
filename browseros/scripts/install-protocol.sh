#!/bin/bash

# GrahmOS Protocol Handler Installation Script
# This script installs the grahmos:// protocol handler on supported platforms

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLATFORM_DIR="$PROJECT_ROOT/platforms"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect platform
detect_platform() {
    case "$(uname -s)" in
        Darwin)
            echo "macos"
            ;;
        Linux)
            echo "linux"
            ;;
        CYGWIN*|MINGW32*|MSYS*|MINGW*)
            echo "windows"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Install macOS protocol handler
install_macos() {
    log_info "Installing grahmos:// protocol handler on macOS..."
    
    local plist_file="$PLATFORM_DIR/macos/Info.plist"
    local app_path="/Applications/GrahmOS.app"
    
    if [[ ! -f "$plist_file" ]]; then
        log_error "Info.plist not found at $plist_file"
        return 1
    fi
    
    # Check if app is installed
    if [[ ! -d "$app_path" ]]; then
        log_warning "GrahmOS.app not found at $app_path"
        log_info "Protocol handler will be registered when app is installed"
    fi
    
    # Register with Launch Services
    if command -v /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister &> /dev/null; then
        log_info "Registering with Launch Services..."
        /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$app_path" 2>/dev/null || true
    fi
    
    # Test protocol handler
    log_info "Testing protocol handler registration..."
    if open "grahmos://launch" 2>/dev/null; then
        log_success "Protocol handler installed successfully!"
    else
        log_warning "Protocol handler registered but test failed (app may not be installed)"
    fi
}

# Install Linux protocol handler
install_linux() {
    log_info "Installing grahmos:// protocol handler on Linux..."
    
    local desktop_file="$PLATFORM_DIR/linux/grahmos.desktop"
    local install_dir="$HOME/.local/share/applications"
    
    if [[ ! -f "$desktop_file" ]]; then
        log_error "Desktop file not found at $desktop_file"
        return 1
    fi
    
    # Create applications directory if it doesn't exist
    mkdir -p "$install_dir"
    
    # Copy desktop file
    cp "$desktop_file" "$install_dir/"
    log_info "Desktop file copied to $install_dir"
    
    # Update MIME database
    if command -v update-desktop-database &> /dev/null; then
        log_info "Updating desktop database..."
        update-desktop-database "$install_dir" 2>/dev/null || true
    fi
    
    # Register MIME type
    if command -v xdg-mime &> /dev/null; then
        log_info "Registering MIME type..."
        xdg-mime default grahmos.desktop x-scheme-handler/grahmos 2>/dev/null || true
    fi
    
    # Test protocol handler
    log_info "Testing protocol handler registration..."
    if xdg-open "grahmos://launch" 2>/dev/null; then
        log_success "Protocol handler installed successfully!"
    else
        log_warning "Protocol handler registered but test failed (app may not be installed)"
    fi
}

# Install Windows protocol handler
install_windows() {
    log_info "Installing grahmos:// protocol handler on Windows..."
    
    local reg_file="$PLATFORM_DIR/windows/protocol.reg"
    
    if [[ ! -f "$reg_file" ]]; then
        log_error "Registry file not found at $reg_file"
        return 1
    fi
    
    # Import registry entries
    if command -v reg &> /dev/null; then
        log_info "Importing registry entries..."
        reg import "$reg_file" 2>/dev/null || {
            log_error "Failed to import registry entries"
            log_info "Please run the installer as administrator or manually import $reg_file"
            return 1
        }
    elif command -v regedit &> /dev/null; then
        log_info "Importing registry entries with regedit..."
        regedit /s "$reg_file" 2>/dev/null || {
            log_error "Failed to import registry entries"
            log_info "Please run the installer as administrator or manually import $reg_file"
            return 1
        }
    else
        log_error "Neither reg nor regedit command found"
        log_info "Please manually import $reg_file using Registry Editor"
        return 1
    fi
    
    log_success "Protocol handler installed successfully!"
}

# Uninstall protocol handler
uninstall() {
    local platform=$(detect_platform)
    
    log_info "Uninstalling grahmos:// protocol handler on $platform..."
    
    case $platform in
        macos)
            if [[ -d "/Applications/GrahmOS.app" ]]; then
                /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -u "/Applications/GrahmOS.app" 2>/dev/null || true
            fi
            log_success "macOS protocol handler uninstalled"
            ;;
        linux)
            rm -f "$HOME/.local/share/applications/grahmos.desktop"
            if command -v update-desktop-database &> /dev/null; then
                update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
            fi
            log_success "Linux protocol handler uninstalled"
            ;;
        windows)
            if command -v reg &> /dev/null; then
                reg delete "HKEY_CLASSES_ROOT\grahmos" /f 2>/dev/null || true
                reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\GrahmOS" /f 2>/dev/null || true
            fi
            log_success "Windows protocol handler uninstalled"
            ;;
        *)
            log_error "Unsupported platform: $platform"
            return 1
            ;;
    esac
}

# Test protocol handler
test_protocol() {
    local platform=$(detect_platform)
    
    log_info "Testing grahmos:// protocol handler on $platform..."
    
    case $platform in
        macos)
            open "grahmos://launch" 2>/dev/null && log_success "Test successful" || log_warning "Test failed"
            ;;
        linux)
            xdg-open "grahmos://launch" 2>/dev/null && log_success "Test successful" || log_warning "Test failed"
            ;;
        windows)
            start "grahmos://launch" 2>/dev/null && log_success "Test successful" || log_warning "Test failed"
            ;;
        *)
            log_error "Unsupported platform: $platform"
            return 1
            ;;
    esac
}

# Main function
main() {
    local action="${1:-install}"
    local platform=$(detect_platform)
    
    log_info "GrahmOS Protocol Handler Installer"
    log_info "Platform: $platform"
    log_info "Action: $action"
    echo
    
    case $action in
        install)
            case $platform in
                macos)
                    install_macos
                    ;;
                linux)
                    install_linux
                    ;;
                windows)
                    install_windows
                    ;;
                *)
                    log_error "Unsupported platform: $platform"
                    exit 1
                    ;;
            esac
            ;;
        uninstall)
            uninstall
            ;;
        test)
            test_protocol
            ;;
        *)
            echo "Usage: $0 [install|uninstall|test]"
            echo
            echo "Commands:"
            echo "  install   - Install grahmos:// protocol handler (default)"
            echo "  uninstall - Remove grahmos:// protocol handler"
            echo "  test      - Test protocol handler registration"
            echo
            echo "Examples:"
            echo "  $0                    # Install protocol handler"
            echo "  $0 install           # Install protocol handler"
            echo "  $0 uninstall         # Remove protocol handler"
            echo "  $0 test              # Test protocol handler"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
