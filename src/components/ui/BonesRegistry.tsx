"use client";

// This component exists solely to side-effect import the boneyard bones registry
// so captured .bones.json layouts are available at runtime across the app.
// It renders nothing — drop it once inside the root layout.
import "@/bones/registry";

export function BonesRegistry() {
  return null;
}
