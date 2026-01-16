export default defineNitroConfig({
  srcDir: "server",
  compatibilityDate: "2025-01-14",
  serverAssets: [
    {
      baseName: "templates",
      dir: "assets",
    },
  ],
  runtimeConfig: {
    aiGatewayApiKey: process.env.AI_GATEWAY_API_KEY ?? "",
    agentSecret: process.env.AGENT_SECRET ?? "",
  },
})
