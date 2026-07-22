const fs = require('fs');

function replaceRadix(file) {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    // We only replace parseInt(e.target.value) -> parseInt(e.target.value, 10)
    // and parseInt(e.target.value) || 0 -> parseInt(e.target.value, 10) || 0
    code = code.replace(/parseInt\((e\.target\.value)\)/g, "parseInt($1, 10)");
    fs.writeFileSync(file, code);
}

replaceRadix('src/components/forensics/tabs/EconomicsMatrixTab.tsx');
replaceRadix('src/components/platform/ApiHub.tsx');
replaceRadix('src/components/finance/TaxManager.tsx');
replaceRadix('src/components/ledger/StatementImporter.tsx');
replaceRadix('src/components/sales/InvoiceModal.tsx');
replaceRadix('src/components/sales/CustomerModal.tsx');

