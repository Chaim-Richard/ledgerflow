export interface TaxRateConfig {
  countryCode: string;
  countryName: string;
  taxType: 'vat' | 'gst' | 'sales_tax';
  defaultRate: number; // Decimal e.g. 0.20 for 20%
  categoryRates: Record<string, number>;
}

export const COUNTRY_TAX_CONFIGS: Record<string, TaxRateConfig> = {
  US: {
    countryCode: 'US',
    countryName: 'United States',
    taxType: 'sales_tax',
    defaultRate: 0.08, // Average US state sales tax
    categoryRates: {
      'Software & SaaS': 0.08,
      'Office Supplies': 0.08,
      'Meals & Entertainment': 0.08,
      'Salary & Wages': 0.0,
      'Insurance': 0.0,
      'Financial Fees': 0.0
    }
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    taxType: 'vat',
    defaultRate: 0.20, // Standard UK VAT 20%
    categoryRates: {
      'Standard Rate': 0.20,
      'Reduced Rate': 0.05,
      'Zero Rate': 0.0,
      'Exempt': 0.0,
      'Salary & Payroll': 0.0
    }
  },
  CA: {
    countryCode: 'CA',
    countryName: 'Canada',
    taxType: 'gst',
    defaultRate: 0.13, // Combined HST average (5% GST + PST)
    categoryRates: {
      'Commercial Supplies': 0.13,
      'Basic Groceries': 0.0,
      'Financial Services': 0.0
    }
  },
  AU: {
    countryCode: 'AU',
    countryName: 'Australia',
    taxType: 'gst',
    defaultRate: 0.10, // 10% Australian GST
    categoryRates: {
      'Taxable Supplies': 0.10,
      'GST-Free': 0.0,
      'Input Taxed': 0.0
    }
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    taxType: 'vat',
    defaultRate: 0.19, // 19% MwSt
    categoryRates: {
      'Regelsatz': 0.19,
      'Ermäßigter Satz': 0.07,
      'Steuerfrei': 0.0
    }
  },
  IL: {
    countryCode: 'IL',
    countryName: 'Israel',
    taxType: 'vat',
    defaultRate: 0.17, // 17% Ma'am
    categoryRates: {
      'Standard VAT': 0.17,
      'Zero Rate Eilat': 0.0,
      'Exempt Services': 0.0
    }
  }
};

export function getDefaultTaxConfig(countryCode?: string): TaxRateConfig {
  const code = (countryCode || 'US').toUpperCase();
  return COUNTRY_TAX_CONFIGS[code] || COUNTRY_TAX_CONFIGS.US;
}

export function generateDefaultTaxRates(countryCode?: string) {
  const config = getDefaultTaxConfig(countryCode);
  return [
    {
      id: `tax-default-${config.countryCode.toLowerCase()}`,
      name: `${config.countryName} Standard ${config.taxType.toUpperCase()} (${(config.defaultRate * 100).toFixed(0)}%)`,
      rate: config.defaultRate,
      code: config.taxType.toUpperCase(),
      isDefault: true
    },
    ...Object.entries(config.categoryRates).map(([cat, rate], idx) => ({
      id: `tax-cat-${idx}`,
      name: `${cat} (${(rate * 100).toFixed(0)}%)`,
      rate: rate,
      code: rate === 0 ? 'EXEMPT' : `${config.taxType.toUpperCase()}_PARTIAL`,
      isDefault: false
    }))
  ];
}
