import express from "express";
import { EventLedger } from "../../kernel/ledger/EventLedger";
import { DoubleEntryValidator } from "../../kernel/validation/DoubleEntryValidator";
import { DepreciationEngine } from "../../kernel/depreciation/DepreciationEngine";
import { CurrencyEngine } from "../../kernel/fx/CurrencyEngine";
import { ConsolidationEngine } from "../../kernel/consolidation/ConsolidationEngine";
import { AuditTrailEngine } from "../../kernel/reporting/AuditTrailEngine";
import { ReconciliationLayer } from "../../kernel/validation/ReconciliationLayer";
import { DuplicateDetectionEngine } from "../../kernel/validation/DuplicateDetectionEngine";
import { OrphanDetectionEngine } from "../../kernel/validation/OrphanDetectionEngine";
import { ReferentialIntegrityEngine } from "../../kernel/validation/ReferentialIntegrityEngine";
import { DerivedBalanceEngine } from "../../kernel/reporting/DerivedBalanceEngine";
import { MaterializedViews } from "../../kernel/reporting/MaterializedViews";
import { RoleEnforcementEngine } from "../../kernel/security/RoleEnforcementEngine";
import { ApprovalWorkflowEngine } from "../../kernel/security/ApprovalWorkflowEngine";

// New Engines
import { AmortizationEngine } from "../../kernel/depreciation/AmortizationEngine";
import { InventoryEngine } from "../../kernel/inventory/InventoryEngine";
import { VarianceEngine } from "../../kernel/budgeting/VarianceEngine";
import { TaxCalculationEngine } from "../../kernel/tax/TaxCalculationEngine";
import { AnomalyDetectionEngine } from "../../kernel/validation/AnomalyDetectionEngine";
import { LiquidityEngine } from "../../kernel/cashflow/LiquidityEngine";
import { FinancialRatiosEngine } from "../../kernel/metrics/FinancialRatiosEngine";
import { InterestEngine } from "../../kernel/treasury/InterestEngine";
import { AllocationEngine } from "../../kernel/budgeting/AllocationEngine";
import { PresentValueEngine } from "../../kernel/metrics/PresentValueEngine";
import { BreakEvenEngine } from "../../kernel/budgeting/BreakEvenEngine";
import { CogsEngine } from "../../kernel/inventory/CogsEngine";
import { PricingEngine } from "../../kernel/inventory/PricingEngine";
import { AgingEngine } from "../../kernel/ar/AgingEngine";
import { CommissionEngine } from "../../kernel/payroll/CommissionEngine";
import { DsoEngine } from "../../kernel/metrics/DsoEngine";
import { WaccEngine } from "../../kernel/metrics/WaccEngine";
import { EbitdaEngine } from "../../kernel/metrics/EbitdaEngine";
import { MacrsEngine } from "../../kernel/depreciation/MacrsEngine";
import { EoqEngine } from "../../kernel/inventory/EoqEngine";
import { TurnoverEngine } from "../../kernel/metrics/TurnoverEngine";
import { DebtRatiosEngine } from "../../kernel/metrics/DebtRatiosEngine";
import { OcfEngine } from "../../kernel/cashflow/OcfEngine";

// Latest Engines
import { AltmanZScoreEngine } from "../../kernel/metrics/AltmanZScoreEngine";
import { PiotroskiFScoreEngine } from "../../kernel/metrics/PiotroskiFScoreEngine";
import { LtvEngine } from "../../kernel/metrics/LtvEngine";
import { DscrEngine } from "../../kernel/metrics/DscrEngine";

// Even more engines
import { SustainableGrowthRateEngine } from "../../kernel/metrics/SustainableGrowthRateEngine";
import { EnterpriseValueEngine } from "../../kernel/metrics/EnterpriseValueEngine";
import { BenfordsLawEngine } from "../../kernel/validation/BenfordsLawEngine";

const router = express.Router();

