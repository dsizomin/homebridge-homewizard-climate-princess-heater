import {
    Characteristic,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    PlatformAccessory,
    Service
} from 'homebridge';

import {HomebridgePrincessHeaterPlatform} from './platform';
import {
    JSONPatchWsIncomingMessage,
    JSONPatchWsOutgoingMessage,
    PrincessHeaterAccessoryContext,
    PrincessHeaterState,
    PrincessHeaterStateWsIncomingMessage,
    ResponseWsIncomingMessage,
    SubscribeWsOutgoingMessage,
    WsIncomingMessage
} from "./ws/types";
import {WsClient} from "./ws/client";
import {MessageType} from "./ws/const";
import {normalizeSlashes} from "ts-node";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomewizardPrincessHeaterAccessory {
    private service: Service;

    /**
     * These are just used to create a working example
     * You should implement your own code to track the state of your accessory
     */
    private state: PrincessHeaterState | null = null;

    constructor(
        private readonly platform: HomebridgePrincessHeaterPlatform,
        private readonly accessory: PlatformAccessory<PrincessHeaterAccessoryContext>,
        private readonly wsClient: WsClient,
    ) {

        this.service = this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat);

        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

        this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
            .on('set', this.setTargetHeatingCoolingState.bind(this));
            // .on('get', this.getTargetHeatingCoolingState.bind(this));

        // this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
        //     .on('get', this.getCurrentHeaterCoolerState.bind(this));

        // this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
        //     .on('get', this.getCurrentHeatingCoolingState.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
            .setProps({
                minStep: 1
            })
            .on('set', this.setTargetTemperature.bind(this))
            // .on('get', this.getTargetTemperature.bind(this));

        // this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        //     .on('get', this.getCurrentTemperature.bind(this));

        this.wsClient.ws.on('message', this.onWsMessage.bind(this));

        this.platform.log.info('Subscribing to device updates:', this.accessory.context.device.name);

        const message: SubscribeWsOutgoingMessage = {
            type: MessageType.SubscribeDevice,
            device: this.accessory.context.device.identifier,
            message_id: wsClient.generateMessageId()
        }

        wsClient.send(message)
    }

    onWsMessage(message: string) {
        const incomingMessage = JSON.parse(message)
        if ('state' in incomingMessage) {
            this.onStateMessage(incomingMessage)
        } else if ('type' in incomingMessage && incomingMessage.type === MessageType.JSONPatch) {
            this.onJSONMessage(incomingMessage)
        }
    }

    onJSONMessage(message: JSONPatchWsIncomingMessage) {
        console.log('Incoming JSON patch', message)
    }

    onStateMessage(message: PrincessHeaterStateWsIncomingMessage) {
        this.platform.log.info('Updating state from message ->', message);
        this.state = message.state
    }

    setTargetHeatingCoolingState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (this.state) {

            let currentValue: CharacteristicValue = this.state.power_on ?
                this.platform.Characteristic.TargetHeatingCoolingState.HEAT :
                this.platform.Characteristic.TargetHeatingCoolingState.OFF;

            let stateValue: boolean
            let normalizedValue: CharacteristicValue = value

            switch (value) {
                case this.platform.Characteristic.TargetHeatingCoolingState.OFF:
                case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
                    stateValue = false;
                    normalizedValue = this.platform.Characteristic.TargetHeatingCoolingState.OFF
                    break;
                case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
                case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
                    stateValue = true;
                    normalizedValue = this.platform.Characteristic.TargetHeatingCoolingState.HEAT
                    break;
                default:
                    this.platform.log.warn('Setting Characteristic TargetHeatingCoolingState, but value is not supported ->', value);
                    callback(new Error('Unsupported characteristic value'), currentValue)
                    return;
            }

            this.platform.log.debug('Set Characteristic TargetHeatingCoolingState ->', value, stateValue);

            const message: JSONPatchWsOutgoingMessage = {
                type: MessageType.JSONPatch,
                message_id: this.wsClient.generateMessageId(),
                device: this.accessory.context.device.identifier,
                patch: [{
                    op: "replace",
                    path: `/state/power_on`,
                    value: stateValue
                }]
            }

            this.wsClient.send(message);

            callback(null)
        } else {
            this.platform.log.warn('Trying to set TargetHeatingCoolingState but state is null');
            callback(new Error('Trying to set TargetHeatingCoolingState but state is null'))
        }
    }

    setTargetTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (this.state) {

            const message: JSONPatchWsOutgoingMessage = {
                type: MessageType.JSONPatch,
                message_id: this.wsClient.generateMessageId(),
                device: this.accessory.context.device.identifier,
                patch: [{
                    op: "replace",
                    path: `/state/target_temperature`,
                    value: value
                }]
            }

            this.platform.log.debug('Set Characteristic TargetTemperature ->', value);

            this.wsClient.send(message);

            callback(null)
        } else {
            this.platform.log.warn('Trying to set TargetTemperature but state is null');
            callback(new Error('Trying to set TargetTemperature but state is null'))
        }
    }
}
