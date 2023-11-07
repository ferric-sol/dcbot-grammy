import { Bot, webhookCallback } from "grammy";
import { createClient } from '@vercel/kv';
import { createPublicClient, http, isAddress, formatEther } from 'viem'
import { gnosis } from 'viem/chains'
import { normalize } from 'viem/ens'
import { privateKeyToAccount } from 'viem/accounts'
import { generatePrivateKey } from 'viem/accounts'
import {
  constructZupassPcdGetRequestUrl,
} from "@pcd/passport-interface";
import {
  EdDSATicketFieldsToReveal,
  ZKEdDSAEventTicketPCDArgs,
  ZKEdDSAEventTicketPCDPackage
} from "@pcd/zk-eddsa-event-ticket-pcd";
import { EdDSATicketPCDPackage } from "@pcd/eddsa-ticket-pcd";
import { Menu, MenuRange } from "@grammyjs/menu";
import { ArgumentTypeName } from "@pcd/pcd-types";
import { SemaphoreIdentityPCDPackage } from "@pcd/semaphore-identity-pcd";

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

const menu = new Menu("zupass");

const fieldsToReveal: EdDSATicketFieldsToReveal = {
  revealTicketId: false,
  revealEventId: false,
  revealProductId: false,
  revealTimestampConsumed: false,
  revealTimestampSigned: false,
  revealAttendeeSemaphoreId: true,
  revealIsConsumed: false,
  revealIsRevoked: false
};

const args: ZKEdDSAEventTicketPCDArgs = {
  ticket: {
    argumentType: ArgumentTypeName.PCD,
    pcdType: EdDSATicketPCDPackage.name,
    value: undefined,
    userProvided: true,
    displayName: "Your Ticket",
    description: "",
    validatorParams: {
      eventIds: [],
      productIds: [],
      // TODO: surface which event ticket we are looking for
      notFoundMessage: "You don't have a ticket to this event."
    },
    hideIcon: true
  },
  identity: {
    argumentType: ArgumentTypeName.PCD,
    pcdType: SemaphoreIdentityPCDPackage.name,
    value: undefined,
    userProvided: true
  },
  fieldsToReveal: {
    argumentType: ArgumentTypeName.ToggleList,
    value: fieldsToReveal,
    userProvided: false,
    hideIcon: true
  },
  externalNullifier: {
    argumentType: ArgumentTypeName.BigInt,
    value: undefined,
    userProvided: false
  },
  validEventIds: {
    argumentType: ArgumentTypeName.StringArray,
    value: ['b03bca82-2d63-11ee-9929-0e084c48e15f'],
    userProvided: false
  },
  watermark: {
    argumentType: ArgumentTypeName.BigInt,
    value: Date.now().toString(),
    userProvided: false,
    description: `This encodes the current timestamp so that the proof can grant funds via faucet when appropriate.`
  }
};

menu.dynamic(async (ctx) => {
  const range = new MenuRange();
  // const appUrl = `${process.env.VERCEL_URL}`;
  const appUrl = 'https://zupass.org'
  const returnHost = process.env.NODE_ENV == 'development' ? `https://06c4-2603-8080-d9f0-79b0-298c-f4a7-f8f-6412.ngrok.io`: `https://${process.env.VERCEL_URL}`;
  const returnUrl = `${returnHost}/api/zucheck/?username=${ctx.from?.username}&telegram_chat_id=${ctx.chat?.id}`;
  console.log('returnUrl: ', returnUrl);
  let proofUrl = await constructZupassPcdGetRequestUrl(appUrl, returnUrl, ZKEdDSAEventTicketPCDPackage.name, args, {
    genericProveScreen: true,
    title: "",
    description:
      "Fruitbot requests a zero-knowledge proof of your ticket to trade fruit"
  });
  console.log('zupass url: ', proofUrl);
  range.webApp('Validate proof', proofUrl);
  return range;
})



bot.use(menu);
bot.command("zupass", async (ctx) => {
  console.log('in zupass');
  console.log('menu: ', menu);
  // Send the menu.
  await ctx.reply("Validate your proof and then use the menu to play:", { reply_markup: menu });
});

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
bot.command("balance", async (ctx) =>  {
  const ethAddressOrEns = ctx.message?.text.replace('/balance', '').replace('@DCFruitBot', '').trim();
  const keyPair = ctx.from?.username ? await getKeyPair(ctx.from?.username?.toString()) : null;
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
  const ethAddress = ctx.message?.text.replace('/balanceaddr', '').replace('@DCFruitBot', '').trim();
  const keyPair = ctx.from?.username ? await getKeyPair(ctx.from?.username?.toString()) : null;
  if (ethAddress) {
    ctx.reply(await returnBalance(ethAddress));
  } else if (keyPair?.address) {
    ctx.reply(await returnBalance(keyPair?.address));
  }
});

bot.command("generate", async (ctx) =>  {
  console.log('from:', ctx.from)
  const username =  ctx.from?.username?.toString();
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