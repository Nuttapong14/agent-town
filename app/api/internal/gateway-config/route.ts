import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type OpenClawConfigShape = {
  gateway?: {
    bind?: string;
    port?: number;
    auth?: { token?: string };
  };
};

type DeviceAuthShape = {
  deviceId?: string;
  tokens?: {
    operator?: {
      token?: string;
      scopes?: string[];
    };
  };
};

type DeviceIdentityShape = {
  deviceId?: string;
  publicKeyPem?: string;
  privateKeyPem?: string;
};

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as { code?: string })?.code !== "ENOENT") {
      console.error(`[gateway-config] Failed to read or parse ${filePath}:`, error);
    }
    return null;
  }
}

function normalizeGatewayUrl(bind: string | undefined, port: number | undefined) {
  const host = !bind || bind === "loopback" || bind === "127.0.0.1" ? "127.0.0.1" : bind;
  return `ws://${host}:${port ?? 18789}/`;
}

export async function GET() {
  const home = process.env.HOME;
  if (!home) {
    return NextResponse.json({ ok: false, error: "HOME is not set" }, { status: 500 });
  }

  const openClawConfigPath = path.join(home, ".openclaw", "openclaw.json");
  const deviceAuthPath = path.join(home, ".openclaw", "identity", "device-auth.json");
  const deviceIdentityPath = path.join(home, ".openclaw", "identity", "device.json");

  const [openClawConfig, deviceAuth, deviceIdentity] = await Promise.all([
    readJson<OpenClawConfigShape>(openClawConfigPath),
    readJson<DeviceAuthShape>(deviceAuthPath),
    readJson<DeviceIdentityShape>(deviceIdentityPath),
  ]);

  const operatorToken = deviceAuth?.tokens?.operator?.token?.trim();
  const sharedToken = openClawConfig?.gateway?.auth?.token?.trim();

  return NextResponse.json({
    ok: true,
    config: {
      provider: "openclaw",
      url: normalizeGatewayUrl(openClawConfig?.gateway?.bind, openClawConfig?.gateway?.port),
      token: sharedToken ?? "",
      deviceToken: operatorToken ?? "",
      device:
        deviceIdentity?.deviceId && deviceIdentity.publicKeyPem
          ? {
              id: deviceIdentity.deviceId,
              publicKeyPem: deviceIdentity.publicKeyPem,
            }
          : undefined,
    },
    scopes: deviceAuth?.tokens?.operator?.scopes ?? [],
  });
}
