import adapter from '@sveltejs/adapter-static';

// Material Web elements (<md-*>) are interactive, but Svelte's a11y checks
// can't know that about custom elements.
const MD_A11Y_FALSE_POSITIVES = new Set([
  'a11y_click_events_have_key_events',
  'a11y_no_static_element_interactions',
]);

function isMdElementWarning(w) {
  if (!MD_A11Y_FALSE_POSITIVES.has(w.code) || !w.frame) return false;
  const lines = w.frame.split('\n');
  const caret = lines.findIndex(l => /^\s*\^\s*$/.test(l));
  return caret > 0 && lines[caret - 1].includes('<md-');
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    warningFilter: (w) => !isMdElementWarning(w)
  },
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    })
  }
};

export default config;
