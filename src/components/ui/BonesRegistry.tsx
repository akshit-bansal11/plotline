// File: src/components/ui/BonesRegistry.tsx
// Purpose: Side-effect component to register Boneyard.js skeleton layouts

"use client";

// ─── Internal — side effects
import "@/bones/registry";

/**
 * This component exists solely to side-effect import the boneyard bones registry
 * so captured .bones.json layouts are available at runtime across the app.
 * It renders nothing — drop it once inside the root layout.
 */
export function BonesRegistry() {
  return null;
}
