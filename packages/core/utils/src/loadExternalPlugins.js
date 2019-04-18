// @flow strict-local

import type {FilePath} from '@parcel/types';
import localRequire from './localRequire';

module.exports = async function loadPlugins(
  plugins: Array<mixed> | {[pluginName: string]: {[string]: mixed}},
  relative: FilePath
): Promise<Array<mixed>> {
  if (Array.isArray(plugins)) {
    return Promise.all(
      plugins.map(p => loadPlugin(p, relative)).filter(Boolean)
    );
  } else if (typeof plugins === 'object') {
    let _plugins = plugins;
    let mapPlugins = await Promise.all(
      Object.keys(plugins).map(p => loadPlugin(p, relative, _plugins[p]))
    );
    return mapPlugins.filter(Boolean);
  } else {
    return [];
  }
};

async function loadPlugin(
  pluginName: string,
  relative: FilePath,
  options: {[string]: mixed} = {}
): mixed {
  let plugin = await localRequire(pluginName, relative);
  plugin = plugin.default || plugin;

  if (Object.keys(options).length > 0) {
    plugin = plugin(options);
  }

  return plugin.default || plugin;
}
