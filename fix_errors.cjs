const fs = require('fs');

function replaceInFile(path, searchRegex, replacement) {
  try {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(searchRegex, replacement);
    fs.writeFileSync(path, content);
  } catch (e) {}
}

replaceInFile('src/components/operations/Commissions.tsx', /import { CheckCircle, DollarSign,/g, "import { DollarSign,");
replaceInFile('src/components/operations/Commissions.tsx', /<CheckCircle2/g, "<CheckCircle");

replaceInFile('src/components/finance/DuPontAnalysisCalculator.tsx', /export default function DuPont/g, "export default function Dupont");
replaceInFile('src/config/registry.tsx', /DuPontAnalysisCalculator/g, "DupontAnalysisCalculator");
