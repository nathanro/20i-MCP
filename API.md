# 20i MCP Server API Documentation

This document provides comprehensive documentation for all MCP tools provided by the 20i MCP Server.

## Authentication

The server authenticates with the 20i API using environment variables:
- `TWENTYI_API_KEY`: Your general API key
- `TWENTYI_OAUTH_KEY`: Your OAuth client key  
- `TWENTYI_COMBINED_KEY`: Your combined API key

## Available Tools

### Account Management

#### `get_reseller_info`
Retrieves comprehensive reseller account information.

**Parameters:** None

**Returns:** JSON object containing:
- Account details and limits
- Usage statistics
- Billing information
- API usage metrics

**Example Usage:**
```
"Show me my 20i account overview"
"What are my current account limits?"
"Display my reseller account statistics"
```

### Domain Management

#### `list_domains`
Lists all domains in your reseller account.

**Parameters:** None

**Returns:** Array of domain objects with:
- Domain names
- Status information
- Expiration dates
- Configuration details

**Example Usage:**
```
"List all my domains"
"Show me domains expiring this month"
"What domains do I manage?"
```

#### `get_domain_info`
Retrieves detailed information for a specific domain.

**Parameters:**
- `domain_id` (string, required): The domain ID to query

**Returns:** Detailed domain object containing:
- Domain configuration
- DNS settings
- Security settings
- Performance metrics

**Example Usage:**
```
"Get details for domain ID 12345"
"Show me configuration for example.com"
```

#### `get_dns_records`
Retrieves DNS records for a specific domain.

**Parameters:**
- `domain_id` (string, required): The domain ID to query

**Returns:** Array of DNS records with:
- Record types (A, AAAA, CNAME, MX, TXT, etc.)
- Record names and values
- TTL settings

**Example Usage:**
```
"Show DNS records for example.com"
"List all A records for my domain"
"What are the MX records for domain ID 12345?"
```

#### `update_dns_record`
Adds or updates DNS records for a domain.

**Parameters:**
- `domain_id` (string, required): The domain ID to update
- `record_type` (string, required): DNS record type (A, AAAA, CNAME, MX, TXT, etc.)
- `name` (string, required): DNS record name/subdomain
- `value` (string, required): DNS record value
- `ttl` (number, optional): Time to live (default: 3600)

**Returns:** Confirmation of DNS record creation/update

**Example Usage:**
```
"Add an A record for blog.example.com pointing to 192.168.1.100"
"Update the CNAME record for www to point to example.com"
"Set the MX record for mail.example.com with priority 10"
```

### Hosting Package Management

#### `list_hosting_packages`
Lists all hosting packages in your reseller account.

**Parameters:** None

**Returns:** Array of hosting package objects with:
- Package names and types
- Resource usage and limits
- Status information
- Performance metrics

**Example Usage:**
```
"List all my hosting packages"
"Show hosting packages using over 80% resources"
"What WordPress hosting packages do I have?"
```

#### `get_hosting_package_info`
Retrieves detailed information for a specific hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to query

**Returns:** Detailed package object containing:
- Resource usage and limits
- Configuration settings
- Performance metrics
- Security status

**Example Usage:**
```
"Get details for hosting package 67890"
"Show performance metrics for my main hosting package"
```

#### `create_hosting_package`
Creates a new hosting package with specified configuration.

**Parameters:**
- `domain_name` (string, required): Domain name for the hosting package
- `package_type` (string, required): Type of hosting package (e.g., "shared", "reseller")
- `username` (string, required): Username for the hosting account
- `password` (string, required): Password for the hosting account

**Returns:** New hosting package details and configuration

**Example Usage:**
```
"Create a WordPress hosting package for newclient.com"
"Set up shared hosting for example.org with username 'example_user'"
```

### Cloud Server Management

#### `list_cloud_servers`
Lists all cloud servers in your reseller account.

**Parameters:** None

**Returns:** Array of cloud server objects with:
- Server names and IDs
- Resource specifications
- Status and health information
- Performance metrics

**Example Usage:**
```
"List all my cloud servers"
"Show cloud servers in the London region"
"What's the status of my production servers?"
```

#### `create_cloud_server`
Creates a new cloud server with specified configuration.

**Parameters:**
- `provider` (string, required): Cloud provider (e.g., "aws", "digitalocean")
- `size` (string, required): Server size/specification
- `location` (string, required): Server location/region
- `name` (string, required): Name for the cloud server

**Returns:** New cloud server details and configuration

**Example Usage:**
```
"Create a 4GB cloud server in London for development"
"Deploy a production server on AWS in the US East region"
"Set up a staging server with 2GB RAM in Germany"
```

## Error Handling

All tools implement comprehensive error handling:

