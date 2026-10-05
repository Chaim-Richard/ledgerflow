import { useEffect } from 'react';
import { startRecentRecordTracking } from '../stores/useRecentRecordsStore';
export function useRecentRecordTracking() { useEffect(() => startRecentRecordTracking(), []); }
