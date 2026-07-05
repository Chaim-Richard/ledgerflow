import { useEffect, useRef } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const shortcutsRef = useRef(shortcuts);
  
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // Combine mod key with key
      const shortcutKey = isMod ? `mod+${key}` : key;

      if (shortcutsRef.current[shortcutKey]) {
        event.preventDefault();
        event.stopPropagation();
        shortcutsRef.current[shortcutKey]();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Capture phase overrides Chrome global search
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}

