import { expect } from '@esm-bundle/chai';
import { setNx } from '../../../../../scripts/utils.js';

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

setNx('/test/fixtures/nx', { hostname: 'example.com' });

// No alt provider configured (the fixture's default) — falls back to ims.js, which resolves
// anonymous by default. Own file: da-auth-status.js pulls in shared/utils.js, whose initIms()
// memoizes at module scope, same reason the initIms() tests themselves are split across files.
describe('da-auth-status — no alt provider, signed out', () => {
  let el;
  let savedAdobeIMS;

  before(async () => {
    await import('../../../../../blocks/shared/da-auth-status/da-auth-status.js');
  });

  beforeEach(() => {
    savedAdobeIMS = window.adobeIMS;
  });

  afterEach(() => {
    el?.remove();
    el = null;
    window.localStorage.removeItem('nx-ims');
    if (savedAdobeIMS === undefined) delete window.adobeIMS; else window.adobeIMS = savedAdobeIMS;
  });

  it('is defined', () => {
    expect(customElements.get('da-auth-status')).to.exist;
  });

  it('renders nothing when signed out — nx-profile is the only sign-in affordance', async () => {
    window.adobeIMS = { getAccessToken: () => null };

    el = document.createElement('da-auth-status');
    document.body.append(el);
    await wait(50);
    await el.updateComplete;

    expect(el.shadowRoot.querySelector('.da-auth-status-label')).to.not.exist;
    expect(el.shadowRoot.textContent.trim()).to.equal('');
  });

  it('finds a nearby nx-nav and offsets to its left', async () => {
    const nav = document.createElement('nx-nav');
    nav.style.cssText = 'position: fixed; top: 0; left: 1000px; width: 200px; height: 1px;';
    document.body.append(nav);

    try {
      el = document.createElement('da-auth-status');
      document.body.append(el);
      await wait(50);
      await el.updateComplete;

      const offset = el.style.getPropertyValue('--da-auth-status-right');
      expect(offset).to.equal(`${window.innerWidth - 1000}px`);
    } finally {
      nav.remove();
    }
  });

  it('falls back to the CSS default offset when there is no nx-nav on the page', async () => {
    el = document.createElement('da-auth-status');
    document.body.append(el);
    await wait(50);
    await el.updateComplete;

    expect(el.style.getPropertyValue('--da-auth-status-right')).to.equal('');
  });

  it('picks up nx-nav even if it is added to the page after this component connects', async () => {
    el = document.createElement('da-auth-status');
    document.body.append(el);
    await wait(50);
    await el.updateComplete;
    expect(el.style.getPropertyValue('--da-auth-status-right')).to.equal('');

    const nav = document.createElement('nx-nav');
    nav.style.cssText = 'position: fixed; top: 0; left: 800px; width: 200px; height: 1px;';
    document.body.append(nav);

    try {
      await wait(50);
      expect(el.style.getPropertyValue('--da-auth-status-right')).to.equal(`${window.innerWidth - 800}px`);
    } finally {
      nav.remove();
    }
  });

  it('recomputes when nx-nav\'s own size settles after an initial, smaller render', async function test() {
    // Chrome doesn't deliver ResizeObserver callbacks to pages that aren't being rendered,
    // and the runner drives many pages in parallel — in a full run this page is usually a
    // background one. Skip there instead of failing on something the component can't affect.
    const delivers = await new Promise((resolve) => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position: fixed; width: 1px; height: 1px;';
      document.body.append(probe);
      const ro = new ResizeObserver(() => resolve(true));
      ro.observe(probe);
      setTimeout(() => resolve(false), 300);
      this.probeCleanup = () => {
        ro.disconnect();
        probe.remove();
      };
    });
    this.probeCleanup();
    if (!delivers) this.skip();

    // Anchored via `right`, not `left` — so a width change (what ResizeObserver actually
    // detects) also moves the computed left edge this component reads, same as a real nav bar
    // growing to fit its just-rendered Feedback/profile content.
    const nav = document.createElement('nx-nav');
    nav.style.cssText = 'position: fixed; top: 0; right: 0; width: 50px; height: 1px;';
    document.body.append(nav);

    try {
      el = document.createElement('da-auth-status');
      document.body.append(el);
      await wait(50);
      await el.updateComplete;
      const initialLeft = nav.getBoundingClientRect().left;
      expect(el.style.getPropertyValue('--da-auth-status-right')).to.equal(`${window.innerWidth - initialLeft}px`);

      nav.style.width = '200px';
      await wait(50);
      const grownLeft = nav.getBoundingClientRect().left;
      expect(grownLeft).to.not.equal(initialLeft);
      expect(el.style.getPropertyValue('--da-auth-status-right')).to.equal(`${window.innerWidth - grownLeft}px`);
    } finally {
      nav.remove();
    }
  });
});
