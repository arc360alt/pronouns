// Registers the Material Web (M3) components used across the app and wires up
// ripples on native clickable elements that aren't md-* components themselves.
import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/button/elevated-button.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/iconbutton/filled-icon-button.js';
import '@material/web/iconbutton/filled-tonal-icon-button.js';
import '@material/web/iconbutton/outlined-icon-button.js';
import '@material/web/ripple/ripple.js';
import '@material/web/focus/md-focus-ring.js';
import '@material/web/switch/switch.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/dialog/dialog.js';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/divider/divider.js';
import '@material/web/elevation/elevation.js';
import '@material/web/progress/circular-progress.js';
import { styles as typescaleStyles } from '@material/web/typography/md-typescale-styles.js';

if (typeof document !== 'undefined' && typescaleStyles.styleSheet) {
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, typescaleStyles.styleSheet];
}

// Native elements that should get an M3 state layer + ripple.
const RIPPLE_SELECTOR = [
  'button:not([data-no-ripple])',
  'a.btn',
  '.nav-links a',
  '.nav-drawer a',
  '.nav-icon-btn',
  '.notif-link',
  '.profile-link-btn',
  '.image-card',
  '.home-card',
  '.dm-conv-row',
  '[data-ripple]',
].join(',');

function addRipple(el: Element) {
  if (el.querySelector(':scope > md-ripple')) return;
  const ripple = document.createElement('md-ripple');
  ripple.setAttribute('aria-hidden', 'true');
  el.appendChild(ripple);
}

function scan(root: ParentNode) {
  if (root instanceof Element && root.matches(RIPPLE_SELECTOR)) addRipple(root);
  root.querySelectorAll(RIPPLE_SELECTOR).forEach(addRipple);
}

let started = false;
export function startAutoRipple() {
  if (started || typeof document === 'undefined') return;
  started = true;
  scan(document.body);
  new MutationObserver(mutations => {
    for (const m of mutations) {
      m.addedNodes.forEach(n => {
        if (n instanceof Element && n.tagName !== 'MD-RIPPLE') scan(n);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}
