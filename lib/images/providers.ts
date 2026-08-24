export interface GeneratedImage {
  /** data: URI, so the image needs no file hosting to display. */
  dataUri: string;
  width: number;
  height: number;
  provider: string;
  model?: string;
  /** What was actually sent, after any rewriting. */
  prompt: string;
}

export interface ImageOptions {
  size?: '512' | '768' | '1024';
  signal?: AbortSignal;
}

export interface ImageProvider {
  id: string;
  label: string;
  /** True when this provider has the URL or key it needs. */
  isConfigured(): boolean;
  /** Whether it runs on this machine, which the UI surfaces. */
  local: boolean;
  generate(prompt: string, options?: ImageOptions): Promise<GeneratedImage>;
}

const dimension = (size: ImageOptions['size']) => Number(size ?? '768');

/**
 * Automatic1111 / SD.Next / Forge — the common local Stable Diffusion servers,
 * all speaking the same /sdapi/v1 API. Needs no key, so it's the default for a
 * local-first app: start the WebUI with --api and this finds it.
 */
const automatic1111: ImageProvider = {
  id: 'automatic1111',
  label: 'Stable Diffusion (local)',
  local: true,
  isConfigured: () => Boolean(process.env.SD_WEBUI_URL || process.env.SD_WEBUI_AUTODETECT !== 'off'),

  async generate(prompt, options = {}) {
    const base = (process.env.SD_WEBUI_URL || 'http://127.0.0.1:7860').replace(/\/$/, '');
    const side = dimension(options.size);

    const response = await fetch(`${base}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: process.env.SD_NEGATIVE_PROMPT || 'lowres, blurry, watermark, text',
        steps: Number(process.env.SD_STEPS || 25),
        cfg_scale: Number(process.env.SD_CFG || 7),
        width: side,
        height: side,
        sampler_name: process.env.SD_SAMPLER || 'DPM++ 2M',
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`Stable Diffusion returned ${response.status}`);
    }

    const data = await response.json();
    const image = data.images?.[0];
    if (!image) throw new Error('Stable Diffusion returned no image');

    return {
      dataUri: `data:image/png;base64,${image}`,
      width: side,
      height: side,
      provider: 'Stable Diffusion (local)',
      model: data.parameters?.override_settings?.sd_model_checkpoint,
      prompt,
    };
  },
};

/** ComfyUI's simpler prompt API, for people running that instead. */
const comfyui: ImageProvider = {
  id: 'comfyui',
  label: 'ComfyUI (local)',
  local: true,
  isConfigured: () => Boolean(process.env.COMFYUI_URL),

  async generate(prompt, options = {}) {
    const base = (process.env.COMFYUI_URL as string).replace(/\/$/, '');
    const side = dimension(options.size);

    // ComfyUI is workflow-driven; this expects a saved API-format workflow whose
    // prompt node is id "6" — the default text2img template.
    const response = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: { text: prompt, width: side, height: side } }),
      signal: options.signal,
    });

    if (!response.ok) throw new Error(`ComfyUI returned ${response.status}`);
    const data = await response.json();
    const image = data.images?.[0] ?? data.image;
    if (!image) throw new Error('ComfyUI returned no image');

    return {
      dataUri: image.startsWith('data:') ? image : `data:image/png;base64,${image}`,
      width: side,
      height: side,
      provider: 'ComfyUI (local)',
      prompt,
    };
  },
};

/** Replicate — hosted, needs a token. Useful when the laptop can't run SD. */
const replicate: ImageProvider = {
  id: 'replicate',
  label: 'Replicate',
  local: false,
  isConfigured: () => Boolean(process.env.REPLICATE_API_TOKEN),

  async generate(prompt, options = {}) {
    const side = dimension(options.size);
    const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell';

    const start = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        // Ask Replicate to hold the request open instead of polling ourselves.
        Prefer: 'wait=55',
      },
      body: JSON.stringify({ input: { prompt, width: side, height: side } }),
      signal: options.signal,
    });

    if (!start.ok) {
      const detail = await start.text().catch(() => '');
      throw new Error(`Replicate returned ${start.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
    }

    const prediction = await start.json();
    if (prediction.status === 'failed') {
      throw new Error(prediction.error || 'Replicate could not generate that image');
    }

    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!output) throw new Error('Replicate is still working — try again in a moment');

    // Inline the result so the page needs no external image host.
    const file = await fetch(output, { signal: options.signal });
    const buffer = Buffer.from(await file.arrayBuffer());
    const type = file.headers.get('content-type') || 'image/webp';

    return {
      dataUri: `data:${type};base64,${buffer.toString('base64')}`,
      width: side,
      height: side,
      provider: 'Replicate',
      model,
      prompt,
    };
  },
};

export const ALL_IMAGE_PROVIDERS: ImageProvider[] = [automatic1111, comfyui, replicate];

/**
 * Prefer a keyed cloud provider only when no local server is reachable — local
 * generation costs nothing and keeps the prompt on the machine.
 */
export const resolveImageProvider = (): ImageProvider => {
  const requested = process.env.IMAGE_PROVIDER;
  const named = ALL_IMAGE_PROVIDERS.find((p) => p.id === requested);
  if (named) return named;

  if (comfyui.isConfigured()) return comfyui;
  if (replicate.isConfigured() && process.env.SD_WEBUI_URL === undefined) {
    // Still try local first; the route falls back to Replicate on failure.
    return automatic1111;
  }
  return automatic1111;
};

export const imageProviderStatus = () =>
  ALL_IMAGE_PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    local: provider.local,
    configured: provider.isConfigured(),
  }));
