# @spectra/webpack

> Yet another opiniated Webpack configuration for NodeCG bundles

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Author](#author)
- [License](#license)

# Install

```bash
$ npm install @spectra/webpack
```

# Usage

Create a new file called `webpack.config.js` and write the following code:

```javascript
const configure = require('@spectra/webpack');

module.exports = configure({
  /**
   * Write the variants you want to use in your bundle by following one of the provided examples.
   * You can even create a custom one based on your needs.
   */
});
```

## API

See the [declaration file](./index.d.ts).

## Author

Alexandre Breteau - [@0xSeldszar](https://twitter.com/0xSeldszar)

## License

MIT © [Alexandre Breteau](https://seldszar.fr)
