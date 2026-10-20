#!/bin/bash
# S-03: Restore drill script
# 
# Dumps the test database, restores it into a fresh one and compares
# row counts and trial balances. Generates a dated report in docs/eval/.
# 
# Usage: ./scripts/restore-drill.sh
# 
# This script is for local testing only. It requires:
# - PostgreSQL client tools (psql, pg_dump, pg_restore)
# - Access to the source and target databases
# - Sufficient disk space for the dump file

set -euo pipefail

# Configuration - adjust these for your environment
SOURCE_DB_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
TARGET_DB_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}_restore_test"
SOURCE_DB_NAME=$(echo "$SOURCE_DB_URL" | grep -oP 'postgresql://[^/]+/\K[^?]+')
TARGET_DB_NAME=$(echo "$TARGET_DB_URL" | grep -oP 'postgresql://[^/]+/\K[^?]+')

# Extract connection parameters
SOURCE_HOST=$(echo "$SOURCE_DB_URL" | grep -oP 'postgresql://\K[^:]+')
SOURCE_PORT=$(echo "$SOURCE_DB_URL" | grep -oP ':[0-9]+' | tr -d ':')
SOURCE_USER=$(echo "$SOURCE_DB_URL" | grep -oP '/[^?]+\?user=\K[^&]+')
SOURCE_PASSWORD=$(echo "$SOURCE_DB_URL" | grep -oP 'password=\K[^&]+')

TARGET_HOST=$(echo "$TARGET_DB_URL" | grep -oP 'postgresql://\K[^:]+')
TARGET_PORT=$(echo "$TARGET_DB_URL" | grep -oP ':[0-9]+' | tr -d ':')

# Defaults if parsing fails
SOURCE_HOST=${SOURCE_HOST:-localhost}
SOURCE_PORT=${SOURCE_PORT:-5432}
SOURCE_USER=${SOURCE_USER:-postgres}
SOURCE_PASSWORD=${SOURCE_PASSWORD:-postgres}
TARGET_HOST=${TARGET_HOST:-localhost}
TARGET_PORT=${TARGET_PORT:-5432}

# Output directory
OUTPUT_DIR="./docs/eval"
REPORT_FILE="$OUTPUT_DIR/restore-drill-$(date +%Y%m%d-%H%M%S).md"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Temporary dump file
DUMP_FILE="/tmp/ledgerflow-restore-drill-$(date +%s).sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "S-03: Database Restore Drill"
echo "Started: $TIMESTAMP"
echo "=========================================="
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to log to both console and report
log() {
    echo "$1"
    echo "$1" >> "$REPORT_FILE"
}

# Function to log error
log_error() {
    echo -e "${RED}$1${NC}"
    echo "$1" >> "$REPORT_FILE"
}

# Function to log success
log_success() {
    echo -e "${GREEN}$1${NC}"
    echo "$1" >> "$REPORT_FILE"
}

# Function to log warning
log_warning() {
    echo -e "${YELLOW}$1${NC}"
    echo "$1" >> "$REPORT_FILE"
}

# Initialize report
cat > "$REPORT_FILE" << EOF
# Database Restore Drill Report

**Timestamp:** $TIMESTAMP  
**Source Database:** $SOURCE_DB_NAME  
**Target Database:** $TARGET_DB_NAME  
**Script:** scripts/restore-drill.sh

---

## 1. Pre-Check

EOF

# Step 1: Pre-check - verify we can connect to source
echo "Step 1: Pre-check - Verifying source database connection..."
if PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    log_success "✓ Source database connection successful"
    echo "" >> "$REPORT_FILE"
else
    log_error "✗ Source database connection failed"
    log_error "  Check your TEST_DATABASE_URL or connection parameters"
    exit 1
fi

# Step 2: Check if target database exists, drop it if it does
echo ""
echo "Step 2: Preparing target database..."
if PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB_NAME'" | grep -q 1; then
    log "Target database $TARGET_DB_NAME exists - dropping it..."
    if PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET_DB_NAME\";" > /dev/null 2>&1; then
        log_success "✓ Dropped existing target database"
    else
        log_error "✗ Failed to drop target database"
        exit 1
    fi
