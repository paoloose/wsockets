// Acording to RFC 6455
// The server MUST close the connection upon receiving a frame that is not masked
export class FrameNotMaskedException extends Error {
  constructor() {
    super('Frame is not masked');
  }
}
