// File: src/components/overlay/modalStack.ts
// Purpose: Global z-index management for nested modals

/**
 * Global z-index tracker for modals to ensure proper stacking of nested overlays.
 * Module-level state is used here intentionally to maintain a consistent stack 
 * across different React component trees and portal instances without needing
 * a shared context, which simplifies deep nesting.
 */
let nextModalZIndex = 1000;

/**
 * Returns a new z-index for a modal and increments the global counter.
 */
export function acquireModalZIndex() {
  const zIndex = nextModalZIndex;
  nextModalZIndex += 2;
  return zIndex;
}

/**
 * Resets the modal z-index counter to its initial value.
 * Useful for testing or when clearing all active modals.
 */
export function resetModalZIndex() {
  nextModalZIndex = 1000;
}
