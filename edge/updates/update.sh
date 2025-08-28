#!/usr/bin/env bash

# Edge Security Delta Update Script
# Verifies manifest + files, then atomically swaps /data/indexes/current -> new release

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IDX_DIR="$BASE_DIR/data/indexes"
REL_DIR="$IDX_DIR/releases"
MANIFEST_FILE="${1:?Usage: $0 <manifest.json> <manifest.json.sig> <public_signing_key.pem>}"
SIGNATURE_FILE="${2:?Usage: $0 <manifest.json> <manifest.json.sig> <public_signing_key.pem>}"
PUBLIC_KEY="${3:?Usage: $0 <manifest.json> <manifest.json.sig> <public_signing_key.pem>}"

echo "🔄 Edge Security Delta Update"
echo "============================="
echo "📄 Manifest: $MANIFEST_FILE"
echo "🔐 Signature: $SIGNATURE_FILE" 
echo "🔑 Public Key: $PUBLIC_KEY"
echo ""

# Ensure all required files exist
if [[ ! -f "$MANIFEST_FILE" ]]; then
    echo "❌ Manifest file not found: $MANIFEST_FILE"
    exit 1
fi

if [[ ! -f "$SIGNATURE_FILE" ]]; then
    echo "❌ Signature file not found: $SIGNATURE_FILE"
    exit 1
fi

if [[ ! -f "$PUBLIC_KEY" ]]; then
    echo "❌ Public key file not found: $PUBLIC_KEY"
    exit 1
fi

# Verify we can read the manifest
if ! jq empty "$MANIFEST_FILE" >/dev/null 2>&1; then
    echo "❌ Invalid JSON in manifest file"
    exit 1
fi

# Extract version information
VERSION=$(jq -r '.version' "$MANIFEST_FILE")
PREVIOUS_VERSION=$(jq -r '.previous_version // "initial"' "$MANIFEST_FILE")
UPDATE_TYPE=$(jq -r '.update_type // "full"' "$MANIFEST_FILE")

echo "📦 Update Details:"
echo "   Version: $PREVIOUS_VERSION → $VERSION"
echo "   Type: $UPDATE_TYPE"

# Check if this version already exists
STAGE_DIR="$REL_DIR/$VERSION"
if [[ -d "$STAGE_DIR" ]]; then
    echo "⚠️  Version $VERSION already exists in releases directory"
    echo "   Remove existing version or increment version number"
    exit 1
fi

# Step 1: Verify manifest signature
echo ""
echo "🔐 Step 1: Verifying Manifest Signature"
echo "----------------------------------------"

if openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "$SIGNATURE_FILE" "$MANIFEST_FILE" >/dev/null 2>&1; then
    echo "✅ Manifest signature is valid"
else
    echo "❌ Manifest signature verification FAILED"
    echo "   This update is not from a trusted source!"
    exit 1
fi

# Step 2: Prepare staging directory
echo ""
echo "📁 Step 2: Preparing Staging Directory" 
echo "---------------------------------------"

mkdir -p "$STAGE_DIR"
echo "✅ Created staging directory: $STAGE_DIR"

# Step 3: Process files from manifest
echo ""
echo "📦 Step 3: Processing Update Files"
echo "-----------------------------------"

MANIFEST_DIR="$(dirname "$MANIFEST_FILE")"
TOTAL_FILES=$(jq '.files | length' "$MANIFEST_FILE")
PROCESSED_FILES=0
TOTAL_BYTES=0

echo "   Files to process: $TOTAL_FILES"

# Process each file in the manifest
jq -r '.files[] | @base64' "$MANIFEST_FILE" | while IFS= read -r file_data; do
    file_json=$(echo "$file_data" | base64 -d)
    file_path=$(echo "$file_json" | jq -r '.path')
    file_sha256=$(echo "$file_json" | jq -r '.sha256')
    file_bytes=$(echo "$file_json" | jq -r '.bytes')
    file_action=$(echo "$file_json" | jq -r '.action // "add"')
    
    source_file="$MANIFEST_DIR/$file_path"
    target_file="$STAGE_DIR/$file_path"
    
    echo "   Processing: $file_path ($file_action, ${file_bytes} bytes)"
    
    # Ensure source file exists
    if [[ ! -f "$source_file" ]]; then
        echo "   ❌ Source file not found: $source_file"
        exit 1
    fi
    
    # Verify file hash
    actual_hash=$(openssl dgst -sha256 -r "$source_file" | awk '{print $1}')
    if [[ "$actual_hash" != "$file_sha256" ]]; then
        echo "   ❌ Hash mismatch for $file_path"
        echo "      Expected: $file_sha256"
        echo "      Actual:   $actual_hash"
        exit 1
    fi
    
    # Create target directory if needed
    target_dir=$(dirname "$target_file")
    mkdir -p "$target_dir"
    
    # Copy file to staging
    cp "$source_file" "$target_file"
    
    # Verify copied file
    copied_hash=$(openssl dgst -sha256 -r "$target_file" | awk '{print $1}')
    if [[ "$copied_hash" != "$file_sha256" ]]; then
        echo "   ❌ Copy verification failed for $file_path"
        exit 1
    fi
    
    echo "   ✅ $file_path verified and staged"
    PROCESSED_FILES=$((PROCESSED_FILES + 1))
    TOTAL_BYTES=$((TOTAL_BYTES + file_bytes))
