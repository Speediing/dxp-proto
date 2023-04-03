// eslint-disable-next-line import/order
const packageJSON = require('./package.json');

const removeArrayDuplicates = (value, index, array) => array.indexOf(value) === index;
const bodilessAndDxpPakages = (it) => it.includes('@bodiless/') || it.includes('--dxp--');
let tempTranspiledPackages = Object.keys(packageJSON.dependencies).filter(bodilessAndDxpPakages);
let innerTranspiledPackages = [];
let transpiledPackages=tempTranspiledPackages;

let $dept = 0;
do {
  tempTranspiledPackages.forEach(package => {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const packageJSON = require(`${package}/package.json`);
      innerTranspiledPackages.push(
        ...Object.keys(packageJSON.dependencies).filter(bodilessAndDxpPakages)
      );
    } catch (error) {
      //
    }
  });
  $dept+=1;
  innerTranspiledPackages = innerTranspiledPackages
    .filter(removeArrayDuplicates)
    .filter(x => !transpiledPackages.includes(x));

  // Add new Packages to the list
  transpiledPackages.push(...innerTranspiledPackages);
  // Remove duplicates.
  transpiledPackages = transpiledPackages.filter(removeArrayDuplicates);
  // Remove pakages already added;
  tempTranspiledPackages = innerTranspiledPackages;
} while ($dept < 4 && tempTranspiledPackages.length > 0);

const withTM = require('next-transpile-modules')([...transpiledPackages]);
const { withPlaiceholder } = require('@plaiceholder/next');
const { addTokenShadowPlugin } = require('@bodiless/webpack');
const createRedirectAliases = require('@bodiless/next/createRedirectAliases');
const createRewrites = require('@bodiless/next/createRewrites');
const NextWebpackConfig = require('@bodiless/next/Webpack/Config');
const getPublicEnv = require('@bodiless/next/getPublicEnv');
const glob = require('glob');
const shadow = require('--dxp--/shadow');

module.exports = withTM(withPlaiceholder({
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      ...(await createRedirectAliases())
    ];
  },
  async rewrites() {
    return {
      ...createRewrites(),
      afterFiles: [
        // These rewrites are checked after pages/public files
        // are checked but before dynamic routes
        {
          source: '/:path*',
          destination: '/generated/:path*',
        },
      ],
    };
  },
  trailingSlash: true,
  env: {
    ...getPublicEnv(),
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL || ''
  },
  reactStrictMode: false,
  webpack: (config, options) => {
    const { usedExports, ...optimization } = config.optimization;
    const BodilessNextConfig = NextWebpackConfig(config, {
      nextWebpack: options
    });

    const tokenShadow = addTokenShadowPlugin({}, { resolvers: [shadow] });

    return {
      ...BodilessNextConfig,
      plugins: [
        ...(BodilessNextConfig.plugins || []),
        ...tokenShadow.plugins,
      ],
      optimization: {
        ...optimization,
        providedExports: true
      },
      // On development, we want changes on Bodiless packages to trigger
      // new builds. Webpack won't watch packages inside node_modules by
      // default, so we remove the @bodiless folder from its default list.
      //
      // See: https://webpack.js.org/configuration/other-options/#snapshot
      snapshot: {
        managedPaths: glob.sync(
          './node_modules/!(@bodiless)*',
          { absolute: true },
        ),
      }
    };
  }
}));
