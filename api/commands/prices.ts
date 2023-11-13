import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  http,
  publicActions,
  parseEther,
  formatEther,
} from "viem";
import { gnosis } from "viem/chains";
import { contracts } from "../contracts";

export default async function getPrices(tokenName: string) {
  try {
    // Initialize kv database
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const fruit = [Apple, Avocado, Banana, Lemon, Strawberry, Tomato];

    // Loop through the kv store to get the most recent fruit prices
    for (let i; i <= fruit.length; i++) {
      //const price = await kv.get(`user:${username}`);
      //console.log(`${fruit[i]} Price: ${price}`);
    }

    return `Price of 1 ${tokenName} is: ${formatEther(data)}`;
  } catch (e) {
    console.log("Error: ", (e as Error).message);
    return false;
  }
}
