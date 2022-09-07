const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const webpack = require("webpack");
module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "build"),
    publicPath: "/",
    filename: "HYPlayer.js",
  },
  devtool: "none",
  devServer: {
    contentBase: "./static", //本地服务器所加载的页面所在的目录
    historyApiFallback: true, //不跳转
    inline: true,
    hot: true,
    host: "0.0.0.0",
    port: 3001,
  },
  module: {
    rules: [
      {
        test: /(\.jsx|\.js)$/,
        use: {
          loader: "babel-loader",
        },
        exclude: /node_modules/,
      },
      {
        test: /\.svg/,
        use: {
          loader: "svg-url-loader",
          options: {},
        },
      },
      {
        test: /\.css$/,
        /*
        use:[{
            loader:'style-loader/url' //使用style-loader进行处理，位置必须在css-loader前面
        },{
            loader:'css-loader' //使用css-loader进行处理
        }]
        //use:['style-loader','css-loader'] // 此处也可以这样写
        */
        use: ExtractTextPlugin.extract({
          fallback: {
            // 这里表示不提取的时候，使用什么样的配置来处理css
            loader: "style-loader",
            options: {
              singleton: true, // 表示将页面上的所有css都放到一个style标签内
            },
          },
          use: [
            // 提取的时候，继续用下面的方式处理
            {
              loader: "css-loader",
            },
          ],
        }),
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: ["css-loader", "sass-loader"],
        }),
      },
    ],
  },
  plugins: [
    new ExtractTextPlugin("styles.css"),
    new webpack.BannerPlugin("版权所有，翻版必究"),
    new HtmlWebpackPlugin({
      template: __dirname + "/static/index.html", //new 一个这个插件的实例，并传入相关的参数
    }),
    new CopyWebpackPlugin([
      {
        from: path.resolve(__dirname, "./src/core"),
        to: path.resolve(__dirname, "./build/core"),
        ignore: [".*"],
      },
      {
        from: path.resolve(__dirname, "./static"),
        to: path.resolve(__dirname, "./build"),
        ignore: [".*"],
      },
      {
        from: path.resolve(__dirname, "./video"),
        to: path.resolve(__dirname, "./build/video"),
        ignore: [".*"],
      },
    ]),
  ],
};
