import { ParsedBankLine } from './mt940Parser';

/**
 * Parsers for ISO 20022 CAMT.053 XML bank statement format.
 */
export function parseCamt053Statement(xmlContent: string): ParsedBankLine[] {
  const parsedLines: ParsedBankLine[] = [];

  // Lightweight XML regex parser for CAMT.053 <Ntry> blocks
  const ntryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
  let match: RegExpExecArray | null;

  while ((match = ntryRegex.exec(xmlContent)) !== null) {
    const block = match[1];

    const amtMatch = block.match(/<Amt[^>]*>([0-9.]+)</);
    const amtCents = amtMatch ? Math.round(parseFloat(amtMatch[1]) * 100) : 0;

    const cdtDbtMatch = block.match(/<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/);
    const isCredit = cdtDbtMatch ? cdtDbtMatch[1] === 'CRDT' : amtCents > 0;

    const dateMatch = block.match(/<BookgDt>[\s\S]*?<Dt>([0-9]{4}-[0-9]{2}-[0-9]{2})<\/Dt>/) ||
                      block.match(/<Dt>([0-9]{4}-[0-9]{2}-[0-9]{2})<\/Dt>/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    const ustrdMatch = block.match(/<Ustrd>([^<]+)<\/Ustrd>/);
    const description = ustrdMatch ? ustrdMatch[1] : 'CAMT.053 Entry';

    parsedLines.push({
      date,
      amountCents: isCredit ? amtCents : -amtCents,
      description,
      type: isCredit ? 'credit' : 'debit'
    });
  }

  return parsedLines;
}
