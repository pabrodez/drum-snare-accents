// @ts-check
import { defineConfig, fontProviders } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
	site: "https://example.com",
	adapter: cloudflare(),
	fonts: [
		{
			provider: fontProviders.fontsource(),
			name: "Patrick Hand",
			cssVariable: "--font-patrick-hand",
		},
		{
			provider: fontProviders.fontsource(),
			name: "Caveat",
			cssVariable: "--font-caveat",
			weights: [500, 700],
		},
	],
});
