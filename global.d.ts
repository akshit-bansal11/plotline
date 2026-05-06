declare module "*.css";

declare module "*.bones.json" {
  const value: unknown;
  export default value;
}

declare module "boneyard-js" {
  export function registerBones(map: Record<string, unknown>): void;
}

declare global {
  interface Window {
    __BONEYARD_BUILD?: boolean;
  }
}

export {};
