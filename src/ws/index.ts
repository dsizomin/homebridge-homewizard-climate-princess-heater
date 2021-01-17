import WebSocket from 'ws';
import {WS_URL} from './const';
import {HomebridgePrincessHeaterPlatform} from '../platform';

export const open = (platform: HomebridgePrincessHeaterPlatform): Promise<WebSocket> => new Promise((res) => {
  platform.log.debug('Opening WS connection to ->', WS_URL);
  const ws = new WebSocket(WS_URL);

  ws.on('message', (message: string) => {
    platform.log.debug('Incoming message:', JSON.parse(message));
  });

  ws.on('close', () => {
    platform.log.debug('Closing WS connection to ->', WS_URL);
  });

  ws.on('open', () => {
    platform.log.debug('Opened WS connection to ->', WS_URL);
    res(ws);
  });
});