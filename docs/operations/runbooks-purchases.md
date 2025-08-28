# Purchases & Payments Operations - Grahmos V1+V2 Unified

## 💳 Payment Processing Operations

This runbook covers payment processing, purchase reconciliation, and financial operations for the Grahmos V1+V2 unified system with offline capabilities.

## 🛒 Offline Purchase Guardrails

### Objective: Enforce per‑device caps and risk controls for offline transactions

**Action:** Enforce per‑device caps ($X/day, N tx/day), TTL 24–48h, allow card present only; show offline disclaimer.

### Offline Purchase Limits

```bash
# Default offline purchase limits
OFFLINE_DAILY_AMOUNT_LIMIT=500.00    # $500 per device per day
OFFLINE_DAILY_TX_LIMIT=10            # 10 transactions per device per day
OFFLINE_TX_TTL=48                    # 48 hours to sync
OFFLINE_SINGLE_TX_LIMIT=100.00       # $100 per transaction
```

### Risk Controls Implementation

```typescript
interface OfflinePurchaseControls {
  deviceLimits: {
    dailyAmount: number;
    dailyTransactionCount: number;
    singleTransactionLimit: number;
    rollingWindowHours: number;
  };
  
  riskFactors: {
    cardPresent: boolean;
    biometricAuth: boolean;
    deviceTrusted: boolean;
    locationConsistent: boolean;
  };
  
  disclaimers: {
    offlineMode: string;
    pendingSync: string;
    riskNotification: string;
  };
}

class OfflinePurchaseManager {
  async validateOfflinePurchase(request: PurchaseRequest): Promise<ValidationResult> {
    // Check device limits
    const dailyUsage = await this.getDailyUsage(request.deviceId);
    if (dailyUsage.amount + request.amount > this.limits.dailyAmount) {
      return { valid: false, reason: 'Daily amount limit exceeded' };
    }
    
    if (dailyUsage.transactionCount >= this.limits.dailyTransactionCount) {
      return { valid: false, reason: 'Daily transaction limit exceeded' };
    }
    
    // Validate single transaction limit
    if (request.amount > this.limits.singleTransactionLimit) {
      return { valid: false, reason: 'Single transaction limit exceeded' };
    }
    
    // Risk assessment
    const riskScore = await this.assessRisk(request);
    if (riskScore > this.riskThreshold) {
      return { valid: false, reason: 'High risk transaction - online verification required' };
    }
    
    return { valid: true };
  }
  
  async createOfflinePurchase(request: PurchaseRequest): Promise<OfflineTransaction> {
    const transaction: OfflineTransaction = {
      id: this.generateTransactionId(),
      deviceId: request.deviceId,
      amount: request.amount,
      merchantId: request.merchantId,
      cardToken: request.cardToken,
      timestamp: Date.now(),
      expiresAt: Date.now() + (this.OFFLINE_TX_TTL * 60 * 60 * 1000),
      status: 'pending_sync',
      riskScore: await this.assessRisk(request),
      disclaimerShown: true
    };
    
    // Store locally for sync
    await this.storeOfflineTransaction(transaction);
    
    // Update device limits
    await this.updateDeviceLimits(request.deviceId, request.amount);
    
    return transaction;
  }
}
```

### Offline Purchase UI Flow

```typescript
// Offline purchase disclaimer and confirmation
class OfflinePurchaseUI {
  async showOfflineDisclaimer(amount: number): Promise<boolean> {
    const disclaimer = `
      ⚠️ Offline Purchase Notice
      
      • This transaction will be processed offline
      • Amount: $${amount.toFixed(2)}
      • Sync required within 48 hours
      • Transaction may be declined if card/account issues exist
      • Full amount will be held until sync completes
      
      Do you want to continue?
    `;
    
    return await this.showConfirmDialog(disclaimer);
  }
  
  async showRiskWarning(riskFactors: string[]): Promise<boolean> {
    const warning = `
      🔒 Additional Verification Required
      
      Risk factors detected:
      ${riskFactors.map(factor => `• ${factor}`).join('\n')}
      
      Please complete online verification or use alternative payment.
    `;
    
    return await this.showWarningDialog(warning);
  }
}
```

