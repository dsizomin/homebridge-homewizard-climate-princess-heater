import {CharacteristicSetCallback, CharacteristicValue, PlatformAccessory, Service, Units} from 'homebridge';

import {HomebridgePrincessHeaterPlatform} from './platform';
import {
  JSONPatchWsIncomingMessage,
  JSONPatchWsOutgoingMessage,
  PrincessHeaterAccessoryContext,
  PrincessHeaterStateWsIncomingMessage,
  SubscribeWsOutgoingMessage,
} from './ws/types';
import {WsClient} from './ws/client';
import {MessageType} from './ws/const';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomewizardPrincessHeaterAccessory {
  private service: Service;

  constructor(
    private readonly platform: HomebridgePrincessHeaterPlatform,
    private readonly accessory: PlatformAccessory<PrincessHeaterAccessoryContext>,
    private readonly wsClient: WsClient,
  ) {

    this.service =
      this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
        ],
      })
      .on('set', this.setTargetHeatingCoolingState.bind(this));


    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        unit: Units.CELSIUS,
        minStep: 1,
      })
      .on('set', this.setTargetTemperature.bind(this));

    this.wsClient.ws.on('message', this.onWsMessage.bind(this));

    this.platform.log.debug('Subscribing to device updates:', this.accessory.context.device.name);

    const message: SubscribeWsOutgoingMessage = {
      type: MessageType.SubscribeDevice,
      device: this.accessory.context.device.identifier,
      message_id: wsClient.generateMessageId(),
    };

    wsClient.send(message);
  }

  onWsMessage(message: string) {
    const incomingMessage = JSON.parse(message);
    if ('state' in incomingMessage) {
      this.onStateMessage(incomingMessage);
    } else if ('type' in incomingMessage && incomingMessage.type === MessageType.JSONPatch) {
      this.onJSONPatchMessage(incomingMessage);
    }
  }

  onJSONPatchMessage(message: JSONPatchWsIncomingMessage) {

    this.platform.log.debug('Updating state from patch message ->', message);

    message.patch.forEach(patchItem => {
      const {op, path, value} = patchItem;

      if (op === 'replace') {
        const match = path.match(/^\/state\/(.*)$/);
        if (match && match[1]) {
          const stateKey = match[1];

          switch (stateKey) {
            case 'power_on': {

              const characteristicValue: CharacteristicValue = value ?
                this.platform.Characteristic.CurrentHeatingCoolingState.HEAT :
                this.platform.Characteristic.CurrentHeatingCoolingState.OFF;

              this.platform.log.debug('Updating CurrentHeatingCoolingState ->', characteristicValue);

              this.service.updateCharacteristic(
                this.platform.Characteristic.CurrentHeatingCoolingState,
                characteristicValue,
              );
              break;
            }
            case 'current_temperature':
              this.platform.log.debug('Updating CurrentHeatingCoolingState ->', value);

              this.service.updateCharacteristic(
                this.platform.Characteristic.CurrentTemperature,
                value,
              );
              break;
          }
        }
      }
    });
  }

  onStateMessage(message: PrincessHeaterStateWsIncomingMessage) {
    this.platform.log.debug('Updating state from state message ->', message);

    Object.keys(message.state).forEach(key => {
      const value = message.state[key];

      switch (key) {
        case 'power_on': {

          const characteristicValue: CharacteristicValue = value ?
            this.platform.Characteristic.CurrentHeatingCoolingState.HEAT :
            this.platform.Characteristic.CurrentHeatingCoolingState.OFF;

          this.platform.log.info('Updating CurrentHeatingCoolingState ->', characteristicValue);

          this.service.setCharacteristic(
            this.platform.Characteristic.CurrentHeatingCoolingState,
            characteristicValue,
          );
          break;
        }
        case 'current_temperature':

          this.platform.log.info('Updating CurrentTemperature ->', value);

          this.service.setCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            value,
          );
          break;
      }
    });
  }

  setTargetHeatingCoolingState(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.platform.log.debug('Set Characteristic TargetHeatingCoolingState ->', value);

    const message: JSONPatchWsOutgoingMessage = {
      type: MessageType.JSONPatch,
      message_id: this.wsClient.generateMessageId(),
      device: this.accessory.context.device.identifier,
      patch: [{
        op: 'replace',
        path: '/state/power_on',
        value: value === this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
      }],
    };

    this.wsClient.send(message)
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  setTargetTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    const message: JSONPatchWsOutgoingMessage = {
      type: MessageType.JSONPatch,
      message_id: this.wsClient.generateMessageId(),
      device: this.accessory.context.device.identifier,
      patch: [{
        op: 'replace',
        path: '/state/target_temperature',
        value: value as number,
      }],
    };

    this.platform.log.debug('Set Characteristic TargetTemperature ->', value);

    this.wsClient.send(message);

    this.wsClient.send(message)
      .then(() => callback(null))
      .catch((err) => callback(err));
  }
}
