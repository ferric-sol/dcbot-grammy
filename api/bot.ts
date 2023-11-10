import { Bot, webhookCallback } from "grammy";
import { createClient } from "@vercel/kv";
import { createPublicClient, http, isAddress, formatEther } from "viem";
import { gnosis } from "viem/chains";
import { normalize } from "viem/ens";
import { privateKeyToAccount } from "viem/accounts";
import { generatePrivateKey } from "viem/accounts";
import { constructZupassPcdGetRequestUrl } from "@pcd/passport-interface";
import {
  EdDSATicketFieldsToReveal,
  ZKEdDSAEventTicketPCDArgs,
  ZKEdDSAEventTicketPCDPackage,
} from "@pcd/zk-eddsa-event-ticket-pcd";
import { EdDSATicketPCDPackage } from "@pcd/eddsa-ticket-pcd";
import { Menu, MenuRange } from "@grammyjs/menu";
import { ArgumentTypeName } from "@pcd/pcd-types";
import { SemaphoreIdentityPCDPackage } from "@pcd/semaphore-identity-pcd";
import getBalance from "./commands/balance";
import getPrice from "./commands/price";
import zupass from "./commands/zupass";
import buy from "./commands/buy";

const token = process.env.TELEGRAM_API_KEY;
if (!token) throw new Error("BOT_TOKEN is unset");

const bot = new Bot(token);
export default webhookCallback(bot, "http");

interface KeyPair {
  address: string;
  privateKey: string;
}

const { KV_REST_API_URL, KV_REST_API_TOKEN, GNOSIS_URL, TELEGRAM_API_KEY } =
  process.env;

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

const transport = http(GNOSIS_URL);

// Connect client to gnosis chain
const client = createPublicClient({
  chain: gnosis,
  transport,
});

// Initialize kv database
const kv = createClient({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
});

// returns keypair for inputted username
const getKeyPair = async (username: string): Promise<KeyPair | null> => {
  return await kv.get(`user:${username}`);
};

// Initialize zupass menu
const menu = new Menu("zupass");

// Define EdDSA fields that will be exposed
const fieldsToReveal: EdDSATicketFieldsToReveal = {
  revealTicketId: false,
  revealEventId: false,
  revealProductId: false,
  revealTimestampConsumed: false,
  revealTimestampSigned: false,
  revealAttendeeSemaphoreId: true,
  revealIsConsumed: false,
  revealIsRevoked: false,
};

// Define ZK edDSA PCD arguments
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
      notFoundMessage: "You don't have a ticket to this event.",
    },
    hideIcon: true,
  },
  identity: {
    argumentType: ArgumentTypeName.PCD,
    pcdType: SemaphoreIdentityPCDPackage.name,
    value: undefined,
    userProvided: true,
  },
  fieldsToReveal: {
    argumentType: ArgumentTypeName.ToggleList,
    value: fieldsToReveal,
    userProvided: false,
    hideIcon: true,
  },
  externalNullifier: {
    argumentType: ArgumentTypeName.BigInt,
    value: undefined,
    userProvided: false,
  },
  validEventIds: {
    argumentType: ArgumentTypeName.StringArray,
    value: ["b03bca82-2d63-11ee-9929-0e084c48e15f"],
    userProvided: false,
  },
  watermark: {
    argumentType: ArgumentTypeName.BigInt,
    value: Date.now().toString(),
    userProvided: false,
    description: `This encodes the current timestamp so that the proof can grant funds via faucet when appropriate.`,
  },
};

// Set menu variables
menu.dynamic(async (ctx) => {
  const range = new MenuRange();
  // const appUrl = `${process.env.VERCEL_URL}`;
  const appUrl = "https://zupass.org";
  const returnHost =
    process.env.NODE_ENV == "development"
      ? `https://06c4-2603-8080-d9f0-79b0-298c-f4a7-f8f-6412.ngrok.io`
      : `https://${process.env.VERCEL_URL}`;
  const returnUrl = `${returnHost}/api/zucheck/?username=${ctx.from?.username}&telegram_chat_id=${ctx.chat?.id}`;
  console.log("returnUrl: ", returnUrl);
  let proofUrl = await constructZupassPcdGetRequestUrl(
    appUrl,
    returnUrl,
    ZKEdDSAEventTicketPCDPackage.name,
    args,
    {
      genericProveScreen: true,
      title: "",
      description:
        "Fruitbot requests a zero-knowledge proof of your ticket to trade fruit",
    }
  );
  console.log("zupass url: ", proofUrl);
  range.webApp("Validate proof", proofUrl);
  return range;
});

// Zupass command with ZK proof
// Commented out code was moved to `./commands/zupass.ts`
bot.use(menu);
bot.command("zupass", async (ctx) => {
  // console.log("in zupass");
  // console.log("menu: ", menu);
  // // Send the menu.
  // if (ctx.from?.id) {
  //   ctx.reply("Validate your proof and then use the menu to play:", {
  //     reply_markup: menu,
  //   });
  //   // TODO: Figure out why this doesn't work
  //   // await bot.api.sendMessage(
  //   //   ctx.chat?.id,
  //   //   "Validate your proof and then use the menu to play:",
  //   //   { reply_markup: menu }
  //   // );
  // }
  await zupass();
});

// Command to start the bot
bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

// Returns the price of a fruit token
bot.command("price", async (ctx) => {
  const tokenName = ctx.message?.text
    .replace("/price", "")
    .replace("@DCFruitBot", "")
    .trim();
  const price = tokenName ? await getPrice(tokenName) : null;
  if (price) {
    ctx.reply(price);
  } else {
    ctx.reply(`Price not found for ${tokenName}`);
  }
});

// Buy x amount of any fruit token
bot.command("buy", async (ctx) => {
  const input = ctx.message?.text
    .replace("/buy", "")
    .replace("@DCFruitBot", "")
    .trim();
  const inputSplit = input.split(" ");
  console.log("input:", input);
  console.log("inputSplit:", inputSplit);
  const buyData = input ? await buy(inputSplit[1], inputSplit[0]) : null;
  if (buyData) {
    ctx.reply(buyData);
  } else {
    ctx.reply(`Price not found for ${inputSplit[1]}`);
  }
});

// Returns the user's balance in SALT
bot.command("balance", async (ctx) => {
  const ethAddressOrEns = ctx.message?.text
    .replace("/balance", "")
    .replace("@DCFruitBot", "")
    .trim();
  const keyPair = ctx.from?.username
    ? await getKeyPair(ctx.from?.username?.toString())
    : null;
  if (keyPair?.address) {
    console.log("addr:", keyPair?.address);
    const message = await getBalance(keyPair?.address);

    ctx.reply(message);
  }
});

// Generates the user a keypair
// Public address is sent to user directly
// Private key is stored in kv store db
bot.command("generate", async (ctx) => {
  console.log("from:", ctx.from);
  const username = ctx.from?.username?.toString();
  if (!username) {
    ctx.reply("No username");
    return;
  }

  let keyPair = await getKeyPair(username);
  if (!keyPair) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    keyPair = {
      address: account.address,
      privateKey: privateKey,
    };

    try {
      await kv.set(`user:${username}`, JSON.stringify(keyPair));
    } catch (error) {
      console.error("Error storing the key pair:", error);
    }
  }
  try {
    const message = `✅ Key pair generated successfully:\n- Address: ${keyPair.address}`;
    ctx.reply(message);
  } catch (error) {
    console.error("Error sending message:", error);
  }
});
