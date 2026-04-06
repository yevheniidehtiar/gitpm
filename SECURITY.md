# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of GitPM seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Use [GitHub Security Advisories](https://github.com/yevheniidehtiar/gitpm/security/advisories/new) to privately report the vulnerability
3. Alternatively, email the maintainers directly (see the repository profile for contact information)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial assessment**: Within 7 days
- **Fix timeline**: Within 90 days for confirmed vulnerabilities
- **Disclosure**: Coordinated disclosure after fix is released

### Scope

The following are in scope for security reports:

- XSS, injection, or other OWASP Top 10 vulnerabilities in the UI or CLI
- Authentication/authorization bypass in sync adapters
- Supply chain vulnerabilities in dependencies
- Information disclosure (tokens, credentials, sensitive data leaks)
- Arbitrary code execution via plugin system or config files

### Out of Scope

- Issues in third-party dependencies (report upstream, but let us know)
- Denial of service via large `.meta/` trees (known limitation)
- Social engineering attacks

## Security Best Practices for Users

- Never commit `.env` files or API tokens to your repository
- Use environment variables or the `gh` CLI for token resolution
- Review plugin code before installing third-party GitPM plugins
- Keep GitPM and its dependencies up to date
