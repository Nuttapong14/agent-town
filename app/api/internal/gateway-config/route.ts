import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

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

function proxyGatewayUrl(req: NextRequest): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host") ?? "localhost:3000";
  const proto = forwardedProto?.split(",")[0].trim() ?? "http";
  const wsProto = proto === "https" ? "wss" : "ws";
  return `${wsProto}://${host}/api/gateway`;
}

export async function GET(req: NextRequest) {
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
      url: proxyGatewayUrl(req),
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
