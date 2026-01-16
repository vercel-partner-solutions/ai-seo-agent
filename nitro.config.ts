export default defineNitroConfig({
  srcDir: "server",
  compatibilityDate: "2025-01-14",
  serverAssets: [
    {
      baseName: "templates",
      dir: "assets",
    },
  ],
})