// --- LEDGER EVENTS ---
router.post("/ledger/events", (req, res) => {
  try {
    const { event } = req.body;
    EventLedger.append(event);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/ledger/events", (req, res) => {
  res.json({ events: EventLedger.getEvents() });
});

router.get("/ledger/balance/:accountId", (req, res) => {
  const asOfDate = req.query.asOfDate as string;
  const balance = EventLedger.getAccountBalance(req.params.accountId, asOfDate);
  res.json({ accountId: req.params.accountId, balanceCents: balance });
});

router.get("/ledger/derived-balance/:accountId", (req, res) => {
  const asOfDate = req.query.asOfDate as string;
  const balance = DerivedBalanceEngine.getBalanceAsOf(req.params.accountId, asOfDate || new Date().toISOString(), EventLedger.getEvents());
  res.json({ accountId: req.params.accountId, balanceCents: balance });
});

// --- VALIDATION ---
router.post("/validation/double-entry", (req, res) => {
  try {
    const isValid = DoubleEntryValidator.validateJournalEntry(req.body.transaction);
    res.json({ isValid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/validation/reconciliation", (req, res) => {
  const { accountId, bookBalanceCents, bankBalanceCents } = req.body;
  const status = ReconciliationLayer.getReconciliationStatus(accountId, bookBalanceCents, bankBalanceCents);
  res.json({ status });
});

router.post("/validation/duplicates", (req, res) => {
  const { newTransaction, existingTransactions } = req.body;
  const duplicates = DuplicateDetectionEngine.detectDuplicates(newTransaction, existingTransactions);
  res.json({ duplicates });
});

router.post("/validation/orphans", (req, res) => {
  const { type, items, linkedItems } = req.body;
  let orphans: any[] = [];
  if (type === 'transactions') {
    orphans = OrphanDetectionEngine.scanTransactions(items);
  } else if (type === 'payments') {
    orphans = OrphanDetectionEngine.scanPayments(items, linkedItems || []);
  } else if (type === 'projects') {
    orphans = OrphanDetectionEngine.scanProjects(items);
  }
  res.json({ orphans });
});

router.post("/validation/referential-integrity", (req, res) => {
  const { type, id, data1, data2 } = req.body;
  let canDelete = false;
  if (type === 'account') {
    canDelete = ReferentialIntegrityEngine.canDeleteAccount(id, data1);
  } else if (type === 'vendor') {
    canDelete = ReferentialIntegrityEngine.canDeleteVendor(id, data1, data2);
  } else if (type === 'customer') {
    canDelete = ReferentialIntegrityEngine.canDeleteCustomer(id, data1, data2);
  } else if (type === 'project') {
    canDelete = ReferentialIntegrityEngine.canDeleteProject(id, data1);
  }
  res.json({ canDelete });
});

// --- DEPRECIATION ---
router.post("/depreciation/optimal", (req, res) => {
  const { cost, salvageValue, bookValue, remainingPeriods } = req.body;
  const amount = DepreciationEngine.calculateOptimalDepreciation(cost, salvageValue, bookValue, remainingPeriods);
  res.json({ depreciationAmount: amount });
});

// --- FX ---
router.post("/fx/convert", (req, res) => {
  const { amountCents, rate } = req.body;
  const converted = CurrencyEngine.convert(amountCents, rate);
  res.json({ convertedAmountCents: converted });
});

router.post("/fx/triangulation", (req, res) => {
  const { rate1, rate2, rate3 } = req.body;
  const isValid = CurrencyEngine.validateTriangulation(rate1, rate2, rate3);
  res.json({ isValid });
});

// --- CONSOLIDATION ---
router.post("/consolidation/balance-sheet", (req, res) => {
  const { balanceCents, closingRate } = req.body;
  const consolidated = ConsolidationEngine.consolidateBalanceSheet(balanceCents, closingRate);
  res.json({ consolidatedAmountCents: consolidated });
});

router.post("/consolidation/income-statement", (req, res) => {
  const { transactions } = req.body;
  const consolidated = ConsolidationEngine.consolidateIncomeStatement(transactions);
  res.json({ consolidatedAmountCents: consolidated });
});

// --- AUDIT TRAIL ---
router.post("/audit/log", (req, res) => {
  AuditTrailEngine.log(req.body.event);
  res.json({ success: true });
});

router.get("/audit/logs/:objectId", (req, res) => {
  res.json({ logs: AuditTrailEngine.getLogsForObject(req.params.objectId) });
});

router.get("/audit/logs", (req, res) => {
  res.json({ logs: AuditTrailEngine.getAllLogs() });
});

// --- MATERIALIZED VIEWS ---
router.post("/reporting/materialized/income-statement", (req, res) => {
  const { accounts, transactions } = req.body;
  const view = MaterializedViews.generateIncomeStatement(accounts, transactions);
  res.json({ view });
});

router.post("/reporting/materialized/balance-sheet", (req, res) => {
  const { accounts, transactions } = req.body;
  const view = MaterializedViews.generateBalanceSheet(accounts, transactions);
  res.json({ view });
});

// --- SECURITY & WORKFLOW ---
router.post("/security/role-enforcement", (req, res) => {
  const { userRole, action } = req.body;
  const hasPermission = RoleEnforcementEngine.hasPermission(userRole, action);
  res.json({ hasPermission });
});

router.post("/security/approval-workflow", (req, res) => {
  const { action, amountCents } = req.body;
  const requiresApproval = ApprovalWorkflowEngine.requiresApproval(action, amountCents);
  res.json({ requiresApproval });
});

// --- NEW ENGINES ---
router.post("/depreciation/amortization", (req, res) => {
  const { principal, residualValue, usefulLifePeriods } = req.body;
  const amount = AmortizationEngine.calculateStraightLineAmortization(principal, residualValue, usefulLifePeriods);
  res.json({ amortizationAmount: amount });
});

router.post("/inventory/fifo", (req, res) => {
  try {
    const cogs = InventoryEngine.calculateFIFO(req.body.batches, req.body.unitsSold);
    res.json({ cogs });
  } catch(e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/budgeting/variance", (req, res) => {
  const variance = VarianceEngine.calculateVariance(req.body.actualCents, req.body.budgetCents);
  res.json({ variance });
});

router.post("/tax/calculate", (req, res) => {
  const tax = TaxCalculationEngine.calculateSalesTax(req.body.subtotalCents, req.body.taxRatePercentage);
  res.json({ tax });
});

router.post("/validation/anomalies", (req, res) => {
  const anomalies = AnomalyDetectionEngine.detectAmountOutliers(req.body.transactions);
  res.json({ anomalies });
});

router.post("/cashflow/liquidity", (req, res) => {
  const currentRatio = LiquidityEngine.calculateCurrentRatio(req.body.currentAssets, req.body.currentLiabilities);
  res.json({ currentRatio });
});

router.post("/metrics/ratios", (req, res) => {
  const roa = FinancialRatiosEngine.calculateROA(req.body.netIncome, req.body.totalAssets);
  res.json({ roa });
});

router.post("/treasury/interest", (req, res) => {
  const interest = InterestEngine.calculateSimpleInterest(req.body.principal, req.body.rate, req.body.days);
  res.json({ interest });
});

router.post("/budgeting/allocation", (req, res) => {
  const allocation = AllocationEngine.allocateOverhead(req.body.totalCostCents, req.body.weights);
  res.json({ allocation });
});

router.post("/metrics/present-value", (req, res) => {
  const npv = PresentValueEngine.calculateNPV(req.body.discountRate, req.body.cashFlows);
  res.json({ npv });
});

router.post("/budgeting/breakeven", (req, res) => {
  const units = BreakEvenEngine.calculateBreakEvenUnits(req.body.fixedCosts, req.body.price, req.body.variableCost);
  res.json({ breakEvenUnits: units });
});

router.post("/inventory/cogs", (req, res) => {
  const cogs = CogsEngine.calculatePeriodicCOGS(req.body.beginning, req.body.purchases, req.body.ending);
  res.json({ cogs });
});

router.post("/inventory/pricing", (req, res) => {
  const price = PricingEngine.calculateCostPlusPricing(req.body.cost, req.body.markup);
  res.json({ price });
});

router.post("/ar/aging", (req, res) => {
  const buckets = AgingEngine.generateAgingReport(req.body.invoices, req.body.asOfDate);
  res.json({ buckets });
});

router.post("/payroll/commission", (req, res) => {
  const commission = CommissionEngine.calculateStraightCommission(req.body.salesAmount, req.body.rate);
  res.json({ commission });
});

router.post("/metrics/dso", (req, res) => {
  const dso = DsoEngine.calculateDSO(req.body.ar, req.body.creditSales, req.body.days);
  res.json({ dso });
});

router.post("/metrics/wacc", (req, res) => {
  const wacc = WaccEngine.calculateWACC(req.body.equity, req.body.debt, req.body.costEquity, req.body.costDebt, req.body.taxRate);
  res.json({ wacc });
});

router.post("/metrics/ebitda", (req, res) => {
  const ebitda = EbitdaEngine.calculateEBITDA(req.body.netIncome, req.body.interest, req.body.taxes, req.body.depreciation, req.body.amortization);
  res.json({ ebitda });
});

router.post("/depreciation/macrs", (req, res) => {
  const macrs = MacrsEngine.calculateMACRS(req.body.cost, req.body.classYears, req.body.year);
  res.json({ macrs });
});

router.post("/inventory/eoq", (req, res) => {
  const eoq = EoqEngine.calculateEOQ(req.body.annualDemand, req.body.costPerOrder, req.body.holdingCost);
  res.json({ eoq });
});

router.post("/metrics/turnover", (req, res) => {
  const turnover = TurnoverEngine.calculateAssetTurnover(req.body.netSales, req.body.averageTotalAssets);
  res.json({ turnover });
});

router.post("/metrics/debt-ratio", (req, res) => {
  const ratio = DebtRatiosEngine.calculateDebtToEquity(req.body.liabilities, req.body.equity);
  res.json({ ratio });
});

router.post("/cashflow/ocf", (req, res) => {
  const ocf = OcfEngine.calculateOCF(req.body.netIncome, req.body.nonCashExpenses, req.body.wcIncrease);
  res.json({ ocf });
});

router.post("/metrics/dscr", (req, res) => {
  const dscr = DscrEngine.calculateDSCR(req.body.noi, req.body.debtService);
  res.json({ dscr });
});

router.post("/metrics/ltv", (req, res) => {
  const ltv = LtvEngine.calculateLTV(req.body.loan, req.body.value);
  res.json({ ltv });
});

router.post("/metrics/zscore", (req, res) => {
  const z = AltmanZScoreEngine.calculatePublicManufacturingZScore(req.body.wc, req.body.re, req.body.ebit, req.body.mve, req.body.tl, req.body.s, req.body.ta);
  res.json({ z });
});

router.post("/metrics/fscore", (req, res) => {
  const f = PiotroskiFScoreEngine.calculateFScore(
    req.body.ni, req.body.ocf, req.body.roaC, req.body.roaP, 
    req.body.ltdC, req.body.ltdP, req.body.crC, req.body.crP, 
    req.body.sC, req.body.sP, req.body.gmC, req.body.gmP, 
    req.body.atC, req.body.atP
  );
  res.json({ fscore: f });
});

router.post("/validation/benfords-law", (req, res) => {
  const results = BenfordsLawEngine.testBenfordsLaw(req.body.numbers);
  res.json({ results });
});

router.post("/metrics/ev", (req, res) => {
  const ev = EnterpriseValueEngine.calculateEV(req.body.marketCap, req.body.totalDebt, req.body.cash);
  res.json({ ev });
});

router.post("/metrics/sgr", (req, res) => {
  const sgr = SustainableGrowthRateEngine.calculateSGR(req.body.roe, req.body.retentionRatio);
  res.json({ sgr });
});

export default router;
