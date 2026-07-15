const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

content = content.replace(
  `    if (!transactions.length) {
      // Placeholder data if no transactions
      return Array.from({ length: 7 }).map((_, i) => ({
        name: \`Day \${i + 1}\`,
        revenue: Math.random() * 5000 + 1000,
        expense: Math.random() * 3000 + 500
      }));
    }`,
  `    if (!transactions.length) {
      // Placeholder data if no transactions
      return Array.from({ length: 7 }).map((_, i) => ({
        name: \`Day \${i + 1}\`,
        revenue: 0,
        expense: 0
      }));
    }`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log("Updated Dashboard.tsx");
