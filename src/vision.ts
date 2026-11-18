import type { EmbeddingBankJson, Ranked } from './classify';
import type { FromWorker, ToWorker } from './vision.worker';

/** Thin promise wrapper around the vision web worker. The model loads lazily on first photo. */
export class Vision {
  private worker?: Worker;
  private ready?: Promise<void>;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: Ranked[]) => void; reject: (e: Error) => void }>();

  constructor(
    private readonly bank: EmbeddingBankJson,
    private readonly onProgress: (loaded: number, total: number) => void,
  ) {}

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      worker.onmessage = (ev: MessageEvent<FromWorker>) => {
        const m = ev.data;
        if (m.type === 'progress') this.onProgress(m.loaded, m.total);
        else if (m.type === 'ready') resolve();
        else if (m.type === 'result') {
          this.pending.get(m.id)?.resolve(m.ranked);
          this.pending.delete(m.id);
        } else if (m.type === 'error') {
          const err = new Error(m.message);
          if (m.id !== undefined) {
            this.pending.get(m.id)?.reject(err);
            this.pending.delete(m.id);
          } else {
            this.ready = undefined; // allow a retry
            reject(err);
          }
        }
      };
      const init: ToWorker = { type: 'init', bank: this.bank, model: this.bank.model };
      worker.postMessage(init);
    });
    return this.ready;
  }

  async classify(image: Blob): Promise<Ranked[]> {
    await this.start();
    const id = this.nextId++;
    return new Promise<Ranked[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: ToWorker = { type: 'classify', id, image };
      this.worker!.postMessage(msg);
    });
  }
}

/** Downscale a photo so a 12 MP camera shot does not stall the phone before inference. */
export async function shrink(file: Blob, max = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
}
