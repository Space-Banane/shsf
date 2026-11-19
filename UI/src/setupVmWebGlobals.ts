// VM contexts do not inherit Node's web-stream globals, which jsdom does not
// provide. Restore them so VM-pool tests match the default jsdom environment.
import { ReadableStream, TransformStream, WritableStream } from "node:stream/web";

Object.assign(globalThis, { ReadableStream, TransformStream, WritableStream });
