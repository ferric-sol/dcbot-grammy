import { abi } from "../../abi/xDAI";
import { dexAbi } from "../../abi/DEX";

import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, publicActions } from "viem";
import { gnosis } from "viem/chains";
import formatEtherTg from "../../utils/format";
import { Context, Bot } from "grammy";
import { createClient } from "@vercel/kv";

const token = process.env.TELEGRAM_API_KEY;
if (!token) throw new Error("TELEGRAM_API_KEY is unset");

const bot = new Bot(token);

const tokenAddresses = {
  Salt: "0x2A1367AC5F5391C02eca422aFECfCcEC1967371D",
  Apple: "0x48D1c60e807E340359ea1253Be4F2e60f9c65A36",
  Avocado: "0x243B401EE5EE4ABA8bF3b36352a48e664DA3Bca8",
  Banana: "0xFA814FC24256206fC25E927f8Af05cCD57C577d4",
  Lemon: "0x0D5854b5C10543c05c0bb4341d2bDFBa87F28E8f",
  Strawberry: "0xE8edFc3DaA1584f9586CD4472D29bfD0679DE9D5",
  Tomato: "0xEE6339d05625442d251AC367C9EcFC664C38A290",
};
const dexAddresses = {
  Apple: "0x806CE4AB074ba366aF52f8c306Bce8bCA6E78796",
  Avocado: "0xDF012d28B4B236CE9b7B2A941c25230f0D56511f",
  Banana: "0x8E45A0970d2dd7438A5fDCb7606aD3a0743C04d2",
  Lemon: "0xcAB5F99D0463E26a47614a84902C4497a8c77497",
  Strawberry: "0xeB4a99F4a8fEB883c7B7d0d6A6B6aFd834c83D33",
  Tomato: "0xf68FaCB8b9386b78842372A9d7d81Ff8CFE605Bb",
};

const account = privateKeyToAccount(`0x${process.env.FRUITBOT_FAUCET_KEY}`);

//   // Initialize the viem client (with faucet account ?)
const client = createWalletClient({
  account,
  chain: gnosis,
  transport: http(process.env.GNOSIS_URL),
}).extend(publicActions);

// Gets networth for address
const getNetworth = async (address: string) => {
  let totalBalance;
  for (let tokenName of Object.keys(tokenAddresses)) {
    //     // Call `balanceOf` on SALT contract
    let tokenAddress = tokenAddresses[tokenName];
    let dexAddress = dexAddresses[tokenName];

    const data = await client.readContract({
      address: tokenAddress,
      abi,
      functionName: "balanceOf",
      args: [address],
    });
    // Add balance for salt, for fruit convert to salt then add
    if (tokenName === "Salt" && parseInt(data) > 0) {
      totalBalance += parseInt(data);
    } else if (parseInt(data) > 0) {
      console.log("dex addr:", dexAddress);
      const convertedBalance = await client.readContract({
        address: dexAddress,
        dexAbi,
        functionName: "assetInPrice",
        args: [data],
      });
      totalBalance += parseInt(convertedBalance);
    }
    //console.log("data: ", formatEtherTg(data));
  }
  return totalBalance;
};

export default async function getLeaderboard(ctx: Context) {
  // Get the faucet EOA account
  if (!process.env.FRUITBOT_FAUCET_KEY) return false;

  // Initialize kv database
  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  console.log("chat:", await bot.api.getChat(ctx.chat.id));
  const chat = await bot.api.getChat(ctx.chat.id);
  const users = chat.active_usernames;
  const userData = [
    {
      username: "",
      address: "",
      networth: "",
    },
  ];
  console.log("usernames:", users);
  for (let user of users) {
    console.log(user);
    const keys = await kv.get(`user:${user}`);
    console.log("keys: ", keys);
    if (keys.privateKey) {
      const totalWorth = await getNetworth(keys.address);
      userData.push({
        username: user,
        address: keys.address,
        networth: totalWorth,
      });
    }
  }
  console.log("users data:", userData);

  //   if (formatEtherTg(data) !== "0.0000")
  //     balances[tokenName] = formatEtherTg(data);

  //   const balances = [];
  //   for (let tokenName of Object.keys(tokenAddresses)) {
  //     // Call `balanceOf` on SALT contract
  //     let tokenAddress = tokenAddresses[tokenName];
  //     console.log(address);
  //     console.log(tokenAddress);
  //     const data = await client.readContract({
  //       address: tokenAddress,
  //       abi,
  //       functionName: "balanceOf",
  //       args: [address],
  //     });
  //     if (tokenName === "Salt") tokenName = "Credit";
  //     //console.log("data: ", formatEtherTg(data));
  //     if (formatEtherTg(data) !== "0.0000")
  //       balances[tokenName] = formatEtherTg(data);
  //   }

  //   return balances;
  return "test return";
}