else
    log "Target database $TARGET_DB_NAME does not exist - will create it"
fi

# Step 3: Create target database
echo ""
echo "Step 3: Creating target database..."
if PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d postgres -c "CREATE DATABASE \"$TARGET_DB_NAME\";" > /dev/null 2>&1; then
    log_success "✓ Created target database $TARGET_DB_NAME"
else
    log_error "✗ Failed to create target database"
    exit 1
fi

# Step 4: Dump source database
echo ""
echo "Step 4: Dumping source database..."
log "Starting dump of $SOURCE_DB_NAME to $DUMP_FILE..."

if PGPASSWORD="$SOURCE_PASSWORD" pg_dump \
    -h "$SOURCE_HOST" \
    -p "$SOURCE_PORT" \
    -U "$SOURCE_USER" \
    -d "$SOURCE_DB_NAME" \
    --no-owner \
    --no-privileges \
    --format=plain \
    --file="$DUMP_FILE" \
    --verbose 2>&1 | tail -5; then
    
    DUMP_SIZE=$(stat -f%z "$DUMP_FILE" 2>/dev/null || stat -c%s "$DUMP_FILE" 2>/dev/null || echo "unknown")
    log_success "✓ Dump completed successfully (size: $DUMP_SIZE bytes)"
else
    log_error "✗ Failed to dump source database"
    exit 1
fi

# Step 5: Restore to target database
echo ""
echo "Step 5: Restoring dump to target database..."
log "Restoring $DUMP_FILE to $TARGET_DB_NAME..."

if PGPASSWORD="$SOURCE_PASSWORD" psql \
    -h "$SOURCE_HOST" \
    -p "$SOURCE_PORT" \
    -U "$SOURCE_USER" \
    -d "$TARGET_DB_NAME" \
    --file="$DUMP_FILE" \
    --quiet 2>&1 | tail -5; then
    
    log_success "✓ Restore completed successfully"
else
    log_error "✗ Failed to restore database"
    exit 1
fi

# Add to report
cat >> "$REPORT_FILE" << EOF

## 2. Dump and Restore

- **Dump file:** $DUMP_FILE
- **Dump size:** $DUMP_SIZE bytes
- **Restore status:** Success

---

## 3. Row Count Comparison

EOF

# Step 6: Compare row counts
echo ""
echo "Step 6: Comparing row counts..."
log "Comparing row counts between source and target..."