- **Authentication Errors**: Invalid or expired API credentials
- **Rate Limiting**: API request limits exceeded
- **Validation Errors**: Invalid parameters or missing required fields
- **Network Errors**: Connection issues with 20i API
- **Server Errors**: Internal server errors from 20i

Error responses include:
- Clear error messages
- Suggested resolution steps
- Relevant error codes
- Context information

## Rate Limits

The server respects 20i API rate limits:
- Automatic retry with exponential backoff
- Request queuing for high-volume operations
- Rate limit status monitoring

## Security Features

- Secure credential handling via environment variables
- Input validation and sanitization
- No logging of sensitive information
- Encrypted API communications
- Token refresh handling

## Integration Examples

### Claude Desktop Integration
```json
{
  "mcpServers": {
    "20i-hosting": {
      "command": "node",
      "args": ["/path/to/20i-MCP/build/index.js"],
      "cwd": "/path/to/20i-MCP",
      "env": {
        "TWENTYI_API_KEY": "your_api_key",
        "TWENTYI_OAUTH_KEY": "your_oauth_key",
        "TWENTYI_COMBINED_KEY": "your_combined_key"
      }
    }
  }
}
```

### VS Code Integration
Configure in your VS Code settings or workspace configuration following the same pattern as Claude Desktop.

## Advanced Usage

### Batch Operations
Many tools can be used in sequence for batch operations:

```
"List all domains, then show DNS records for each domain expiring in 30 days"
"Create hosting packages for these three domains: site1.com, site2.com, site3.com"
```

### Monitoring and Alerting
Use tools for proactive monitoring:

```
"Check resource usage across all hosting packages and alert if any exceed 90%"
"Monitor DNS propagation for recently updated records"
```

### Automation Workflows
Chain tools together for complex workflows:

```
"Create a hosting package for newsite.com, then set up DNS records pointing to the server"
"Deploy a cloud server, create a hosting package, and configure the domain"
```

## Support and Troubleshooting

For issues with the MCP server:
1. Check authentication credentials
2. Verify 20i API access and permissions
3. Review server logs for detailed error information
4. Consult the troubleshooting section in README.md

For 20i API-specific issues:
- Consult the official 20i API documentation
- Contact 20i support for account-related issues
- Check API status and maintenance notifications

### Premium Email Services

#### `order_premium_mailbox`
Orders a premium mailbox service from 20i.

**Parameters:**
- `mailbox_id` (string, required): The mailbox ID (e.g., "m11111")
- `local` (string, required): The local part before @ symbol
- `domain` (string, required): The domain part after @ symbol
- `for_user` (string, optional): Optional user to assign mailbox to

**Returns:** Order confirmation and mailbox details

**Example Usage:**
```
"Order a premium mailbox for support@example.com"
"Set up premium email for admin@clientsite.com"
"Create a premium mailbox m12345 for sales@newdomain.com"
```

#### `renew_premium_mailbox`
Renews an existing premium mailbox subscription.

**Parameters:**
- `id` (string, required): The premium mailbox ID to renew

**Returns:** Renewal confirmation and updated subscription details

**Example Usage:**
```
"Renew premium mailbox subscription for ID pm67890"
"Extend the premium email service for admin@example.com"
```

#### `generate_webmail_url`
Generates a single sign-on URL for webmail access.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID
- `mailbox_id` (string, required): The mailbox ID

**Returns:** Single sign-on webmail URL

**Example Usage:**
```
"Generate webmail login for user@example.com"
"Create SSO webmail link for support mailbox"
```

### Email Configuration Management

#### `get_email_configuration`
Retrieves email configuration for a domain in a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** Email domain configuration including:
- Domain settings
- MX records configuration
- Email routing settings
- Security settings

**Example Usage:**
```
"Show email configuration for example.com"
"Get email settings for package w12345 and domain d67890"
```

#### `get_mailbox_configuration`
Retrieves mailbox configuration and settings.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** Mailbox configuration including:
- Mailbox quotas and limits
- User account settings
- Storage usage
- Security preferences

**Example Usage:**
```
"Show mailbox settings for example.com"
"Get mailbox quotas for all users on clientsite.com"
```

#### `get_email_forwarders`
Retrieves email forwarders for a specific email domain.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** Array of email forwarders with:
- Source email addresses
- Destination addresses
- Forwarding rules
- Status information

**Example Usage:**
```
"List email forwarders for example.com"
"Show forwarding rules for support@clientsite.com"
```

#### `get_all_email_forwarders`
Retrieves all email forwarders for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Complete list of all email forwarders across all domains in the package

**Example Usage:**
```
"Show all email forwarders for hosting package w12345"
"List every email forwarding rule in my hosting account"
```

### Database Management

#### `get_mysql_databases`
Retrieves MySQL databases for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of MySQL databases with configuration details

**Example Usage:**
```
"Show MySQL databases for package w12345"
"List all databases for my hosting package"
```

