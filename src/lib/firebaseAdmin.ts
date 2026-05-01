// File: src/lib/firebaseAdmin.ts
// Purpose: Server-side Firebase Admin SDK initialization and service exports

// ─── Firebase Admin
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ─── Configuration
const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  // Ensure the private key handles newlines correctly
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

// ─── Initialization
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert(firebaseAdminConfig as ServiceAccount),
    });
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
  }
}

// ─── Exports
export const adminAuth = getAuth();
export const adminDb = getFirestore();
