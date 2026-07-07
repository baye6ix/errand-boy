"""Errand Boy API — single Lambda handler behind an API Gateway HTTP API.

Routes (all require a Cognito JWT except CORS preflight, handled by the API):
  GET  /wallet          -> current balance (auto-creates wallet at 0)
  POST /wallet/fund     -> {amount}          add funds, record transaction
  GET  /errands         -> list this user's errands
  POST /errands         -> {type, cost}      book an errand (debits wallet)
  GET  /transactions    -> list this user's transactions

User identity comes from the verified JWT claims (sub), never from the client body.
"""
import json, os, time, uuid
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key

ddb = boto3.resource("dynamodb")
ERRANDS = ddb.Table(os.environ["ERRANDS_TABLE"])
TXNS    = ddb.Table(os.environ["TRANSACTIONS_TABLE"])
WALLETS = ddb.Table(os.environ["WALLETS_TABLE"])

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}

def _resp(code, body):
    return {"statusCode": code, "headers": CORS, "body": json.dumps(body, default=_json)}

def _json(o):
    if isinstance(o, Decimal):
        return float(o)
    return str(o)

def _user(event):
    claims = (event.get("requestContext", {}).get("authorizer", {})
              .get("jwt", {}).get("claims", {}))
    return claims.get("sub")

def _balance(uid):
    item = WALLETS.get_item(Key={"userId": uid}).get("Item")
    return item["balance"] if item else Decimal(0)

def handler(event, context):
    rc = event.get("requestContext", {})
    method = rc.get("http", {}).get("method", "GET")
    path = event.get("rawPath", "/")
    if method == "OPTIONS":
        return _resp(200, {})

    uid = _user(event)
    if not uid:
        return _resp(401, {"error": "unauthorized"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "invalid JSON body"})

    # ——— Wallet ———
    if path == "/wallet" and method == "GET":
        return _resp(200, {"balance": _balance(uid)})

    if path == "/wallet/fund" and method == "POST":
        amount = Decimal(str(body.get("amount", 0)))
        if amount <= 0:
            return _resp(400, {"error": "amount must be positive"})
        WALLETS.update_item(
            Key={"userId": uid},
            UpdateExpression="ADD balance :a",
            ExpressionAttributeValues={":a": amount},
        )
        _record_txn(uid, "Wallet Funded", amount, "credit")
        return _resp(200, {"balance": _balance(uid)})

    if path == "/wallet/debit" and method == "POST":
        amount = Decimal(str(body.get("amount", 0)))
        title = (body.get("title") or "Payment").strip()
        if amount <= 0:
            return _resp(400, {"error": "amount must be positive"})
        if _balance(uid) < amount:
            return _resp(402, {"error": "insufficient wallet balance"})
        WALLETS.update_item(
            Key={"userId": uid},
            UpdateExpression="ADD balance :d",
            ExpressionAttributeValues={":d": -amount},
        )
        _record_txn(uid, title, amount, "debit")
        return _resp(200, {"balance": _balance(uid)})

    # ——— Errands ———
    if path == "/errands" and method == "GET":
        items = ERRANDS.query(
            KeyConditionExpression=Key("userId").eq(uid),
            ScanIndexForward=False,
        ).get("Items", [])
        return _resp(200, {"errands": items})

    if path == "/errands" and method == "POST":
        etype = (body.get("type") or "").strip()
        cost = Decimal(str(body.get("cost", 0)))
        if not etype or cost <= 0:
            return _resp(400, {"error": "type and positive cost required"})
        if _balance(uid) < cost:
            return _resp(402, {"error": "insufficient wallet balance"})
        WALLETS.update_item(
            Key={"userId": uid},
            UpdateExpression="ADD balance :d",
            ExpressionAttributeValues={":d": -cost},
        )
        errand_id = "EB-" + uuid.uuid4().hex[:8].upper()
        record = {
            "userId": uid, "errandId": errand_id, "type": etype,
            "cost": cost, "status": "Booked", "createdAt": int(time.time()),
        }
        ERRANDS.put_item(Item=record)
        _record_txn(uid, f"{etype} ({errand_id})", cost, "debit")
        return _resp(201, {"errand": record, "balance": _balance(uid)})

    # ——— Transactions ———
    if path == "/transactions" and method == "GET":
        items = TXNS.query(
            KeyConditionExpression=Key("userId").eq(uid),
            ScanIndexForward=False,
        ).get("Items", [])
        return _resp(200, {"transactions": items})

    return _resp(404, {"error": f"no route for {method} {path}"})

def _record_txn(uid, title, amount, sign):
    TXNS.put_item(Item={
        "userId": uid,
        "txnId": f"{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}",
        "title": title,
        "amount": amount,
        "sign": sign,
        "createdAt": int(time.time()),
    })
