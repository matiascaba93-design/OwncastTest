export class ViewerAuthRequiredError extends Error {
  constructor(message = 'viewer_auth_required') {
    super(message);
    this.name = 'ViewerAuthRequiredError';
  }
}
