const path = require('path');
const git = require('isomorphic-git');
const findUp = require('find-up');
const plaiceholder=require('plaiceholder');
const fs = require('fs');
const fg=require('fast-glob');

module.exports.getFiles = async (dir) => {
  const dirents = await fs.readdirSync(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? this.getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
};

module.exports.parentDir = (path) => path.split('/').slice(0, -1).join('/');

module.exports.getPages = async (pagesPath) => {
  try {
    const allowedFileNames = ['index.jsx', 'index.tsx', 'index.json'];
    const dirContent = await this.getFiles(pagesPath);
    const indexFiles = dirContent.filter(
      (filename) => allowedFileNames.some(end => filename.endsWith(end))
    );
    const pages = indexFiles.map(filename => {
      let cleanedFilename = filename;
      allowedFileNames.forEach(file => { cleanedFilename = cleanedFilename.replace(`/${file}`, ''); });
      return cleanedFilename.replace(pagesPath, '');
    }) || [];

    // Looks for path without index file which parent has subpage_template defined.
    const directories = dirContent.map((file) => this.parentDir(file));
    const subpages = [...new Set(directories)].filter((path) => {
      if (
        !allowedFileNames.some(allowedFile => fs.existsSync(`${path}/${allowedFile}`))
        && fs.existsSync(`${this.parentDir(path)}/index.json`)) {
        const json = fs.readFileSync(`${this.parentDir(path)}/index.json`);
        const data = JSON.parse(json.toString());
        if (data['#subpage_template']) {
          return true;
        }
      }
      return false;
    });

    return [...pages, ...subpages.map(filename => filename.replace(pagesPath, ''))];
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log("No pages available. The directory doesn't exist:", error.path);
    } else {
      console.error(error);
    }
    return [];
  }
};

module.exports.findGitFolder = async () => await findUp('.git', { type: 'directory' }) || '';

/**
 * Get git info from local fs .git directory.
 *
 * @returns {
*  repo: string,
*  sha: string,
*  branch: string,
* }
*/
module.exports.getGitInfoFromFs = async () => {
  let repo = '';
  let sha = '';
  let branch = '';

  const gitDir = await this.findGitFolder();
  if (gitDir) {
    try {
      const projectRoot = path.dirname(gitDir);
      const remotes = await git.listRemotes({ fs, dir: projectRoot });
      const origin = remotes.find(v => v.remote === 'origin');
      repo = origin?.url ?? '';
      branch = await git.currentBranch({ fs, dir: projectRoot }) || '';
      sha = await git.resolveRef({ fs, dir: projectRoot, ref: 'HEAD' }) || '';
      return { repo, sha, branch };
    } catch (err) {
      console.log('Failed to retrieve git info from fs. ', err);
      return { repo, sha, branch };
    }
  }

  return { repo, sha, branch };
};

/**
* Get current git repo info.
*
* @returns Promise<{
*  repo: string,
*  sha: string,
*  branch: string,
* }>
*/
module.exports.createGitInfo = async () => {
  try {
    const gitInfoFs = await this.getGitInfoFromFs();
    if (gitInfoFs) {
      console.log('Git info from fs. ', gitInfoFs);
      return gitInfoFs;
    }
  } catch (err) {
    console.log('Failed to create git info. ', err);
  }

  return {
    repo: '',
    sha: '',
    branch: '',
  };
};

/**
 * Helper function to find page component.
 * @param  {...string} pathSegments Path to component directory.
 */
module.exports.findComponentPath = (...pathSegments) => {
  let componentPath;
  // Allowed component extensions are jsx, tsx and json.
  ['index.jsx', 'index.tsx', 'index.json'].some(item => {
    componentPath = path.resolve(...pathSegments, item);
    if (fs.existsSync(componentPath)) {
      return true;
    }
    return false;
  });
  return componentPath || null;
};
const cachedTemplates = {};

module.exports.readTemplateFile = (indexPath) => {
  if (Object.keys(cachedTemplates).includes(indexPath)) {
    return cachedTemplates[indexPath];
  }
  if (!fs.existsSync(indexPath)) {
    cachedTemplates[indexPath] = false;
    return cachedTemplates[indexPath];
  }
  const contents = fs.readFileSync(indexPath);
  try {
    const parsedContent = JSON.parse(contents.toString());
    cachedTemplates[indexPath] = {
      template: parsedContent['#template'],
      subpage_template: parsedContent['#subpage_template'],
      path: parsedContent.path,
    };
  } catch (exception) {
    cachedTemplates[indexPath] = false;
  }
  return cachedTemplates[indexPath];
};

module.exports.findTemplate = (indexPath, basePath, isFirst = true) => {
  const templates = this.readTemplateFile(indexPath);
  const { subpage_template = '', template = '_default'} = templates;
  if (isFirst && template) {
    return template;
  }
  if (!isFirst && subpage_template) {
    return subpage_template;
  }
  const parentPath = path.dirname(path.dirname(indexPath));
  if (parentPath <= basePath) {
    return '_default';
  }
  return this.findTemplate(`${parentPath}/index.json`, basePath, false);
};

