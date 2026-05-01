// File: src/app/api/auth/session/route.ts
// Purpose: Server-side session management using Firebase Admin SDK and cookies

// ─── Imports: Third-party
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─── Internal — services
import { adminAuth } from "@/lib/firebaseAdmin";

// ─── Validation
const sessionSchema = z.object({
  idToken: z.string().min(1, "Token is required"),
});

// ─── Route Handlers
/**
 * Creates a server-side session cookie based on a client-provided ID token.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = sessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { idToken } = result.data;

    // Set session expiration to 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    // Create the session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

/**
 * Deletes the server-side session cookie (logout).
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  return NextResponse.json({ success: true });
}
