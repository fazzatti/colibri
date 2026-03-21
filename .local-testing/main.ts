import { StellarTestLedger, type LogLevelDesc } from "../test-tooling/mod.ts";

const logLevel: LogLevelDesc = "debug";
const stellarTestLedger = new StellarTestLedger({ logLevel });

console.log("Starting Stellar test ledger...");

try {
  await stellarTestLedger.start();
  console.log("Container started");

  const networkConfig = await stellarTestLedger.getNetworkConfiguration();
  console.log("Resolved network:", networkConfig.horizonUrl);

  const horizonResponse = await fetch(networkConfig.horizonUrl as string);
  console.log("Horizon status:", horizonResponse.status);
  await horizonResponse.text();
} catch (error) {
  console.error("Smoke test failed:", error);
  throw error;
} finally {
  await stellarTestLedger.stop();
  await stellarTestLedger.destroy();
}
