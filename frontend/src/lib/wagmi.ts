"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "SynthEdge",
  projectId: "4f5fdcfb1346d9066773e7ee30823050", // WalletConnect Cloud project ID — replace with a real one for production
  chains: [arbitrum],
  ssr: true,
});
