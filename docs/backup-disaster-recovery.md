# Backup & Disaster Recovery Plan
**AutoLumiku Multi-Tenant SaaS Platform**

**Document Version:** 1.0
**Last Updated:** 2025-11-23
**Owner:** DevOps Team / Platform Admin
**Review Schedule:** Quarterly

---

## 📋 Executive Summary

This document outlines the backup strategy and disaster recovery procedures for AutoLumiku platform to ensure business continuity and data protection.

**Key Metrics:**
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 24 hours
- **Backup Frequency:** Daily (automated)
- **Backup Retention:** 30 days
- **DR Testing:** Quarterly

---

## 🎯 Objectives

### Primary Goals:
1. ✅ Protect all tenant data from loss
2. ✅ Enable rapid recovery from infrastructure failures
3. ✅ Maintain business continuity during disasters
4. ✅ Comply with data protection requirements (UU PDP Indonesia)

### Success Criteria:
- Zero data loss for transactions within 24 hours
- Full system recovery within 4 hours of failure
- Automated backup processes with monitoring
- Regular tested recovery procedures

---

## 💾 Backup Strategy

### 1. Database Backups

#### **PostgreSQL Database**

**Method:** Automated PostgreSQL Backups

```yaml
Backup Configuration:
  Frequency: Daily at 02:00 WIB
  Retention: 30 days
  Type: Full database dump + WAL archiving
  Storage: AWS S3 / Google Cloud Storage
  Encryption: AES-256
  Compression: gzip
```

**Implementation:**

```bash
# Automated daily backup script
#!/bin/bash
# /scripts/backup-database.sh

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="autolumiku_backup_${BACKUP_DATE}.sql.gz"
S3_BUCKET="s3://autolumiku-backups/database/"

# Dump database
pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} \
  --format=custom --compress=9 \
  | gzip > /tmp/${BACKUP_FILE}

# Encrypt backup
openssl enc -aes-256-cbc -salt \
  -in /tmp/${BACKUP_FILE} \
  -out /tmp/${BACKUP_FILE}.enc \
  -k ${BACKUP_ENCRYPTION_KEY}

# Upload to S3
aws s3 cp /tmp/${BACKUP_FILE}.enc ${S3_BUCKET}

# Cleanup local files
rm /tmp/${BACKUP_FILE}*

# Log completion
echo "[$(date)] Backup completed: ${BACKUP_FILE}" >> /var/log/backups.log
```

**Cron Schedule:**
```cron
# Daily backup at 2 AM WIB
0 2 * * * /scripts/backup-database.sh
```

**Point-in-Time Recovery (PITR):**
```yaml
WAL Archiving:
  Enabled: Yes
  Archive Location: S3 bucket
  Retention: 7 days
  Purpose: Restore to any point in last 7 days
```

---

### 2. File Storage Backups

#### **Vehicle Photos & Documents**

**Method:** CDN + S3 Versioning

```yaml
Storage Configuration:
  Primary: AWS S3 / Cloudflare R2
  CDN: CloudFlare / AWS CloudFront
  Versioning: Enabled
  Lifecycle:
    - Current version: Permanent
    - Old versions: 30 days retention
  Replication: Multi-region (Jakarta + Singapore)
```

**Folder Structure:**
```
s3://autolumiku-media/
├── vehicles/
│   ├── {tenant-id}/
│   │   ├── {vehicle-id}/
│   │   │   ├── photo-1.jpg
│   │   │   ├── photo-2.jpg
│   │   │   └── documents/
│   │   │       └── registration.pdf
├── tenants/
│   ├── {tenant-id}/
│   │   ├── logo.png
│   │   └── branding/
└── backups/
    └── {date}/
```

**Backup Strategy:**
- ✅ S3 versioning enabled (automatic)
- ✅ Cross-region replication (Jakarta → Singapore)
- ✅ Daily snapshot to backup bucket
- ✅ Lifecycle policy for old versions

---

### 3. Application Code & Configuration

#### **Source Code**

**Method:** Git Repository

```yaml
Repository: https://github.com/yoppiari/autolumiku.git
Backup: Automatic (GitHub infrastructure)
Branches Protected: main, production
Backup Locations:
  - GitHub (primary)
  - GitLab mirror (secondary)
  - Local archive (tertiary)
```

#### **Environment Variables & Secrets**

**Method:** Encrypted Vault

```yaml
Storage: AWS Secrets Manager / HashiCorp Vault
Encryption: KMS managed keys
Backup: Automatic vault snapshots
Access Control: IAM roles with MFA
```

**Critical Secrets:**
```
- DATABASE_URL
- JWT_SECRET
- API_KEYS (z.ai, payment gateway)
- SMTP credentials
- S3 access keys
```

---

### 4. Configuration Files

**Infrastructure as Code (IaC):**

```yaml
Tool: Terraform / Pulumi
Repository: autolumiku-infrastructure (private)
Backup: Git + S3 state files
State Locking: DynamoDB
```

**Docker Configurations:**
```
Location: /docker-compose.yml, /Dockerfile
Backup: Git repository
Versioning: Semantic versioning tags
```

