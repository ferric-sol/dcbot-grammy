import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  http,
  publicActions,
  parseEther,
  formatEther,
  decodeEventLog,
} from "viem";
import { gnosis } from "viem/chains";
import { contracts } from "../contracts";
import { createClient } from "@vercel/kv";
import gnosisLink from "../gnosis";

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
  // Connect to the user's wallet
  const keys = await kv.get(`user:${username}`);

  const account = privateKeyToAccount(keys.privateKey);
  const dexContractName: string = `BasicDex${tokenName}`;
  console.log("dexContractName:", dexContractName);

  // Initialize the viem client using the user's private key in kv db
  const client = createWalletClient({
    account,
    chain: gnosis,
    transport: gnosisLink(),
    // transport: http(process.env.GNOSIS_URL),
  }).extend(publicActions);

  // Connect contract objects to variables
  // TODO: TSify this using types from
  // https://github.com/BuidlGuidl/event-wallet/blob/08790b0d8f070b22625b1fadcd312988a70be825/packages/nextjs/utils/scaffold-eth/contract.ts#L7
  let tokenContract;
  let saltContract;
  try {
    tokenContract = (contracts as any)[`${dexContractName}`];
    saltContract = (contracts as any)["SaltToken"];
  } catch (error) {
    console.log("error:", error);
  }

  if (!tokenContract) {
    //throw new Error(`Token ${tokenName} not found in contracts`);
    return `Token "${tokenName}" not found in contracts`;
  }

  // Get price of fruit token
  const price = await client.readContract({
    address: tokenContract.address,
    abi: tokenContract.abi,
    functionName: "assetInPrice",
    args: [parseEther("1")],
  });
  console.log("price:", price);

  // Use `price` to calculate min value out
  // 1e18 variable * 1e18 variable means you need to divide by 1e18 afterwards

  const salt =
    (parseInt(parseEther(amount.toString())) * parseInt(price)) / 1e18;
  console.log("parsed price:", parseInt(price));
  console.log("parsed ether:", parseEther(amount.toString()));
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
    console.log("Insuffcient credit balance");
    return "Insufficient credit balance";
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
    console.log(
      `Approving ${tokenName} Dex for ${
        (tokenContract.address, salt - parseInt(allowance))
      } SALT`
    );
    const approveTx = await client.writeContract({
      address: saltContract.address,
      abi: saltContract.abi,
      functionName: "approve",
      args: [tokenContract.address, salt - parseInt(allowance)],
    });
    console.log("approveTx:", approveTx);
  }

  try {
    // Simulate the transaction before actually sending it
    const { request } = await client.simulateContract({
      account,
      address: tokenContract.address,
      abi: tokenContract.abi,
      functionName: "creditToAsset",
      args: [salt, minOutParsed],
    });

    // Send the transaction
    const hash = await client.writeContract(request);
    // if the tx went through view the receipt for amount of fruit token received
    if (hash) {
      const transaction = await client.waitForTransactionReceipt({ hash });
      console.log("hash:", hash.toString());
      console.log(
        "transaction:",
        JSON.stringify(transaction, (_, v) =>
          typeof v === "bigint" ? v.toString() : v
        )
      );
      console.log(
        "value purchased: ",
        decodeEventLog({
          abi: tokenContract.abi,
          data: transaction.logs[transaction.logs.length - 1].data,
          topics: transaction.logs[transaction.logs.length - 1].topics,
        })
      );
      const valueReceivedLog = decodeEventLog({
        abi: tokenContract.abi,
        data: transaction.logs[transaction.logs.length - 1].data,
        topics: transaction.logs[transaction.logs.length - 1].topics,
      });
      const valueReceived = formatEther(valueReceivedLog.args._tokensReceived);

      return [
        `Successfully swapped ${formatEther(
          salt
        )} SALT for ${valueReceived} ${tokenName} `,
        `Transaction hash: ${hash}`,
      ];
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
