# Security Policy

## Supported Versions

The following versions of Stellar Stream are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Stellar Stream seriously. If you believe you have found a security vulnerability, please report it privately.

**Please do not open a public issue for security vulnerabilities.**

### Private Reporting Process

Please use the **[GitHub Security Advisory](https://github.com/stellar-stream/stellar-stream/security/advisories/new)** form to report vulnerabilities privately. 

This is the preferred method as it allows us to communicate with you privately and coordinate a fix before public disclosure.

### Our Commitment (SLA)

Once a report is received through the GitHub Security Advisory form, we commit to the following response timeline:

- **48 hours**: Acknowledgement of receipt of the report.
- **7 days**: Initial assessment and confirmation of the vulnerability.
- **30 days**: Target for providing a fix or public disclosure (depending on complexity).

## GitHub Security Advisories

Maintainers: Please ensure that **GitHub Security Advisories** are enabled for this repository to allow researchers to submit reports privately.

## Logging and Secret Redaction

Server logs are configured to redact Stellar secret keys to prevent accidental leakage. The backend uses `pino` with the following protections:

- Structured field redaction for paths: `*.secretKey`, `*.privateKey`, `*.seed`.
- Regex-based redaction for any string matching `^S[0-9A-Z]{55}$` (Stellar secret seed format).

If you discover logs containing secret material, please follow the private reporting process above.
