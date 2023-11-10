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
import { createClient } from "@vercel/kv";

// Before the function can be executed, we need to connect to the user's wallet

// Initialize kv database
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// This function allows users to buy a Fruit token using SALT
// 1. view token price in terms of SALT
// 2. swap SALT for fruit token using price to calculate min value out
export default async function buy(
  tokenName: string,
  amount: number,
  username: string
) {
  console.log("buy script input:");
  console.log("tokenName:", tokenName);
  console.log("amount:", amount);
  console.log("username:", username);

  // Connect to the user's wallet
  const keys = await kv.get(`user:${username}`);
  console.log("keys:", keys);
  console.log("priv key:", keys.privateKey);

  const account = privateKeyToAccount(keys.privateKey);
  console.log("account:", account);
  const dexContractName: string = `BasicDex${tokenName}`;
  console.log("dexContractName:", dexContractName);

  // Initialize the viem client using the user's private key in kv db
  const client = createWalletClient({
    account,
    chain: gnosis,
    transport: http(process.env.GNOSIS_URL),
  }).extend(publicActions);

  // TODO: TSify this using types from
  // https://github.com/BuidlGuidl/event-wallet/blob/08790b0d8f070b22625b1fadcd312988a70be825/packages/nextjs/utils/scaffold-eth/contract.ts#L7
  let tokenContract;
  let saltContract;
  try {
    tokenContract = (contracts as any)[`${dexContractName}`];
    saltContract = (contracts as any)["SaltToken"];
    //console.log("tokenContract:", tokenContract);
  } catch (error) {
    console.log("error:", error);
  }

  if (!tokenContract) {
    //throw new Error(`Token ${tokenName} not found in contracts`);
    return `Token "${tokenName}" not found in contracts`;
  }

  /** Example Flow
   *  1. /buy 5 = You want 5 FRUIT for x SALT
   *  2. get price = .5 (1 SALT = 2 FRUIT)
   *  3. swap tokens(salt amount, min fruit out) = (5 * .5, 5 * .9) <-- 90% slippage protection
   */

  // Get price of fruit token
  const price = await client.readContract({
    address: tokenContract.address,
    abi: tokenContract.abi,
    functionName: "creditInPrice",
    args: [parseEther("1")],
  });
  console.log("price:", price);

  // Use `price` to calculate min value out
  const salt = parseInt(amount) * parseInt(price);
  console.log("salt in:", salt);

  // Calculate minimum fruit token amount to receive (currently hard-coded to 90% of original value)
  const minOut = amount * 0.9;
  console.log("minOut:", minOut);
  const minOutParsed = parseEther(minOut.toString());
  console.log("minOutParsed:", minOutParsed);

  // Right before swapping the tokens, we need to approve the DEX to take our SALT
  const approveTx = await client.writeContract({
    address: SaltToken.address,
    abi: SaltToken.abi,
    functionName: "approve",
    args: [tokenContract.address, salt],
  });
  console.log("approveTx:", approveTx);

  
  // Swap the SALT for the fruit tokens
  // 0xa2212c6d <-- error code we are getting
  const data = await client.writeContract({
    address: tokenContract.address,
    abi: tokenContract.abi,
    functionName: "creditToAsset",
    args: [salt, 0],
  });

  //console.log("data:", data.toString());
  //   console.log("data2:", formatEther(data));
  //   return `Price of 1 ${tokenName} is: ${formatEther(data)}`;
  return "Rohan Nero is the greatest";
}
