let JavaScript = require('./JavaScript');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

class TypeScript extends JavaScript {
    /**
     * The API name for the component.
     */
    name() {
        return ['typeScript', 'ts'];
    }

    /**
     * Required dependencies for the component.
     */
    dependencies() {
        return ['cache-loader', 'ts-loader', 'typescript'].concat(super.dependencies());
    }

    /**
     * webpack rules to be appended to the master config.
     */
    webpackRules() {
      return [{
        test: /\.tsx?$/,
        use: [
          'cache-loader',
          'thread-loader',
          {
            loader: 'babel-loader',
            options: Config.babel()
          },
          {
            loader: 'ts-loader',
            options: {
              appendTsSuffixTo: [/\.vue$/],
              transpileOnly: true,
              happyPackMode: true
            }
          },
        ],
        exclude: /node_modules/,
      }];
    }

    /**
     * Override the generated webpack configuration.
     *
     * @param {Object} config
     */
    webpackConfig(config) {
        super.webpackConfig(config);

        config.plugins.push(new ForkTsCheckerWebpackPlugin());

        config.resolve.extensions.push('.ts', '.tsx');
        config.resolve.alias['vue$'] = 'vue/dist/vue.esm.js';
    }
}

module.exports = TypeScript;
