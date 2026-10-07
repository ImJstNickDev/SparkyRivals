const { TestEnvironment } = require('jest-environment-jsdom');

/** React Router's data router uses standard Fetch request objects even for
 * client-only navigation. Use Node's implementation, not a router mock. */
class BrowserEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    Object.assign(this.global, {
      Request,
      Response,
      Headers,
      AbortController,
      AbortSignal,
    });
  }
}
module.exports = BrowserEnvironment;
