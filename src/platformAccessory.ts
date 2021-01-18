import {CharacteristicSetCallback, CharacteristicValue, PlatformAccessory, Service, Units} from 'homebridge';

import {HomebridgePrincessHeaterPlatform} from './platform';
import {
  JSONPatchWsIncomingMessage,
  JSONPatchWsOutgoingMessage,
  PrincessHeaterAccessoryContext,
  PrincessHeaterStateWsIncomingMessage,
  ResponseWsIncomingMessage,
  SubscribeWsOutgoingMessage,
  WsIncomingMessage,
} from './ws/types';
import {WsAPIClient} from './ws';
import {MessageType} from './ws/const';

const JSON_PATCH_MAX_RETRIES = 5;

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
    private readonly wsClient: WsAPIClient,
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

    this.wsClient.on('message', this.onWsMessage.bind(this));

    this.platform.log.debug('Subscribing to device updates:', this.accessory.context.device.name);

    this.subscribe().catch(
      err => this.platform.log.error('Failed to subscribe to device ->', this.accessory.context.device.name, err),
    );
  }

  subscribe(): Promise<ResponseWsIncomingMessage> {
    return this.wsClient.send<SubscribeWsOutgoingMessage>({
      type: MessageType.SubscribeDevice,
      device: this.accessory.context.device.identifier,
    });
  }

  async jsonPatch(path: string, value: boolean | number, callback: CharacteristicSetCallback): Promise<void> {

    const message = {
      type: MessageType.JSONPatch,
      device: this.accessory.context.device.identifier,
      patch: [{
        op: 'replace',
        path: path,
        value,
      }],
    };

    const trySend = (retriesLeft: number) => {
      return this.wsClient.send(message)
        .then(m => {
          callback(null);
          return m;
        })
        .catch(err => {
          if (err.status === 400 && retriesLeft) {
            this.platform.log.warn(`Error code 400. Might mean we need to re-subscribe (${retriesLeft} retries left) ->`, message, err);
            return this.subscribe().then(() => trySend(retriesLeft - 1));
          }
        });
    };

    await trySend(JSON_PATCH_MAX_RETRIES)
      .catch(err => {
        this.platform.log.error('Failed to send jsonPatch message ->', message, err);
        callback(err);
      });
  }

  onWsMessage(message: WsIncomingMessage) {
    if ('state' in message) {
      this.onStateMessage(message as PrincessHeaterStateWsIncomingMessage);
    } else if ('type' in message && message.type === MessageType.JSONPatch) {
      this.onJSONPatchMessage(message as JSONPatchWsOutgoingMessage);
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

    this.jsonPatch(
      '/state/power_on',
      value === this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
      callback,
    );
  }

  setTargetTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.platform.log.debug('Set Characteristic TargetTemperature ->', value);

    this.jsonPatch('/state/target_temperature', value as number, callback);
  }
}
