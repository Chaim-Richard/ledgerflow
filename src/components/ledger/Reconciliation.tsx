import React from 'react';
import { useReconciliationModel } from './useReconciliationModel';
import { ReconciliationView } from './ReconciliationView';

export default function Reconciliation() {
 return <ReconciliationView {...useReconciliationModel()} />;
}
