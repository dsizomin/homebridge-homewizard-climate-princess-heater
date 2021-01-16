import WebSocket from 'ws'
import {WS_URL} from './const'

export const open = (): Promise<WebSocket> => new Promise((res) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => res(ws));
})