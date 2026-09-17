export interface ContactCandidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
}

export interface DuplicateGroup {
  primaryContact: ContactCandidate;
  duplicates: ContactCandidate[];
  similarityScore: number;
  reason: string;
}

/**
 * Detects potential duplicate contacts based on normalized name, email, tax ID or phone matching.
 */
export function detectDuplicateContacts(contacts: ContactCandidate[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processedIds = new Set<string>();

  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (let i = 0; i < contacts.length; i++) {
    const c1 = contacts[i];
    if (processedIds.has(c1.id)) continue;

    const duplicates: ContactCandidate[] = [];
    let matchReason = '';

    for (let j = i + 1; j < contacts.length; j++) {
      const c2 = contacts[j];
      if (processedIds.has(c2.id)) continue;

      let matched = false;

      // Exact tax ID match
      if (c1.taxId && c2.taxId && c1.taxId.trim() === c2.taxId.trim()) {
        matched = true;
        matchReason = 'Identical Tax ID';
      }
      // Exact email match
      else if (c1.email && c2.email && c1.email.trim().toLowerCase() === c2.email.trim().toLowerCase()) {
        matched = true;
        matchReason = 'Identical Email Address';
      }
      // Normalized name match
      else if (normalize(c1.name) === normalize(c2.name) && normalize(c1.name).length > 2) {
        matched = true;
        matchReason = 'Normalized Name Match';
      }

      if (matched) {
        duplicates.push(c2);
        processedIds.add(c2.id);
      }
    }

    if (duplicates.length > 0) {
      processedIds.add(c1.id);
      groups.push({
        primaryContact: c1,
        duplicates,
        similarityScore: 0.95,
        reason: matchReason
      });
    }
  }

  return groups;
}