#### `get_mysql_users`
Retrieves MySQL users for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of MySQL users and their permissions

**Example Usage:**
```
"Show MySQL users for package w12345"
"List database users and their access levels"
```

#### `get_mssql_databases`
Retrieves MSSQL databases for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of MSSQL databases with configuration details

**Example Usage:**
```
"Show MSSQL databases for Windows hosting package"
"List SQL Server databases for package w12345"
```

### SSL Certificate Management

#### `get_ssl_certificates`
Retrieves SSL certificates for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of SSL certificates with status and expiration information

**Example Usage:**
```
"Show SSL certificates for package w12345"
"Check SSL certificate status for my domains"
```

#### `add_free_ssl`
Adds free SSL certificates for specified domains.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `domains` (array, required): Array of domain names for SSL certificate

**Returns:** SSL certificate creation confirmation

**Example Usage:**
```
"Add free SSL for example.com and www.example.com"
"Enable SSL certificates for my domains"
```

#### `get_force_ssl`
Gets Force HTTPS/SSL status for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Force HTTPS configuration status

**Example Usage:**
```
"Check if Force HTTPS is enabled for package w12345"
"Show SSL redirect settings for my hosting package"
```

#### `set_force_ssl`
Enables or disables Force HTTPS/SSL for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `enabled` (boolean, required): Whether to enable or disable Force HTTPS

**Returns:** Force HTTPS configuration update confirmation

**Example Usage:**
```
"Enable Force HTTPS for package w12345"
"Disable SSL redirect for my hosting package"
```

### Statistics and Monitoring

#### `get_bandwidth_stats`
Retrieves bandwidth statistics for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Bandwidth usage statistics and historical data

**Example Usage:**
```
"Show bandwidth usage for package w12345"
"Get traffic statistics for my hosting package"
```

#### `get_disk_usage`
Retrieves disk usage statistics for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Disk usage breakdown and storage statistics

**Example Usage:**
```
"Show disk usage for package w12345"
"Check storage consumption for my hosting package"
```

#### `get_access_logs`
Retrieves access logs for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Web server access logs and traffic data

**Example Usage:**
```
"Show access logs for package w12345"
"Get visitor logs for my hosting package"
```

### VPS Management

#### `list_vps`
Lists all VPS servers in your account.

**Parameters:** None

**Returns:** Array of VPS servers with status and configuration

**Example Usage:**
```
"List all my VPS servers"
"Show VPS infrastructure overview"
```

#### `get_vps_info`
Retrieves detailed information for a specific VPS server.

**Parameters:**
- `vps_id` (string, required): The VPS ID to query

**Returns:** Detailed VPS configuration and status information

**Example Usage:**
```
"Get details for VPS server vps123"
"Show configuration for my production VPS"
```

#### `list_managed_vps`
Lists all managed VPS servers in your account.

**Parameters:** None

**Returns:** Array of managed VPS servers with management status

**Example Usage:**
```
"List all my managed VPS servers"
"Show managed infrastructure overview"
```

#### `get_managed_vps_info`
Retrieves detailed information for a specific managed VPS server.

**Parameters:**
- `managed_vps_id` (string, required): The managed VPS ID to query

**Returns:** Detailed managed VPS configuration and management status

**Example Usage:**
```
"Get details for managed VPS mvps456"
"Show management status for my VPS server"
```

### Enhanced Hosting Package Tools

#### `get_hosting_package_web_info`
Retrieves web-specific hosting package information.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Web hosting specific configuration and settings

**Example Usage:**
```
"Get web hosting details for package w12345"
"Show web server configuration for my hosting package"
```

#### `get_hosting_package_limits`
Retrieves hosting package limits and quotas.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Package limits, quotas, and resource restrictions

**Example Usage:**
```
"Show resource limits for package w12345"
"Check quotas and restrictions for my hosting package"
```

#### `get_hosting_package_usage`
Retrieves hosting package usage statistics.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Current usage statistics and resource consumption

**Example Usage:**
```
"Show usage statistics for package w12345"
"Check resource consumption for my hosting package"
```

### Subdomain Management

#### `create_subdomain`
Creates a subdomain for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `subdomain` (string, required): The subdomain name to create

**Returns:** Subdomain creation confirmation with configuration details

**Example Usage:**
```
"Create subdomain 'blog' for package w12345"
"Add subdomain 'shop.mysite' to my hosting package"
"Set up subdomain 'api' for my application"
```

#### `remove_subdomain`
Removes a subdomain from a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `subdomain` (string, required): The subdomain name to remove

**Returns:** Subdomain removal confirmation

**Example Usage:**
```
"Remove subdomain 'old-blog' from package w12345"
"Delete the 'test' subdomain from my hosting package"
```

