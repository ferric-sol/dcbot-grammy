import { Bot, webhookCallback } from "grammy";
import { createClient } from "@vercel/kv";
import { createPublicClient, http, isAddress, formatEther } from "viem";
import { gnosis } from "viem/chains";
import { normalize } from "viem/ens";
import { privateKeyToAccount } from "viem/accounts";
import { generatePrivateKey } from "viem/accounts";
import getBalance from "./commands/balance";
import getPrice from "./commands/price";
// import zupass from "./commands/zupass";
import buy from "./commands/buy";
import sell from "./commands/sell";
import { zupass_menu, handle_zuconnect } from "./commands/start";

const token = process.env.TELEGRAM_API_KEY;
if (!token) throw new Error("BOT_TOKEN is unset");

const bot = new Bot(token);
const timeoutMilliseconds = 60_000;
export default webhookCallback(bot, "http", "throw", timeoutMilliseconds);

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
  console.log(`key: user:${username}`);
  const keyPair = await kv.get(`user:${username}`);
  console.log(`keyPair: ${JSON.stringify(keyPair)}`);
  return keyPair as KeyPair;
};

const menu = zupass_menu();
bot.use(menu);
// Command to start the bot
bot.command("start", async (ctx) => {
  handle_zuconnect(ctx, bot, menu);
});
// Zupass command with ZK proof
// Commented out code was moved to `./commands/zupass.ts`

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

// Returns the prices of all fruit tokens
// bot.command("prices", async (ctx) => {
//   const tokenName = ctx.message?.text
//     .replace("/prices", "")
//     .replace("@DCFruitBot", "")
//     .trim();
//   const price = tokenName ? await getPrices(tokenName) : null;
//   if (price) {
//     ctx.reply(price);
//   } else {
//     ctx.reply(`Price not found for ${tokenName}`);
//   }
// });
bot.command("prices", async (ctx) => {
  const tokenName = ctx.message?.text
    .replace("/prices", "")
    .replace("@DCFruitBot", "")
    .trim();
  const fruit = ["Apple", "Avocado", "Banana", "Lemon", "Strawberry", "Tomato"];
  let priceArray = [];
  for (let i = 0; i < fruit.length; i++) {
    console.log("element:", fruit[i]);
    const price = fruit ? await getPrice(fruit[i]) : null;
    priceArray.push(price);
  }
  if (priceArray.length > 0) {
    // ctx.reply(priceArray);
    await ctx.reply(priceArray[0]);
    await ctx.reply(priceArray[1]);
    await ctx.reply(priceArray[2]);
    await ctx.reply(priceArray[3]);
    await ctx.reply(priceArray[4]);
    await ctx.reply(priceArray[5]);
  } else {
    ctx.reply(`Price not found for ${tokenName}`);
  }
});

// Buy x amount of any fruit token
bot.command("buy", async (ctx) => {
  // Parse and pass username
  const username = ctx.from?.username?.toString();
  if (!username) {
    ctx.reply("No username");
    return;
  }

  // Parse and pass input
  const input = ctx.message?.text
    .replace("/buy", "")
    .replace("@DCFruitBot", "")
    .trim();
  const inputSplit = input.split(" ");
  console.log("input:", input);
  console.log("inputSplit:", inputSplit);
  const buyData = input
    ? await buy(inputSplit[1], inputSplit[0], username)
    : null;
  if (buyData) {
    //ctx.reply(buyData);
    await ctx.reply(buyData[0]);
    await ctx.reply(buyData[1]);
  } else {
    ctx.reply(`Price not found for ${inputSplit[1]}`);
  }
});

// sell x amount of any fruit token
bot.command("sell", async (ctx) => {
  // Parse and pass username
  const username = ctx.from?.username?.toString();
  if (!username) {
    ctx.reply("No username");
    return;
  }
  // Parse and pass input
  const input = ctx.message?.text
    .replace("/sell", "")
    .replace("@DCFruitBot", "")
    .trim();
  const inputSplit = input.split(" ");
  console.log("input:", input);
  console.log("inputSplit:", inputSplit);
  const sellData = input
    ? await sell(inputSplit[1], inputSplit[0], username)
    : null;
  if (sellData) {
    if (sellData.length == 2) {
      await ctx.reply(sellData[0]);
      await ctx.reply(sellData[1]);
    } else {
      ctx.reply(sellData);
    }
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
