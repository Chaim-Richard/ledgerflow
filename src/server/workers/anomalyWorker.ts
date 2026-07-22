import { parentPort, workerData } from 'worker_threads';
import { AnomalyDetectionEngine } from '../../kernel/validation/AnomalyDetectionEngine';

const { transactions } = workerData;

try {
  const anomalies = AnomalyDetectionEngine.detectAmountOutliers(transactions, 3.0);
  
  parentPort?.postMessage({ success: true, anomalies });
} catch (error: any) {
  parentPort?.postMessage({ success: false, error: error.message });
}
