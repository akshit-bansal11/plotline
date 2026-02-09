import { useEffect } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/context/auth-context";

type AuthApi = {
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const authMocks = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(() => Promise.resolve({})),
  createUserWithEmailAndPassword: vi.fn(() =>
    Promise.resolve({ user: { uid: "user-1", email: "user@example.com", displayName: "" } })
  ),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve({})),
  signInWithPopup: vi.fn(() =>
    Promise.resolve({ user: { uid: "user-1", email: "user@example.com", displayName: "Plot User" } })
  ),
  updateProfile: vi.fn(() => Promise.resolve({})),
  onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return () => {};
  }),
  signOut: vi.fn(() => Promise.resolve({})),
}));

const firestoreMocks = vi.hoisted(() => ({
  setDoc: vi.fn(() => Promise.resolve({})),
  doc: vi.fn((db: unknown, collection: string, id: string) => ({ db, collection, id })),
  serverTimestamp: vi.fn(() => "timestamp"),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: authMocks.onAuthStateChanged,
  signInWithEmailAndPassword: authMocks.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: authMocks.createUserWithEmailAndPassword,
  sendPasswordResetEmail: authMocks.sendPasswordResetEmail,
  signInWithPopup: authMocks.signInWithPopup,
  updateProfile: authMocks.updateProfile,
  signOut: authMocks.signOut,
}));

vi.mock("firebase/firestore", () => ({
  setDoc: firestoreMocks.setDoc,
  doc: firestoreMocks.doc,
  serverTimestamp: firestoreMocks.serverTimestamp,
}));

vi.mock("@/lib/firebase", () => ({
  auth: { mocked: true },
  db: { mocked: true },
  googleProvider: { mocked: true },
}));

function TestHarness({ onReady }: { onReady: (api: AuthApi) => void }) {
  const api = useAuth() as AuthApi;
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

const createApiPromise = () => {
  let resolveApi: (api: AuthApi) => void;
  const promise = new Promise<AuthApi>((resolve) => {
    resolveApi = resolve;
  });
  return { promise, onReady: (api: AuthApi) => resolveApi(api) };
};

describe("AuthProvider", () => {
  it("signs in with email and password", async () => {
    const { promise, onReady } = createApiPromise();
    render(
      <AuthProvider>
        <TestHarness onReady={onReady} />
      </AuthProvider>
    );

    const api = await promise;
    await api.signInWithEmail("user@example.com", "password123");

    expect(authMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
      { mocked: true },
      "user@example.com",
      "password123"
    );
  });

  it("creates user profile on sign up", async () => {
    const { promise, onReady } = createApiPromise();
    render(
      <AuthProvider>
        <TestHarness onReady={onReady} />
      </AuthProvider>
    );

    const api = await promise;
    await api.signUpWithEmail("user@example.com", "password123", "Plot User");

    expect(authMocks.createUserWithEmailAndPassword).toHaveBeenCalled();
    expect(authMocks.updateProfile).toHaveBeenCalled();
    expect(firestoreMocks.setDoc).toHaveBeenCalled();
  });

  it("sends password reset email", async () => {
    const { promise, onReady } = createApiPromise();
    render(
      <AuthProvider>
        <TestHarness onReady={onReady} />
      </AuthProvider>
    );

    const api = await promise;
    await api.sendPasswordReset("user@example.com");

    expect(authMocks.sendPasswordResetEmail).toHaveBeenCalledWith({ mocked: true }, "user@example.com");
  });

  it("signs in with Google", async () => {
    const { promise, onReady } = createApiPromise();
    render(
      <AuthProvider>
        <TestHarness onReady={onReady} />
      </AuthProvider>
    );

    const api = await promise;
    await api.signInWithGoogle();

    expect(authMocks.signInWithPopup).toHaveBeenCalled();
    expect(firestoreMocks.setDoc).toHaveBeenCalled();
  });

  it("signs out", async () => {
    const { promise, onReady } = createApiPromise();
    render(
      <AuthProvider>
        <TestHarness onReady={onReady} />
      </AuthProvider>
    );

    const api = await promise;
    await api.signOut();

    expect(authMocks.signOut).toHaveBeenCalled();
  });
});
