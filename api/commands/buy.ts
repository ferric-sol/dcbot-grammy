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

// This function allows users to buy a Fruit token using SALT
// 1. view token price in terms of SALT
// 2. swap SALT for fruit token using price to calculate min value out
export default async function buy(tokenName: string, amount: number) {
  console.log("buy script input:");
  console.log("tokenName:", tokenName);
  console.log("amount:", amount);
  // Get the faucet EOA account
  if (!process.env.FRUITBOT_FAUCET_KEY) return false;

  const account = privateKeyToAccount(`0x${process.env.FRUITBOT_FAUCET_KEY}`);
  const dexContractName: string = `BasicDex${tokenName}`;
  console.log("dexContractName:", dexContractName);

  // Initialize the viem client
  const client = createWalletClient({
    account,
    chain: gnosis,
    transport: http(process.env.GNOSIS_URL),
  }).extend(publicActions);

  // TODO: TSify this using types from
  // https://github.com/BuidlGuidl/event-wallet/blob/08790b0d8f070b22625b1fadcd312988a70be825/packages/nextjs/utils/scaffold-eth/contract.ts#L7
  const tokenContract = (contracts as any)[`${dexContractName}`];

  if (!tokenContract) {
    throw new Error(`Token ${tokenName} not found in contracts`);
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
  const minOutParsed = parseEther(minOut);
  console.log("minOutParsed:", minOutParsed);

  // Swap the SALT for the fruit tokens
  //   const data = await client.writeContract({
  //     address: tokenContract.address,
  //     abi: tokenContract.abi,
  //     functionName: "creditToAsset",
  //     args: [salt, parseEther(minOut.toString())],
  //   });

  //   console.log("data:", data.toString());
  //   console.log("data2:", formatEther(data));
  //   return `Price of 1 ${tokenName} is: ${formatEther(data)}`;
  return "Rohan Nero is the greatest";
}
