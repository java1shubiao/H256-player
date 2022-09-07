import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import postcss from "rollup-plugin-postcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import nodeResolve from "rollup-plugin-node-resolve";
import replace from "rollup-plugin-replace";
import { string } from "rollup-plugin-string";
import workerInline from "rollup-plugin-worker-inline";
import { version } from "./package.json";
const { uglify } = require("rollup-plugin-uglify");
// const isProd = process.env.NODE_ENV === "production";

//const banner =
//  "/*!\n" +
// ` * HYPlayer.js v${version}\n` +
//` * (c) 2017-${new Date().getFullYear()} \n` +
//   " * Released  the MIT License.\n" +
//   " */\n";
const isProd = true;

const baseConfig = {
  output: {
    format: "umd",
    sourcemap: !isProd,
  },
  plugins: [
    string({
      include: ["src/control/icons/*.svg"],
    }),
    nodeResolve(),
    commonjs(),
    workerInline(),
    babel({
      runtimeHelpers: true,
      exclude: "node_modules/**",
      presets: [
        [
          "@babel/preset-env",
          {
            modules: false,
          },
        ],
      ],
      plugins: [
        "@babel/plugin-external-helpers",
        "@babel/plugin-transform-runtime",
      ],
    }),
    replace({
      exclude: "node_modules/**",
      __ENV__: JSON.stringify(process.env.NODE_ENV || "development"),
      __VERSION__: version,
    }),

    isProd && {
      name: "removeHtmlSpace",
      transform(code) {
        return {
          code: code.replace(/\\n*\s*</g, "<").replace(/>\\n*\s*/g, ">"),
        };
      },
    },
  ],
};

export default [
  {
    input: "src/index.js",
    output: {
      name: "HYPlayer",
      file: "dist/hyplayer.js",
    },
    plugins: [
      postcss({
        plugins: [
          autoprefixer(),
          cssnano({
            preset: "default",
          }),
        ],
        sourceMap: !isProd,
        extract: false,
      }),
    ],
  },
].map((config) => {
  return {
    input: config.input,
    output: {
      ...baseConfig.output,
      ...config.output,
    },
    plugins: [...baseConfig.plugins, ...config.plugins],
  };
});
