const fs = require('fs');

let typesCode = fs.readFileSync('./src/types.ts', 'utf8');

// The regex I used earlier mangled some lines. Let's fix them manually based on the grep output.
typesCode = typesCode.replace(/tags\?: string\[\]; metadata\?: Record<string, any>;quantity\?: number;/g, 'tags?: string[];\n  metadata?: Record<string, any>;\n  quantity?: number;');
typesCode = typesCode.replace(/tags\?: string\[\]; metadata\?: Record<string, any>;\/\/ Audit & History/g, 'tags?: string[];\n  metadata?: Record<string, any>;\n  // Audit & History');
typesCode = typesCode.replace(/metadata\?: Record<string, any>;\/\/ Extended for custom fields/g, 'metadata?: Record<string, any>; // Extended for custom fields');
typesCode = typesCode.replace(/dimensions: string\[\]; tags\?: string\[\]; metadata\?: Record<string, any>;splitRules\?: Array<\{/g, 'dimensions: string[];\n  tags?: string[];\n  metadata?: Record<string, any>;\n  splitRules?: Array<{');
typesCode = typesCode.replace(/metadata\?: Record<string, any>;createdAt: string;/g, 'metadata?: Record<string, any>;\n  createdAt: string;');
typesCode = typesCode.replace(/tags\?: string\[\]; metadata\?: Record<string, any>;balanceCents\?: number;/g, 'tags?: string[];\n  metadata?: Record<string, any>;\n  balanceCents?: number;');
typesCode = typesCode.replace(/tags\?: string\[\]; metadata\?: Record<string, any>;splits\?: Array<\{/g, 'tags?: string[];\n  metadata?: Record<string, any>;\n  splits?: Array<{');
typesCode = typesCode.replace(/metadata\?: Record<string, any>;status: 'pending'/g, 'metadata?: Record<string, any>;\n  status: \'pending\'');
typesCode = typesCode.replace(/tags\?: string\[\]; metadata\?: Record<string, any>;notes\?: string;/g, 'tags?: string[];\n  metadata?: Record<string, any>;\n  notes?: string;');
typesCode = typesCode.replace(/metadata\?: Record<string, any>;plan\?: 'free'/g, 'metadata?: Record<string, any>;\n  plan?: \'free\'');

// Now let's remove duplicates in the same interface blocks.
// I'll just remove lines 136 and 141 (the duplicate metadata) for JournalEntry.

let lines = typesCode.split('\n');
let filteredLines = [];
let inJournalEntry = false;
let seenMetadataInJournal = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('interface JournalEntry ')) {
    inJournalEntry = true;
  }
  if (inJournalEntry && lines[i].includes('}')) {
    inJournalEntry = false;
    seenMetadataInJournal = false;
  }
  
  if (inJournalEntry && lines[i].includes('metadata?: Record<string, any>;')) {
    if (seenMetadataInJournal) {
      continue; // skip duplicate
    } else {
      seenMetadataInJournal = true;
    }
  }
  
  // also for Transaction
  
  filteredLines.push(lines[i]);
}

typesCode = filteredLines.join('\n');


let inTransaction = false;
let seenMetadataInTransaction = false;
filteredLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('interface Transaction ')) {
    inTransaction = true;
  }
  if (inTransaction && lines[i].includes('}')) {
    inTransaction = false;
    seenMetadataInTransaction = false;
  }
  
  if (inTransaction && lines[i].includes('metadata?: Record<string, any>;')) {
    if (seenMetadataInTransaction) {
      continue; // skip duplicate
    } else {
      seenMetadataInTransaction = true;
    }
  }
  
  filteredLines.push(lines[i]);
}
typesCode = filteredLines.join('\n');

fs.writeFileSync('./src/types.ts', typesCode);

// Fix Sales tags and IntelligenceCenter componentName
let salesCode = fs.readFileSync('./src/components/sales/Sales.tsx', 'utf8');
salesCode = salesCode.replace(/(inv as any)\.tags/g, '(inv as any).tags'); // already did this but maybe tsc needs explicit string
fs.writeFileSync('./src/components/sales/Sales.tsx', salesCode);

