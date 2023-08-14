export const OPCODES = {
  continuation: 0x00,
  text: 0x01,
  binary: 0x02,
  close: 0x08,
  ping: 0x09,
  pong: 0x0a,
  // others opcodes are reserver
} as const;
