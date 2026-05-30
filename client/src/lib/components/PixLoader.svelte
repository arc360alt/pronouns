<script lang="ts">
  import { onMount } from 'svelte';

  let { size = 32, color = '' }: { size?: number; color?: string } = $props();

  let canvas: HTMLCanvasElement | null = $state(null);

  function hexToRgb(hex: string): [number, number, number] {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    return [224, 122, 39];
  }

  function draw(ctx: CanvasRenderingContext2D, sz: number, elapsed: number, hex: string) {
    const [r, g, b] = hexToRgb(hex);
    ctx.clearRect(0, 0, sz, sz);
    const cx = sz / 2, cy = sz / 2;
    const gap = sz > 30 ? 4 : 2.4;
    const dot = sz > 30 ? 3 : 2;
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        const dx = (col - 1) * gap;
        const dy = (row - 1) * gap;
        const alpha = 0.06 + 0.84 * Math.pow(Math.max(0, Math.sin(0.003 * elapsed - 0.7 * col - 0.35 * row)), 1.6);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(
          Math.round(cx + dx) - Math.floor(dot / 2),
          Math.round(cy + dy) - Math.floor(dot / 2),
          dot, dot
        );
      }
    }
  }

  onMount(() => {
    if (!canvas) return;
    const resolvedColor = color || getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#e07a27';
    const SC = window.devicePixelRatio || 2;
    canvas.width = size * SC;
    canvas.height = size * SC;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SC, SC);
    const t0 = performance.now();
    let raf: number;
    function loop() {
      draw(ctx, size, performance.now() - t0, resolvedColor);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas
  bind:this={canvas}
  width={size}
  height={size}
  style="width:{size}px;height:{size}px;image-rendering:pixelated;display:inline-block;vertical-align:middle"
/>
