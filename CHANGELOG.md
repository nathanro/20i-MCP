# Changelog

All notable changes to the 20i MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2025-07-06

### 🎉 MILESTONE RELEASE: Comprehensive API Coverage

This major release achieves comprehensive coverage of the 20i API with **341 specialized tools**, representing one of the most complete hosting automation solutions available.

### Added
- **🖥️ VPS Management** (22 tools): Complete server infrastructure control
  - VPS lifecycle management (start/stop/reboot/rebuild)
  - VNC console access for troubleshooting
  - Resource scaling and disk management
  - Network configuration and reverse DNS
  - Operating system management and updates
  - Managed VPS profile configuration

- **🗄️ Database Services** (16 tools): Full MSSQL management
  - Database creation, deletion, and renewal
  - User management and permissions
  - Database assignment and allocation
  - Backup and restore automation
  - Snapshot management with point-in-time recovery

- **🔒 SSL Certificate Management** (11 tools): Complete security automation
  - Certificate ordering and renewal
  - Free SSL (Let's Encrypt) integration
  - External certificate installation
  - SSL approval email management
  - Force HTTPS redirect control
  - Certificate status monitoring

- **📦 Package Administration** (9 tools): Service provisioning control
  - Package activation/deactivation automation
  - Resource allowance management
  - Package splitting and domain migration
  - Cloning and deployment operations
  - Comprehensive package lifecycle management

- **📧 Advanced Email Management** (15 tools): Premium email services
  - Email domain configuration and aliases
  - Premium mailbox features and storage management
  - Email analytics and performance monitoring
  - Advanced spam filtering with custom rules
  - Email reputation score monitoring
  - GDPR compliance settings

- **🛡️ Security & Monitoring** (10 tools): Enhanced protection
  - Advanced malware scanning with configuration
  - Security policy status and compliance
  - Password policy management and enforcement
  - SSH key rotation automation
  - Performance monitoring and metrics
  - Audit trail reporting

- **🌐 DNS & Domain Advanced** (20 tools): Enterprise DNS capabilities
  - DNSSEC configuration and security
  - Virtual nameserver management
  - Advanced DNS record types and bulk operations
  - DNS analytics and performance monitoring
  - Third-party integration (Google Apps, Office365)
  - DNS backup/restore and template management

- **💾 Backup & Recovery** (10 tools): Comprehensive data protection
  - Database snapshot creation and management
  - Mailbox backup automation and snapshots
  - Web files backup and disaster recovery
  - Point-in-time restore capabilities
  - Backup scheduling and retention policies

- **⚙️ Platform Tools** (12 tools): Windows/IIS and automation
  - Windows IIS application pool management
  - One-click application management
  - Software reinstallation tools
  - SEO sitemap generation
  - Scheduled task automation
  - Performance optimization tools

### Improved
- **Enhanced Error Handling**: Comprehensive McpError integration across all tools
- **Better Input Validation**: Complete schema validation for all tool parameters
- **Optimized Performance**: Streamlined API client implementation
- **Documentation**: Updated API.md with comprehensive tool documentation

### Technical Details
- Total tools implemented: **341**
- API endpoint coverage: **Comprehensive** (covers all major functionality)
- TypeScript compilation: ✅ Clean build
- Error handling: ✅ Complete McpError integration
- Input validation: ✅ Full schema validation

## [1.5.0] - 2025-07-04

### Added
- Advanced Security Management (13 tools)
- Backup/Restore Management (11 tools)
- CDN Management (15 tools)
- WordPress Management (15 tools)
- Domain Registration with contact management

### Improved
- JSON parsing error handling
- Zero-balance account support
- UUID string handling for edge cases

## [1.4.0] - 2025-07-03

### Added
- Initial MCP server implementation
- Basic hosting package management
- Domain and DNS management
- Email account management
- MySQL database operations
- FTP user management

### Technical
- TypeScript implementation
- Axios-based API client
- Environment variable configuration
- Comprehensive error handling