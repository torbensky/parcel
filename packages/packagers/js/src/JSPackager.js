// @flow

import {Packager} from '@parcel/plugin';
import fs from 'fs';

const PRELUDE = fs
  .readFileSync(__dirname + '/prelude.js', 'utf8')
  .trim()
  .replace(/;$/, '');

export default new Packager({
  async package(bundle) {
    let promises = [];
    bundle.assetGraph.traverseAssets(asset => {
      promises.push(asset.getOutput());
    });
    let outputs = await Promise.all(promises);

    let assets = '';
    let i = 0;
    let first = true;
    bundle.assetGraph.traverseAssetsWithReferences(({type, asset}) => {
      if (type === 'asset_reference' && asset.type === 'js') {
        // if this is a reference to another javascript asset, we should not include
        // either its output or a stub, as its contents should already be loaded
        return;
      }

      let wrapped = first ? '' : ',';
      if (type === 'asset_reference') {
        wrapped += JSON.stringify(asset.id) + ':[0,{}]';
      } else {
        let deps = {};
        let dependencies = bundle.assetGraph.getDependencies(asset);
        for (let dep of dependencies) {
          let resolved = bundle.assetGraph.getDependencyResolution(dep);
          if (resolved) {
            deps[dep.moduleSpecifier] = resolved.id;
          }
        }

        let output = outputs[i];
        wrapped +=
          JSON.stringify(asset.id) +
          ':[function(require,module,exports) {\n' +
          (output.code || '') +
          '\n},';
        wrapped += JSON.stringify(deps);
        wrapped += ']';

        i++;
      }

      assets += wrapped;
      first = false;
    });

    return (
      PRELUDE +
      '({' +
      assets +
      '},{},' +
      JSON.stringify(
        bundle.assetGraph.getEntryAssets().map(asset => asset.id)
      ) +
      ', ' +
      'null' +
      ')'
    );
  }
});