module.exports.findSubPageTemplateTemplate = (indexPath, basePath) => {
  const templates = this.readTemplateFile(indexPath);
  const { subpage_template = '', template = '_default'} = templates;
  if (subpage_template) return subpage_template;
  if (template) return template;
  const parentPath = path.dirname(path.dirname(indexPath));
  if (parentPath <= basePath) {
    return '_default';
  }
  return this.findSubPageTemplateTemplate(`${parentPath}/index.json`, basePath);
};

module.exports.loadDataFromFiles = async (filepath, publicPath) => {
  const data = [];
  if (!fs.existsSync(filepath)) return data;

  const files = fs.readdirSync(filepath).filter(filename => filename.endsWith('.json'));
  await Promise.all(files.map(async (file) => {
    const name = file.replace('.json', '');

    const content = JSON.parse(fs.readFileSync(path.resolve(filepath, file)).toString());
    const src = content.src || false;

    const isImage = src && src.match(/\.(png|jpg|jpeg|webp|avif)$/);
    if (isImage && fs.existsSync(path.join(publicPath, src))) {
      const {
        base64,
        img: { width, height },
      } = await plaiceholder.getPlaiceholder(
        src,
        { size: 10 }
      );
      content.base64 = base64;
      content.width = width;
      content.height = height;
    }

    data.push({
      node: {
        content: JSON.stringify(content),
        name
      }
    });
  }));

  return data;
};

module.exports.getStaticProps = async ({ params, gitInfo }) => {
  const { slug = [''] } = params;
  const defaultContentSources = [];

  const realSlug = `/${slug.join('/')}/`.replace('//', '/');
  const templateBasePath = ['.', 'src', 'templates'];
  const pagesBasePath = ['.', 'src', 'data', 'pages'];
  const siteDataBasePath = ['.', 'src', 'data', 'site'];
  const publicBasePath = ['.', 'public'];
  const pageData = {
    path: realSlug,
    component: '_default.jsx',
    pageContext: {
      slug: realSlug,
    },
    data: {
      Page: [],
      Site: [],
      DefaultContent: [],
    },
  };

  try {
    const indexPath = this.findComponentPath(...pagesBasePath, ...realSlug.split('/').filter(Boolean));
    if (indexPath === null) {
      console.log('Skip folder ', realSlug, pageData.path, ' index file not found.');
    } else {
      const basePath = path.resolve(...pagesBasePath);
      // Handle JSON.
      if (indexPath.endsWith('.json')) {
        const template = this.findTemplate(indexPath, basePath);
        const componentAbs = path.resolve(
          ...templateBasePath,
          `${template}.jsx`,
        );
        const component = (componentAbs.search(templateBasePath.join('/')) > -1) ? `${template}.jsx` : pageData.component;
        pageData.component = component;
        pageData.pageContext.template = template;
      } else {
        // Normal way.
        pageData.component = indexPath;
      }

      pageData.pageContext.subPageTemplate = this.findSubPageTemplateTemplate(indexPath, basePath);
      pageData.pageContext.gitInfo = gitInfo;
      pageData.data.Page = await this.loadDataFromFiles(
        path.join(...pagesBasePath, realSlug),
        path.join(...publicBasePath)
      );
      if (!pageData.data.Site.length) {
        pageData.data.Site = await this.loadDataFromFiles(
          path.join(...siteDataBasePath),
          path.join(...publicBasePath)
        );
      }

      if (process.env.BODILESS_DEFAULT_CONTENT_AUTO_DISCOVERY === '1') {
        const depth = process.env.BODILESS_DEFAULT_CONTENT_AUTO_DISCOVERY_DEPTH || '1';
        defaultContentSources.push(...this.discoverDefaultContent(parseInt(depth, 10)));

        if (defaultContentSources.length && !pageData.data.DefaultContent.length) {
          // eslint-disable-next-line no-restricted-syntax
          for (const source of defaultContentSources) {
            // eslint-disable-next-line no-await-in-loop
            const defaultContents = await this.loadDataFromFiles(
              source,
              path.join(...publicBasePath)
            );
            pageData.data.DefaultContent.push(...defaultContents);
          }
        }
      }
    }
  } catch (exception) {
    console.warn(`Error trying to create ${pageData.path}`, exception);
  }

  return {
    props: pageData,
  };
};

module.exports.discoverDefaultContent = (depth = 1) => {
  let dir = path.resolve(process.cwd());
  let currentDepth = depth;
  let defaultContentPaths = [];
  while (currentDepth > 0 && dir !== path.resolve(dir, '..')) {
    const files = fg.sync([
      `${dir}/bodiless.content.json`,
      `${dir}/node_modules/**/bodiless.content.json`,
    ], { deep: 1 });
    files.forEach((file) => {
      let fileContent = [];
      try {
        fileContent = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`@bodiless/next: error on reading file: ${file}. Error: ${e}.`);
      }
      defaultContentPaths = [
        ...defaultContentPaths,
        ...fileContent.map((file$) => path.resolve(path.dirname(file), file$)),
      ];
    });
    currentDepth -= 1;
    dir = path.resolve(dir, '..');
  }
  return defaultContentPaths;
};
