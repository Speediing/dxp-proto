#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const contentGenerationUtils = require('./contentGenerationUtils');

const originFolder = 'src/pages/generated';
const buildPropsDestinationFolder = './public/staticProps';

const override = async () => {
  const sitePath = path.resolve();
  const pages = await contentGenerationUtils.getPages(`${sitePath}/src/data/pages`);
  const gitInfo = await contentGenerationUtils.createGitInfo();

  const existingGeneratedPages = await contentGenerationUtils.getPages(`${sitePath}/${originFolder}`);

  // Remove old pages.
  existingGeneratedPages.filter(x => !pages.includes(x)).forEach(filepath => {
    const dest = path.join(sitePath, originFolder, 'generated', filepath);
    const buildPropsDest = path.join(sitePath, buildPropsDestinationFolder, filepath);
    try {
      if (fs.existsSync(dest)) {
        // Remove files from build.
        if (fs.existsSync(buildPropsDest)) {
          fs.rmSync(buildPropsDest, { recursive: true, force: true });
        }
      }
    } catch (error) {
      console.log(`Unable to remove directory and files for page ${filepath}`);
    }
  });
  try {
    if (!fs.existsSync(path.join(sitePath, buildPropsDestinationFolder))) {
      fs.mkdirSync(path.join(sitePath, buildPropsDestinationFolder), { recursive: true });
    }
  } catch (error) {
    console.log('Unable to create destination directory');
  }
  pages.forEach(async (page) => {
    // Add new files to build.
    const buildJsonDestination = path.join(sitePath, buildPropsDestinationFolder, page || 'index');
    try {
      const staticProps = await contentGenerationUtils.getStaticProps(
        { params: {slug: [page]}, gitInfo}
      );
      const destination = path.join(sitePath, originFolder, page);

      const destinationFolder = path.join(
        sitePath,
        buildPropsDestinationFolder,
        path.dirname(page)
      );

      if (!fs.existsSync(destinationFolder)) {
        fs.mkdirSync(destinationFolder, { recursive: true });
      }
      fs.writeFileSync(
        `${buildJsonDestination}.json`,
        JSON.stringify(staticProps)
      );
    } catch (error) {
      console.log(error);
      console.log(`Unable to create files for path ${buildJsonDestination}.json`);
    }
  });
};

override();
