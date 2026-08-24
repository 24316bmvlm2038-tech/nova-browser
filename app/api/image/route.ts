import { NextResponse } from 'next/server';
import {
  ALL_IMAGE_PROVIDERS,
  imageProviderStatus,
  resolveImageProvider,
} from '@/lib/images/providers';
import { currentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Diffusion is slow on CPU; allow well past the usual request budget.
const TIMEOUT_MS = 180_000;

export async function GET() {
  return NextResponse.json({ providers: imageProviderStatus() });
}

export async function POST(request: Request) {
  if (!currentUser()) {
    return NextResponse.json({ error: 'Sign in to generate images.' }, { status: 401 });
  }

  let prompt: string;
  let size: '512' | '768' | '1024';

  try {
    const body = await request.json();
    prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    size = ['512', '768', '1024'].includes(body.size) ? body.size : '768';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: 'Describe the image you want.' }, { status: 400 });
  }
  if (prompt.length > 800) {
    return NextResponse.json({ error: 'That prompt is too long.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Try the preferred provider, then any other that's configured — a local
  // server that isn't running shouldn't block a working cloud fallback.
  const primary = resolveImageProvider();
  const order = [primary, ...ALL_IMAGE_PROVIDERS.filter((p) => p.id !== primary.id)];
  const tried: { provider: string; reason: string }[] = [];

  try {
    for (const provider of order) {
      if (!provider.isConfigured()) continue;
      try {
        const image = await provider.generate(prompt, { size, signal: controller.signal });
        return NextResponse.json(image);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        tried.push({
          provider: provider.label,
          reason: error instanceof Error ? error.message : 'failed',
        });
      }
    }

    return NextResponse.json(
      {
        error:
          'No image generator is reachable. Start Stable Diffusion WebUI with --api, or set REPLICATE_API_TOKEN.',
        tried,
      },
      { status: 503 }
    );
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? 'Image generation timed out. A smaller size renders faster.'
          : error instanceof Error
            ? error.message
            : 'Image generation failed',
      },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
