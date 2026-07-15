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
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = event.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.tagName === 'SELECT' ||
         target.isContentEditable)
      ) {
        // Allow escape key to still work even in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      const isMod = event.metaKey || event.ctrlKey;
      const isAlt = event.altKey;
      const isShift = event.shiftKey;
      const key = event.key.toLowerCase();

      // We normalize the key string format
      let shortcutKey = '';
      if (isMod) shortcutKey += 'mod+';
      if (isAlt) shortcutKey += 'alt+';
      if (isShift && key !== '?') shortcutKey += 'shift+'; // Special case for '?'
      shortcutKey += key;

      // Handle raw key mapping if defined directly (e.g., '?')
      if (shortcutsRef.current[key] && !isMod && !isAlt && !isShift) {
         event.preventDefault();
         event.stopPropagation();
         shortcutsRef.current[key]();
         return;
      }

      if (shortcutsRef.current[shortcutKey]) {
        event.preventDefault();
        event.stopPropagation();
        shortcutsRef.current[shortcutKey]();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}
