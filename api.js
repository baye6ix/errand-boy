// Errand Boy — authenticated API helper. Attaches the Cognito JWT to every call.
(function () {
  async function req(method, path, body) {
    const token = await ebAuth.getToken();
    if (!token) throw { status: 401, error: "not signed in" };
    const res = await fetch(EB.apiBase + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  window.ebApi = {
    getWallet: () => req("GET", "/wallet"),
    fundWallet: (amount) => req("POST", "/wallet/fund", { amount }),
    debitWallet: (amount, title) => req("POST", "/wallet/debit", { amount, title }),
    listErrands: () => req("GET", "/errands"),
    bookErrand: (type, cost) => req("POST", "/errands", { type, cost }),
    completeErrand: (errandId) => req("POST", "/errands/complete", { errandId }),
    listTransactions: () => req("GET", "/transactions"),
    chat: (payload) => req("POST", "/chat", payload),
  };
})();
