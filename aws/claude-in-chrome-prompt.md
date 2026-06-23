# AWS Key Setup — Claude-in-Chrome prompt

Paste the prompt below into **Claude in Chrome** (the browser extension) while you are **signed in to the AWS Console as an admin/root user**. It will walk the IAM screens with you and create a least-privilege user + access key scoped to exactly what the Errand Boy backend needs.

> ⚠️ At the end you'll see an **Access key ID** and **Secret access key**. The secret is shown **once**. Do **not** paste them into the chat. Save them into a local file `errand-boy/.env` (which is gitignored) as:
> ```
> AWS_ACCESS_KEY_ID=...
> AWS_SECRET_ACCESS_KEY=...
> AWS_REGION=eu-west-1
> ```

---

## Prompt to paste into Claude in Chrome

```
You are helping me create a least-privilege AWS IAM user and access key for a project
called "Errand Boy". I am signed in to the AWS Console as an admin. Please drive the
browser through these steps, pausing for my confirmation before anything destructive:

1. Go to the IAM console (https://console.aws.amazon.com/iam/).
2. Create a new customer-managed policy named "ErrandBoyDeployPolicy".
   Use the JSON editor and paste exactly this document:

   {
     "Version": "2012-10-17",
     "Statement": [
       { "Sid": "Hosting", "Effect": "Allow",
         "Action": ["s3:*","cloudfront:*","route53:*","acm:*"], "Resource": "*" },
       { "Sid": "Compute", "Effect": "Allow",
         "Action": ["lambda:*","apigateway:*","logs:*","cloudwatch:*"], "Resource": "*" },
       { "Sid": "DataAuth", "Effect": "Allow",
         "Action": ["dynamodb:*","cognito-idp:*","cognito-identity:*"], "Resource": "*" },
       { "Sid": "SecretsAi", "Effect": "Allow",
         "Action": ["secretsmanager:*","bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream"],
         "Resource": "*" },
       { "Sid": "IaC", "Effect": "Allow",
         "Action": ["cloudformation:*","iam:GetRole","iam:PassRole","iam:CreateRole",
                    "iam:AttachRolePolicy","iam:PutRolePolicy","iam:DeleteRole",
                    "iam:DetachRolePolicy","iam:DeleteRolePolicy","iam:CreatePolicy",
                    "iam:TagRole","ssm:GetParameter","ssm:GetParameters","ssm:PutParameter"],
         "Resource": "*" }
     ]
   }

3. Create a new IAM user named "errand-boy-deploy" with NO console access (programmatic only).
4. Attach the "ErrandBoyDeployPolicy" policy to that user.
5. Create an access key for the user, choosing the "Application running outside AWS" use case.
6. When the Access key ID and Secret access key are shown, tell me they are ready and
   remind me to copy them into my local errand-boy/.env file. Do NOT read the secret
   value aloud or store it anywhere — just confirm it has been generated.

Use the region eu-west-1 unless I tell you otherwise. Pause and ask me before clicking
any final "Create" button so I can confirm.
```

---

## Notes

- The policy is intentionally broad **per service** (`s3:*`, `lambda:*`, etc.) but **narrow in scope** — it only covers the services Errand Boy uses, nothing else. We can tighten to specific resource ARNs once the stack names are fixed.
- `bedrock:InvokeModel` is included in case we choose Amazon Bedrock for the AI chat; harmless if we stay on Gemini.
- For CI/CD later, prefer a **GitHub OIDC role** (no long-lived keys) — the workflow in `.github/workflows/ci.yml` already has a commented-out deploy job ready for it.
- The same JSON is saved at `aws/iam-policy-errand-boy.json` for reuse via CLI:
  `aws iam create-policy --policy-name ErrandBoyDeployPolicy --policy-document file://aws/iam-policy-errand-boy.json`
