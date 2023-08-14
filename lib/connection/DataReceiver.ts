// eslint-disable-next-line max-classes-per-file
import { Writable } from 'node:stream';
import { EMPTY_BUFFER } from 'lib/constants';

enum ReceiverState {
  GETTING_INFO,
  GETTING_PAYLOAD_LENGTH_16,
  GETTING_PAYLOAD_LENGTH_64,
  GETTING_MASK,
  GETTING_DATA,
}

type WriteCallback = (error?: Error | null | undefined) => void;

/**
 * An abstaction over how the websocket receives the data from the client.
 *
 * Remember that the client always sends masked data in frames, and because of
 * that this will be a sort of state machine to receive the data.
 *
 * Being an state machine allows us to not lose data if the client sends
 * multiple frames at once.
 */
export class DataReceiver extends Writable {
  public state!: ReceiverState;
  private looping!: boolean;
  private buffersQueue: Buffer[] = [];
  private bufferedBytes = 0;

  constructor() {
    super();
    this.state = ReceiverState.GETTING_INFO;
    this.looping = false;
  }

  /**
   * Writes some data to the underlying resource, and notifies the caller
   * of this stream via the supplied callback.
   *
   * @param chunk the chunk of data to be written
   * @param encoding the encoding of the chunk
   * @param callback the callback to be called when the chunk is written
   */
  _write(chunk: Buffer, encoding: BufferEncoding, callback: WriteCallback): void {
    console.log(`receiving data: ${chunk.toString('hex')}`, { encoding });
    // read data to not lose it
    this.buffersQueue.push(chunk);
    this.bufferedBytes += chunk.length;
    // so we run the state machine
    this.processDataLoop(callback);
  }

  /**
   * Data parsing loop
   *
   * @param callback When called, it may contain an error
   */
  private processDataLoop(callback: WriteCallback) {
    callback(null);
    this.looping = true;

    do {
      switch (this.state) {
        case ReceiverState.GETTING_INFO: {
          this.getConnectionInformation();
          break;
        }
        default: {
          this.looping = false;
        }
      }
    } while (this.looping);
  }

  // TODO: needs consume(2) to work!!!! 🐢
  private getConnectionInformation() {
    if (this.bufferedBytes < 2) {
      this.looping = false;
      return;
    }

    const information = this.consume(2);
    console.log({ information });

    // Read, and depending on that, go to the next state :)
    this.state = ReceiverState.GETTING_PAYLOAD_LENGTH_16;
    this.state = ReceiverState.GETTING_PAYLOAD_LENGTH_64;

    // //   // Process first byte
    // // 0:[FIN] 1..3:[reserved] 4..7:[opcode]
    // const firstByte = data.readUint8(0);
    // const opcode = firstByte & 0b00001111;
    // const fin = (firstByte & 0b10000000) >> 7;
    // console.log({ firstByte, fin, opcode });
    // const validOpcode = Object.values(OPCODES).some((value) => value === opcode);
    // if (!validOpcode) {
    //   throw new Error(`Invalid opcode: ${opcode}`);
    // }
    // if (opcode === OPCODES.close) {
    //   this.state = WsConnectionState.CLOSING;
    //   this.socket.end();
    //   return;
    // }
    // // Process second byte
    // // 0:[MASK] 1..7:[Payload len]
    // const secondByte = data.readUint8(1);
    // const masked = (secondByte & 0b10000000) >> 7;
    // if (!masked) {
    //   throw new FrameNotMaskedException();
    // }
    // const maskingKey = data.readUint32BE(2);

    // const len = secondByte & 0b01111111;
    // // NOTE: should the len be a bigint to be compliant with
    // //       <https://www.rfc-editor.org/rfc/rfc6455#page-29>?
    // const effectiveLen = len <= 125 ? len : (
    //   len === 126 ? data.readUint16BE(2) : data.readUint32BE(2)
    // );
  }

  /**
   * This abstracts how the data is consumed from the buffers queue.
   *
   * Returns and empty buffer when there is no data to read.
   */
  // eslint-disable-next-line consistent-return
  private consume(bytes: number): Buffer {
    // https://github.com/websockets/ws/blob/master/lib/receiver.js#L94
    if (this.bufferedBytes === 0) return EMPTY_BUFFER;
    // NOTE: does this guarantee that the buffer queue is not empty?

    if (bytes === this.buffersQueue[0].length) return this.buffersQueue.shift()!;

    if (bytes < this.buffersQueue[0].length) {
      this.buffersQueue[0] = Buffer.from(this.buffersQueue[0], bytes);
      return Buffer.from(this.buffersQueue[0], 0, bytes);
    }

    return EMPTY_BUFFER;
  }
}