### Risk Rules Implementation

```bash
# High-risk BIN (Bank Identification Number) blocking
HIGH_RISK_BINS=(
  "123456"  # Example high-risk BIN
  "654321"  # Another example
)

# Risk assessment function
assess_purchase_risk() {
  local card_bin=$1
  local amount=$2
  local device_id=$3
  local location=$4
  
  risk_score=0
  
  # Check high-risk BINs
  for bin in "${HIGH_RISK_BINS[@]}"; do
    if [[ "$card_bin" == "$bin"* ]]; then
      risk_score=$((risk_score + 50))
      echo "High-risk BIN detected: $bin"
    fi
  done
  
  # Large amount risk
  if (( $(echo "$amount > 200" | bc -l) )); then
    risk_score=$((risk_score + 25))
  fi
  
  # Location consistency check
  if ! check_location_consistency "$device_id" "$location"; then
    risk_score=$((risk_score + 30))
  fi
  
  echo $risk_score
}
```

## 🔄 Reconciliation & Revocation

### Procedure: Sync and reconcile offline transactions

**Objective:** Handle offline transaction synchronization, capture, and revocation processes.

### Reconciliation Process

```bash
#!/bin/bash
# reconcile-offline-purchases.sh

reconcile_offline_transactions() {
  local batch_size=100
  local total_processed=0
  
  log "Starting offline transaction reconciliation..."
  
  # Get pending offline transactions
  local pending_txs=$(./scripts/get-pending-transactions.sh --status=pending_sync --limit=$batch_size)
  
  for tx_id in $pending_txs; do
    reconcile_single_transaction "$tx_id"
    ((total_processed++))
  done
  
  log "Reconciliation complete. Processed: $total_processed transactions"
  generate_reconciliation_report "$total_processed"
}

reconcile_single_transaction() {
  local tx_id=$1
  
  log "Reconciling transaction: $tx_id"
  
  # 1. Retrieve transaction details
  local tx_data=$(./scripts/get-transaction.sh --id="$tx_id")
  local amount=$(echo "$tx_data" | jq -r '.amount')
  local card_token=$(echo "$tx_data" | jq -r '.cardToken')
  local merchant_id=$(echo "$tx_data" | jq -r '.merchantId')
  
  # 2. Attempt capture with payment processor
  local capture_result=$(attempt_capture "$tx_id" "$amount" "$card_token")
  
  if [[ "$capture_result" == "success" ]]; then
    # 3a. Successful capture
    log "✅ Transaction $tx_id captured successfully"
    update_transaction_status "$tx_id" "captured"
    update_entitlement_status "$tx_id" "active"
    
  elif [[ "$capture_result" == "declined" ]]; then
    # 3b. Declined transaction - revoke within 5 minutes
    log "❌ Transaction $tx_id declined - initiating revocation"
    revoke_transaction "$tx_id"
    
  else
    # 3c. Processing error - retry later
    log "⚠️ Transaction $tx_id processing error - will retry"
    update_transaction_status "$tx_id" "retry_required"
  fi
}

attempt_capture() {
  local tx_id=$1
  local amount=$2
  local card_token=$3
  
  # Call payment processor API
  curl -X POST "${PAYMENT_PROCESSOR_URL}/capture" \
    -H "Authorization: Bearer ${PROCESSOR_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"transaction_id\": \"$tx_id\",
      \"amount\": $amount,
      \"card_token\": \"$card_token\",
      \"capture_method\": \"offline_reconciliation\"
    }" | jq -r '.status'
}

revoke_transaction() {
  local tx_id=$1
  
  log "🔄 Revoking transaction $tx_id within 5-minute SLA"
  
  # 1. Update transaction status
  update_transaction_status "$tx_id" "revoked"
  
  # 2. Revoke entitlement immediately
  revoke_entitlement "$tx_id"
  
  # 3. Notify user of revocation
  notify_user_revocation "$tx_id"
  
  # 4. Log for audit trail
  log "Transaction $tx_id revoked at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

revoke_entitlement() {
  local tx_id=$1
  
  # Update entitlement status to revoked
  curl -X PATCH "${API_BASE_URL}/entitlements/by-transaction/$tx_id" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"status": "revoked", "revoked_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
    || log "ERROR: Failed to revoke entitlement for transaction $tx_id"
}

notify_user_revocation() {
  local tx_id=$1
  local user_id=$(get_transaction_user "$tx_id")
  
  # Send push notification
  ./scripts/send-notification.sh \
    --user-id="$user_id" \
    --type="payment_declined" \
    --title="Payment Declined" \
    --message="Your recent purchase could not be processed. Please try again with a different payment method."
  
  # Send email notification
  ./scripts/send-email.sh \
    --user-id="$user_id" \
    --template="payment_declined" \
    --data="{\"transaction_id\": \"$tx_id\"}"
}
```

