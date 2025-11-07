import { createContext } from 'react';
import { ServerStatus } from '../interfaces/server-status.model';
import { ViewerAuthRequiredError } from '../utils/errors';

const ENDPOINT = `/api/status`;

export interface ServerStatusStaticService {
  getStatus(): Promise<ServerStatus>;
}

class ServerStatusService {
  public static async getStatus(): Promise<ServerStatus> {
    const response = await fetch(ENDPOINT, {
      credentials: 'include',
    });

    if (response.status === 401) {
      throw new ViewerAuthRequiredError();
    }

    if (!response.ok) {
      throw new Error(`Unable to fetch status: ${response.status}`);
    }

    const status = await response.json();
    return status;
  }
}

export const ServerStatusServiceContext =
  createContext<ServerStatusStaticService>(ServerStatusService);
