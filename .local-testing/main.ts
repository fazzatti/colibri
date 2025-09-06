// import {
//   StellarTestLedger,
//   LogLevelDesc,
//   Container,
// } from "../test-tooling/mod.ts";
// console.log("test local");

// const logLevel: LogLevelDesc = "debug";
// const stellarTestLedger = new StellarTestLedger({ logLevel });

// console.log("Starting container...");
// try {
//   const container: Container = await stellarTestLedger.start();
//   console.log("Container started");
// } catch (error) {
//   console.error("Failed to start container:", error);
//   throw error;
// }

import Docker from "npm:dockerode";

const docker = new Docker();
console.log("Testing Docker connection...");

try {
  const info = await docker.info();
  console.log("Docker connected successfully!");
  console.log("Docker version:", info.ServerVersion);
} catch (error) {
  console.error("Docker connection failed:", error);
}