### Weekly Audit & Drift Detection

```bash
#!/bin/bash
# weekly-reconciliation-audit.sh

perform_weekly_audit() {
  local week_start=$(date -d '7 days ago' +%Y-%m-%d)
  local week_end=$(date +%Y-%m-%d)
  
  log "🔍 Performing weekly reconciliation audit: $week_start to $week_end"
  
  # 1. Compare ledger vs processor records
  local ledger_total=$(get_ledger_total "$week_start" "$week_end")
  local processor_total=$(get_processor_total "$week_start" "$week_end")
  
  local drift=$(echo "$ledger_total - $processor_total" | bc)
  local drift_percentage=$(echo "scale=2; ($drift / $ledger_total) * 100" | bc)
  
  log "Ledger total: $ledger_total"
  log "Processor total: $processor_total"
  log "Drift: $drift (${drift_percentage}%)"
  
  # 2. Check drift threshold
  local max_drift_percentage=2.0
  if (( $(echo "$drift_percentage > $max_drift_percentage" | bc -l) )); then
    log "⚠️ ALERT: Reconciliation drift exceeds threshold!"
    create_drift_incident "$drift" "$drift_percentage"
  else
    log "✅ Reconciliation drift within acceptable range"
  fi
  
  # 3. Generate detailed reconciliation report
  generate_weekly_report "$week_start" "$week_end" "$drift"
}

create_drift_incident() {
  local drift_amount=$1
  local drift_percentage=$2
  
  # Create incident in ticketing system
  curl -X POST "${INCIDENT_SYSTEM_URL}/incidents" \
    -H "Authorization: Bearer ${INCIDENT_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"Payment Reconciliation Drift Detected\",
      \"description\": \"Weekly reconciliation shows drift of $drift_amount (${drift_percentage}%)\",
      \"priority\": \"high\",
      \"category\": \"financial\",
      \"assignee\": \"finance-team\",
      \"tags\": [\"reconciliation\", \"payment\", \"audit\"]
    }"
  
  # Send Slack alert
  ./scripts/send-slack-alert.sh \
    --channel="#finance-alerts" \
    --message="🚨 Payment reconciliation drift detected: $drift_amount (${drift_percentage}%). Incident created."
}
```

## 💰 Refunds & Disputes

### Refund Processing Workflow

**Action:** Refund API path; ledger updated; entitlement set to `revoked`; attach processor evidence.

