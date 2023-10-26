import { Bot, webhookCallback } from "grammy";
import { createClient } from '@vercel/kv';
import { createPublicClient, http, isAddress, formatEther } from 'viem'
import { gnosis } from 'viem/chains'
import { normalize } from 'viem/ens'
import { privateKeyToAccount } from 'viem/accounts'
import { generatePrivateKey } from 'viem/accounts'
import {
  constructZupassPcdGetRequestUrl,
} from "@pcd/passport-interface/src/PassportInterface";
import {
  ZKEdDSAEventTicketPCDArgs,
  ZKEdDSAEventTicketPCDPackage
} from "@pcd/zk-eddsa-event-ticket-pcd";

const token = process.env.TELEGRAM_API_KEY
if (!token) throw new Error("BOT_TOKEN is unset");

const bot = new Bot(token);
export default webhookCallback(bot, "http");

interface KeyPair {
  address: string;
  privateKey: string;
}

const { KV_REST_API_URL, KV_REST_API_TOKEN, GNOSIS_URL, TELEGRAM_API_KEY } = process.env;

if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !GNOSIS_URL || !TELEGRAM_API_KEY) {
  throw new Error('Environment variables KV_REST_API_URL and KV_REST_API_TOKEN and ALCHEMY_URL and TELEGRAM_API_KEY must be defined');
}

const transport = http(GNOSIS_URL);

const client = createPublicClient({
  chain: gnosis,
  transport,
})

const kv = createClient({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
});

const getKeyPair = async (username: string): Promise<KeyPair | null> => {
  return await kv.get(`user:${username}`);
}

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
bot.command("balance", async (ctx) =>  {
  const ethAddressOrEns = ctx.message?.text.replace('/balance', '').trim();
  const keyPair = ctx.from ? await getKeyPair(ctx.from.toString()) : null;
  if (ethAddressOrEns && ethAddressOrEns?.length > 0) {
    const ensAddress = await client.getEnsAddress({ name: normalize(ethAddressOrEns) });
    if (ensAddress !== null) {
      ctx.reply(await returnBalance(ensAddress));
    } else {
      const message = 'Error fetching balance';
      ctx.reply(message);
    }
  } else if (keyPair?.address) {
      const message = await returnBalance(keyPair?.address);
      ctx.reply(message);
  }
});

bot.command("balanceaddr", async (ctx) =>  {
  const ethAddress = ctx.message?.text.replace('/balanceaddr', '').trim();
  const keyPair = ctx.from ? await getKeyPair(ctx.from.toString()) : null;
  if (ethAddress) {
    ctx.reply(await returnBalance(ethAddress));
  } else if (keyPair?.address) {
    ctx.reply(await returnBalance(keyPair?.address));
  }
});

bot.command("generate", async (ctx) =>  {
  console.log('from:', ctx.from)
  const username =  ctx.from?.toString();
  if(!username) {
    ctx.reply('No username');
    return;
  }

  let keyPair = await getKeyPair(username);
  if(!keyPair) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    keyPair = {
      address: account.address,
      privateKey: privateKey,
    };

    try {
      await kv.set(`user:${username}`, JSON.stringify(keyPair));
    } catch (error) {
      console.error('Error storing the key pair:', error);
    }
  }
  try {
    const message = `✅ Key pair generated successfully:\n- Address: ${keyPair.address}`;
    ctx.reply(message);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}
);

async function returnBalance(ethAddress: string) {
  if (!ethAddress || !isAddress(ethAddress)) {
    const message = 'Address not understood';
    return message;
  }

  try {
    const balanceWei = await client.getBalance({address: ethAddress});
    const balanceEth = formatEther(balanceWei);
    
    const balanceWeiNumber = Number(balanceWei);
    const message = `✅ The balance for address: *"${ethAddress}"* is ${balanceEth} xDAI\nHave a great day! 👋🏻`;
    return message;
  } catch (error) {
    console.error(error);
    const message = 'Error fetching balance';
    return message;
  }
}