// @flow
import {Transformer} from '@parcel/plugin';
import localRequire from '@parcel/utils/localRequire';
import loadExternalPlugins from '@parcel/utils/loadExternalPlugins';
import postcss from 'postcss';
import semver from 'semver';

const URL_RE = /url\s*\("?(?![a-z]+:)/;
const IMPORT_RE = /@import/;
const PROTOCOL_RE = /^[a-z]+:/;

export default new Transformer({
  async getConfig(asset, opts) {
    let config = await asset.getConfig(
      ['.postcssrc', '.postcssrc.json', '.postcssrc.js', 'postcss.config.js'],
      {packageKey: 'postcss'}
    );

    let enableModules = !!asset.meta.modules;
    if (!config && !opts.minify && !enableModules) {
      return;
    }

    config = config || {};

    if (typeof config !== 'object') {
      throw new Error('PostCSS config should be an object.');
    }

    let postcssModulesConfig = {
      getJSON: (filename, json) => (asset.meta.cssModules = json)
    };

    if (config.plugins && config.plugins['postcss-modules']) {
      postcssModulesConfig = Object.assign(
        config.plugins['postcss-modules'],
        postcssModulesConfig
      );
      delete config.plugins['postcss-modules'];
    }

    config.plugins = await loadExternalPlugins(config.plugins, asset.filePath);

    if (config.modules || enableModules) {
      let postcssModules = await localRequire(
        'postcss-modules',
        asset.filePath
      );
      config.plugins.push(postcssModules(postcssModulesConfig));
    }

    if (opts.minify) {
      let [cssnano, {version}] = await Promise.all(
        ['cssnano', 'cssnano/package.json'].map(name =>
          localRequire(name, asset.filePath).catch(() => require(name))
        )
      );
      config.plugins.push(
        cssnano(
          (await asset.getConfig(['cssnano.config.js'])) || {
            // Only enable safe css transforms if cssnano < 4
            // See: https://github.com/parcel-bundler/parcel/issues/698
            // See: https://github.com/ben-eb/cssnano/releases/tag/v4.0.0-rc.0
            safe: semver.satisfies(version, '<4.0.0-rc')
          }
        )
      );
    }

    config.from = asset.filePath;
    config.to = asset.filePath;
    return config;
  },

  canReuseAST(ast) {
    return ast.type === 'postcss' && semver.satisfies(ast.version, '^7.0.0');
  },

  parse(asset) {
    return {
      type: 'postcss',
      version: '7.0.0',
      isDirty: false,
      program: postcss.parse(asset.code, {
        from: asset.filePath,
        to: asset.filePath
      })
    };
  },

  async transform(asset, config) {
    if (!config) {
      return [asset];
    }

    let res = await postcss(config.plugins).process(asset.ast.program, config);

    asset.code = res.css;
    asset.ast.isDirty = false;
    return [asset];
  },

  generate(asset) {
    let code;
    if (!asset.ast.isDirty) {
      code = asset.code;
    } else {
      code = '';
      postcss.stringify(asset.ast.program, c => (code += c));
    }

    return {
      code
    };
  }
});
