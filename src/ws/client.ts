import type WebSocket from 'ws';
import {WsOutgoingMessage} from "./types";

export class WsClient {

    private lastMessageId: number = 0;

    public readonly outgoingMessages: {
        [key: number]: WsOutgoingMessage
    } = {};

    constructor(public readonly ws: WebSocket) {}

    public generateMessageId() {
        return ++this.lastMessageId;
    }

    public send(message: WsOutgoingMessage) {
        this.outgoingMessages[message.message_id] = message;
        this.ws.send(JSON.stringify(message))
    }
}