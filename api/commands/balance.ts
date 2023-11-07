import { abi } from "../../abi/xDAI";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, publicActions } from "viem";
import { gnosis } from "viem/chains";

export default async function getBalance(address: string) {
  // Get the faucet EOA account
  const account = privateKeyToAccount(
    "0xd08f8438025b4145a67af65a379b26e7deacec02add261e3b87744991db17ae3"
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
  return `Your SALT balance is: ${data.toString()}`;
}
