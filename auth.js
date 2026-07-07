// Errand Boy — Cognito auth via the public REST API (no SDK, no client secret).
(function () {
  const IDP = `https://cognito-idp.${EB.region}.amazonaws.com/`;
  const KEY = "eb_auth";

  async function idp(op, payload) {
    const res = await fetch(IDP, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService." + op,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.__type || "Authentication error";
      throw new Error(msg.replace(/^.*#/, ""));
    }
    return data;
  }

  window.ebAuth = {
    async signUp(email, password, name) {
      return idp("SignUp", {
        ClientId: EB.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          ...(name ? [{ Name: "name", Value: name }] : []),
        ],
      });
    },

    async confirm(email, code) {
      return idp("ConfirmSignUp", {
        ClientId: EB.clientId,
        Username: email,
        ConfirmationCode: code,
      });
    },

    async resend(email) {
      return idp("ResendConfirmationCode", { ClientId: EB.clientId, Username: email });
    },

    async signIn(email, password) {
      const r = await idp("InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: EB.clientId,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      });
      const a = r.AuthenticationResult;
      const auth = {
        idToken: a.IdToken,
        refreshToken: a.RefreshToken,
        email,
        exp: Date.now() + (a.ExpiresIn - 60) * 1000,
      };
      localStorage.setItem(KEY, JSON.stringify(auth));
      return auth;
    },

    signOut() {
      localStorage.removeItem(KEY);
    },

    current() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || "null");
      } catch {
        return null;
      }
    },

    // Returns a valid id token, refreshing if expired. null if not signed in.
    async getToken() {
      const a = this.current();
      if (!a) return null;
      if (Date.now() < a.exp) return a.idToken;
      if (!a.refreshToken) {
        this.signOut();
        return null;
      }
      try {
        const r = await idp("InitiateAuth", {
          AuthFlow: "REFRESH_TOKEN_AUTH",
          ClientId: EB.clientId,
          AuthParameters: { REFRESH_TOKEN: a.refreshToken },
        });
        const res = r.AuthenticationResult;
        a.idToken = res.IdToken;
        a.exp = Date.now() + (res.ExpiresIn - 60) * 1000;
        localStorage.setItem(KEY, JSON.stringify(a));
        return a.idToken;
      } catch {
        this.signOut();
        return null;
      }
    },
  };
})();
