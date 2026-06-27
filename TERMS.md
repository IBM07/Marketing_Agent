# HyperDrive AI — Acceptable Use Policy

> **Effective date:** 2025-01-01  
> This document is the repository-level acceptable use policy for the HyperDrive AI open-source project. It supplements, and does not replace, the in-app [Terms of Service](/terms) page.

---

## 1. What HyperDrive AI Is

HyperDrive AI is a **self-hosted, open-source software tool** that helps you automate lead generation by searching the public web and sending email outreach campaigns. When you clone this repository and run it, **you are the operator**. The software is provided to you under the MIT License — you own the deployment, the data, and the responsibility for how you use it.

This is not a managed SaaS product. There is no central platform operator monitoring or controlling your instance. Everything that happens with your deployment is your responsibility.

---

## 2. Acceptable Use

You may use HyperDrive AI to:

- Generate lists of **publicly available** business contact information for legitimate B2B prospecting
- Send **commercial email campaigns** to prospects in compliance with applicable anti-spam laws
- Automate routine lead research and outreach workflows for your own business or clients
- Integrate with your own API keys (Serper.dev, Groq, Cerebras, Gemini, Resend) under those providers' respective terms
- Modify, extend, or redistribute the software in accordance with the [MIT License](LICENSE)

---

## 3. Prohibited Uses

You may **not** use HyperDrive AI for any of the following:

### 3.1 Spam and Unsolicited Messaging
- Sending unsolicited bulk email to individuals who have not opted in or have a legitimate prior business relationship with you
- Building or selling email lists for mass unsolicited commercial messaging
- Disguising the origin of emails or forging sender information (email spoofing)

### 3.2 Illegal Scraping
- Scraping websites that explicitly prohibit automated access in their Terms of Service or `robots.txt`, without authorisation
- Bypassing technical measures (CAPTCHAs, login walls, rate limits) that a website operator uses to prevent automated access
- Collecting data that is protected by privacy law without a lawful basis (e.g., scraping personal data of EU residents without GDPR compliance)

### 3.3 Harassment and Harm
- Targeting individuals for harassment, stalking, or intimidation
- Collecting contact information for any purpose that could endanger the safety of any person
- Using the platform to distribute malware, phishing content, or fraudulent communications

### 3.4 Credential and Data Abuse
- Using the BYOK (Bring Your Own Key) credential system to store or process credentials belonging to others without their knowledge
- Selling, licensing, or distributing data scraped with this tool without a lawful basis to do so
- Using the tool to scrape and aggregate personal data for resale ("data brokering") without compliance with applicable regulations

---

## 4. Your Legal Compliance Obligations

By running HyperDrive AI, you represent that you will comply with all laws and regulations applicable to your use, including but not limited to:

| Law / Regulation | Jurisdiction | What You Must Do |
|---|---|---|
| **CAN-SPAM Act** | United States | Include a physical postal address, a working unsubscribe mechanism, and a non-deceptive subject line in every commercial email |
| **GDPR** | European Union / UK | Identify a lawful basis for processing personal data; honour data subject rights (access, erasure, portability); do not transfer EU personal data to jurisdictions without adequate protection without safeguards |
| **CASL** | Canada | Obtain express or implied consent before sending commercial electronic messages; include identification and an unsubscribe mechanism |
| **ePrivacy Directive** | European Union | Comply with rules on electronic marketing, cookies, and unsolicited communications |
| **CCPA / CPRA** | California, USA | Honour consumer rights to know, delete, and opt out of sale of personal information |
| **Website Terms of Service** | Global | Review and comply with each target website's terms before scraping; respect `robots.txt` directives |
| **API Provider Terms** | Global | Your use of Serper, Groq, Cerebras, Gemini, Resend, and Clerk APIs is governed by each provider's own Terms of Service |

The built-in **unsubscribe system** (`/api/unsubscribe`) and the workspace-scoped `Unsubscribe` table help you comply with opt-out requirements. You are responsible for honouring those opt-outs and not re-adding opted-out recipients.

---

## 5. BYOK (Bring Your Own Key) Responsibility

HyperDrive AI allows you to supply your own API keys for Resend and SMTP email sending. When you use BYOK:

- You are using those keys under your own agreement with the respective provider
- You are responsible for staying within rate limits, quota limits, and acceptable use policies defined by those providers
- The project contributors have no visibility into how you use your keys or what you send

---

## 6. No Warranty

This software is provided **"AS IS"**, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.

The project contributors do not guarantee that the software is free from bugs, that it will meet your requirements, or that its operation will be uninterrupted or error-free.

---

## 7. Limitation of Liability

**To the maximum extent permitted by applicable law, the contributors to HyperDrive AI shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages** arising out of or related to your use of this software, even if advised of the possibility of such damages.

This includes, without limitation:

- Damages resulting from your violation of applicable anti-spam, privacy, or scraping laws
- Costs of legal proceedings brought against you by third parties
- Loss of data, revenue, goodwill, or business opportunity
- Claims by third parties whose data was collected or contacted using this tool

**You bear sole and full responsibility for the consequences of your deployment.**

---

## 8. Enforcement

Because this is open-source software and you self-host it, the project maintainers cannot directly enforce this policy against your deployment. However:

- Violations that involve the project's GitHub repository (e.g., filing issues to report that you are using it for spam) will be addressed by the maintainers
- We reserve the right to refuse contributions, block accounts, or remove forks from associated GitHub resources if we become aware of serious violations
- Nothing in this policy limits the rights of third parties (website operators, email recipients, regulators) to take action against you directly

---

## 9. Reporting Concerns

If you become aware of a serious misuse of this software (e.g., a public fork being used for spam campaigns), please report it via the [SECURITY.md](SECURITY.md) contact channel or by opening a GitHub issue.

---

## 10. Relationship to In-App Terms

The in-app `/terms` page is a lighter-weight version of this policy intended for end users of a deployed instance. This document is the more detailed repository-level policy for developers, forks, and self-hosters.

If there is any conflict between this document and the in-app `/terms` page, this document controls for repository-level concerns.

---

*Questions about this policy can be raised via a GitHub Discussion or Issue in the project repository.*
