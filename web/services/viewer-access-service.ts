export class ViewerAccessService {
  private static AUTH_ENDPOINT = '/api/viewer/auth';

  private static LOGOUT_ENDPOINT = '/api/viewer/logout';

  public static async authenticate(password: string): Promise<void> {
    const response = await fetch(ViewerAccessService.AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const { message } = await response.json().catch(() => ({ message: 'Authentication failed.' }));
      throw new Error(message || 'Authentication failed.');
    }
  }

  public static async logout(): Promise<void> {
    await fetch(ViewerAccessService.LOGOUT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
    });
  }
}