```typescript
interface RefundRequest {
  transactionId: string;
  reason: RefundReason;
  amount?: number; // Partial refund amount (optional)
  requestedBy: string;
  customerReason?: string;
}

enum RefundReason {
  CUSTOMER_REQUEST = 'customer_request',
  TECHNICAL_ERROR = 'technical_error',
  DUPLICATE_CHARGE = 'duplicate_charge',
  FRAUD_PREVENTION = 'fraud_prevention',
  CHARGEBACK = 'chargeback'
}

class RefundProcessor {
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    try {
      // 1. Validate refund eligibility
      const transaction = await this.getTransaction(request.transactionId);
      if (!this.isRefundEligible(transaction)) {
        throw new Error('Transaction not eligible for refund');
      }
      
      // 2. Calculate refund amount
      const refundAmount = request.amount || transaction.amount;
      if (refundAmount > transaction.amount) {
        throw new Error('Refund amount exceeds original transaction');
      }
      
      // 3. Process refund with payment processor
      const processorResult = await this.submitRefundToProcessor({
        transactionId: request.transactionId,
        amount: refundAmount,
        reason: request.reason
      });
      
      // 4. Update internal ledger
      await this.updateLedger({
        originalTransactionId: request.transactionId,
        refundAmount: refundAmount,
        refundId: processorResult.refundId,
        status: 'processed',
        processedAt: new Date()
      });
      
      // 5. Revoke entitlement
      await this.revokeEntitlement(request.transactionId, {
        reason: 'refund_processed',
        refundId: processorResult.refundId,
        amount: refundAmount
      });
      
      // 6. Attach processor evidence
      await this.attachProcessorEvidence(request.transactionId, {
        refundId: processorResult.refundId,
        processorResponse: processorResult.rawResponse,
        evidenceType: 'refund_confirmation'
      });
      
      // 7. Notify customer
      await this.notifyCustomer({
        transactionId: request.transactionId,
        refundAmount: refundAmount,
        refundId: processorResult.refundId,
        expectedProcessingTime: '3-5 business days'
      });
      
      return {
        success: true,
        refundId: processorResult.refundId,
        amount: refundAmount,
        estimatedArrival: this.calculateRefundArrival(transaction.paymentMethod)
      };
      
    } catch (error) {
      await this.logRefundError(request, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async revokeEntitlement(transactionId: string, refundInfo: RefundInfo): Promise<void> {
    await this.entitlementService.updateEntitlement(transactionId, {
      status: 'revoked',
      revokedReason: refundInfo.reason,
      revokedAt: new Date(),
      refundReference: refundInfo.refundId,
      refundAmount: refundInfo.amount
    });
  }
}
```

### Refund Operations Scripts

```bash
#!/bin/bash
# refund-operations.sh

process_refund() {
  local transaction_id=$1
  local refund_reason=$2
  local refund_amount=$3
  local requested_by=$4
  
  log "Processing refund for transaction: $transaction_id"
  
  # 1. Validate transaction exists and is refundable
  if ! validate_refund_eligibility "$transaction_id"; then
    log "ERROR: Transaction $transaction_id not eligible for refund"
    return 1
  fi
  
  # 2. Submit refund to payment processor
  local refund_id=$(submit_processor_refund "$transaction_id" "$refund_amount" "$refund_reason")
  if [[ -z "$refund_id" ]]; then
    log "ERROR: Failed to process refund with payment processor"
    return 1
  fi
  
  # 3. Update internal ledger
  update_ledger_refund "$transaction_id" "$refund_id" "$refund_amount"
  
  # 4. Revoke entitlement
  revoke_entitlement_refund "$transaction_id" "$refund_id"
  
  # 5. Update transaction status
  update_transaction_status "$transaction_id" "refunded"
  
  # 6. Create audit trail
  create_refund_audit_record "$transaction_id" "$refund_id" "$refund_reason" "$requested_by"
  
  # 7. Notify customer
  notify_customer_refund "$transaction_id" "$refund_id" "$refund_amount"
  
  log "✅ Refund processed successfully: $refund_id"
  return 0
}

submit_processor_refund() {
  local transaction_id=$1
  local amount=$2
  local reason=$3
  
  curl -X POST "${PAYMENT_PROCESSOR_URL}/refunds" \
    -H "Authorization: Bearer ${PROCESSOR_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"transaction_id\": \"$transaction_id\",
      \"amount\": $amount,
      \"reason\": \"$reason\",
      \"metadata\": {
        \"system\": \"grahmos\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
      }
    }" | jq -r '.refund_id'
}

# Batch refund processing for system errors
process_batch_refunds() {
  local refund_file=$1
  local batch_id=$(uuidgen)
  
  log "Processing batch refunds from file: $refund_file (Batch ID: $batch_id)"
  
  local total_refunds=0
  local successful_refunds=0
  local failed_refunds=0
  
  while IFS=',' read -r transaction_id refund_reason refund_amount; do
    ((total_refunds++))
    
    if process_refund "$transaction_id" "$refund_reason" "$refund_amount" "system_batch"; then
      ((successful_refunds++))
    else
      ((failed_refunds++))
      echo "$transaction_id,$refund_reason,$refund_amount" >> "failed_refunds_${batch_id}.csv"
    fi
  done < "$refund_file"
  
  log "Batch refund processing complete:"
  log "  Total: $total_refunds"
  log "  Successful: $successful_refunds"  
  log "  Failed: $failed_refunds"
  
  # Generate batch report
  generate_batch_refund_report "$batch_id" "$total_refunds" "$successful_refunds" "$failed_refunds"
}
```

