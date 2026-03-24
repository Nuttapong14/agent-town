import { promises as fs } from "node:fs";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const { subtle } = webcrypto;

type DeviceIdentityShape = {
  deviceId?: string;
  publicKeyPem?: string;
  privateKeyPem?: string;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const buf = Buffer.from(base64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeDeviceAuthPart(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const home = process.env.HOME;
  if (!home) {
    return NextResponse.json({ ok: false, error: "HOME is not set" }, { status: 500 });
  }

  let body: {
    nonce: string;
    token?: string;
    scopes: string[];
    signedAtMs: number;
    clientId: string;
    clientMode: string;
    role: string;
    platform: string;
    deviceFamily?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { nonce, token, scopes, signedAtMs, clientId, clientMode, role, platform, deviceFamily } =
    body;

  if (!nonce || !Array.isArray(scopes) || !clientId || !clientMode || !role || !platform) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const deviceIdentityPath = path.join(home, ".openclaw", "identity", "device.json");
  let deviceIdentity: DeviceIdentityShape | null = null;
  try {
    deviceIdentity = JSON.parse(
      await fs.readFile(deviceIdentityPath, "utf8"),
    ) as DeviceIdentityShape;
  } catch (error) {
    if ((error as { code?: string })?.code === "ENOENT") {
      return NextResponse.json({ ok: false, error: "Device identity not found" }, { status: 404 });
    }
    console.error("[sign-nonce] Failed to read or parse device identity:", error);
    return NextResponse.json(
      { ok: false, error: "Malformed device identity file" },
      { status: 500 },
    );
  }

  if (!deviceIdentity?.deviceId || !deviceIdentity.privateKeyPem || !deviceIdentity.publicKeyPem) {
    return NextResponse.json({ ok: false, error: "Incomplete device identity" }, { status: 400 });
  }

  const payload = [
    "v3",
    deviceIdentity.deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(","),
    String(signedAtMs),
    token ?? "",
    nonce,
    normalizeDeviceAuthPart(platform),
    normalizeDeviceAuthPart(deviceFamily),
  ].join("|");

  const privateKey = await subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(deviceIdentity.privateKeyPem),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = await subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(payload),
  );

  const publicKey = await subtle.importKey(
    "spki",
    pemToArrayBuffer(deviceIdentity.publicKeyPem),
    { name: "Ed25519" },
    true,
    [],
  );
  const rawPublicKey = await subtle.exportKey("raw", publicKey);

  return NextResponse.json({
    ok: true,
    signature: bytesToBase64Url(new Uint8Array(signature)),
    publicKey: bytesToBase64Url(new Uint8Array(rawPublicKey)),
    deviceId: deviceIdentity.deviceId,
  });
}
