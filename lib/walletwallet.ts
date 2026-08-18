import "server-only";

const BASE_URL = "https://api.walletwallet.dev/api";

type MemberPassInput = {
  memberId: string;
  name: string;
  points: number;
};

function getApiKey() {
  const key = process.env.WALLETWALLET_API_KEY;
  if (!key) throw new Error("Missing WALLETWALLET_API_KEY");
  return key;
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`,
  };
}

export function buildMemberPass({
  memberId,
  name,
  points,
}: MemberPassInput) {
  return {
    barcodeValue: memberId,
    barcodeFormat: "QR",
    logoText: "GULA EXPRESS",
    organizationName: "GULA EXPRESS",
    description: "GULA EXPRESS Loyalty Pass",
    primaryFields: [
      {
        label: "POINTS",
        value: String(points),
        changeMessage: "You now have %@ points",
      },
    ],
    secondaryFields: [
      {
        label: "MEMBER",
        value: (name || "GULA Member").toUpperCase(),
      },
    ],
    backFields: [
      {
        label: "Member ID",
        value: memberId,
      },
    ],
    sharingProhibited: true,
    colorPreset: "red",
  };
}

async function readWalletError(res: Response) {
  try {
    const data = await res.json();
    return typeof data?.error === "string"
      ? data.error
      : `WalletWallet request failed (${res.status})`;
  } catch {
    return `WalletWallet request failed (${res.status})`;
  }
}

export async function createWalletPass(input: MemberPassInput) {
  const res = await fetch(`${BASE_URL}/passes`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(buildMemberPass(input)),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await readWalletError(res));
  }

  const data = await res.json();

  if (!data.serialNumber || !data.shareUrl) {
    throw new Error("WalletWallet returned an incomplete pass response.");
  }

  return {
    serialNumber: String(data.serialNumber),
    shareUrl: String(data.shareUrl),
    googleSaveUrl:
      typeof data.googleSaveUrl === "string" ? data.googleSaveUrl : null,
  };
}

export async function updateWalletPass(
  walletSerial: string,
  input: MemberPassInput,
) {
  const res = await fetch(
    `${BASE_URL}/passes/${encodeURIComponent(walletSerial)}`,
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(buildMemberPass(input)),
      cache: "no-store",
    },
  );

  if (res.status === 404) {
    return { ok: false as const, missing: true as const };
  }

  if (!res.ok) {
    throw new Error(await readWalletError(res));
  }

  return { ok: true as const, missing: false as const };
}
