#!/usr/bin/env python3
"""Deploy the Errand Boy API: Lambda + API Gateway HTTP API + Cognito JWT auth.

Idempotent-ish: safe to re-run. Reads foundation outputs from infra/outputs.json.
Run:  python infra/deploy_api.py
"""
import io, json, os, time, zipfile, boto3, botocore

PROFILE = "errand-boy"
FUNC = "ErrandBoy-Api"
ROLE = "ErrandBoy-LambdaRole"
API_NAME = "ErrandBoy-HttpApi"
HERE = os.path.dirname(os.path.abspath(__file__))
HANDLER = os.path.join(HERE, "..", "lambda", "handler.py")

sess = boto3.Session(profile_name=PROFILE)
region = sess.region_name
acct = sess.client("sts").get_caller_identity()["Account"]
iam = sess.client("iam")
lam = sess.client("lambda")
api = sess.client("apigatewayv2")

def load_outputs():
    with open(os.path.join(HERE, "outputs.json")) as f:
        return json.load(f)

def ensure_role():
    trust = {"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"},
         "Action": "sts:AssumeRole"}]}
    policy = {"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Action": ["logs:CreateLogGroup", "logs:CreateLogStream",
                                       "logs:PutLogEvents"], "Resource": "*"},
        {"Effect": "Allow", "Action": ["dynamodb:GetItem", "dynamodb:PutItem",
                                       "dynamodb:UpdateItem", "dynamodb:Query",
                                       "dynamodb:DeleteItem"], "Resource": "*"}]}
    try:
        arn = iam.create_role(RoleName=ROLE, AssumeRolePolicyDocument=json.dumps(trust),
                              Description="Errand Boy API Lambda execution role")["Role"]["Arn"]
        print("role: created")
        time.sleep(12)  # IAM propagation
    except iam.exceptions.EntityAlreadyExistsException:
        arn = iam.get_role(RoleName=ROLE)["Role"]["Arn"]
        print("role: exists")
    iam.put_role_policy(RoleName=ROLE, PolicyName="ErrandBoyApiInline",
                        PolicyDocument=json.dumps(policy))
    return arn

def zip_code():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        with open(HANDLER) as f:
            z.writestr("handler.py", f.read())
    return buf.getvalue()

def ensure_function(role_arn, env):
    code = zip_code()
    try:
        lam.get_function(FunctionName=FUNC)
        exists = True
    except lam.exceptions.ResourceNotFoundException:
        exists = False

    if exists:
        lam.update_function_code(FunctionName=FUNC, ZipFile=code)
        waiter = lam.get_waiter("function_updated_v2")
        waiter.wait(FunctionName=FUNC)
        lam.update_function_configuration(FunctionName=FUNC, Environment={"Variables": env})
        waiter.wait(FunctionName=FUNC)
        arn = lam.get_function(FunctionName=FUNC)["Configuration"]["FunctionArn"]
        print("lambda: updated")
        return arn

    for attempt in range(6):
        try:
            arn = lam.create_function(
                FunctionName=FUNC, Runtime="python3.12", Role=role_arn,
                Handler="handler.handler", Code={"ZipFile": code},
                Timeout=15, MemorySize=256, Environment={"Variables": env},
            )["FunctionArn"]
            print("lambda: created")
            return arn
        except lam.exceptions.InvalidParameterValueException as e:
            if "assume" in str(e).lower() and attempt < 5:
                print(f"  waiting for role to be assumable (retry {attempt+1})")
                time.sleep(6)
            else:
                raise

def get_api_id():
    for item in api.get_apis().get("Items", []):
        if item["Name"] == API_NAME:
            return item["ApiId"]
    return None

def ensure_api(lambda_arn, out):
    api_id = get_api_id()
    if not api_id:
        api_id = api.create_api(
            Name=API_NAME, ProtocolType="HTTP",
            CorsConfiguration={
                "AllowOrigins": ["*"], "AllowMethods": ["GET", "POST", "OPTIONS"],
                "AllowHeaders": ["authorization", "content-type"]},
        )["ApiId"]
        print("api: created")
    else:
        print("api: exists")

    issuer = f"https://cognito-idp.{region}.amazonaws.com/{out['UserPoolId']}"
    authorizers = {a["Name"]: a["AuthorizerId"] for a in api.get_authorizers(ApiId=api_id).get("Items", [])}
    if "CognitoJwt" in authorizers:
        auth_id = authorizers["CognitoJwt"]
    else:
        auth_id = api.create_authorizer(
            ApiId=api_id, Name="CognitoJwt", AuthorizerType="JWT",
            IdentitySource=["$request.header.Authorization"],
            JwtConfiguration={"Issuer": issuer, "Audience": [out["UserPoolClientId"]]},
        )["AuthorizerId"]
        print("authorizer: created")

    integrations = api.get_integrations(ApiId=api_id).get("Items", [])
    if integrations:
        integ_id = integrations[0]["IntegrationId"]
    else:
        integ_id = api.create_integration(
            ApiId=api_id, IntegrationType="AWS_PROXY",
            IntegrationUri=lambda_arn, PayloadFormatVersion="2.0",
        )["IntegrationId"]
        print("integration: created")

    existing_routes = {r["RouteKey"] for r in api.get_routes(ApiId=api_id).get("Items", [])}
    routes = ["GET /wallet", "POST /wallet/fund", "POST /wallet/debit",
              "GET /errands", "POST /errands", "POST /errands/complete",
              "GET /transactions"]
    for rk in routes:
        if rk in existing_routes:
            continue
        api.create_route(ApiId=api_id, RouteKey=rk, Target=f"integrations/{integ_id}",
                         AuthorizationType="JWT", AuthorizerId=auth_id)
    print(f"routes: ensured ({len(routes)})")

    stages = {s["StageName"] for s in api.get_stages(ApiId=api_id).get("Items", [])}
    if "$default" not in stages:
        api.create_stage(ApiId=api_id, StageName="$default", AutoDeploy=True)
        print("stage: $default created")

    # allow API Gateway to invoke the function
    try:
        lam.add_permission(
            FunctionName=FUNC, StatementId="apigw-invoke",
            Action="lambda:InvokeFunction", Principal="apigateway.amazonaws.com",
            SourceArn=f"arn:aws:execute-api:{region}:{acct}:{api_id}/*/*",
        )
        print("permission: granted")
    except lam.exceptions.ResourceConflictException:
        print("permission: already present")

    return f"https://{api_id}.execute-api.{region}.amazonaws.com"

def main():
    out = load_outputs()
    env = {
        "ERRANDS_TABLE": out["ErrandsTable"],
        "TRANSACTIONS_TABLE": out["TransactionsTable"],
        "WALLETS_TABLE": out["WalletsTable"],
    }
    role_arn = ensure_role()
    lambda_arn = ensure_function(role_arn, env)
    base = ensure_api(lambda_arn, out)
    out["ApiBaseUrl"] = base
    with open(os.path.join(HERE, "outputs.json"), "w") as f:
        json.dump(out, f, indent=2)
    print("\nAPI base URL:", base)
    print("(saved to infra/outputs.json)")

if __name__ == "__main__":
    main()
