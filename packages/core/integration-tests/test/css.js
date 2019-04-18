const assert = require('assert');
const path = require('path');
const fs = require('@parcel/fs');
const {bundle, run, assertBundles, assertBundleTree} = require('./utils');

describe('css in v2', () => {
  it('should produce two bundles when importing a CSS file', async () => {
    let b = await bundle(path.join(__dirname, '/integration/css/index.js'));

    await assertBundles(b, [
      {
        name: 'index.js',
        assets: ['index.js', 'local.js']
      },
      {
        name: 'local.css',
        assets: ['index.css', 'local.css']
      }
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');
    assert.equal(output(), 3);
  });

  it('should support loading a CSS bundle along side dynamic imports', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/dynamic-css/index.js')
    );

    await assertBundles(b, [
      {
        name: 'index.js',
        assets: [
          'bundle-loader.js',
          'bundle-url.js',
          'css-loader.js',
          'index.js',
          'js-loader.js',
          'JSRuntime.js'
        ]
      },
      {name: 'local.0feb842b.js', assets: ['local.js']},
      {name: 'local.6f071801.css', assets: ['local.css']},
      {name: 'index.css', assets: ['index.css']}
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');
    assert.equal(await output(), 3);
  });
});

describe.skip('css', function() {
  it('should support importing CSS from a CSS file', async function() {
    let b = await bundle(
      path.join(__dirname, '/integration/css-import/index.js')
    );

    await assertBundleTree(b, {
      name: 'index.js',
      assets: ['index.js', 'index.css', 'other.css', 'local.css'],
      childBundles: [
        {
          name: 'index.css',
          assets: ['index.css', 'other.css', 'local.css'],
          childBundles: [
            {
              type: 'map'
            }
          ]
        },
        {
          name: 'index.map',
          type: 'map'
        }
      ]
    });

    let output = await run(b);
    assert.equal(typeof output, 'function');
    assert.equal(output(), 2);

    let css = await fs.readFile(
      path.join(__dirname, '/dist/index.css'),
      'utf8'
    );
    assert(css.includes('.local'));
    assert(css.includes('.other'));
    assert(/@media print {\s*.other/.test(css));
    assert(css.includes('.index'));
  });

  it('should support linking to assets with url() from CSS', async function() {
    let b = await bundle(path.join(__dirname, '/integration/css-url/index.js'));

    await assertBundleTree(b, {
      name: 'index.js',
      assets: ['index.js', 'index.css'],
      childBundles: [
        {
          name: 'index.css',
          assets: ['index.css'],
          childBundles: [
            {
              type: 'map'
            }
          ]
        },
        {
          type: 'map'
        },
        {
          type: 'woff2',
          assets: ['test.woff2'],
          childBundles: []
        }
      ]
    });

    let output = await run(b);
    assert.equal(typeof output, 'function');
    assert.equal(output(), 2);

    let css = await fs.readFile(
      path.join(__dirname, '/dist/index.css'),
      'utf8'
    );
    assert(/url\("test\.[0-9a-f]+\.woff2"\)/.test(css));
    assert(css.includes('url("http://google.com")'));
    assert(css.includes('.index'));
    assert(css.includes('url("data:image/gif;base64,quotes")'));
    assert(css.includes('.quotes'));
    assert(css.includes('url(data:image/gif;base64,no-quote)'));
    assert(css.includes('.no-quote'));

    assert(
      await fs.exists(
        path.join(
          __dirname,
          '/dist/',
          css.match(/url\("(test\.[0-9a-f]+\.woff2)"\)/)[1]
        )
      )
    );
  });

  it('should support linking to assets with url() from CSS in production', async function() {
    let b = await bundle(
      path.join(__dirname, '/integration/css-url/index.js'),
      {
        production: true
      }
    );

    await assertBundleTree(b, {
      name: 'index.js',
      assets: ['index.js', 'index.css'],
      childBundles: [
        {
          name: 'index.css',
          assets: ['index.css'],
          childBundles: [
            {
              type: 'map'
            }
          ]
        },
        {
          type: 'map'
        },
        {
          type: 'woff2',
          assets: ['test.woff2'],
          childBundles: []
        }
      ]
    });

    let output = await run(b);
    assert.equal(typeof output, 'function');
    assert.equal(output(), 2);

    let css = await fs.readFile(
      path.join(__dirname, '/dist/index.css'),
      'utf8'
    );
    assert(/url\(test\.[0-9a-f]+\.woff2\)/.test(css), 'woff ext found in css');
    assert(css.includes('url(http://google.com)'), 'url() found');
    assert(css.includes('.index'), '.index found');
    assert(css.includes('url("data:image/gif;base64,quotes")'));
    assert(css.includes('.quotes'));
    assert(css.includes('url(data:image/gif;base64,no-quote)'));
    assert(css.includes('.no-quote'));

    assert(
      await fs.exists(
        path.join(
          __dirname,
          '/dist/',
          css.match(/url\((test\.[0-9a-f]+\.woff2)\)/)[1]
        )
      )
    );
  });

  it('should minify CSS in production mode', async function() {
    let b = await bundle(
      path.join(__dirname, '/integration/cssnano/index.js'),
      {
        production: true
      }
    );

    let output = await run(b);
    assert.equal(typeof output, 'function');
    assert.equal(output(), 3);

    let css = await fs.readFile(
      path.join(__dirname, '/dist/index.css'),
      'utf8'
    );
    assert(css.includes('.local'));
    assert(css.includes('.index'));
    assert.equal(css.split('\n').length, 2); // sourceMappingURL
  });
});
