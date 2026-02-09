"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  sendPasswordReset: async () => {},
  signOut: async () => {},
});

const normalizeAuthError = (error: unknown) => {
  if (!error || typeof error !== "object") return "Something went wrong. Please try again.";
  const message = "message" in error ? String(error.message) : "";
  if (message.includes("auth/invalid-credential")) return "Invalid email or password.";
  if (message.includes("auth/email-already-in-use")) return "Email already in use.";
  if (message.includes("auth/weak-password")) return "Password should be at least 6 characters.";
  if (message.includes("auth/invalid-email")) return "Please enter a valid email.";
  if (message.includes("auth/user-not-found")) return "No account found for this email.";
  if (message.includes("auth/too-many-requests")) return "Too many attempts. Try again later.";
  return "Something went wrong. Please try again.";
};

const buildProfile = (user: User, displayNameOverride?: string) => {
  const displayName = displayNameOverride || user.displayName || "";
  const email = user.email || "";
  if (!user.uid) {
    throw new Error("Missing user id.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email.");
  }
  if (displayName && displayName.length > 80) {
    throw new Error("Display name is too long.");
  }
  return {
    uid: user.uid,
    email,
    displayName,
  };
};

const saveUserProfile = async (user: User, displayNameOverride?: string) => {
  const profile = buildProfile(user, displayNameOverride);
  await setDoc(
    doc(db, "users", profile.uid),
    {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          await saveUserProfile(user);
        } catch {
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await saveUserProfile(result.user);
      }
    } catch (error) {
      throw new Error(normalizeAuthError(error));
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw new Error(normalizeAuthError(error));
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        if (displayName) {
          await updateProfile(result.user, { displayName });
        }
        await saveUserProfile(result.user, displayName);
      }
    } catch (error) {
      throw new Error(normalizeAuthError(error));
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(normalizeAuthError(error));
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw new Error(normalizeAuthError(error));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
