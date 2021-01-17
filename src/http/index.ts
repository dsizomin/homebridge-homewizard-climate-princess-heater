import axios, {AxiosInstance} from 'axios';
import {AUTH_URL, DEVICES_URL} from './const';
import {DeviceType} from '../ws/const';
import {Logger} from 'homebridge';

export type DeviceResponseItem = {
  // endpoint: never;
  // grants: never;
  identifier: string;
  name: string;
  type: DeviceType;
};

export class HttpAPIClient {

  private readonly axiosInstance: AxiosInstance;

  constructor(
    private readonly log: Logger,
    private readonly authorization: string,
  ) {
    this.axiosInstance = axios.create({
      headers: {
        Authorization: `Basic ${this.authorization}`,
      },
    });
  }

  getToken(): Promise<string> {
    this.log.debug(`GET ${AUTH_URL}`);
    return this.axiosInstance.get(AUTH_URL).then(response => response.data.token);
  }

  getDevices(): Promise<DeviceResponseItem[]> {
    this.log.debug(`GET ${DEVICES_URL}`);
    return this.axiosInstance.get(DEVICES_URL).then(response => response.data.devices);
  }
}
