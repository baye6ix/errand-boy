#!/usr/bin/env python3
"""Deploy/update the Errand Boy foundation CloudFormation stack.

Uses the isolated 'errand-boy' AWS profile (scoped IAM user). No secrets in repo.
Run:  python infra/deploy.py
"""
import json, os, sys, boto3, botocore

PROFILE = "errand-boy"
STACK = "errand-boy-foundation"
HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "foundation.yaml")

def main():
    sess = boto3.Session(profile_name=PROFILE)
    cfn = sess.client("cloudformation")
    body = open(TEMPLATE).read()

    exists = True
    try:
        cfn.describe_stacks(StackName=STACK)
    except botocore.exceptions.ClientError as e:
        if "does not exist" in str(e):
            exists = False
        else:
            raise

    action = "update" if exists else "create"
    try:
        if exists:
            cfn.update_stack(StackName=STACK, TemplateBody=body, Capabilities=["CAPABILITY_NAMED_IAM"])
        else:
            cfn.create_stack(StackName=STACK, TemplateBody=body, Capabilities=["CAPABILITY_NAMED_IAM"])
    except botocore.exceptions.ClientError as e:
        if "No updates are to be performed" in str(e):
            print("stack: no changes")
            return dump_outputs(cfn)
        raise

    print(f"stack: {action} in progress — waiting...")
    waiter = cfn.get_waiter(f"stack_{action}_complete")
    waiter.wait(StackName=STACK, WaiterConfig={"Delay": 8, "MaxAttempts": 60})
    print(f"stack: {action} complete")
    return dump_outputs(cfn)

def dump_outputs(cfn):
    outs = cfn.describe_stacks(StackName=STACK)["Stacks"][0].get("Outputs", [])
    data = {o["OutputKey"]: o["OutputValue"] for o in outs}
    out_path = os.path.join(HERE, "outputs.json")
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
    print("outputs:")
    for k, v in data.items():
        print(f"  {k} = {v}")
    print(f"(written to {out_path})")
    return data

if __name__ == "__main__":
    main()
