import { NextResponse } from "next/server";
import {
  ZKEdDSAEventTicketPCD,
  ZKEdDSAEventTicketPCDPackage,
} from "@pcd/zk-eddsa-event-ticket-pcd";
import { getEdDSAPublicKey } from "@pcd/eddsa-pcd";
import { createClient } from "@vercel/kv";
import { Bot, webhookCallback } from "grammy";
import { abi } from "../abi/xDAI";
import { createWalletClient, http, publicActions } from "viem";
import { gnosis } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const { KV_REST_API_URL, KV_REST_API_TOKEN, GNOSIS_URL, TELEGRAM_API_KEY } =
  process.env;

const token = process.env.TELEGRAM_API_KEY;
if (!token) throw new Error("BOT_TOKEN is unset");

const bot = new Bot(token);

if (
  !KV_REST_API_URL ||
  !KV_REST_API_TOKEN ||
  !GNOSIS_URL ||
  !TELEGRAM_API_KEY
) {
  throw new Error(
    "Environment variables KV_REST_API_URL and KV_REST_API_TOKEN and ALCHEMY_URL and TELEGRAM_API_KEY must be defined"
  );
}

export const closeWebviewHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sample HTML Page</title>
      <script src="https://telegram.org/js/telegram-web-app.js"></script>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #2a3231;
        }
      </style>
    </head>
    <body>
      <script>
        // Call the function when the page loads
        window.onload = Telegram.WebApp.close();
      </script>
    </body>
    </html>
  `;

async function verifyZKEdDSAEventTicketPCD(
  serializedZKEdDSATicket: string
): Promise<ZKEdDSAEventTicketPCD | null> {
  let pcd: ZKEdDSAEventTicketPCD;

  try {
    pcd = await ZKEdDSAEventTicketPCDPackage.deserialize(
      JSON.parse(serializedZKEdDSATicket).pcd
    );
  } catch (e) {
    throw new Error(`Deserialization error, ${e}`);
  }

  let signerMatch = false;

  const zupassPubkeyReq = await fetch(
    "https://api.zupass.org/issue/eddsa-public-key"
  );
  const TICKETING_PUBKEY = await zupassPubkeyReq.json();

  signerMatch =
    pcd.claim.signer[0] === TICKETING_PUBKEY[0] &&
    pcd.claim.signer[1] === TICKETING_PUBKEY[1];

  if (
    // TODO: wrap in a MultiProcessService?
    (await ZKEdDSAEventTicketPCDPackage.verify(pcd)) &&
    signerMatch
  ) {
    return pcd;
  } else {
    console.log("[TELEGRAM] pcd invalid");
    return null;
  }
}

export async function GET(request: Request, res: Response) {
  const { searchParams } = new URL(request.url);
  try {
    const proof = searchParams.has("proof") ? searchParams.get("proof") : null;
    const telegram_user_id = searchParams.has("")
      ? searchParams.get("id")
      : null;
    const chat_id = searchParams.has("telegram_chat_id")
      ? searchParams.get("telegram_chat_id") || 0
      : 0;
    let telegram_username = searchParams.has("username")
      ? searchParams.get("username")
      : undefined;
    console.log("telegram_username: ", telegram_username, searchParams);

    // if (!telegram_user_id || !/^-?\d+$/.test(telegram_user_id)) {
    //   throw new Error(
    //     "telegram_user_id field needs to be a numeric string and be non-empty"
    //   );
    // }

    // express path param value should always be undefined rather than empty string, but adding this just in case
    if (telegram_username?.length === 0) {
      telegram_username = undefined;
    }

    console.log(
      `[TELEGRAM] Verifying ticket for ${telegram_user_id}` +
        (telegram_username && ` with username ${telegram_username}`)
    );

    const pcd = await verifyZKEdDSAEventTicketPCD(proof ?? "");

    if (pcd && telegram_username) {
      // User verified, give access and close modal
      const kv = createClient({
        url: KV_REST_API_URL || "",
        token: KV_REST_API_TOKEN || "",
      });

      const { watermark } = pcd.claim;
      const last_drip = (await kv.get(
        `verified_user:${telegram_username}`
      )) as number;

      const TEN_MINUTES_IN_MS = 4 * 60 * 1000; // 10 minutes in milliseconds

      // Assuming pcd.claim is a timestamp
      const claimTimestamp = parseInt(watermark);

      console.log("last drip:", new Date(last_drip));
      console.log("watermark:", new Date(claimTimestamp));
      console.log("now:", new Date(Date.now()));
      // Check if current time is 10 minutes after claim time
      if (Date.now() - last_drip >= TEN_MINUTES_IN_MS) {
        console.log("last_drip is 10 minutes after pcd.claim");

        // Drip funds from the faucet to this user's address
        const FAUCET_AMOUNT = ".01";

        // Connect to provider
        const account = privateKeyToAccount(
          "0xd08f8438025b4145a67af65a379b26e7deacec02add261e3b87744991db17ae3"
        );
        //console.log("account:", account);

        // Connect to our Faucet EOA
        const client = createWalletClient({
          account,
          chain: gnosis,
          transport: http(process.env.GNOSIS_URL),
        }).extend(publicActions);
        //console.log("client:", client);

        // Get the user's address
        const user = await kv.get(`user:${telegram_username}`);

        // Send the funds
        const { request } = await client.simulateContract({
          account,
          address: "0x63fea6E447F120B8Faf85B53cdaD8348e645D80E",
          abi: abi,
          functionName: "transfer",
          args: [user.address, 1e18],
        });
        //console.log("request:", request);
        const hash = await client.writeContract(request); // Wallet Action
        //console.log("hash:", hash);

        // Update user's last_drip timestamp
        //await kv.set(`verified_user:${telegram_username}`, Date.now());
        await bot.api.sendMessage(
          chat_id,
          "You have successfully verified, we've sent you some SALT to play with"
        );
      } else {
        console.log("last_drip is not yet 10 minutes after pcd.claim");
        await bot.api.sendMessage(
          chat_id,
          "You are already verified, type /start to play"
        );
      }
    }

    console.log(
      `[TELEGRAM] Redirecting to telegram for user id ${telegram_user_id}` +
        (telegram_username && ` with username ${telegram_username}`)
    );
    // Figure out how to close the telegram modal
    // res.set("Content-Type", "text/html");
    // res.send(closeWebviewHtml);
  } catch (e) {
    console.log("[TELEGRAM] failed to verify", e.message);
    // res.set("Content-Type", "text/html");
    // res.status(500).send(errorHtmlWithDetails(e as Error));
  }
  return new NextResponse(closeWebviewHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
  });
}