#### `list_subdomains`
Lists all subdomains for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of subdomains with configuration details

**Example Usage:**
```
"List all subdomains for package w12345"
"Show me all subdomains for my hosting account"
```

### Enhanced MySQL Management

#### `create_mysql_database`
Creates a MySQL database for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `name` (string, required): The database name

**Returns:** Database creation confirmation with connection details

**Example Usage:**
```
"Create MySQL database 'blog_db' for package w12345"
"Add database 'ecommerce' to my hosting package"
"Set up database 'analytics_data' for my application"
```

#### `create_mysql_user`
Creates a MySQL user for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `username` (string, required): The username for the MySQL user
- `password` (string, required): The password for the MySQL user

**Returns:** MySQL user creation confirmation with access details

**Example Usage:**
```
"Create MySQL user 'blog_user' with password 'secure123' for package w12345"
"Add database user 'app_reader' for my hosting package"
```

### Enhanced Email Management

#### `create_email_account`
Creates an email account for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email` (string, required): The email address to create
- `password` (string, required): The password for the email account

**Returns:** Email account creation confirmation with configuration details

**Example Usage:**
```
"Create email account 'support@example.com' for package w12345"
"Add email 'sales@mysite.com' with password 'securePass123'"
"Set up email account 'info@clientsite.org'"
```

#### `create_email_forwarder`
Creates an email forwarder for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `source` (string, required): The source email address
- `destinations` (array, required): Array of destination email addresses

**Returns:** Email forwarder creation confirmation

**Example Usage:**
```
"Forward emails from 'contact@example.com' to 'support@company.com'"
"Create forwarder from 'sales@mysite.com' to multiple addresses"
"Set up email forwarding from 'info@site.com' to Gmail"
```

### PHP Version Management

#### `get_php_versions`
Gets available PHP versions for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of available PHP versions with compatibility information

**Example Usage:**
```
"Show available PHP versions for package w12345"
"What PHP versions can I use for my hosting package?"
"List supported PHP versions for my website"
```

#### `set_php_version`
Sets the PHP version for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `version` (string, required): The PHP version to set (e.g., "8.1", "8.2")

**Returns:** PHP version update confirmation

**Example Usage:**
```
"Set PHP version to 8.2 for package w12345"
"Upgrade PHP to version 8.1 for my hosting package"
"Change PHP version to 7.4 for compatibility"
```

### Application Management

#### `list_applications`
Lists available applications for installation.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of available applications with installation options

**Example Usage:**
```
"Show available applications for package w12345"
"What applications can I install on my hosting package?"
"List one-click install options for WordPress and others"
```

#### `install_application`
Installs an application on a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `application_id` (string, required): The application ID to install
- `path` (string, required): The installation path
- `config` (object, optional): Optional configuration parameters for the application

**Returns:** Application installation confirmation with access details

**Example Usage:**
```
"Install WordPress at '/blog' for package w12345"
"Set up Joomla in the root directory of my hosting package"
"Install Drupal at '/cms' with custom database settings"
```

### FTP and Directory Management

#### `create_ftp_user`
Creates an FTP user for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `username` (string, required): The FTP username
- `password` (string, required): The FTP password
- `path` (string, optional): The FTP access path (defaults to root)

**Returns:** FTP user creation confirmation with connection details

**Example Usage:**
```
"Create FTP user 'client_ftp' for package w12345"
"Add FTP user 'designer' with access to '/public_html/design'"
"Set up FTP account 'backup_user' for my hosting package"
```

#### `list_ftp_users`
Lists all FTP users for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of FTP users with access permissions and paths

**Example Usage:**
```
"List all FTP users for package w12345"
"Show FTP accounts for my hosting package"
"Display FTP user permissions and access levels"
```

#### `manage_directories`
Creates or deletes directories in a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `action` (string, required): The action to perform ('create' or 'delete')
- `path` (string, required): The directory path

**Returns:** Directory operation confirmation

**Example Usage:**
```
"Create directory '/public_html/uploads' for package w12345"
"Delete directory '/old_backups' from my hosting package"
"Make new folder '/assets/images' in my web directory"
```

## Real-World Usage Examples

### Complete Website Setup
```
"Create hosting package for newclient.com, then set up WordPress, create MySQL database, and add SSL certificate"
```

### Email System Setup
```
"Create email accounts for support@, sales@, and info@ for my domain, then set up forwarding to my Gmail"
```

### Development Environment
```
"Set PHP version to 8.2, create staging subdomain, install WordPress, and create FTP user for developer access"
```

### Site Migration
```
"Create MySQL database and user, set up FTP access, create subdomain for testing, then install application"
```

### Security Hardening
```
"Enable Force HTTPS, add free SSL certificates, check current PHP version, and review FTP user permissions"
```

---

*This API documentation is continuously updated to reflect new features and improvements.*