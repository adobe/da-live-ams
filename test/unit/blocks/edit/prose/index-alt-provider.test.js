import { expect } from '@esm-bundle/chai';
import { setNx } from '../../../../../scripts/utils.js';
import { createConnection } from '../../../../../blocks/edit/prose/index.js';
import { testState as altAuthState } from '../../../../fixtures/nx/utils/helix-admin-auth.js';
import { testState as nx2ApiTestState } from '../../../../fixtures/nx2/utils/api.js';

// initIms() memoizes its result at module scope for the lifetime of a test file, so this
// alternate-provider scenario gets a file of its own (same reason as the utils-init-ims-*
// tests) instead of leaking its memoized account-level token into index.test.js.
setNx('/test/fixtures/nx', { hostname: 'example.com' });

describe('prose/index createConnection, alternate provider', () => {
  let savedFetch;
  beforeEach(() => {
    savedFetch = window.fetch;
    window.fetch = async () => new Response('', { status: 200 });
  });
  afterEach(() => {
    window.fetch = savedFetch;
    window.localStorage.removeItem('nx-ims');
    document.querySelectorAll('da-dialog.da-auth-banner').forEach((el) => el.remove());
  });

  it('On 4401, upgrades the alt provider\'s stale account-level token to a site-scoped one '
    + 'instead of giving up and showing the banner', async () => {
    // Regression: getAuthToken() only ever returns initIms()'s memoized, page-load-time
    // token, which never reflects a site-scoped token minted later by daFetch's own upgrade
    // (see shared/utils.js). Without checking the alt provider's exchange here too, a
    // connection opened with the account-level token would 4401 forever and show "session
    // expired" even though a working site token exists.
    window.localStorage.setItem('nx-ims', 'true');
    const savedIMS = window.adobeIMS;
    delete window.adobeIMS;
    altAuthState.available = true;
    altAuthState.token = 'hlxtst_stale-account-level';
    nx2ApiTestState.siteToken = 'hlxtst_fresh-site-scoped';

    try {
      const { wsProvider, ydoc } = await createConnection('https://admin.ent-da.live/source/org/repo/page.html');
      expect(wsProvider.protocols).to.deep.equal(['yjs', 'hlxtst_stale-account-level']);

      // The handler re-enables the connection; keep that from opening a real socket.
      wsProvider.connect = () => { wsProvider.shouldConnect = true; };
      wsProvider.emit('connection-close', [{ code: 4401, reason: 'auth' }, wsProvider]);
      await new Promise((r) => { setTimeout(r, 80); });

      expect(wsProvider.protocols).to.deep.equal(['yjs', 'hlxtst_fresh-site-scoped']);
      expect(wsProvider.shouldConnect).to.equal(true);
      expect(document.querySelector('da-dialog.da-auth-banner')).to.not.exist;

      wsProvider.disconnect({ data: 'Client navigation' });
      wsProvider.destroy?.();
      ydoc.destroy();
    } finally {
      if (savedIMS === undefined) delete window.adobeIMS; else window.adobeIMS = savedIMS;
      altAuthState.available = false;
      altAuthState.token = null;
      nx2ApiTestState.siteToken = null;
    }
  });
});
