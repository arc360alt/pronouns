<script lang="ts">
  import PixLoader from '$lib/components/PixLoader.svelte';

  const CS = 340;   // canvas internal size
  const CR = 134;   // crop circle radius
  const OUT = 512;  // output image size

  let {
    file,
    onConfirm,
    onCancel,
  }: {
    file: File | null;
    onConfirm: (blob: Blob) => void;
    onCancel: () => void;
  } = $props();

  let canvas = $state<HTMLCanvasElement | undefined>();
  let imgEl = $state<HTMLImageElement | null>(null);
  let zoom = $state(1);
  let minZoom = $state(0.1);
  let maxZoom = $state(5);
  let offsetX = $state(0);
  let offsetY = $state(0);
  let applying = $state(false);

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  // Load image whenever file changes
  $effect(() => {
    if (!file) { imgEl = null; return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const mz = Math.max((2 * CR) / img.naturalWidth, (2 * CR) / img.naturalHeight);
      minZoom = mz;
      maxZoom = mz * 8;
      zoom = mz;
      offsetX = 0;
      offsetY = 0;
      imgEl = img;
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  });

  // Redraw on any relevant state change
  $effect(() => {
    void zoom; void offsetX; void offsetY; void imgEl; void canvas;
    draw();
  });

  function clamp() {
    if (!imgEl) return;
    const maxOX = Math.max(0, (imgEl.naturalWidth  * zoom) / 2 - CR);
    const maxOY = Math.max(0, (imgEl.naturalHeight * zoom) / 2 - CR);
    if (offsetX < -maxOX) offsetX = -maxOX;
    if (offsetX >  maxOX) offsetX =  maxOX;
    if (offsetY < -maxOY) offsetY = -maxOY;
    if (offsetY >  maxOY) offsetY =  maxOY;
  }

  function draw() {
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext('2d')!;
    const cx = CS / 2, cy = CS / 2;

    ctx.clearRect(0, 0, CS, CS);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CS, CS);

    // Image
    const iw = imgEl.naturalWidth  * zoom;
    const ih = imgEl.naturalHeight * zoom;
    ctx.drawImage(imgEl, cx + offsetX - iw / 2, cy + offsetY - ih / 2, iw, ih);

    // Dark overlay outside crop circle (evenodd "donut")
    ctx.beginPath();
    ctx.rect(0, 0, CS, CS);
    ctx.arc(cx, cy, CR, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill('evenodd');

    // Rule-of-thirds grid (clipped to circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, CR, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const x = cx - CR + (2 * CR * i) / 3;
      const y = cy - CR + (2 * CR * i) / 3;
      ctx.beginPath();
      ctx.moveTo(x, cy - CR); ctx.lineTo(x, cy + CR);
      ctx.moveTo(cx - CR, y); ctx.lineTo(cx + CR, y);
      ctx.stroke();
    }
    ctx.restore();

    // Circle border
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, CR, 0, Math.PI * 2);
    ctx.stroke();
  }

  function scale(clientX: number, clientY: number) {
    if (!canvas) return { dx: 0, dy: 0 };
    const rect = canvas.getBoundingClientRect();
    const s = CS / rect.width;
    return { dx: (clientX - lastX) * s, dy: (clientY - lastY) * s };
  }

  function onMouseDown(e: MouseEvent) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  }
  function onMouseMove(e: MouseEvent) {
    if (!dragging) return;
    const { dx, dy } = scale(e.clientX, e.clientY);
    offsetX += dx; offsetY += dy;
    lastX = e.clientX; lastY = e.clientY;
    clamp();
  }
  function onMouseUp() { dragging = false; }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }
  function onTouchMove(e: TouchEvent) {
    if (e.touches.length !== 1 || !dragging) return;
    e.preventDefault();
    const { dx, dy } = scale(e.touches[0].clientX, e.touches[0].clientY);
    offsetX += dx; offsetY += dy;
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    clamp();
  }
  function onTouchEnd() { dragging = false; }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    zoom = Math.max(minZoom, Math.min(maxZoom, zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    clamp();
  }

  function onZoomSlider(e: Event) {
    zoom = parseFloat((e.target as HTMLInputElement).value);
    clamp();
  }

  // zoom display as multiplier relative to "fit" (minZoom = 1×)
  let zoomDisplay = $derived(((zoom / minZoom)).toFixed(1) + '×');

  async function confirm() {
    if (!imgEl || applying) return;
    applying = true;

    const cx = CS / 2, cy = CS / 2;
    const iw = imgEl.naturalWidth  * zoom;
    const ih = imgEl.naturalHeight * zoom;
    const imgLeft = cx + offsetX - iw / 2;
    const imgTop  = cy + offsetY - ih / 2;

    // Source coords of crop circle top-left
    const srcX = (cx - CR - imgLeft) / zoom;
    const srcY = (cy - CR - imgTop)  / zoom;
    const srcW = (2 * CR) / zoom;
    const srcH = (2 * CR) / zoom;

    const out = document.createElement('canvas');
    out.width = OUT; out.height = OUT;
    out.getContext('2d')!.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, OUT, OUT);
    out.toBlob(blob => { applying = false; if (blob) onConfirm(blob); }, 'image/jpeg', 0.93);
  }
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="crop-backdrop" onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
  <div class="crop-modal">
    <div class="crop-modal-header">
      <span>Crop Profile Picture</span>
      <button class="crop-close" onclick={onCancel} aria-label="Cancel">×</button>
    </div>

    <div class="crop-body">
      <p class="crop-hint">
        <i class="fa-solid fa-arrows-up-down-left-right"></i> Drag to reposition
        &nbsp;·&nbsp;
        <i class="fa-solid fa-magnifying-glass"></i> Scroll or slider to zoom
      </p>

      <!-- Canvas -->
      <div class="crop-canvas-wrap">
        <canvas
          bind:this={canvas}
          width={CS}
          height={CS}
          class="crop-canvas"
          onmousedown={onMouseDown}
          onmousemove={onMouseMove}
          onmouseup={onMouseUp}
          onmouseleave={onMouseUp}
          ontouchstart={onTouchStart}
          ontouchmove={onTouchMove}
          ontouchend={onTouchEnd}
          onwheel={onWheel}
        ></canvas>
      </div>

      <!-- Zoom slider -->
      <div class="crop-zoom-row">
        <i class="fa-solid fa-magnifying-glass-minus" style="font-size:12px;color:var(--text-muted)"></i>
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={minZoom * 0.01}
          value={zoom}
          oninput={onZoomSlider}
          class="crop-slider"
        />
        <i class="fa-solid fa-magnifying-glass-plus" style="font-size:12px;color:var(--text-muted)"></i>
        <span class="crop-zoom-label">{zoomDisplay}</span>
      </div>
    </div>

    <div class="crop-actions">
      <button class="btn btn-secondary" onclick={onCancel}>Cancel</button>
      <button class="btn btn-primary" onclick={confirm} disabled={!imgEl || applying}>
        {#if applying}
          <PixLoader size={20} /> Processing…
        {:else}
          <i class="fa-solid fa-check"></i> Apply crop
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .crop-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .crop-modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: 100%;
    max-width: 400px;
    overflow: hidden;
  }

  .crop-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    font-size: 15px;
  }
  .crop-close {
    background: none;
    border: none;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0 2px;
  }
  .crop-close:hover { color: var(--text); }

  .crop-body { padding: 1rem; }

  .crop-hint {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    margin-bottom: 0.75rem;
  }

  .crop-canvas-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 0.85rem;
  }

  .crop-canvas {
    display: block;
    width: 100%;
    max-width: 340px;
    aspect-ratio: 1;
    border-radius: var(--radius);
    cursor: grab;
    touch-action: none;
  }
  .crop-canvas:active { cursor: grabbing; }

  .crop-zoom-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .crop-slider {
    flex: 1;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .crop-zoom-label {
    font-size: 12px;
    color: var(--text-muted);
    min-width: 2.5rem;
    text-align: right;
  }

  .crop-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border);
  }
</style>
