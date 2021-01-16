export const WS_URL = 'wss://app-ws.homewizard.com:443/ws'

export enum DeviceType {
    Heater = 'heater'
}

export enum MessageType {
    Hello = 'hello',
    SubscribeDevice = 'subscribe_device',
    JSONPatch = 'json_patch'
}

export enum PrincessHeaterMode {
    High = 'high',
    Low = 'low',
}