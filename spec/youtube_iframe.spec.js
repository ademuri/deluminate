import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';

describe('YouTube Embed Inversion', () => {
  let dom;
  let document;

  before(() => {
    const cssContent = fs.readFileSync(path.resolve('deluminate.css'), 'utf8');
    dom = new JSDOM(`<!DOCTYPE html>
      <html hc="delumine-smart">
        <body>
            <iframe id="yt-embed" src="https://www.youtube.com/embed/xyz" allowfullscreen></iframe>
            <iframe id="generic-frame" src="http://example.com"></iframe>
            <video id="html5-video"></video>
        </body>
      </html>`);
    document = dom.window.document;

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = cssContent;
    console.log(
      'CSS Content snippet:',
      cssContent.substring(
        cssContent.indexOf('embed:not'),
        cssContent.indexOf('filter: hue-rotate'),
      ),
    );
    document.head.appendChild(style);
  });

  const setScheme = (scheme) => {
    document.documentElement.setAttribute('hc', scheme);
  };

  const checkReinvert = (id) => {
    const el = document.getElementById(id);
    const style = dom.window.getComputedStyle(el);
    expect(style.filter).toContain('invert(100%)');
  };

  it('should reinvert video elements in smart mode', () => {
    setScheme('delumine-smart');
    checkReinvert('html5-video');
  });

  it('should reinvert youtube iframes in smart mode', () => {
    setScheme('delumine-smart');
    checkReinvert('yt-embed');
  });

  it('should reinvert video elements in noimg mode', () => {
    setScheme('delumine-noimg');
    checkReinvert('html5-video');
  });

  it('should reinvert youtube iframes in noimg mode', () => {
    setScheme('delumine-noimg');
    checkReinvert('yt-embed');
  });

  it('should reinvert video elements in all mode', () => {
    setScheme('delumine-all');
    checkReinvert('html5-video');
  });

  it('should reinvert youtube iframes in all mode', () => {
    setScheme('delumine-all');
    checkReinvert('yt-embed');
  });
});
