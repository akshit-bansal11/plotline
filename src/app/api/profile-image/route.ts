import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const sanitizeUid = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

const getExtension = (filename: string, mimeType: string) => {
    const fromName = filename.split(".").pop()?.toLowerCase();
    if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/png") return "png";
    if (mimeType === "image/webp") return "webp";
    if (mimeType === "image/svg+xml") return "svg";
    if (mimeType === "image/gif") return "gif";
    return "png";
};

export async function POST(request: Request) {
    try {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return NextResponse.json(
                { error: "BLOB_READ_WRITE_TOKEN is missing on the server." },
                { status: 500 },
            );
        }

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
            return NextResponse.json({ error: "Only image uploads are allowed." }, { status: 400 });
        }

        if (file.size > MAX_PROFILE_IMAGE_BYTES) {
            return NextResponse.json({ error: "Profile image must be 5MB or smaller." }, { status: 400 });
        }

        const uid = sanitizeUid(uidRaw);
        if (!uid) {
            return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
        }

        const extension = getExtension(file.name, file.type);
        const pathname = `users/${uid}/profile-${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const blob = await put(pathname, file, {
            access: "public",
            addRandomSuffix: false,
        });

        return NextResponse.json({ url: blob.url }, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
