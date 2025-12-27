-- CreateTable: Sales Customers
CREATE TABLE "sales_customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "nik" TEXT,
    "npwp" TEXT,
    "source" TEXT,
    "whatsappConversationId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "sales_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Leasing Partners
CREATE TABLE "leasing_partners" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "interestRateMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestRateMax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestType" TEXT NOT NULL DEFAULT 'flat',
    "tenorOptions" TEXT NOT NULL DEFAULT '12,24,36,48,60',
    "dpMinPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "adminFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leasing_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Sales Invoices
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "salesUserId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "vehicleYear" INTEGER,
    "vehicleColor" TEXT,
    "vehiclePlateNumber" TEXT,
    "vehicleFrameNumber" TEXT,
    "vehicleEngineNumber" TEXT,
    "vehicleMileage" INTEGER,
    "vehiclePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountNote" TEXT,
    "dpp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppnPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppnAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppnbmPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppnbmAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adminFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherFeeNote" TEXT,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "notes" TEXT,
    "termsConditions" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Sales Invoice Credit Details
CREATE TABLE "sales_invoice_credit_details" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "leasingPartnerId" TEXT NOT NULL,
    "dpAmount" DOUBLE PRECISION NOT NULL,
    "dpPercent" DOUBLE PRECISION NOT NULL,
    "principalAmount" DOUBLE PRECISION NOT NULL,
    "tenor" INTEGER NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "interestType" TEXT NOT NULL DEFAULT 'flat',
    "monthlyInstallment" DOUBLE PRECISION NOT NULL,
    "totalInterest" DOUBLE PRECISION NOT NULL,
    "totalPayment" DOUBLE PRECISION NOT NULL,
    "leasingApprovalNumber" TEXT,
    "approvalDate" TIMESTAMP(3),
    "disbursementDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoice_credit_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Sales Invoice Payments
CREATE TABLE "sales_invoice_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL DEFAULT 'regular',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "referenceNumber" TEXT,
    "proofUrl" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Commission Configs
CREATE TABLE "commission_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Commission',
    "type" TEXT NOT NULL DEFAULT 'percentage_price',
    "fixedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentageRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "tieredRules" TEXT,
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "vehicleType" TEXT NOT NULL DEFAULT 'all',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Sales Commissions
CREATE TABLE "sales_commissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "salesUserId" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "bonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "disbursedBy" TEXT,
    "disbursementMethod" TEXT,
    "disbursementRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Sales Invoice Audit Logs
CREATE TABLE "sales_invoice_audit_logs" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "sales_invoice_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Sales Customers
CREATE UNIQUE INDEX "sales_customers_tenantId_phone_key" ON "sales_customers"("tenantId", "phone");
CREATE INDEX "sales_customers_tenantId_idx" ON "sales_customers"("tenantId");
CREATE INDEX "sales_customers_tenantId_name_idx" ON "sales_customers"("tenantId", "name");

-- CreateIndex: Leasing Partners
CREATE UNIQUE INDEX "leasing_partners_tenantId_code_key" ON "leasing_partners"("tenantId", "code");
CREATE INDEX "leasing_partners_tenantId_idx" ON "leasing_partners"("tenantId");

-- CreateIndex: Sales Invoices
CREATE UNIQUE INDEX "sales_invoices_invoiceNumber_key" ON "sales_invoices"("invoiceNumber");
CREATE INDEX "sales_invoices_tenantId_idx" ON "sales_invoices"("tenantId");
CREATE INDEX "sales_invoices_tenantId_status_idx" ON "sales_invoices"("tenantId", "status");
CREATE INDEX "sales_invoices_tenantId_invoiceDate_idx" ON "sales_invoices"("tenantId", "invoiceDate");
CREATE INDEX "sales_invoices_customerId_idx" ON "sales_invoices"("customerId");
CREATE INDEX "sales_invoices_salesUserId_idx" ON "sales_invoices"("salesUserId");

-- CreateIndex: Sales Invoice Credit Details
CREATE UNIQUE INDEX "sales_invoice_credit_details_invoiceId_key" ON "sales_invoice_credit_details"("invoiceId");
CREATE INDEX "sales_invoice_credit_details_leasingPartnerId_idx" ON "sales_invoice_credit_details"("leasingPartnerId");

-- CreateIndex: Sales Invoice Payments
CREATE INDEX "sales_invoice_payments_invoiceId_idx" ON "sales_invoice_payments"("invoiceId");

-- CreateIndex: Commission Configs
CREATE UNIQUE INDEX "commission_configs_tenantId_name_key" ON "commission_configs"("tenantId", "name");
CREATE INDEX "commission_configs_tenantId_idx" ON "commission_configs"("tenantId");

-- CreateIndex: Sales Commissions
CREATE UNIQUE INDEX "sales_commissions_invoiceId_key" ON "sales_commissions"("invoiceId");
CREATE INDEX "sales_commissions_tenantId_idx" ON "sales_commissions"("tenantId");
CREATE INDEX "sales_commissions_tenantId_status_idx" ON "sales_commissions"("tenantId", "status");
CREATE INDEX "sales_commissions_salesUserId_idx" ON "sales_commissions"("salesUserId");

-- CreateIndex: Sales Invoice Audit Logs
CREATE INDEX "sales_invoice_audit_logs_invoiceId_idx" ON "sales_invoice_audit_logs"("invoiceId");
CREATE INDEX "sales_invoice_audit_logs_performedAt_idx" ON "sales_invoice_audit_logs"("performedAt");

-- AddForeignKey: Sales Invoices -> Sales Customers
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sales_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Sales Invoice Credit Details -> Sales Invoices
ALTER TABLE "sales_invoice_credit_details" ADD CONSTRAINT "sales_invoice_credit_details_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Sales Invoice Credit Details -> Leasing Partners
ALTER TABLE "sales_invoice_credit_details" ADD CONSTRAINT "sales_invoice_credit_details_leasingPartnerId_fkey" FOREIGN KEY ("leasingPartnerId") REFERENCES "leasing_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Sales Invoice Payments -> Sales Invoices
ALTER TABLE "sales_invoice_payments" ADD CONSTRAINT "sales_invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Sales Commissions -> Sales Invoices
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Sales Invoice Audit Logs -> Sales Invoices
ALTER TABLE "sales_invoice_audit_logs" ADD CONSTRAINT "sales_invoice_audit_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