done

echo "✅ All files processed successfully"
echo "   Files: $PROCESSED_FILES"
echo "   Total bytes: $TOTAL_BYTES"

# Step 4: Validate staged release
echo ""
echo "🔍 Step 4: Validating Staged Release"
echo "-------------------------------------"

# Check for required files
required_files=("fts.sqlite")
for req_file in "${required_files[@]}"; do
    if [[ ! -f "$STAGE_DIR/$req_file" ]]; then
        echo "❌ Required file missing in staged release: $req_file"
        exit 1
    fi
done

# Test SQLite database if it exists
if [[ -f "$STAGE_DIR/fts.sqlite" ]]; then
    echo "   Testing SQLite FTS database..."
    if sqlite3 "$STAGE_DIR/fts.sqlite" "SELECT COUNT(*) FROM fts;" >/dev/null 2>&1; then
        record_count=$(sqlite3 "$STAGE_DIR/fts.sqlite" "SELECT COUNT(*) FROM fts;")
        echo "   ✅ SQLite database valid ($record_count records)"
    else
        echo "   ❌ SQLite database validation failed"
        exit 1
    fi
fi

# Step 5: Create rollback point
echo ""
echo "💾 Step 5: Creating Rollback Point"
echo "-----------------------------------"

CURRENT_LINK="$IDX_DIR/current"
ROLLBACK_LINK="$IDX_DIR/rollback"

if [[ -L "$CURRENT_LINK" ]]; then
    current_target=$(readlink "$CURRENT_LINK")
    ln -sfn "$current_target" "$ROLLBACK_LINK"
    echo "✅ Rollback point created: $current_target"
else
    echo "⚠️  No existing current version to rollback to"
fi

# Step 6: Atomic swap
echo ""
echo "🔀 Step 6: Atomic Index Swap"
echo "-----------------------------"

# Create temporary link for atomic operation
TEMP_LINK="$IDX_DIR/.current.tmp.$$"
ln -sfn "$STAGE_DIR" "$TEMP_LINK"

# Atomic move (rename is atomic on most filesystems)
mv "$TEMP_LINK" "$CURRENT_LINK"

# Force filesystem sync to ensure durability
sync

echo "✅ Atomic swap completed successfully"

# Step 7: Verify new current version
echo ""
echo "✅ Step 7: Verification"
echo "-----------------------"

if [[ -L "$CURRENT_LINK" ]]; then
    new_current=$(readlink "$CURRENT_LINK")
    if [[ "$new_current" == "$STAGE_DIR" ]]; then
        echo "✅ Current index now points to: $VERSION"
        
        # Test the new index with a simple query
        if sqlite3 "$CURRENT_LINK/fts.sqlite" "SELECT COUNT(*) FROM fts LIMIT 1;" >/dev/null 2>&1; then
            echo "✅ New index is operational"
        else
            echo "⚠️  New index may have issues (but swap was successful)"
        fi
    else
        echo "❌ Current index points to unexpected target: $new_current"
        exit 1
    fi
else
    echo "❌ Current index link is missing after swap"
    exit 1
fi

# Step 8: Cleanup and summary
echo ""
echo "🧹 Step 8: Cleanup"
echo "------------------"

# Remove old releases (keep last 3)
echo "   Cleaning up old releases (keeping last 3)..."
ls -1t "$REL_DIR" | tail -n +4 | while IFS= read -r old_version; do
    old_path="$REL_DIR/$old_version"
    if [[ -d "$old_path" ]] && [[ "$old_path" != "$STAGE_DIR" ]]; then
        echo "   Removing old release: $old_version"
        rm -rf "$old_path"
    fi
done

# Update metadata
cat > "$IDX_DIR/version.json" << EOF
{
  "current_version": "$VERSION",
  "previous_version": "$PREVIOUS_VERSION", 
  "update_type": "$UPDATE_TYPE",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "files_count": $PROCESSED_FILES,
  "total_bytes": $TOTAL_BYTES
}
EOF

echo ""
echo "🎉 Update Completed Successfully!"
echo "================================="
echo "✅ Version: $PREVIOUS_VERSION → $VERSION"  
echo "✅ Files: $PROCESSED_FILES processed"
echo "✅ Size: $TOTAL_BYTES bytes"
echo "✅ Index: Ready for queries"
echo ""
echo "🔄 Rollback command (if needed):"
echo "   ln -sfn \$(readlink $ROLLBACK_LINK) $CURRENT_LINK"
echo ""
echo "📊 Current status:"
echo "   Active: $VERSION" 
echo "   Rollback available: $(readlink "$ROLLBACK_LINK" 2>/dev/null | xargs basename || echo "None")"
