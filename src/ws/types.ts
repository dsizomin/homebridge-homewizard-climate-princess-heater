import {DeviceType, MessageType, PrincessHeaterMode} from './const';
import {DeviceResponseItem} from "../http";

export type HelloWsOutgoingMessage = {
    type: MessageType.Hello;
    message_id: number;
    version: string;
    os: string;
    source: string;
    compatibility: number;
    token: string;
}

export type SubscribeWsOutgoingMessage = {
    type: MessageType.SubscribeDevice;
    message_id: number;
    device: string
}

export type JSONPatchWsOutgoingMessage = {
    type: MessageType.JSONPatch;
    device: string;
    message_id: number,
    patch: [{
        op: string;
        path: string,
        value: any
    }]
}

export type WsOutgoingMessage = HelloWsOutgoingMessage | SubscribeWsOutgoingMessage | JSONPatchWsOutgoingMessage

export type ResponseWsIncomingMessage = {
    type: 'response';
    message_id: number;
    status: number;
}

export type DeviceMetaData = {
    type: DeviceType,
    device: string,
    online: boolean,
    version: string,
    model: string,
    name: string
}

export type StateWsIncomingMessage<S> = DeviceMetaData & {
    state: S,
}

export type PrincessHeaterMetadata = DeviceMetaData & {
    type: DeviceType.Heater
}

export type PrincessHeaterState = {
    power_on: boolean,
    lock: boolean,
    target_temperature: number,
    current_temperature: number,
    timer: number,
    mode: PrincessHeaterMode
}

export type PrincessHeaterStateWsIncomingMessage = StateWsIncomingMessage<PrincessHeaterState>;

export type JSONPatchWsIncomingMessage = {
    type: MessageType.JSONPatch;
    device: string;
    patch: [{
        op: string;
        path: string,
        value: any
    }]
}

export type WsIncomingMessage = ResponseWsIncomingMessage | PrincessHeaterStateWsIncomingMessage | JSONPatchWsIncomingMessage | {}

export type PrincessHeaterAccessoryContext = {
    device: DeviceResponseItem & {
        type: DeviceType.Heater
    },
    metadata: PrincessHeaterMetadata
}