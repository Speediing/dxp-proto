export default {
  stackbitVersion: '~0.6.0',
  ssgName: 'custom',
  cmsName: 'git',
  devCommand: 'npm start --workspace @sites/--dxp--',
  nodeVersion: '16',
  experimental: {
    ssg: {
      name: 'Gatsby',
      logPatterns: {
        up: 'You can now view',
      },
    },
  },
};
