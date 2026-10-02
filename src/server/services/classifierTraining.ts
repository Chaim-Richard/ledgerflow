import { getDb } from '../db/firestore';
import type { BayesianClassifier } from '../../lib/algorithms';

/**
 * Teach the category classifier from the workspace's own transactions and from corrections
 * people made (learnedDeltas). Used by /api/v1/brain/analyze and the developer categorize API.
 * Returns how many examples were used.
 */
export async function trainClassifierWithWorkspaceData(classifier: BayesianClassifier, workspaceId: string, apiKeyId?: string) {
  const db = getDb();
  let trainedCount = 0;
  try {
    const transactionsSnap = await db.collection("transactions").where("workspaceId", "==", workspaceId).limit(200).get();
    transactionsSnap.docs.forEach(doc => {
      const txData = doc.data();
      if (txData && txData.description) {
        const category = txData.category || txData.lines?.find((l: { category?: string }) => l.category)?.category || txData.lines?.find((l: { amountCents?: number }) => (l.amountCents || 0) > 0)?.accountName;
        if (category) {
          classifier.train(txData.description, category, 1.5);
          trainedCount++;
        }
      }
    });
  } catch {
    /* training data is optional: the classifier still works untrained */
  }

  try {
    const activeKeyId = apiKeyId || "human_web_console";
    const queryPromises = [
      db.collection("learnedDeltas").where("apiKeyId", "==", "human_web_console").limit(150).get()
    ];
    if (activeKeyId !== "human_web_console") {
      queryPromises.push(db.collection("learnedDeltas").where("apiKeyId", "==", activeKeyId).limit(150).get());
    }
    const snaps = await Promise.all(queryPromises);
    snaps.forEach(snap => {
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data && data.description && data.category && data.workspaceId === workspaceId) {
          classifier.train(data.description, data.category, 3.0);
          trainedCount++;
        }
      });
    });
  } catch {
    /* training data is optional: the classifier still works untrained */
  }
  
  return trainedCount;
}
