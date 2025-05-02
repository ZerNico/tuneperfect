import { googleOAuthClient } from "./google";

class OAuthService {
  private oauthClients = {
    google: googleOAuthClient,
  };

  async createAuthorizationURL(provider: keyof typeof this.oauthClients) {
    return await this.oauthClients[provider].getAuthorizationURL();
  }

  async exchangeCodeForAccessToken(provider: keyof typeof this.oauthClients, code: string, codeVerifier: string) {
    const token = await this.oauthClients[provider].validateAuthorizationCode(code, codeVerifier);
    return token.accessToken();
  }

  async getOrCreateUser(provider: keyof typeof this.oauthClients, token: string) {
    const user = await this.oauthClients[provider].getOrCreateUser(token);
    return user;
  }
}

export const oauthService = new OAuthService();
