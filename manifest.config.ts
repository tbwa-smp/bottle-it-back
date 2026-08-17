import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Bottle It Back - AI Water Tracker",
  version: "1.0.2",
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyEO0iBoBz5+6KlTACu6GshOBkvWQ+ZPsQiIXNgYLJJKhe+rxTgh39D+9EbJjjVjgd37PdJMqFNDVchf3gP5G6C45gXEi36Tb67bacNmj1tYKyAz5qFuZS+e50AWyNDg0zwzz4NOZ/YxR/CQ8x3SjVWzNE+QANbadW0yDnQ3UAQhj1dxg2OkV6KWJHzQ7Jn/NPpFNwOvEaf5HUVz3SLVMWizfh6ujO72gJCA7uYFkzOvs8I6tf6PwYdfc+/P2wJsuFUHjqJ22oxACUnasiLDM1Lyepf3y4XTRs3emIYTLpHBxy/R57OcRtaNfOHsNN7GKg3htg2Hd0Qezz/0N0ODgKwIDAQAB",
  description:
    "Tracks supported AI websites and estimates water consumption from prompts. In partnership with the Planet Water Foundation.",
  permissions: ["storage"],
  host_permissions: [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://openai.com/*",
    "https://gemini.google.com/*",
    "https://claude.ai/*",
    "https://chat.mistral.ai/*",
    "https://donorbox.org/bottle-it-back*",
    "https://api.ecologits.ai/*",
  ],
  background: {
    service_worker: "src/utils/background.ts",
    type: "module",
  },
  action: {
    default_title: "Bottle It Back - AI Water Tracker",
    default_popup: "index.html",
    default_icon: {
      16: "icons/icon16.png",
      32: "icons/icon32.png",
    },
  },
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  content_scripts: [
    {
      matches: [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://openai.com/*",
        "https://gemini.google.com/*",
        "https://claude.ai/*",
        "https://chat.mistral.ai/*",
      ],
      js: ["src/utils/content.ts"],
      run_at: "document_idle",
    },
    {
      matches: ["https://donorbox.org/bottle-it-back*"],
      js: ["src/utils/donationWatch.ts"],
      run_at: "document_idle",
    },
  ],
});
