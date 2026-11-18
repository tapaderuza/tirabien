/// <reference lib="webworker" />
import { AutoProcessor, SiglipVisionModel, RawImage, env } from '@huggingface/transformers';
import { decodeBank, rank, type EmbeddingBankJson, type Ranked } from './classify';

export type ToWorker =
  | { type: 'init'; bank: EmbeddingBankJson; model: string }
  | { type: 'classify'; id: number; image: Blob };

export type FromWorker =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'result'; id: number; ranked: Ranked[]; ms: number }
  | { type: 'error'; id?: number; message: string };

env.allowLocalModels = false;
env.useBrowserCache = true;

let bank: ReturnType<typeof decodeBank> | undefined;
let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | undefined;
let vision: Awaited<ReturnType<typeof SiglipVisionModel.from_pretrained>> | undefined;

const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      bank = decodeBank(msg.bank);
      const files = new Map<string, { loaded: number; total: number }>();
      const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file) return;
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        post({ type: 'progress', loaded, total });
      };
      processor = await AutoProcessor.from_pretrained(msg.model, { progress_callback });
      vision = await SiglipVisionModel.from_pretrained(msg.model, { dtype: 'q8', device: 'wasm', progress_callback });
      post({ type: 'ready' });
    } else if (msg.type === 'classify') {
      if (!bank || !processor || !vision) throw new Error('Model not ready');
      const t0 = performance.now();
      const img = await RawImage.fromBlob(msg.image);
      const { pooler_output } = await vision(await processor(img));
      post({ type: 'result', id: msg.id, ranked: rank(bank, Array.from(pooler_output.data as Float32Array)), ms: performance.now() - t0 });
    }
  } catch (e) {
    post({ type: 'error', id: msg.type === 'classify' ? msg.id : undefined, message: e instanceof Error ? e.message : String(e) });
  }
};
