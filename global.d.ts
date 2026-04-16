declare module "*.css";
declare module "*.bones.json" {
  const value: unknown;
  export default value;
}
declare module "boneyard-js" {
  export function registerBones(map: Record<string, unknown>): void;
}

interface Window {
  __BONEYARD_BUILD?: boolean;
}
