import { abi } from "../../abi/xDAI";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, publicActions, formatEther } from "viem";
import { gnosis } from "viem/chains";

export default async function getBalance(address: string) {
  // Get the faucet EOA account
  if(!process.env.FRUITBOT_FAUCET_KEY) return false;

  const account = privateKeyToAccount(
    `0x${process.env.FRUITBOT_FAUCET_KEY}`
  );

  // Initialize the viem client
  const client = createWalletClient({
    account,
    chain: gnosis,
    transport: http(process.env.GNOSIS_URL),
  }).extend(publicActions);

  // Call `balanceOf` on SALT contract
  const data = await client.readContract({
    address: "0x2A1367AC5F5391C02eca422aFECfCcEC1967371D",
    abi,
    functionName: "balanceOf",
    args: [address],
  });
  console.log("data:", data.toString());
  console.log("data2:", data);
  return `Your SALT balance is: ${formatEther(data)}`;
}
