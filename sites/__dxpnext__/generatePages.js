#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const contentGenerationUtils = require('./contentGenerationUtils');

const destinationFolder = 'src/pages/generated';
const pageTemplate = `/* eslint-disable prefer-template */
import React from 'react';
import staticPropsFile from './staticProps.json';
import Template from '%%templatePath%%';

export async function getStaticProps() {
  if (process.env.NEXT_PHASE) return { props: staticPropsFile};
  try {
    // eslint-disable-next-line prefer-template
    const res = await fetch('%%url%%');
    const props = await res.json();
    return {
      ...props,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
  }
  return {};
}

const Page = (props: any) => (<Template {...props} />);

export default Page;
`;

const generate = async () => {
  const sitePath = path.resolve();
  const pages = await contentGenerationUtils.getPages(`${sitePath}/src/data/pages`);
  const gitInfo = await contentGenerationUtils.createGitInfo();

  const existingGeneratedPages = await contentGenerationUtils.getPages(`${sitePath}/${destinationFolder}`);

  // Remove old pages.
  existingGeneratedPages.filter(x => !pages.includes(x)).forEach(filepath => {
    const dest = path.join(sitePath, destinationFolder, 'generated', filepath);
    try {
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
    } catch (error) {
      console.log(`Unable to remove directory and files for page ${filepath}`);
    }
  });
  pages.forEach(async (page) => {
    try {
      const destination = path.join(sitePath, destinationFolder, page);
      if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
      }
      const staticProps = await contentGenerationUtils.getStaticProps(
        { params: {slug: [page]}, gitInfo}
      );

      fs.writeFileSync(
        path.join(destination, 'staticProps.json'),
        JSON.stringify(staticProps.props, null, 2)
      );

      const absoluteTemplatePath = path.resolve('./src/templates', staticProps.props.pageContext.template);
      const destinationFile = `${sitePath}/${destinationFolder}/${page}/index.tsx`;
      const absoluteDestinationFile = path.resolve(`${sitePath}/${destinationFolder}/${page}`);

      const url = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:9000';

      fs.writeFileSync(
        destinationFile,
        pageTemplate.replace('%%templatePath%%', path.relative(absoluteDestinationFile, absoluteTemplatePath))
          .replace('%%url%%', `${url}/staticProps${page || '/index'}.json`)
      );
    } catch (error) {
      console.log(error);
      console.log(`Unable to create files for path ${sitePath}/${destinationFolder}/${page}`);
    }
  });
};

generate();
