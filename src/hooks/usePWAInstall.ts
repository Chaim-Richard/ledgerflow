import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Installing LedgerFlow as an app. The browser offers it once, early (`beforeinstallprompt`), so the
 * offer is kept here for every screen that shows an Install button (the sidebar, Settings →
 * Appearance), even ones opened later.
 */
let stashed: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(fn => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    stashed = e as BeforeInstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    stashed = null;
    installedNow = true;
    changed();
  });
}

const runningAsApp = () => typeof window !== 'undefined' && (
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
);

/** iPhone and iPad browsers never offer it: people add the app from the Share menu. */
export const isAppleMobile = () => typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export function usePWAInstall() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const promptInstall = async () => {
    const offer = stashed;
    if (!offer) return;
    // The offer can be used once
    stashed = null;
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    if (outcome === 'accepted') installedNow = true;
    changed();
  };

  return { isInstallable: stashed !== null, isInstalled: installedNow || runningAsApp(), promptInstall };
}
