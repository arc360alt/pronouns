// Lets Svelte's type checker accept Material Web custom elements in markup.
import type { HTMLAttributes } from 'svelte/elements';

type MdProps = HTMLAttributes<HTMLElement> & { [prop: string]: any };

declare module 'svelte/elements' {
  export interface SvelteHTMLElements {
    'md-filled-button': MdProps;
    'md-filled-tonal-button': MdProps;
    'md-outlined-button': MdProps;
    'md-text-button': MdProps;
    'md-elevated-button': MdProps;
    'md-icon-button': MdProps;
    'md-filled-icon-button': MdProps;
    'md-filled-tonal-icon-button': MdProps;
    'md-outlined-icon-button': MdProps;
    'md-ripple': MdProps;
    'md-focus-ring': MdProps;
    'md-switch': MdProps;
    'md-outlined-text-field': MdProps;
    'md-dialog': MdProps;
    'md-tabs': MdProps;
    'md-primary-tab': MdProps;
    'md-chip-set': MdProps;
    'md-filter-chip': MdProps;
    'md-divider': MdProps;
    'md-elevation': MdProps;
    'md-circular-progress': MdProps;
  }
}

export {};
