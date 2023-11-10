import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, publicActions, parseEther, formatEther } from "viem";
import { gnosis } from "viem/chains";
import { contracts } from "../contracts"

export default async function getPrice(tokenName: string) {
  // Get the faucet EOA account
  if(!process.env.FRUITBOT_FAUCET_KEY) return false;

  const account = privateKeyToAccount(
    `0x${process.env.FRUITBOT_FAUCET_KEY}`
  );
  const dexContractName: string = `BasicDex${tokenName}`;

  // Initialize the viem client
  const client = createWalletClient({
    account,
    chain: gnosis,
    transport: http(process.env.GNOSIS_URL),
  }).extend(publicActions);

  const tokenContract = (contracts as any)[`${dexContractName}`];

  if (!tokenContract) {
    throw new Error(`Token ${tokenName} not found in contracts`);
  }
  
  const data = await client.readContract({
    address: tokenContract.address,
    abi: tokenContract.abi,
    functionName: "creditInPrice",
    args: [parseEther("1")]
  });

  console.log("data:", data.toString());
  console.log("data2:", formatEther(data));
  return `Price of 1 ${tokenName} is: ${formatEther(data)}`;
}
