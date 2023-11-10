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

// This 
export default async function sell(tokenName: string) {
  // Get the faucet EOA account
  if (!process.env.FRUITBOT_FAUCET_KEY) return false;

  const account = privateKeyToAccount(`0x${process.env.FRUITBOT_FAUCET_KEY}`);
  const dexContractName: string = `BasicDex${tokenName}`;

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

  //   const data = await client.readContract({
  //     address: tokenContract.address,
  //     abi: tokenContract.abi,
  //     functionName: "creditInPrice",
  //     args: [parseEther("1")],
  //   });
  const data = await client.writeContract({
    address: tokenContract.address,
    abi: tokenContract.abi,
    functionName: "creditInPrice",
    args: [parseEther("1")],
  });

  console.log("data:", data.toString());
  console.log("data2:", formatEther(data));
  return `Price of 1 ${tokenName} is: ${formatEther(data)}`;
}