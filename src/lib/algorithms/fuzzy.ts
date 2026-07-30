// Levenshtein Distance for string similarity
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, // insertion
                   matrix[i - 1][j] + 1) // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function stringSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim().slice(0, 64);
  const bLower = b.toLowerCase().trim().slice(0, 64);
  if (aLower === bLower) return 1.0;
  
  const maxLength = Math.max(aLower.length, bLower.length);
  if (maxLength === 0) return 1.0;

  // Optimization: If length difference is too large, the distance will be large
  const minDistance = Math.abs(aLower.length - bLower.length);
  if ((1.0 - minDistance / maxLength) < 0.2) return 0.0;
  
  const distance = levenshteinDistance(aLower, bLower);
  
  return 1.0 - distance / maxLength;
}

// Jaccard similarity for sets of tokens
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  if (union.size === 0) return 1.0;
  return intersection.size / union.size;
}

export function combineStringSimilarity(a: string, b: string): number {
   return (stringSimilarity(a, b) * 0.7) + (jaccardSimilarity(a, b) * 0.3);
}
