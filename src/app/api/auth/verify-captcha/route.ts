// File: src/app/api/auth/verify-captcha/route.ts
// Purpose: Server-side reCAPTCHA verification using Google's siteverify API

// ─── Imports: Third-party
import { type NextRequest, NextResponse } from "next/server";

// ─── Internal — lib
import { safeFetch } from "@/lib/fetch";

/**
 * Verifies a reCAPTCHA token provided by the client.
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 400 });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    const response = await safeFetch(url, { method: "POST" });
    const data = await response.json();

    if (data.success && data.score >= 0.5) {
      return NextResponse.json({ success: true, score: data.score });
    } else {
      return NextResponse.json(
        { error: "Verification failed", score: data.score || 0 },
        { status: 403 },
      );
    }
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
