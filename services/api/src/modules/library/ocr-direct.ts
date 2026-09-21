import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

// Minimal typed surface of the Emscripten-generated Tesseract module —
// tesseract.js-core ships no type declarations at all, so these are
// hand-written from tesseract.js's own worker-script/index.js (the
// reference implementation this file's sequence of calls mirrors).
interface TessBaseApi {
  Init(dataPath: string | null, language: string, oem: number, configFile?: string): number;
  SetImageFile(exifOrientation: number, angle: number): number;
  Recognize(monitor: null): number;
  GetUTF8Text(): string;
  MeanTextConf(): number;
}

interface TessModule {
  FS: { writeFile(path: string, data: Uint8Array): void };
  TessBaseAPI: new () => TessBaseApi;
}

type TesseractCoreFactory = (options?: Record<string, unknown>) => Promise<TessModule>;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- tesseract.js-core ships no type declarations, and this specific per-variant subpath export (the plain, non-SIMD build — chosen directly rather than via tesseract.js's own wasm-feature-detect auto-selection, to keep this path as simple/deterministic as possible) isn't resolvable via import syntax without them.
const TesseractCore = require("tesseract.js-core/tesseract-core-lstm") as TesseractCoreFactory;

const OEM_LSTM_ONLY = 1;

// Drives tesseract.js-core directly on the main thread instead of going
// through tesseract.js's own createWorker/worker_threads wrapper.
//
// Why: on this Vercel deployment, the WASM core and the bundled
// eng.traineddata both load in well under a second, but the native
// Tesseract init call never completed inside a spawned worker_thread —
// confirmed hung (not merely slow) even given 55s, via diagnostic
// progress checkpoints logged during investigation. This file replicates
// the exact same sequence tesseract.js's own worker-script runs (load
// core → write traineddata into the Emscripten virtual FS →
// TessBaseAPI.Init → SetImageFile → Recognize → GetUTF8Text/
// MeanTextConf) but on the calling thread directly, with no
// worker_threads indirection, no message-passing serialization, and no
// wasm-feature-detect SIMD probing (its own extra WASM compiles) in the
// way.
//
// Both the compiled module and the initialized API are cached at module
// scope (not per-request) — Init() parses the ~5MB traineddata into
// Tesseract's internal data structures, expensive enough to want reuse
// across every warm invocation of the same Lambda instance, same as
// tesseract.js's own Worker was cached at the NestJS service instance
// level before this.
let tessModulePromise: Promise<TessModule> | null = null;
let apiPromise: Promise<TessBaseApi> | null = null;

const TESSDATA_DIR = path.join(__dirname, "..", "..", "..", "tessdata");

// Covers in this ERP's market are routinely Nepali (Devanagari script),
// English, or — on a lot of real covers — both on the same page (a
// Nepali title with a Latin-script publisher/ISBN line, or vice versa).
// Tesseract's own multi-language mode ("eng+nep") handles exactly this:
// it isn't "detect the language then pick a model," each recognized
// word is matched against whichever loaded language model fits best,
// so mixed-script covers work in one pass instead of needing a
// separate detect-then-recognize step.
const LANGS = ["eng", "nep"];

function loadLanguageData(tessModule: TessModule, lang: string): void {
  const compressed = fs.readFileSync(path.join(TESSDATA_DIR, `${lang}.traineddata.gz`));
  tessModule.FS.writeFile(`/${lang}.traineddata`, zlib.gunzipSync(compressed));
}

function getTessModule(): Promise<TessModule> {
  if (!tessModulePromise) {
    // The .wasm binary is loaded by the glue code's own emscripten
    // runtime via a dynamically-templated path deep inside it, not a
    // static require()/import — Vercel's file tracer can't see that
    // reference at build time, so relying on the tesseract.js-core
    // package's own directory being fully bundled proved unreliable
    // (the .js glue file was always present via this file's own static
    // require() above, but its .wasm sibling intermittently wasn't,
    // even with an explicit broad includeFiles glob covering the whole
    // package directory). locateFile sidesteps that class of problem
    // entirely by pointing the read at a copy of just this one file
    // living in services/api/tessdata/ instead — the exact same
    // project-local, explicitly includeFiles'd location the bundled
    // traineddata files already use reliably.
    tessModulePromise = TesseractCore({
      locateFile: (filename: string) => path.join(TESSDATA_DIR, filename),
    }).then((tessModule) => {
      for (const lang of LANGS) loadLanguageData(tessModule, lang);
      return tessModule;
    });
  }
  return tessModulePromise;
}

function getApi(): Promise<TessBaseApi> {
  apiPromise ??= getTessModule().then((tessModule) => {
    const api = new tessModule.TessBaseAPI();
    const status = api.Init(null, LANGS.join("+"), OEM_LSTM_ONLY);
    if (status === -1) throw new Error("Tesseract initialization failed");
    return api;
  });
  return apiPromise;
}

// Same crude-but-working EXIF orientation sniff tesseract.js's own
// setImage.js uses: the raw byte sequence "1 18 0 3 0 0 0 1 0 <tag>" is
// the Orientation IFD entry's tag id/type/count/value layout, found by
// treating the buffer as space-separated byte values rather than
// actually parsing JPEG/EXIF structure. A camera-captured cover photo
// (as opposed to a canvas-rendered one) can carry real EXIF rotation —
// preserved here rather than hardcoding "no rotation" and silently
// regressing photos taken sideways/upside-down on a phone.
function sniffExifOrientation(image: Buffer): number {
  const match = image.subarray(0, 500).join(" ").match(/1 18 0 3 0 0 0 1 0 (\d)/);
  const value = match ? parseInt(match[1], 10) : NaN;
  return Number.isNaN(value) ? 1 : value;
}

export async function recognizeCover(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const [tessModule, api] = await Promise.all([getTessModule(), getApi()]);
  tessModule.FS.writeFile("/input", buffer);
  const result = api.SetImageFile(sniffExifOrientation(buffer), 0);
  if (result === 1) throw new Error("Error attempting to read image");
  api.Recognize(null);
  return { text: api.GetUTF8Text(), confidence: api.MeanTextConf() };
}
