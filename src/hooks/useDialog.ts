import { useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELD = 'input:not([disabled]):not([type="hidden"]):not([type="file"]), select:not([disabled]), textarea:not([disabled])';

function visible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

/**
 * What a dialog needs to be usable with a keyboard and a screen reader (E-08…E-20): it is announced
 * as a dialog with its title, focus moves into it (the first field, else the first control), Tab
 * stays inside, Escape closes it, and focus goes back where it was when it closes.
 *
 *   const { dialogProps, titleId } = useDialog(onClose, isOpen);
 *   <div {...dialogProps} className="…"> <h2 id={titleId}>New invoice</h2> …
 *
 * `onClose` may ask first (unsaved changes); it is called as it is at the time of the key press.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void, open = true) {
  const ref = useRef<T>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);

    if (!node.contains(document.activeElement)) {
      const field = Array.from(node.querySelectorAll<HTMLElement>(FIELD)).find(visible);
      (field || focusables()[0] || node).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // an inner dialog closes alone
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      if (previous && previous.isConnected) previous.focus();
    };
  }, [open]);

  return {
    titleId,
    dialogProps: { ref, role: 'dialog' as const, 'aria-modal': true as const, 'aria-labelledby': titleId, tabIndex: -1 },
  };
}
