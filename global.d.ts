declare module "*.css";
declare module "*.bones.json" {
  const value: any;
  export default value;
}
declare module "boneyard-js" {
  export function registerBones(map: Record<string, any>): void;
}

interface Window {
  __BONEYARD_BUILD?: boolean;
}
