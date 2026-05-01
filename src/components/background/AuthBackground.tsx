// File: src/components/background/AuthBackground.tsx
// Purpose: Ambient background gradients for authentication pages

export function AuthBackground() {
  return (
    <>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
    </>
  );
}
