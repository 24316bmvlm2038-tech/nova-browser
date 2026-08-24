import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/session';
import {
  DEFAULT_VISION_MODEL,
  generate,
  listModels,
  pickVisionModel,
} from '@/lib/ollamaServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 90_000;
// A 1024px JPEG is ~200KB; anything much larger is a full-resolution photo the
// vision model gains nothing from and Ollama is slow to encode.
const MAX_BYTES = 6 * 1024 * 1024;

const PROMPT = `Identify the single main product in this photo.
Reply with ONLY the product name, as specific as you can be — include brand and model if legible.
Examples of good replies: "Sony WH-1000XM5 headphones", "Nintendo Switch OLED", "Le Creuset 5.5qt Dutch oven".
If you cannot tell what the product is, reply exactly: UNKNOWN`;

/** Which vision model is available, so the UI can explain itself before use. */
export async function GET() {
  try {
    const installed = (await listModels()).map((model) => model.name);
    const model = pickVisionModel(installed);
    return NextResponse.json({
      available: Boolean(model),
      model,
      suggested: DEFAULT_VISION_MODEL,
    });
  } catch {
    return NextResponse.json({
      available: false,
      model: null,
      suggested: DEFAULT_VISION_MODEL,
    });
  }
}

/** Take a captured photo and name the product in it. */
export async function POST(request: Request) {
  if (!currentUser()) {
    return NextResponse.json({ error: 'Sign in to use the scanner.' }, { status: 401 });
  }

  let image: string;
  try {
    const body = await request.json();
    image = typeof body.image === 'string' ? body.image : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Accept a data: URI or bare base64; Ollama wants the payload without the prefix.
  const base64 = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  if (!base64) {
    return NextResponse.json({ error: 'No photo was sent.' }, { status: 400 });
  }
  if (base64.length * 0.75 > MAX_BYTES) {
    return NextResponse.json(
      { error: 'That photo is too large. Try again — the camera downscales automatically.' },
      { status: 413 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const installed = (await listModels(controller.signal)).map((model) => model.name);
    const model = pickVisionModel(installed);

    if (!model) {
      return NextResponse.json(
        {
          error: `No vision model installed. Run \`ollama pull ${DEFAULT_VISION_MODEL}\` and try again.`,
        },
        { status: 503 }
      );
    }

    const reply = await generate(PROMPT, model, controller.signal, [base64]);
    const name = cleanName(reply);

    if (!name) {
      return NextResponse.json(
        { error: "I couldn't tell what that is. Try filling more of the frame.", model },
        { status: 422 }
      );
    }

    return NextResponse.json({ name, model });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    const detail = error instanceof Error ? error.message : 'Vision request failed';
    return NextResponse.json(
      {
        error: aborted
          ? 'The vision model took too long. A smaller model like moondream is much faster.'
          : /fetch failed|ECONNREFUSED/i.test(detail)
            ? 'Could not reach Ollama. Start it with `ollama serve`.'
            : detail,
      },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Vision models like to wrap the answer in a sentence. Strip the padding and
 * reject the explicit UNKNOWN sentinel.
 */
const cleanName = (reply: string): string | null => {
  const first = reply.trim().split('\n')[0] ?? '';
  const cleaned = first
    .replace(/^(?:this (?:is|appears to be)|the product is|it'?s|answer:)\s*/i, '')
    .replace(/^["'`]|["'`.]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /^unknown$/i.test(cleaned)) return null;
  // A paragraph means it didn't follow the instruction; don't search on prose.
  if (cleaned.length > 80) return null;
  return cleaned;
};
