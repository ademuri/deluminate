import UrlSelector from '../url_selector.js';
import { Site } from '../utils.js';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';

describe("UrlSelector", () => {
  let dom;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="target"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.URL = dom.window.URL;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.URL;
  });

  it("parses a simple domain", () => {
    const url = "https://example.com/foo/bar";
    const selector = new UrlSelector(url);
    
    // Check internal state based on constructor logic
    expect(selector.domain).toBe("example.com");
    expect(selector.subdomains).toEqual([]);
    expect(selector.path_parts).toEqual(["foo", "bar"]);
  });

  it("parses a subdomain", () => {
    const url = "https://sub.example.com/foo";
    const selector = new UrlSelector(url);
    
    expect(selector.domain).toBe("example.com");
    expect(selector.subdomains).toEqual(["sub"]);
    expect(selector.path_parts).toEqual(["foo"]);
  });

  it("renders to a target element", () => {
    const url = "https://sub.example.com/foo/bar";
    const selector = new UrlSelector(url);
    const target = document.getElementById("target");
    
    selector.render_to(target);
    
    const spans = target.querySelectorAll("span");
    // Expect: sub, example.com, foo, bar.
    // Order in pieces: subdomains (reversed), domain, path_parts.
    // UrlSelector logic: 
    // pieces = subdomains.map(...)
    // push domain
    // push path_parts.map(...)
    
    // For sub.example.com:
    // subdomains = ["sub"]
    // domain = "example.com"
    // pieces = [sub, example.com, foo, bar]
    
    expect(spans.length).toBe(4);
    expect(spans[0].textContent).toBe("sub");
    expect(spans[1].textContent).toBe("example.com");
    expect(spans[2].textContent).toBe("foo");
    expect(spans[3].textContent).toBe("bar");
  });

  it("selects the whole site by default", () => {
    const url = "https://example.com/foo";
    const selector = new UrlSelector(url);
    const target = document.getElementById("target");
    selector.render_to(target);
    
    // By default constructor logic: pieces[0].classList.add('start');
    // pieces[0] is the domain "example.com" (since no subdomains)
    
    const startElements = target.querySelectorAll(".start");
    expect(startElements.length).toBe(1);
    expect(startElements[0].textContent).toBe("example.com");
    
    // No end element means "rest of the path" implies implicit end?
    // Let's check get_site output.
    const site = selector.get_site();
    // Site { domain_hierarchy: ['example.com'], page_hierarchy: [] } -> implies whole domain?
    // Let's check logic of get_site.
    // It pushes domains if selected && host.
    // It pushes paths if selected && !host.
    // 'start' starts selection. 'end' ends it.
    
    expect(site.domain_hierarchy).toEqual(["example.com"]);
    expect(site.page_hierarchy).toEqual([]);
  });

  it("can select a specific path", () => {
    const url = "https://example.com/foo/bar";
    const selector = new UrlSelector(url);
    const target = document.getElementById("target");
    selector.render_to(target);
    
    // Simulate clicking "foo" to start selection there?
    // Or clicking "example.com" as start and "foo" as end?
    // Usage in popup.js suggests selecting logic.
    
    // Let's try select_site logic first, which is higher level.
    // If we have stored settings for example.com/foo, we want to visualize it.
    
    const siteToSelect = new Site("https://example.com/foo");
    selector.select_site(siteToSelect);
    
    // Check classes
    const fooElement = Array.from(target.querySelectorAll("span")).find(el => el.textContent === "foo");
    expect(fooElement.classList.contains("end")).toBe(true);
    
    // Verify get_site retrieves it back
    const retrievedSite = selector.get_site();
    expect(retrievedSite.domain_hierarchy).toEqual(["example.com"]);
    expect(retrievedSite.page_hierarchy).toEqual(["foo"]);
  });

  it("can select a subdomain", () => {
    const url = "https://sub.example.com/foo";
    const selector = new UrlSelector(url);
    const target = document.getElementById("target");
    selector.render_to(target);

    // Select just the subdomain
    const siteToSelect = new Site("https://sub.example.com");
    selector.select_site(siteToSelect);
    
    // sub element should be start
    const subElement = Array.from(target.querySelectorAll("span")).find(el => el.textContent === "sub");
    expect(subElement.classList.contains("start")).toBe(true);
    
    // example.com element should be implicitly selected? 
    // UrlSelector logic:
    // if piece is 'start', selected = true.
    // if selected && host -> push to domains.
    // So 'sub' is start -> selected=true. 'sub' is host -> push 'sub'.
    // Next is 'example.com'. selected=true. 'example.com' is host -> push 'example.com'.
    
    const retrievedSite = selector.get_site();
    expect(retrievedSite.domain_hierarchy).toEqual(["example.com", "sub"]);
    expect(retrievedSite.page_hierarchy).toEqual([]);
  });
});