---

## 🔄 Backup Verification

### Automated Checks

```bash
# Daily backup verification script
# /scripts/verify-backup.sh

#!/bin/bash
LATEST_BACKUP=$(aws s3 ls ${S3_BUCKET} | tail -1 | awk '{print $4}')

# Check backup exists
if [ -z "$LATEST_BACKUP" ]; then
  echo "ERROR: No backup found!"
  send_alert "Backup verification failed"
  exit 1
fi

# Check backup size (should be > 100MB)
BACKUP_SIZE=$(aws s3 ls ${S3_BUCKET}${LATEST_BACKUP} | awk '{print $3}')
if [ $BACKUP_SIZE -lt 104857600 ]; then
  echo "ERROR: Backup too small: ${BACKUP_SIZE} bytes"
  send_alert "Backup size anomaly"
  exit 1
fi

# Test restore (sample data)
pg_restore --test /tmp/test_restore.sql < ${LATEST_BACKUP}
if [ $? -ne 0 ]; then
  echo "ERROR: Backup file corrupted"
  send_alert "Backup restore test failed"
  exit 1
fi

echo "SUCCESS: Backup verified"
```

### Monthly Manual Checks
- [ ] Download random backup file
- [ ] Verify decryption works
- [ ] Test restore to staging environment
- [ ] Validate data integrity
- [ ] Document results in backup log

---

## 🚨 Disaster Recovery Procedures

### DR Scenarios

#### **Scenario 1: Database Failure**

**Symptoms:**
- Database connection errors
- Data corruption detected
- Primary DB instance down

**Recovery Steps:**

```bash
# 1. Assess the damage
psql -h ${DB_HOST} -U ${DB_USER} -c "SELECT version();"

# 2. Download latest backup
aws s3 cp s3://autolumiku-backups/database/latest.sql.gz.enc /tmp/

# 3. Decrypt backup
openssl enc -aes-256-cbc -d \
  -in /tmp/latest.sql.gz.enc \
  -out /tmp/latest.sql.gz \
  -k ${BACKUP_ENCRYPTION_KEY}

# 4. Decompress
gunzip /tmp/latest.sql.gz

# 5. Restore database
pg_restore -h ${DB_HOST} -U ${DB_USER} \
  --clean --if-exists \
  -d ${DB_NAME} /tmp/latest.sql

# 6. Verify data
psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} \
  -c "SELECT COUNT(*) FROM tenants;"

# 7. Restart application
systemctl restart autolumiku

# 8. Monitor logs
tail -f /var/log/autolumiku/app.log
```

**Expected Recovery Time:** 2-3 hours

---

#### **Scenario 2: Complete Infrastructure Failure**

**Symptoms:**
- All services down
- Server unreachable
- Regional outage

**Recovery Steps:**

**Phase 1: Activate DR Site (0-1 hour)**
```bash
# 1. Spin up new infrastructure in backup region
cd autolumiku-infrastructure/
terraform init
terraform plan -var="region=ap-southeast-3" # Singapore
terraform apply

# 2. Deploy application
docker-compose pull
docker-compose up -d
```

**Phase 2: Restore Database (1-2 hours)**
```bash
# Follow "Scenario 1: Database Failure" steps above
```

**Phase 3: Restore File Storage (2-3 hours)**
```bash
# S3 cross-region replication handles this automatically
# Verify sync status
aws s3 ls s3://autolumiku-media-dr/
```

**Phase 4: DNS Cutover (3-4 hours)**
```bash
# Update DNS to point to DR site
# Update A records:
# autolumiku.com -> {DR_IP}
# api.autolumiku.com -> {DR_IP}

# Wait for DNS propagation (up to 1 hour)
```

**Expected Recovery Time:** 4 hours

---

#### **Scenario 3: Data Corruption / Ransomware**

**Symptoms:**
- Unusual data changes
- Encrypted files
- Suspicious database modifications

**Recovery Steps:**

```bash
# 1. IMMEDIATELY ISOLATE
# Disconnect from internet
sudo iptables -A INPUT -j DROP
sudo iptables -A OUTPUT -j DROP

# 2. Identify corruption timestamp
# Check audit logs
SELECT * FROM audit_logs
WHERE created_at > '2025-11-23 00:00:00'
ORDER BY created_at DESC;

# 3. Restore to point before corruption
# Use PITR (Point-in-Time Recovery)
pg_restore --target-time="2025-11-23 08:00:00" \
  /path/to/backup

# 4. Verify restored data
# Run data integrity checks

# 5. Investigate breach
# Analyze security logs
# Patch vulnerabilities
```

**Expected Recovery Time:** 4-6 hours (+ investigation time)

---

## 📊 Backup Monitoring

### Metrics to Track

```yaml
Daily Metrics:
  - Backup completion status (success/fail)
  - Backup file size (detect anomalies)
  - Backup duration (detect performance issues)
  - Storage usage (prevent quota exceeded)

Weekly Metrics:
  - Backup success rate (should be 100%)
  - Average backup size trend
  - Recovery test results

Monthly Metrics:
  - Storage costs
  - Data growth rate
  - Compliance audit results
```

