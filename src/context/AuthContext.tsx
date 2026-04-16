"use client";

import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  getIdToken,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { saveLastUsedProvider } from "@/utils/auth";

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
    captchaToken?: string,
  ) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateUserProfile: (displayName: string, photoURL: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  sendPasswordReset: async () => {},
  updateUserProfile: async () => {},
  signOut: async () => {},
});

// Sync session cookie with server
const syncSession = async (user: User | null) => {
  if (user) {
    const idToken = await getIdToken(user);
    await fetch("/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
  } else {
    await fetch("/api/auth/session", { method: "DELETE" });
  }
};

const normalizeAuthError = (error: unknown) => {
  if (!error || typeof error !== "object") return "Something went wrong. Please try again.";
  const message = "message" in error ? String(error.message) : "";
  const code = "code" in error ? String(error.code) : "";

  if (code === "auth/invalid-credential" || message.includes("auth/invalid-credential"))
    return "Invalid email or password.";
  if (code === "auth/email-already-in-use" || message.includes("auth/email-already-in-use"))
    return "Email already in use.";
  if (code === "auth/weak-password" || message.includes("auth/weak-password"))
    return "Password should be at least 6 characters.";
  if (code === "auth/invalid-email" || message.includes("auth/invalid-email"))
    return "Please enter a valid email.";
  if (code === "auth/user-not-found" || message.includes("auth/user-not-found"))
    return "No account found for this email.";
  if (code === "auth/too-many-requests" || message.includes("auth/too-many-requests"))
    return "Too many attempts. Try again later.";
  if (message.includes("reCAPTCHA")) return message;

  return "Something went wrong. Please try again.";
};

const buildProfile = (
  user: User,
  overrides?: { displayName?: string; photoURL?: string | null },
) => {
  const displayName = overrides?.displayName ?? user.displayName ?? "";
  const email = user.email || "";
  const hasPhotoOverride = Boolean(overrides && Object.hasOwn(overrides, "photoURL"));
  const photoURL = hasPhotoOverride ? (overrides?.photoURL ?? null) : (user.photoURL ?? "");
  if (!user.uid) {
    throw new Error("Missing user id.");
  }
  if (!email?.includes("@")) {
    throw new Error("Invalid email.");
  }
  if (displayName && displayName.length > 80) {
    throw new Error("Display name is too long.");
  }
  return {
    uid: user.uid,
    email,
    displayName,
    photoURL,
  };
};

const saveUserProfile = async (
  user: User,
  overrides?: { displayName?: string; photoURL?: string | null },
) => {
  const profile = buildProfile(user, overrides);
  await setDoc(
    doc(db, "users", profile.uid),
    {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser) => {
      setUser(authenticatedUser);
      if (authenticatedUser) {
        try {
          await saveUserProfile(authenticatedUser);
          await syncSession(authenticatedUser);
        } catch (err) {
          console.error("Error during auth state change:", err);
        }
      } else {
        await syncSession(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const verifyCaptcha = async (token?: string) => {
    const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
    if (!token) {
      if (isRecaptchaEnabled) {
        throw new Error("CAPTCHA verification failed. Please try again.");
      }
      return true;
    }

    const res = await fetch("/api/auth/verify-captcha", {
      method: "POST",
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      throw new Error("reCAPTCHA verification failed. Please try again.");
    }
    return true;
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await saveUserProfile(result.user);
        await syncSession(result.user);
        saveLastUsedProvider("google");
        if (pathname === "/auth") router.push("/");
      }
    } catch (err) {
      const message = normalizeAuthError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const signInWithEmail = async (email: string, password: string, captchaToken?: string) => {
    setError(null);
    try {
      await verifyCaptcha(captchaToken);
      const result = await signInWithEmailAndPassword(auth, email, password);
      await syncSession(result.user);
      saveLastUsedProvider("password");
      if (pathname === "/auth") router.push("/");
    } catch (err) {
      const message = normalizeAuthError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    captchaToken?: string,
  ) => {
    setError(null);
    try {
      await verifyCaptcha(captchaToken);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        if (displayName) {
          await updateProfile(result.user, { displayName });
        }
        await saveUserProfile(result.user, { displayName });
        await syncSession(result.user);
        saveLastUsedProvider("password");
        if (pathname === "/auth") router.push("/");
      }
    } catch (err) {
      const message = normalizeAuthError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setError(null);
    try {
      // Check rate limit via API first
      const ratelimitRes = await fetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const ratelimitData = await ratelimitRes.json();

      if (!ratelimitRes.ok) {
        throw new Error(ratelimitData.error || "Too many attempts");
      }

      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      const message = normalizeAuthError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const updateUserProfile = async (displayName: string, photoURL: string | null) => {
    setError(null);
    if (!auth.currentUser) throw new Error("No active account.");
    try {
      await updateProfile(auth.currentUser, {
        displayName,
        photoURL: photoURL || null,
      });
      await saveUserProfile(auth.currentUser, { displayName, photoURL });
      setUser(auth.currentUser);
    } catch (err) {
      const message = normalizeAuthError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      await syncSession(null);
    } catch (err) {
      const message = normalizeAuthError(err);
      setError(message);
      throw new Error(message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        updateUserProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
