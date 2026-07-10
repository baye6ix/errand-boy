#!/usr/bin/env python3
"""End-to-end test of the Errand Boy API: Cognito login -> JWT -> API -> DynamoDB.

Creates a temporary Cognito user, signs in, calls every route, then cleans up.
Run:  python tests/api_e2e.py
"""
import json, os, time, urllib.request, urllib.error, boto3

PROFILE = "errand-boy"
HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "..", "infra", "outputs.json")) as f:
    OUT = json.load(f)

POOL = OUT["UserPoolId"]
CLIENT = OUT["UserPoolClientId"]
BASE = OUT["ApiBaseUrl"]
EMAIL = "e2e-tester@errandboy.test"
PASSWORD = "ErrandBoy#2026"

sess = boto3.Session(profile_name=PROFILE)
idp = sess.client("cognito-idp")

def setup_user():
    try:
        idp.admin_delete_user(UserPoolId=POOL, Username=EMAIL)
    except idp.exceptions.UserNotFoundException:
        pass
    idp.admin_create_user(
        UserPoolId=POOL, Username=EMAIL, MessageAction="SUPPRESS",
        UserAttributes=[{"Name": "email", "Value": EMAIL},
                        {"Name": "email_verified", "Value": "true"}])
    idp.admin_set_user_password(UserPoolId=POOL, Username=EMAIL,
                                Password=PASSWORD, Permanent=True)

def login():
    r = idp.initiate_auth(AuthFlow="USER_PASSWORD_AUTH", ClientId=CLIENT,
                          AuthParameters={"USERNAME": EMAIL, "PASSWORD": PASSWORD})
    return r["AuthenticationResult"]["IdToken"]

def call(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Authorization": "Bearer " + token,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")

def main():
    print("setup: creating test user...")
    setup_user()
    token = login()
    print("login: got JWT (len %d)" % len(token))

    # no-auth check
    try:
        req = urllib.request.Request(BASE + "/wallet", method="GET")
        urllib.request.urlopen(req, timeout=10)
        print("noauth: UNEXPECTED 200")
    except urllib.error.HTTPError as e:
        print(f"noauth: {e.code} (expected 401)")
    except urllib.error.URLError as e:
        print(f"noauth: skipped (transient network: {e.reason})")

    steps = [
        ("GET",  "/wallet",       None),
        ("POST", "/wallet/fund",  {"amount": 50000}),
        ("POST", "/errands",      {"type": "Market Run", "cost": 8500}),
        ("GET",  "/errands",      None),
        ("GET",  "/transactions", None),
        ("GET",  "/wallet",       None),
    ]
    for method, path, body in steps:
        # small retry for fresh-stage propagation
        for attempt in range(4):
            code, resp = call(method, path, token, body)
            if code != 500 and not (code == 401 and attempt < 3):
                break
            time.sleep(4)
        print(f"{method} {path} -> {code}  {json.dumps(resp)[:120]}")

    # ——— newer endpoints: debit, complete, chat ———
    code, r = call("POST", "/wallet/debit", token, {"amount": 2000, "title": "Airtime test"})
    print(f"POST /wallet/debit -> {code}  {json.dumps(r)[:80]}")
    code, r = call("POST", "/errands", token, {"type": "Dispatch Rider", "cost": 4000})
    eid = r.get("errand", {}).get("errandId")
    print(f"POST /errands (dispatch) -> {code}  {eid}")
    code, r = call("POST", "/errands/complete", token, {"errandId": eid})
    print(f"POST /errands/complete -> {code}  {json.dumps(r)[:60]}")
    code, r = call("POST", "/chat", token, {"message": "are you close?"})
    print(f"POST /chat -> {code}  {json.dumps(r)[:80]}  (configured={r.get('configured')})")

    print("cleanup: deleting test user...")
    idp.admin_delete_user(UserPoolId=POOL, Username=EMAIL)
    print("done.")

if __name__ == "__main__":
    main()
