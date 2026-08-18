import "server-only";

const BASE_URL =
  "https://api.walletwallet.dev/api";

type MemberPassInput = {
  memberId: string;
  name: string;
  points: number;
  logoURL?: string;
};

class WalletWalletError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);

    this.name =
      "WalletWalletError";

    this.status = status;
  }
}

function getApiKey() {
  const key =
    process.env
      .WALLETWALLET_API_KEY;

  if (!key) {
    throw new Error(
      "Missing WALLETWALLET_API_KEY",
    );
  }

  return key;
}

function headers() {
  return {
    "Content-Type":
      "application/json",

    Authorization:
      `Bearer ${getApiKey()}`,
  };
}

export function buildMemberPass({
  memberId,
  name,
  points,
  logoURL,
}: MemberPassInput) {
  const rewardReady =
    points >= 1000;

  return {
    barcodeValue:
      memberId,

    barcodeFormat:
      "QR",

    logoText:
      "GULA EXPRESS",

    organizationName:
      "GULA EXPRESS",

    description:
      "GULA EXPRESS Rewards",

    ...(logoURL
      ? { logoURL }
      : {}),

    headerFields: [
      {
        key:
          "POINTS",

        label:
          "POINTS",

        value:
          String(points),

        changeMessage:
          "Your GULA balance is now %@ points",
      },
    ],

    primaryFields: [
      {
        key:
          "REWARD",

        label:
          rewardReady
            ? "REWARD READY"
            : "NEXT REWARD",

        value:
          rewardReady
            ? "FREE REWARD AVAILABLE!"
            : "FREE REWARD AT 1000 POINTS!",
      },
    ],

    secondaryFields: [
      {
        key:
          "MEMBER",

        label:
          "MEMBER",

        value:
          (
            name ||
            "GULA Member"
          ).toUpperCase(),
      },
    ],

    backFields: [
      {
        key:
          "MEMBER_ID",

        label:
          "Member ID",

        value:
          memberId,
      },

      {
        key:
          "REWARDS",

        label:
          "Rewards",

        value:
          "Earn 10 points for every $1 spent at GULA EXPRESS.",
      },

      {
        key:
          "FREE_REWARD",

        label:
          "Free Reward",

        value:
          "Redeem 1000 points for one free reward at GULA EXPRESS.",
      },

      {
        key:
          "THANK_YOU",

        label:
          "Thank you",

        value:
          "Thanks for being part of GULA EXPRESS.",
      },
    ],

    sharingProhibited:
      true,

    colorPreset:
      "red",
  };
}

async function parseWalletError(
  res: Response,
) {
  try {
    const data =
      await res.json();

    const message =
      typeof data?.error ===
      "string"
        ? data.error
        : `WalletWallet request failed (${res.status})`;

    return new WalletWalletError(
      message,
      res.status,
    );
  } catch {
    return new WalletWalletError(
      `WalletWallet request failed (${res.status})`,
      res.status,
    );
  }
}

function isLogoPlanError(
  error: unknown,
) {
  if (
    !(
      error instanceof
      WalletWalletError
    )
  ) {
    return false;
  }

  return (
    error.status === 400 &&
    /logo|image|pro|plan|feature/i.test(
      error.message,
    )
  );
}

async function createPassRequest(
  input: MemberPassInput,
) {
  const res = await fetch(
    `${BASE_URL}/passes`,
    {
      method: "POST",

      headers:
        headers(),

      body:
        JSON.stringify(
          buildMemberPass(
            input,
          ),
        ),

      cache:
        "no-store",
    },
  );

  if (!res.ok) {
    throw await parseWalletError(
      res,
    );
  }

  const data =
    await res.json();

  if (
    !data.serialNumber ||
    !data.shareUrl
  ) {
    throw new Error(
      "WalletWallet returned an incomplete pass response.",
    );
  }

  return {
    serialNumber:
      String(
        data.serialNumber,
      ),

    shareUrl:
      String(
        data.shareUrl,
      ),

    googleSaveUrl:
      typeof data.googleSaveUrl ===
      "string"
        ? data.googleSaveUrl
        : null,
  };
}

export async function createWalletPass(
  input: MemberPassInput,
) {
  try {
    return {
      ...(await createPassRequest(
        input,
      )),

      logoApplied:
        Boolean(
          input.logoURL,
        ),
    };
  } catch (error) {
    if (
      input.logoURL &&
      isLogoPlanError(error)
    ) {
      const {
        logoURL:
          _logoURL,
        ...withoutLogo
      } = input;

      return {
        ...(await createPassRequest(
          withoutLogo,
        )),

        logoApplied:
          false,
      };
    }

    throw error;
  }
}

async function updatePassRequest(
  walletSerial: string,
  input: MemberPassInput,
) {
  const res = await fetch(
    `${BASE_URL}/passes/${encodeURIComponent(
      walletSerial,
    )}`,
    {
      method:
        "PUT",

      headers:
        headers(),

      body:
        JSON.stringify(
          buildMemberPass(
            input,
          ),
        ),

      cache:
        "no-store",
    },
  );

  if (
    res.status === 404
  ) {
    return {
      ok:
        false as const,

      missing:
        true as const,
    };
  }

  if (!res.ok) {
    throw await parseWalletError(
      res,
    );
  }

  return {
    ok:
      true as const,

    missing:
      false as const,
  };
}

export async function updateWalletPass(
  walletSerial: string,
  input: MemberPassInput,
) {
  try {
    return {
      ...(await updatePassRequest(
        walletSerial,
        input,
      )),

      logoApplied:
        Boolean(
          input.logoURL,
        ),
    };
  } catch (error) {
    if (
      input.logoURL &&
      isLogoPlanError(error)
    ) {
      const {
        logoURL:
          _logoURL,
        ...withoutLogo
      } = input;

      return {
        ...(await updatePassRequest(
          walletSerial,
          withoutLogo,
        )),

        logoApplied:
          false,
      };
    }

    throw error;
  }
}
