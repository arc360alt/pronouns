<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type * as MonacoNS from 'monaco-editor';

  interface Props {
    value: string;
    language: string;
    onchange?: (value: string) => void;
  }
  let { value, language, onchange }: Props = $props();

  let container: HTMLElement;
  let editor: MonacoNS.editor.IStandaloneCodeEditor | null = null;
  // Tracks the last value we pushed into the editor externally so we can
  // tell the difference between a user edit and a programmatic setValue call.
  let lastPushedValue = value;

  onMount(async () => {
    const monaco = await import('monaco-editor');

    const [edW, htmlW, cssW, tsW] = await Promise.all([
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/html/html.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
    ]);

    (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
      getWorker(_: string, label: string) {
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlW.default();
        if (label === 'css' || label === 'scss' || label === 'less') return new cssW.default();
        if (label === 'javascript' || label === 'typescript') return new tsW.default();
        return new edW.default();
      }
    };

    editor = monaco.editor.create(container, {
      value,
      language,
      theme: 'vs-dark',
      minimap: { enabled: false },
      fontSize: 13,
      lineHeight: 20,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      padding: { top: 8, bottom: 8 },
    });

    editor.onDidChangeModelContent(() => {
      const v = editor!.getValue();
      // Only notify parent for genuine user edits, not our own setValue calls
      if (v !== lastPushedValue) {
        onchange?.(v);
      }
    });
  });

  onDestroy(() => editor?.dispose());

  // Sync external value changes (e.g. switching files) into the editor
  $effect(() => {
    if (editor && editor.getValue() !== value) {
      lastPushedValue = value;
      editor.setValue(value);
    }
  });

  // Sync language changes (e.g. switching between .html and .css files)
  $effect(() => {
    if (editor) {
      const model = editor.getModel();
      if (model) {
        import('monaco-editor').then(monaco => {
          monaco.editor.setModelLanguage(model, language);
        });
      }
    }
  });
</script>

<div bind:this={container} style="height:100%;width:100%;"></div>
