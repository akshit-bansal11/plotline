import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_FOLDER = "plotline_user_pfp";

const sanitizeUid = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

export async function POST(request: Request) {
  try {
    if (!process.env.CLOUDINARY_URL) {
      return NextResponse.json(
        { error: "CLOUDINARY_URL is missing on the server." },
        { status: 500 },
      );
    }

    cloudinary.config({
      secure: true,
      url: process.env.CLOUDINARY_URL,
    });

    const formData = await request.formData();
    const file = formData.get("file");
    const uidRaw = String(formData.get("uid") || "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    if (!uidRaw) {
      return NextResponse.json({ error: "Missing user id." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image uploads are allowed." },
        { status: 400 },
      );
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Profile image must be 5MB or smaller." },
        { status: 400 },
      );
    }

    const uid = sanitizeUid(uidRaw);
    if (!uid) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise<{ secure_url: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: PROFILE_IMAGE_FOLDER,
            public_id: `${uid}-${Date.now()}`,
            resource_type: "image",
            overwrite: true,
            invalidate: true,
          },
          (error, result) => {
            if (error || !result?.secure_url) {
              reject(error ?? new Error("Cloudinary upload failed."));
              return;
            }
            resolve({ secure_url: result.secure_url });
          },
        );

        stream.end(fileBuffer);
      },
    );

    return NextResponse.json({ url: uploadResult.secure_url }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