### Dispute Management

```bash
#!/bin/bash
# dispute-management.sh

handle_chargeback() {
  local transaction_id=$1
  local chargeback_id=$2
  local chargeback_reason=$3
  local chargeback_amount=$4
  
  log "🚨 Chargeback received: $chargeback_id for transaction: $transaction_id"
  
  # 1. Immediately revoke entitlement
  revoke_entitlement_chargeback "$transaction_id" "$chargeback_id"
  
  # 2. Update transaction status
  update_transaction_status "$transaction_id" "charged_back"
  
  # 3. Collect evidence for dispute
  collect_dispute_evidence "$transaction_id" "$chargeback_id"
  
  # 4. Create dispute case
  create_dispute_case "$transaction_id" "$chargeback_id" "$chargeback_reason"
  
  # 5. Notify relevant teams
  notify_dispute_teams "$transaction_id" "$chargeback_id" "$chargeback_reason"
  
  log "Chargeback handling initiated for: $chargeback_id"
}

collect_dispute_evidence() {
  local transaction_id=$1
  local chargeback_id=$2
  
  local evidence_dir="disputes/evidence/$chargeback_id"
  mkdir -p "$evidence_dir"
  
  # Collect transaction details
  ./scripts/get-transaction-details.sh --id="$transaction_id" > "$evidence_dir/transaction_details.json"
  
  # Collect device/session information
  ./scripts/get-device-info.sh --transaction-id="$transaction_id" > "$evidence_dir/device_info.json"
  
  # Collect delivery confirmation (if applicable)
  ./scripts/get-delivery-confirmation.sh --transaction-id="$transaction_id" > "$evidence_dir/delivery.json"
  
  # Collect customer communication logs
  ./scripts/get-customer-communications.sh --transaction-id="$transaction_id" > "$evidence_dir/communications.json"
  
  # Generate evidence package
  tar -czf "$evidence_dir.tar.gz" -C disputes/evidence "$chargeback_id"
  
  log "Evidence collected for chargeback: $chargeback_id"
}
```

## 📊 Purchase Analytics & Reporting

### Financial Reporting

