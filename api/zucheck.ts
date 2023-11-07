import { NextResponse } from 'next/server';
import {
  ZKEdDSAEventTicketPCD,
  ZKEdDSAEventTicketPCDPackage
} from "@pcd/zk-eddsa-event-ticket-pcd";
import { getEdDSAPublicKey } from "@pcd/eddsa-pcd";
import { createClient } from '@vercel/kv';

const { KV_REST_API_URL, KV_REST_API_TOKEN, GNOSIS_URL, TELEGRAM_API_KEY } = process.env;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !GNOSIS_URL || !TELEGRAM_API_KEY) {
  throw new Error('Environment variables KV_REST_API_URL and KV_REST_API_TOKEN and ALCHEMY_URL and TELEGRAM_API_KEY must be defined');
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
        You are now ready to play!
        <a href="javascript:onclick=Telegram.WebApp.close();">click here to close this window</a>
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

  const zupassPubkeyReq = await fetch('https://api.zupass.org/issue/eddsa-public-key');
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

};
 
export async function GET(request: Request, res: Response) {
  const { searchParams } = new URL(request.url);
  try {
    const proof = searchParams.has('proof') ? searchParams.get('proof') : null;
    const telegram_user_id = searchParams.has('id') ? searchParams.get('id') : null;
    let telegram_username = searchParams.has('username') ? searchParams.get('username') : undefined;
    console.log('telegram_user_id: ', telegram_user_id, searchParams);

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

    const pcd = await verifyZKEdDSAEventTicketPCD(proof ?? '');

    if(pcd) {
      // User verified, give access and close modal
      const kv = createClient({
        url: KV_REST_API_URL || '',
        token: KV_REST_API_TOKEN || '',
      });

      await kv.set(`verified_user:${telegram_username}`, 'true');
    }

    console.log(
      `[TELEGRAM] Redirecting to telegram for user id ${telegram_user_id}` +
        (telegram_username && ` with username ${telegram_username}`)
    );
    // Figure out how to close the telegram modal
    // res.set("Content-Type", "text/html");
    // res.send(closeWebviewHtml);
  } catch (e) {
    console.log("[TELEGRAM] failed to verify", e);
    // res.set("Content-Type", "text/html");
    // res.status(500).send(errorHtmlWithDetails(e as Error));
  }
  return new NextResponse(closeWebviewHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html'
    },
  });
}
