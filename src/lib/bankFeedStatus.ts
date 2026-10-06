export interface BankStatus { id: string; institutionName: string; status: string; lastSyncedAt?: string | null }
export function readBankStatuses(value: unknown): BankStatus[] {
  if (!value || typeof value !== 'object' || !('banks' in value) || !Array.isArray(value.banks)) throw new Error('The server did not return bank connection status.');
  return value.banks.map((bank: unknown) => {
    if (!bank || typeof bank !== 'object' || !('id' in bank) || typeof bank.id !== 'string' || bank.id.length > 500) throw new Error('Invalid bank connection status.');
    let sync: Pick<BankStatus, 'lastSyncedAt'> = {};
    if ('lastSyncedAt' in bank) {
      const value = bank.lastSyncedAt;
      if (value === null) sync = { lastSyncedAt: null };
      else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value) sync = { lastSyncedAt: value };
      else throw new Error('Invalid bank last successful sync timestamp.');
    }
    return { ...sync, id: bank.id, institutionName: 'institutionName' in bank && typeof bank.institutionName === 'string' ? bank.institutionName : 'Bank', status: 'status' in bank && typeof bank.status === 'string' ? bank.status : 'unknown' };
  });
}
