'use client';

/**
 * Getting an image into the phone's photo library.
 *
 * iOS Safari ignores the `download` attribute, so a plain link just navigates.
 * The Web Share API is the only route to "Save Image" there, and it needs a
 * File plus a user gesture. Desktop browsers do honour `download`, so that is
 * the fallback rather than the primary path.
 */

export type SaveOutcome =
  | { ok: true; how: 'share' | 'download' }
  | { ok: false; how: 'newtab'; reason: string }
  | { ok: false; how: 'failed'; reason: string };

const toFile = async (dataUri: string, filename: string): Promise<File> => {
  const response = await fetch(dataUri);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'image';

export const saveImage = async (
  dataUri: string,
  caption: string
): Promise<SaveOutcome> => {
  const extension = dataUri.startsWith('data:image/jpeg') ? 'jpg' : 'png';
  const filename = `can-ai-${slug(caption)}.${extension}`;

  // 1. Share sheet — on iOS this is what offers "Save Image".
  try {
    const file = await toFile(dataUri, filename);
    const shareData = { files: [file], title: caption };

    if (navigator.canShare?.(shareData) && navigator.share) {
      await navigator.share(shareData);
      return { ok: true, how: 'share' };
    }
  } catch (error) {
    // A cancelled share sheet is a normal outcome, not a failure to report.
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: true, how: 'share' };
    }
  }

  // 2. Download attribute — works on desktop and Android.
  try {
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { ok: true, how: 'download' };
  } catch {
    // Fall through.
  }

  // 3. Last resort: open it so the viewer can long-press to save.
  try {
    const file = await toFile(dataUri, filename);
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener');
    // Give the new tab time to read the blob before revoking it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return {
      ok: false,
      how: 'newtab',
      reason: 'Opened in a new tab — press and hold the image to save it.',
    };
  } catch (error) {
    return {
      ok: false,
      how: 'failed',
      reason: error instanceof Error ? error.message : 'Could not save the image.',
    };
  }
};

/** Whether the share sheet is likely available, for labelling the button. */
export const canShareFiles = (): boolean => {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob(['x'])], 'probe.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
};
