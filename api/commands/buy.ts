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
const fs = require("fs");

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

  // Connect contract objects to variables
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
   *  3. ensure you have enough SALT to pay for it (balanceOf)
   *  4. ensure you have approved fruit DEX to take the tokens, if not then approve it
   *  5. swap tokens(salt amount, min fruit out) = (5 * .5, 5 * .9) <-- 90% slippage protection
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
  // 1e18 variable * 1e18 variable means you need to divide by 1e18 afterwards
  const salt =
    (parseInt(parseEther(amount.toString())) * parseInt(price)) / 1e18;
  console.log("salt in:", salt);

  // Calculate minimum fruit token amount to receive (currently hard-coded to 90% of original value)
  const minOut = amount * 0.9;
  console.log("minOut:", minOut);
  const minOutParsed = parseEther(minOut.toString());
  console.log("minOutParsed:", minOutParsed);

  /** Before we do anything, we need to ensure that the user has enough SALT to buy the fruit tokens */
  const saltBalance = await client.readContract({
    address: saltContract.address,
    abi: saltContract.abi,
    functionName: "balanceOf",
    args: [keys.address],
  });
  console.log("salt balance:", saltBalance);

  // If you don't have enough SALT, return a message saying so
  if (saltBalance < salt) {
    console.log("Insuffcient SALT balance");
    return "Insufficient SALT balance";
  }

  /** Right before swapping the tokens, we need to approve the DEX to take our SALT
   * Should first check allowance for desired fruit dex, then approve the difference between SALT to swap, and allowance value
   * This way SALT is only approved if needed
   */

  // View current allownance
  const allowance = await client.readContract({
    address: saltContract.address,
    abi: saltContract.abi,
    functionName: "allowance",
    args: [keys.address, tokenContract.address],
  });
  console.log("allowance:", allowance);

  // If you are trying to give the fruit contract more SALT than you currently have approved it to take
  // we need to approve it to take the additional SALT
  if (salt > allowance) {
    // Approve the FRUIT contract to `transferFrom()` your SALT
    const approveTx = await client.writeContract({
      address: saltContract.address,
      abi: saltContract.abi,
      functionName: "approve",
      args: [tokenContract.address, salt - parseInt(allowance)],
    });
    console.log("approveTx:", approveTx);
  }

  // Swap the SALT for the fruit tokens

  // Simulate the transaction before actually submitting it
  try {
    const { request } = await client.simulateContract({
      account,
      address: tokenContract.address,
      abi: tokenContract.abi,
      functionName: "creditToAsset",
      args: [salt, 0], // need to replace 0 with `minOutParsed` in prod
    });

    // trying to get output from swap function call
    fs.writeFileSync("result.log", JSON.stringify(result, null, 2));
    // console.log("request:", request);
    // return request;

    // Need to ensure
    // 1. the contract is approved to take our SALT
    // 2. we have enough xDAI to pay for the transaction
    // 3. the `minOut` variable is acceptable
    // 4. the `salt` value is non-zero
    // const data = await client.writeContract({
    //   address: tokenContract.address,
    //   abi: tokenContract.abi,
    //   functionName: "creditToAsset",
    //   args: [salt, 0], // temporarily set to 0,should use `minOutParsed`
    // });
    const hash = await client.writeContract(request);
    console.log("hash:", hash.toString());

    // const transaction = await client.getTransactionReceipt({
    //   hash: hash,
    // });
    // console.log("tx data:", transaction);
    if (hash) {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setReceipt(receipt);
      return `Successfully swapped ${salt} SALT for ${tokenName} `;
    }
    //   console.log("data2:", formatEther(data));
    //   return `Price of 1 ${tokenName} is: ${formatEther(data)}`;
    // Temporary return text for testing purposes
    return "Rohan Nero is the greatest";
  } catch (error) {
    console.log("error:", error.message);
    return error.message;
  }
}