### Alerts Configuration

```yaml
Critical Alerts (immediate):
  - Backup failed
  - Backup file corrupted
  - Storage quota > 90%
  - Encryption key rotation due

Warning Alerts (within 24h):
  - Backup size anomaly (±30%)
  - Backup duration > 2x normal
  - Backup verification failed
```

**Alert Channels:**
- Email: devops@autolumiku.com
- Slack: #alerts-production
- PagerDuty: On-call engineer

---

## 🔐 Security & Compliance

### Encryption

**Data at Rest:**
- ✅ Database backups: AES-256 encryption
- ✅ File storage: S3 server-side encryption (SSE)
- ✅ Secrets: KMS managed encryption keys

**Data in Transit:**
- ✅ Backup uploads: HTTPS/TLS 1.3
- ✅ Replication: Encrypted connections
- ✅ DR sync: VPN tunnel

### Access Control

**Backup Access Roles:**
```yaml
Administrators:
  - Can create/delete backups
  - Can restore to production
  - Requires MFA

DevOps Team:
  - Can view backup status
  - Can restore to staging
  - Read-only access to logs

Automated Systems:
  - Can create backups (write-only)
  - Cannot delete backups
  - Service account with rotation
```

### Compliance (UU PDP Indonesia)

- ✅ Data stored in Indonesia (Jakarta region)
- ✅ Backup retention aligns with legal requirements
- ✅ Encryption meets regulatory standards
- ✅ Audit trail for all backup operations
- ✅ Right to deletion honored (soft delete + backup purge)

---

## 🧪 DR Testing Schedule

### Quarterly DR Drill

**Objectives:**
- Validate recovery procedures work
- Train team on DR process
- Identify improvement opportunities
- Update documentation

**Test Plan:**
```markdown
Q1 Test (March): Database restore test
- Restore latest backup to staging
- Verify data integrity
- Measure recovery time
- Document results

Q2 Test (June): Full infrastructure failover
- Activate DR site in Singapore
- DNS cutover
- Application deployment
- End-to-end testing
- Rollback to primary

Q3 Test (September): Ransomware simulation
- Simulate data corruption
- Point-in-time recovery
- Security patching
- Incident response practice

Q4 Test (December): Multi-component failure
- Database + Storage failure
- Complete recovery
- Document lessons learned
- Update DR plan
```

### DR Drill Checklist

- [ ] Schedule maintenance window
- [ ] Notify stakeholders
- [ ] Backup production (pre-drill snapshot)
- [ ] Execute drill scenario
- [ ] Time each recovery step
- [ ] Verify system functionality
- [ ] Document issues encountered
- [ ] Update procedures based on findings
- [ ] Share results with team

---

## 📞 Emergency Contacts

### On-Call Escalation

```
L1: DevOps Engineer
  - Name: [TBD]
  - Phone: +62-xxx-xxxx-xxxx
  - Slack: @devops-oncall

L2: Platform Lead
  - Name: [TBD]
  - Phone: +62-xxx-xxxx-xxxx
  - Email: platform-lead@autolumiku.com

L3: CTO
  - Name: [TBD]
  - Phone: +62-xxx-xxxx-xxxx
  - Email: cto@autolumiku.com
```

### Vendor Support

```
Database (PostgreSQL):
  - AWS RDS Support: https://console.aws.amazon.com/support
  - Severity: Critical
  - SLA: 1 hour response

Cloud Provider:
  - AWS Support: +1-xxx-xxx-xxxx
  - Google Cloud: +1-xxx-xxx-xxxx

Security Incident:
  - Incident Response: security@autolumiku.com
  - External IR Partner: [TBD]
```

---

## 📝 Maintenance & Updates

### Regular Maintenance Tasks

**Daily:**
- ✅ Automated backup execution
- ✅ Backup verification
- ✅ Monitoring alerts review

**Weekly:**
- ✅ Backup success rate review
- ✅ Storage usage monitoring
- ✅ DR site health check

**Monthly:**
- ✅ Manual backup restore test
- ✅ Documentation review
- ✅ Capacity planning

**Quarterly:**
- ✅ DR drill execution
- ✅ DR plan update
- ✅ Team training
- ✅ Compliance audit

### Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-23 | Claude AI + DevOps | Initial version created |
| | | | |

---

## ✅ Checklist: Backup/DR Readiness

- [ ] Database automated backups configured
- [ ] Backup encryption enabled
- [ ] S3 cross-region replication active
- [ ] Secrets stored in vault
- [ ] DR site infrastructure defined
- [ ] Recovery procedures documented
- [ ] Team trained on DR process
- [ ] Quarterly DR drills scheduled
- [ ] Monitoring and alerts configured
- [ ] Emergency contacts updated
- [ ] Compliance requirements met
- [ ] DR plan approved by management

---

**Document Status:** ✅ COMPLETE
**Next Review Date:** 2026-02-23
**Approval Required:** CTO / Platform Lead

---

*This document is confidential and intended for internal use only.*
