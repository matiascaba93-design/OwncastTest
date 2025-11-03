import { createContext } from 'react';
import { ClientConfig } from '../interfaces/client-config.model';
import { ViewerAuthRequiredError } from '../utils/errors';

const ENDPOINT = `/api/config`;

export interface ClientConfigStaticService {
  getConfig(): Promise<ClientConfig>;
}

class ClientConfigService {
  public static async getConfig(): Promise<ClientConfig> {
    const response = await fetch(ENDPOINT, {
      credentials: 'include',
    });

    if (response.status === 401) {
      throw new ViewerAuthRequiredError();
    }

    if (!response.ok) {
      throw new Error(`Unable to fetch config: ${response.status}`);
    }

    const status = await response.json();
    return status;
  }
}

export const ClientConfigServiceContext =
  createContext<ClientConfigStaticService>(ClientConfigService);
