const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_ADMIN_USER || process.env.SQL_USER,
  password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
  port: 5432,
  connectionTimeoutMillis: 5000,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running advanced ERP schema initialization...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (id SERIAL PRIMARY KEY, currency VARCHAR(3), rate NUMERIC(15,6), date DATE);
      CREATE TABLE IF NOT EXISTS projects (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100), status VARCHAR(20), budget_cents BIGINT);
      CREATE TABLE IF NOT EXISTS employees (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100), salary_cents BIGINT);
      CREATE TABLE IF NOT EXISTS payroll_runs (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), date DATE, total_cents BIGINT, status VARCHAR(20));
      
      CREATE TABLE IF NOT EXISTS assets (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100), cost_cents BIGINT, salvage_value_cents BIGINT, useful_life_months INT, accumulated_depreciation_cents BIGINT, status VARCHAR(20));
      CREATE TABLE IF NOT EXISTS inventory_items (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), sku VARCHAR(50), name VARCHAR(100), cost_cents BIGINT, qty_on_hand INT, asset_account_id VARCHAR(50), cogs_account_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS inventory_transactions (id SERIAL PRIMARY KEY, item_id VARCHAR(50), type VARCHAR(20), qty INT, cost_cents BIGINT, date DATE);
      
      CREATE TABLE IF NOT EXISTS budgets (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), account_id VARCHAR(50), period VARCHAR(20), amount_cents BIGINT);
      CREATE TABLE IF NOT EXISTS allocations (id SERIAL PRIMARY KEY, workspace_id VARCHAR(50), source_account_id VARCHAR(50), dest_account_id VARCHAR(50), percentage NUMERIC(5,4));
      
      CREATE TABLE IF NOT EXISTS tax_rates (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100), rate NUMERIC(5,4), liability_account_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS approvals (id SERIAL PRIMARY KEY, workspace_id VARCHAR(50), ref_id VARCHAR(50), ref_type VARCHAR(50), status VARCHAR(20), approver_id VARCHAR(50), created_at TIMESTAMP DEFAULT NOW());
      
      CREATE TABLE IF NOT EXISTS intercompany_entities (id VARCHAR(50) PRIMARY KEY, parent_workspace_id VARCHAR(50), child_workspace_id VARCHAR(50), elimination_account_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS leases (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100), monthly_payment_cents BIGINT, term_months INT, interest_rate NUMERIC(5,4), liability_account_id VARCHAR(50), rou_asset_account_id VARCHAR(50));
      
      CREATE TABLE IF NOT EXISTS crypto_wallets (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), address VARCHAR(100), currency VARCHAR(20), balance_sats BIGINT, asset_account_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS crypto_transactions (id SERIAL PRIMARY KEY, wallet_id VARCHAR(50), type VARCHAR(20), amount_sats BIGINT, usd_value_cents BIGINT, date DATE);
      
      CREATE TABLE IF NOT EXISTS manufacturing_orders (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), product_item_id VARCHAR(50), qty_ordered INT, qty_completed INT, status VARCHAR(20));
      CREATE TABLE IF NOT EXISTS bills_of_material (id SERIAL PRIMARY KEY, parent_item_id VARCHAR(50), component_item_id VARCHAR(50), qty_required INT);
      
      CREATE TABLE IF NOT EXISTS loans (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100), principal_cents BIGINT, annual_interest_rate NUMERIC(5,4), term_months INT, liability_account_id VARCHAR(50), interest_expense_account_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS deferred_revenue_contracts (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), customer_id VARCHAR(50), total_amount_cents BIGINT, recognized_cents BIGINT, months INT, deferred_account_id VARCHAR(50), revenue_account_id VARCHAR(50));
      
      CREATE TABLE IF NOT EXISTS cam_properties (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100), total_sqft INT);
      CREATE TABLE IF NOT EXISTS cam_leases (id VARCHAR(50) PRIMARY KEY, property_id VARCHAR(50), tenant_name VARCHAR(100), sqft INT, pro_rata_share NUMERIC(5,4));
      CREATE TABLE IF NOT EXISTS cam_expenses (id SERIAL PRIMARY KEY, property_id VARCHAR(50), description VARCHAR(100), amount_cents BIGINT, date DATE);
      
      CREATE TABLE IF NOT EXISTS cap_tables (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), shareholder VARCHAR(100), shares INT, class VARCHAR(20));
      CREATE TABLE IF NOT EXISTS funds (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100), nav_cents BIGINT, shares_outstanding INT);
      
      CREATE TABLE IF NOT EXISTS store_locations (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), name VARCHAR(100));
      CREATE TABLE IF NOT EXISTS pos_shifts (id SERIAL PRIMARY KEY, store_id VARCHAR(50), start_time TIMESTAMP, end_time TIMESTAMP, expected_cash_cents BIGINT, actual_cash_cents BIGINT);
      
      CREATE TABLE IF NOT EXISTS agricultural_fields (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), crop_type VARCHAR(50), acres NUMERIC(10,2), w_i_p_account_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS media_projects (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), title VARCHAR(100), budget_cents BIGINT, cap_account_id VARCHAR(50));
      
      CREATE TABLE IF NOT EXISTS medical_claims (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), patient_name VARCHAR(100), amount_cents BIGINT, status VARCHAR(20), ar_account_id VARCHAR(50), revenue_account_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS fleet_vehicles (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), vin VARCHAR(50), status VARCHAR(20), maintenance_expense_account_id VARCHAR(50));
      
      CREATE TABLE IF NOT EXISTS hotel_reservations (id VARCHAR(50) PRIMARY KEY, workspace_id VARCHAR(50), guest_name VARCHAR(100), room_number VARCHAR(20), daily_rate NUMERIC(10,2), status VARCHAR(20), check_in DATE, check_out DATE, guest_ledger_account_id VARCHAR(50), room_revenue_account_id VARCHAR(50));
    `);
    
    console.log('✅ Advanced ERP Schema Initialized.');
  } catch (err) {
    console.error('Error initializing schema:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
