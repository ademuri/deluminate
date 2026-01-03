const path = require('path')
const reporters = require('jasmine-reporters');
const junitReporter = new reporters.JUnitXmlReporter({
  savePath: path.join(__dirname, '..', 'junitresults'),
  consolidateAll: false
});
jasmine.getEnv().addReporter(junitReporter);

/* Needed for tests which interact with the local storage. */
require('mock-local-storage');
afterEach(localStorage.clear);
