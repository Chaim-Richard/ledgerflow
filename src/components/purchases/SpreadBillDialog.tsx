import React from 'react';
import SpreadDialog from '../common/SpreadDialog';
import type { Bill } from '../../types';

/** Spread a bill's cost over the months it covers, as a prepaid expense (K-17). */
export default function SpreadBillDialog({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  return <SpreadDialog kind="bill" document={bill} onClose={onClose} />;
}
