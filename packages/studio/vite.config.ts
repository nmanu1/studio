import {
  ConfigEnv,
  defineConfig,
  PluginOption,
  searchForWorkspaceRoot,
  UserConfig,
} from "vite";
import createStudioPlugin from "@yext/studio-plugin";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig(async (args: ConfigEnv): Promise<UserConfig> => {
  return {
    root: __dirname,
    server: {
      fs: {
        allow: [
          searchForWorkspaceRoot(process.cwd()),
          process.cwd(),
          __dirname,
        ],
      },
    },
    build: {
      rollupOptions: {
        input: ["index.html", "src/store/useStudioStore.ts"],
      },
    },
    plugins: [react(), createStudioPlugin(args), svgr() as PluginOption],
    css: {
      postcss: __dirname,
    },
    optimizeDeps: {
      include: [
        "recent-searches",
        "hashlru",
        "lodash/isEqual",
        "prop-types",
        "react-dom",
        "raf",
        "cross-fetch",
        "mapbox-gl",
      ],
    },
  };
});
