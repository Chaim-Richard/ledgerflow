export interface BankStatus { id: string; institutionName: string; status: string }
export function readBankStatuses(value: unknown): BankStatus[] {
  if (!value || typeof value !== 'object' || !('banks' in value) || !Array.isArray(value.banks)) throw new Error('The server did not return bank connection status.');
  return value.banks.map((bank: unknown) => {
    if (!bank || typeof bank !== 'object' || !('id' in bank) || typeof bank.id !== 'string' || bank.id.length > 500) throw new Error('Invalid bank connection status.');
    return { id: bank.id, institutionName: 'institutionName' in bank && typeof bank.institutionName === 'string' ? bank.institutionName : 'Bank', status: 'status' in bank && typeof bank.status === 'string' ? bank.status : 'unknown' };
  });
}
