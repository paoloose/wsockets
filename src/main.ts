import { WebSocketServer } from './websocket-server';

const WS_PORT = process.env.PORT ?? 4000;

const ws = new WebSocketServer({
  noServer: false,
});

ws.listen(WS_PORT, () => {
  console.log(`ws: listening on port ${WS_PORT}`);
});

ws.on('headers', (headers) => {
  console.log(headers);
});