# Get list of tables from source
SOURCE_TABLES=$(PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB_NAME" -At -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name NOT LIKE 'pg_%' 
    AND table_name NOT LIKE 'sql_%' 
    ORDER BY table_name;
" | tr -d ' ')

MISMATCHES=0
TOTAL_TABLES=0
MATCHING_TABLES=0

cat >> "$REPORT_FILE" << EOF
| Table | Source Count | Target Count | Status |
|-------|-------------|-------------|--------|

EOF

for TABLE in $SOURCE_TABLES; do
    if [ -z "$TABLE" ]; then
        continue
    fi
    
    TOTAL_TABLES=$((TOTAL_TABLES + 1))
    
    # Get row count from source
    SOURCE_COUNT=$(PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB_NAME" -At -c "SELECT COUNT(*) FROM \"$TABLE\";" | tr -d ' ')
    
    # Get row count from target
    TARGET_COUNT=$(PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$TARGET_DB_NAME" -At -c "SELECT COUNT(*) FROM \"$TABLE\";" | tr -d ' ')
    
    if [ "$SOURCE_COUNT" = "$TARGET_COUNT" ]; then
        STATUS="✓ Match"
        MATCHING_TABLES=$((MATCHING_TABLES + 1))
        log "  ✓ $TABLE: $SOURCE_COUNT rows"
    else
        STATUS="✗ Mismatch"
        MISMATCHES=$((MISMATCHES + 1))
        log_warning "  ✗ $TABLE: source=$SOURCE_COUNT, target=$TARGET_COUNT"
    fi
    
    echo "| $TABLE | $SOURCE_COUNT | $TARGET_COUNT | $STATUS |" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << EOF

**Summary:** $MATCHING_TABLES/$TOTAL_TABLES tables match, $MISMATCHES mismatches

---

## 4. Trial Balance Comparison

EOF

# Step 7: Compare trial balances
echo ""
echo "Step 7: Comparing trial balances..."
log "Calculating trial balances for both databases..."

# Function to get trial balance from a database
get_trial_balance() {
    local db_name=$1
    PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$db_name" -At -c "
        SELECT 
            COALESCE(SUM(CASE WHEN data->>'type' = 'credit' THEN (data->>'amountCents')::numeric ELSE 0 END), 0) as total_credits,
            COALESCE(SUM(CASE WHEN data->>'type' = 'debit' THEN (data->>'amountCents')::numeric ELSE 0 END), 0) as total_debits,
            COALESCE(SUM(CASE WHEN data->>'type' = 'credit' THEN (data->>'amountCents')::numeric ELSE 0 END) - 
            COALESCE(SUM(CASE WHEN data->>'type' = 'debit' THEN (data->>'amountCents')::numeric ELSE 0 END), 0) as net_balance
        FROM transactions 
        WHERE data->>'isPosted' = 'true';
    " | tr -d ' '
}

SOURCE_BALANCE=$(get_trial_balance "$SOURCE_DB_NAME")
TARGET_BALANCE=$(get_trial_balance "$TARGET_DB_NAME")

cat >> "$REPORT_FILE" << EOF
| Database | Total Credits | Total Debits | Net Balance |
|----------|--------------|-------------|-------------|
| Source | $SOURCE_BALANCE |  |  |
| Target | $TARGET_BALANCE |  |  |

EOF

if [ "$SOURCE_BALANCE" = "$TARGET_BALANCE" ]; then
    log_success "✓ Trial balances match"
    echo "**Trial Balance Status:** ✓ Match" >> "$REPORT_FILE"
else
    log_error "✗ Trial balances DO NOT match"
    echo "**Trial Balance Status:** ✗ MISMATCH" >> "$REPORT_FILE"
    MISMATCHES=$((MISMATCHES + 1))
fi

# Step 8: Cleanup
echo ""
echo "Step 8: Cleaning up..."
log "Removing temporary dump file..."
rm -f "$DUMP_FILE"
log "✓ Temporary dump file removed"

# Step 9: Generate final report
echo ""
echo "Step 9: Generating final report..."

FINAL_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DURATION=$(( $(date +%s) - $(stat -c%Y "$REPORT_FILE" 2>/dev/null || echo 0) ))

cat >> "$REPORT_FILE" << EOF

---

## 5. Summary

- **Started:** $TIMESTAMP
- **Completed:** $FINAL_TIMESTAMP
- **Duration:** ${DURATION}s
- **Tables checked:** $TOTAL_TABLES
- **Tables matching:** $MATCHING_TABLES
- **Tables with mismatches:** $MISMATCHES
- **Trial balance:** $( [ "$SOURCE_BALANCE" = "$TARGET_BALANCE" ] && echo "✓ Match" || echo "✗ Mismatch")

EOF

if [ $MISMATCHES -eq 0 ]; then
    cat >> "$REPORT_FILE" << EOF
**Result:** ✅ PASS - Restore drill completed successfully with no discrepancies

EOF
    log_success "✅ Restore drill PASSED - No discrepancies found"
    log_success "Report saved to: $REPORT_FILE"
else
    cat >> "$REPORT_FILE" << EOF
**Result:** ❌ FAIL - Restore drill found $MISMATCHES discrepancies

EOF
    log_error "❌ Restore drill FAILED - $MISMATCHES discrepancies found"
    log_error "Report saved to: $REPORT_FILE"
    exit 1
fi

# Final output
cat >> "$REPORT_FILE" << EOF

---

*This report was generated automatically by scripts/restore-drill.sh*
*For local testing only - not for production use*
EOF

echo ""
echo "=========================================="
echo "Restore Drill Complete"
echo "Report: $REPORT_FILE"
echo "=========================================="

exit 0
