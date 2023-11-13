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

// This function allows users to sell a Fruit token for salt
export default async function sell(
tokenName: string,
amount: number,
username: string
) {
// Connect to the user's wallet
const keys = await kv.get(`user:${username}`);
const account = privateKeyToAccount(keys.privateKey);

// Format fruit token's DEX name from input
const dexContractName: string = `BasicDex${tokenName}`;

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
let fruitContract;
try {
tokenContract = (contracts as any)[`${dexContractName}`];
fruitContract = (contracts as any)[`${tokenName}Token`];
//console.log("tokenContract:", tokenContract);
} catch (error) {
console.log("error:", error);
}

if (!tokenContract || !fruitContract) {
//throw new Error(`Token ${tokenName} not found in contracts`);
return `Token "${tokenName}" not found in contracts`;
}

// Format input amount
const fruit = parseEther(amount);

// Get price of fruit token in fruit
const price = await client.readContract({
address: tokenContract.address,
abi: tokenContract.abi,
functionName: "assetInPrice",
args: [parseEther("1")],
});
console.log("price:", price);

// Use `price` to calculate min value out
const salt =
(parseInt(parseEther(amount.toString())) \* parseInt(price)) / 1e18;
console.log("parsed price:", parseInt(price));
console.log("parsed ether:", parseEther(amount.toString()));
console.log("salt:", salt);

// Calculate minimum salt token amount to receive (temporarily hard-coded to 95% of original value which is 5% slippage)
const minOut = salt * 0.95;
console.log("minOut:", minOut);
// const minOutParsed = parseEther(minOut.toString());

/* Before we do anything, we need to ensure that the user has enough fruit tokens to sell the inputted amount */
const fruitBalance = await client.readContract({
address: fruitContract.address,
abi: fruitContract.abi,
functionName: "balanceOf",
args: [keys.address],
});
console.log("fruit balance:", fruitBalance);

// If you don't have enough fruit, return a message saying so
if (fruitBalance < fruit) {
console.log("Insuffcient fruit balance");
return "Insufficient fruit balance";
}

/**  Before swapping the tokens, we need to approve the DEX to take our fruit

- Check allowance for fruit dex, then approve the difference between fruit input and allowance value
- This way fruit is only approved if needed
  */

// View current allownance
const allowance = await client.readContract({
address: fruitContract.address,
abi: fruitContract.abi,
functionName: "allowance",
args: [keys.address, tokenContract.address],
});
console.log("allowance:", allowance);

// If you are trying to give the fruit contract more fruit than you currently have approved it to take
// we need to approve it to take the additional fruit
console.log("parse ether:", parseEther(amount));
if (parseEther(amount) > allowance) {
console.log(
`Approving ${tokenName} Dex for ${formatEther(fruit - allowance)} fruit`
);
const approveTx = await client.writeContract({
address: fruitContract.address,
abi: fruitContract.abi,
functionName: "approve",
args: [tokenContract.address, fruit - allowance],
});
console.log("approveTx:", approveTx);
}

// Simulate the transaction before actually sending it
try {
const { request } = await client.simulateContract({
account,
address: tokenContract.address,
abi: tokenContract.abi,
functionName: "assetToCredit",
args: [fruit, minOut], 
});

    const hash = await client.writeContract(request);
    // if tx went through view the receipt for amount of fruit token received
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
      // setReceipt(receipt);

      // const transaction = await client.getTransactionReceipt({
      //   hash: hash,
      // });
      // console.log("tx data:", transaction);
      return [
        `Successfully swapped ${amount} ${tokenName} for ${valueReceived} Salt`,
        `Transaction hash: ${hash}`,
      ];
    }
} catch (error) {
console.log("error:", error.message);
return error.message;
}
}