```bash
#!/bin/bash
# financial-reporting.sh

generate_daily_financial_report() {
  local report_date=${1:-$(date +%Y-%m-%d)}
  local report_file="reports/financial/daily_report_${report_date}.json"
  
  log "Generating daily financial report for: $report_date"
  
  # Calculate key metrics
  local total_revenue=$(calculate_daily_revenue "$report_date")
  local total_transactions=$(count_daily_transactions "$report_date")
  local refund_amount=$(calculate_daily_refunds "$report_date")
  local chargeback_amount=$(calculate_daily_chargebacks "$report_date")
  local net_revenue=$(echo "$total_revenue - $refund_amount - $chargeback_amount" | bc)
  
  # Generate report
  cat > "$report_file" << EOF
{
  "date": "$report_date",
  "revenue": {
    "gross": $total_revenue,
    "refunds": $refund_amount,
    "chargebacks": $chargeback_amount,
    "net": $net_revenue
  },
  "transactions": {
    "total": $total_transactions,
    "successful": $(count_successful_transactions "$report_date"),
    "failed": $(count_failed_transactions "$report_date"),
    "offline": $(count_offline_transactions "$report_date")
  },
  "reconciliation": {
    "pending_sync": $(count_pending_sync_transactions "$report_date"),
    "reconciled": $(count_reconciled_transactions "$report_date"),
    "discrepancies": $(count_reconciliation_discrepancies "$report_date")
  }
}
EOF

  log "Daily financial report generated: $report_file"
  
  # Send to stakeholders
  ./scripts/send-financial-report.sh --file="$report_file" --recipients="finance-team@company.com"
}

# Monthly reconciliation summary
generate_monthly_reconciliation() {
  local month=${1:-$(date +%Y-%m)}
  
  log "Generating monthly reconciliation for: $month"
  
  # Reconciliation accuracy metrics
  local total_transactions=$(count_monthly_transactions "$month")
  local reconciled_transactions=$(count_reconciled_monthly_transactions "$month")
  local reconciliation_rate=$(echo "scale=2; ($reconciled_transactions / $total_transactions) * 100" | bc)
  
  # Financial drift analysis
  local total_drift=$(calculate_monthly_drift "$month")
  local avg_daily_drift=$(echo "scale=2; $total_drift / 30" | bc)
  
  echo "Monthly Reconciliation Summary - $month"
  echo "Total Transactions: $total_transactions"
  echo "Reconciled: $reconciled_transactions ($reconciliation_rate%)"
  echo "Total Drift: \$$total_drift"
  echo "Average Daily Drift: \$$avg_daily_drift"
}
```

---

## 🚨 Purchase Emergency Procedures

### System-Wide Purchase Issues

```bash
#!/bin/bash
# purchase-emergency-procedures.sh

# Emergency: Stop all purchases
emergency_stop_purchases() {
  local reason=$1
  
  log "🚨 EMERGENCY: Stopping all purchases - Reason: $reason"
  
  # 1. Set global purchase disabled flag
  redis-cli SET purchases:global:disabled "true"
  redis-cli SET purchases:disabled:reason "$reason"
  redis-cli SET purchases:disabled:timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  
  # 2. Update API configuration
  curl -X POST "${API_BASE_URL}/admin/purchases/disable" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d "{\"reason\": \"$reason\"}"
  
  # 3. Notify all services
  ./scripts/notify-services.sh --message="purchases_disabled" --reason="$reason"
  
  # 4. Alert operations team
  ./scripts/send-alert.sh \
    --severity="critical" \
    --message="Purchases disabled system-wide: $reason"
  
  log "✅ Purchase system disabled successfully"
}

# Emergency: Resume purchases
emergency_resume_purchases() {
  local authorized_by=$1
  
  log "🟢 RESUMING: Purchase system - Authorized by: $authorized_by"
  
  # 1. Remove global disabled flag
  redis-cli DEL purchases:global:disabled
  redis-cli DEL purchases:disabled:reason
  redis-cli DEL purchases:disabled:timestamp
  
  # 2. Update API configuration
  curl -X POST "${API_BASE_URL}/admin/purchases/enable" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d "{\"authorized_by\": \"$authorized_by\"}"
  
  # 3. Run system health check
  ./scripts/health-check.sh --focus=purchases
  
  # 4. Notify resumption
  ./scripts/send-alert.sh \
    --severity="info" \
    --message="Purchase system resumed by $authorized_by"
  
  log "✅ Purchase system resumed successfully"
}
```

---

## 📞 Purchase Support Contacts

- **Finance Team**: finance@company.com
- **Payment Operations**: payments@company.com
- **Fraud Team**: fraud@company.com
- **Customer Support**: support@company.com
- **Emergency Escalation**: +1-XXX-XXX-XXXX

---

**Last Updated**: $(date)  
**Version**: 2.0.0  
**Owner**: Finance & Payments Team
