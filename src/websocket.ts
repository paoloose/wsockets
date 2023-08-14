import EventEmitter from 'events';
import { Duplex } from 'stream';
import { FrameNotMaskedException } from './exceptions';
import { OPCODES } from './constants';

export enum WsConnectionState {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
}

export class WebSocketConnection extends EventEmitter {
  socket!: Duplex;
  state: WsConnectionState = WsConnectionState.CONNECTING;

  constructor({ socket }: { socket: Duplex }) {
    super();
    this.socket = socket;

    socket.on('data', (data: Buffer) => {
      console.log(`receiving data: ${data.toString('hex')}`);
      this.parseFrame(data);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  parseFrame(data: Buffer) {
    // Process first byte
    // 0:[FIN] 1..3:[reserved] 4..7:[opcode]
    const firstByte = data.readUint8(0);
    // const fin = (firstByte & 0b10000000) >> 7; // if set, this is the final fragment
    const opcode = firstByte & 0b0001111;

    if (opcode === OPCODES.close) {
      this.socket.end();
      return;
    }
    const entry = Object.values(OPCODES).find((_, value) => (
      value === opcode
    ));

    // Process second byte
    // 0:[MASK] 1..7:[Payload len]
    const secondByte = data.readUint8(1);
    const masked = (secondByte & 0b10000000) >> 7;

    if (!masked) {
      throw new FrameNotMaskedException();
    }

    const len = secondByte & 0b01111111;
    // eslint-disable-next-line no-nested-ternary
    const effectiveLen = len <= 125 ? len : (
      len === 126 ? data.readUInt16BE(2) : data.readUInt32BE(2)
    );

    console.log({ firstByte, opcode: (entry || [])[0] ?? 'invalid' });
  }
}
