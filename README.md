# 20i MCP Server 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![20i API](https://img.shields.io/badge/20i-API%20Integration-blue)](https://20i.com)

> **The first and only Model Context Protocol (MCP) server for 20i web hosting services** 

Transform your 20i hosting management experience with AI-powered administration. This groundbreaking MCP server enables natural language interactions with your 20i hosting infrastructure through Claude, ChatGPT, and other AI assistants.

## 🆕 What's New - Latest Update

**🎉 13 New Management Tools Added!** We've significantly expanded the capabilities with comprehensive hosting management features:

- **🌐 Subdomain Management**: Create, remove, and list subdomains with simple commands
- **🗄️ Database Operations**: Create MySQL databases and users for your applications  
- **📧 Email Account Creation**: Set up email accounts and forwarders directly
- **⚙️ PHP Version Control**: Get and set PHP versions for optimal compatibility
- **🚀 Application Installation**: Install WordPress, Joomla, and other applications instantly
- **📁 FTP & File Management**: Create FTP users and manage directory structures

**Now supporting 44 total tools** for complete hosting management through natural language!

## 🎯 Why This Matters

**For 20i Customers:**
- Manage hosting services through natural language conversations
- Reduce complex API interactions to simple chat commands
- Streamline domain, hosting, and DNS management workflows
- Enable non-technical users to perform advanced hosting operations

**For 20i:**
- First-to-market AI integration in the hosting industry
- Differentiate from competitors with cutting-edge AI capabilities
- Reduce support burden through self-service AI assistance
- Attract tech-savvy customers and developers

## ✨ Features

### 🏢 **Reseller Account Management**
- Real-time account overview and statistics
- Monitor usage, limits, and billing information
- Track performance metrics across your infrastructure

### 🌐 **Domain Management**
- List and search all domains in your portfolio
- Get detailed domain information and status
- Monitor expiration dates and renewal requirements
- Automated domain health checks

### 🖥️ **Hosting Package Administration**
- Create hosting packages with natural language descriptions
- Monitor hosting package performance and usage
- Scale resources based on demand
- Automated provisioning and deployment
- **NEW**: Create and manage subdomains for organized site structure
- **NEW**: Set PHP versions for optimal application compatibility
- **NEW**: Install applications like WordPress with one command

### ☁️ **Cloud Server Operations**
- Deploy cloud servers across multiple providers
- Monitor server health and performance
- Scale infrastructure based on requirements
- Automated backup and recovery operations

### 🔧 **DNS Management**
- View and modify DNS records through conversation
- Bulk DNS operations and migrations
- Automated DNS health monitoring
- Advanced DNS configuration management

### 📧 **Premium Email Services**
- Order and manage premium mailbox subscriptions
- Renew existing premium email services
- Generate single sign-on webmail URLs
- Monitor email service usage and billing

### 📮 **Email Configuration Management**
- Configure email settings for hosting packages
- Manage mailbox configurations and quotas
- Set up and modify email forwarding rules
- Monitor email infrastructure health
- **NEW**: Create email accounts directly through conversation
- **NEW**: Set up email forwarders with multiple destinations

### 🗃️ **Database Management**
- **NEW**: Create MySQL databases for applications
- **NEW**: Set up MySQL users with proper permissions
- List and monitor existing databases
- Manage database access and security

### 📁 **File and Access Management**
- **NEW**: Create FTP users for team access
- **NEW**: Manage directories (create/delete)
- **NEW**: Control file access permissions
- Monitor file usage and organization

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- 20i Reseller Account with API access
- Claude Desktop, VS Code with Claude, or other MCP-compatible AI assistant

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Cbrown35/20i-MCP.git
   cd 20i-MCP
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Configure your AI assistant:**
   
   Add to your `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "20i-hosting": {
         "command": "node",
         "args": ["/path/to/20i-MCP/build/index.js"],
         "cwd": "/path/to/20i-MCP",
         "env": {
           "TWENTYI_API_KEY": "your_general_api_key",
           "TWENTYI_OAUTH_KEY": "your_oauth_client_key", 
           "TWENTYI_COMBINED_KEY": "your_combined_api_key"
         }
       }
     }
   }
   ```

5. **Restart your AI assistant** and start managing your 20i services with natural language!

## 💬 Usage Examples

### 🌟 Power User Workflows (New!)

**Complete WordPress Site Setup**
```
"Create hosting package for myblog.com, then create a staging subdomain, install WordPress, create MySQL database 'blog_db' and user 'blog_admin', set PHP to 8.2, add SSL certificate, and create FTP user for my developer"
```

**Professional Email Setup**
```
"Create email accounts for support@, sales@, and info@ for mycompany.com, forward all to admin@mycompany.com, then create a premium mailbox for the CEO"
```

**Development Environment**
```
"Set up dev.mysite.com subdomain, install WordPress there, create separate MySQL database 'dev_db', set PHP 8.1, create FTP user 'developer' with access to /dev folder"
```

### Domain Management
```
"List all my domains that expire in the next 30 days"
"Show me DNS records for example.com"
"Add an A record pointing blog.example.com to 192.168.1.100"
```

### Hosting Operations
```
"Create a new hosting package for clientsite.com with WordPress optimization"
"Show me hosting packages using more than 80% of their resources" 
"What's the performance status of all my hosting packages?"
```

### Cloud Infrastructure
```
"Deploy a new cloud server in London with 4GB RAM for my development environment"
"Show me all cloud servers and their current resource usage"
"Scale up the production server to handle increased traffic"
```

### Account Monitoring
```
"Give me an overview of my 20i reseller account"
"What's my current API usage and remaining limits?"
"Show me this month's hosting statistics"
```

### Hosting Management Operations
```
"Create a new subdomain 'blog' for my website"
"Set up a MySQL database called 'ecommerce_data' for my store"
"Create an FTP user for my designer to upload files"
"Install WordPress in the '/blog' directory of my site"
```

### Database and Development
```
"Create MySQL database 'app_db' and user 'app_user' for my application"
"Upgrade PHP to version 8.2 for better performance"
"List all available applications I can install"
"Set up staging subdomain with separate FTP access"
```

### Email System Management  
```
"Create email account 'support@mysite.com' with secure password"
"Set up email forwarding from 'contact@' to my Gmail account"
"Order a premium mailbox for support@example.com"
"Generate a webmail login URL for user@example.com"
```

### Complete Workflow Examples
```
"Set up a complete WordPress site: create subdomain, install WordPress, create database, and add SSL"
"Prepare development environment: create staging subdomain, set PHP 8.2, create FTP user, install testing tools"
"Email system setup: create support@, sales@, and info@ accounts, then forward all to main inbox"
```

## 🛠️ Available Tools (44 Total)

### Core Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_reseller_info` | Account overview and statistics | Monitoring, reporting, billing analysis |
| `list_domains` | Domain portfolio management | Bulk operations, expiration tracking |
| `get_domain_info` | Detailed domain information | Troubleshooting, configuration review |
| `get_dns_records` | DNS configuration retrieval | Troubleshooting, migration planning |
| `update_dns_record` | DNS record management | Configuration changes, traffic routing |

### Hosting Package Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `list_hosting_packages` | Hosting inventory management | Resource planning, client management |
| `get_hosting_package_info` | Individual package details | Performance analysis, troubleshooting |
| `get_hosting_package_web_info` | Web-specific package details | Web hosting analysis, configuration |
| `get_hosting_package_limits` | Package quotas and limits | Resource monitoring, upgrade planning |
| `get_hosting_package_usage` | Usage statistics | Performance monitoring, billing analysis |
| `create_hosting_package` | Automated package creation | Client onboarding, rapid deployment |

### Database Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_mysql_databases` | List MySQL databases | Database management, backup planning |
| `get_mysql_users` | List MySQL users | User management, security auditing |
| `get_mssql_databases` | List MSSQL databases | Windows hosting database management |
| `create_mysql_database` | Create MySQL database | Database provisioning, application setup |
| `create_mysql_user` | Create MySQL user | Database access management, security |

### SSL Certificate Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_ssl_certificates` | View SSL certificates | Security monitoring, renewal tracking |
| `add_free_ssl` | Add free SSL certificates | Security automation, HTTPS setup |
| `get_force_ssl` | Check Force HTTPS status | Security auditing, configuration review |
| `set_force_ssl` | Enable/disable Force HTTPS | Security management, site configuration |

### Statistics & Monitoring
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_bandwidth_stats` | Bandwidth usage statistics | Performance monitoring, cost analysis |
| `get_disk_usage` | Disk usage reporting | Storage monitoring, cleanup planning |
| `get_access_logs` | Web server access logs | Traffic analysis, troubleshooting |

### Cloud Infrastructure
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `list_cloud_servers` | Cloud infrastructure overview | Capacity planning, cost optimization |
| `create_cloud_server` | On-demand server provisioning | Scaling, development environments |
| `list_vps` | List VPS servers | Infrastructure management, monitoring |
| `get_vps_info` | VPS server details | Performance analysis, troubleshooting |
| `list_managed_vps` | List managed VPS servers | Managed infrastructure overview |
| `get_managed_vps_info` | Managed VPS details | Managed service monitoring |

### Premium Email Services
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `order_premium_mailbox` | Order premium email services | Premium email sales, client onboarding |
| `renew_premium_mailbox` | Renew premium email subscriptions | Service renewals, billing management |
| `get_email_configuration` | Email domain configuration | Email troubleshooting, setup verification |
| `get_mailbox_configuration` | Mailbox settings and quotas | Account management, usage monitoring |
| `get_email_forwarders` | Email forwarding rules | Email routing, configuration review |
| `get_all_email_forwarders` | All package email forwarders | Bulk management, migration planning |
| `generate_webmail_url` | Single sign-on webmail access | Customer support, easy access provision |
| `create_email_account` | Create email accounts | Email provisioning, user onboarding |
| `create_email_forwarder` | Create email forwarders | Email routing automation, workflow setup |

### Subdomain Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `create_subdomain` | Create subdomains | Site organization, service deployment |
| `remove_subdomain` | Remove subdomains | Cleanup, site restructuring |
| `list_subdomains` | List all subdomains | Inventory management, organization |

### PHP and Application Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_php_versions` | List available PHP versions | Compatibility planning, upgrades |
| `set_php_version` | Set PHP version | Performance optimization, compatibility |
| `list_applications` | List installable applications | Application deployment, site setup |
| `install_application` | Install applications | Automated deployment, rapid setup |

### FTP and File Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `create_ftp_user` | Create FTP users | Access management, team collaboration |
| `list_ftp_users` | List FTP users | Security auditing, access review |
| `manage_directories` | Create/delete directories | File organization, site structure |

## 🏗️ Architecture

- **TypeScript**: Type-safe, maintainable codebase
- **MCP Protocol**: Standards-compliant AI assistant integration
- **RESTful API**: Clean integration with 20i's API infrastructure
- **Environment-based Configuration**: Secure credential management
- **Error Handling**: Comprehensive error reporting and recovery
- **Modular Design**: Easy to extend and customize

## 🔒 Security

- Environment variable credential storage
- No sensitive data in code or logs
- Secure API token handling
- Rate limiting and error recovery
- Input validation and sanitization

## 🤝 Contributing

We welcome contributions! This project represents the cutting edge of AI-powered hosting management.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Recognition

This is the **first Model Context Protocol server for 20i hosting services**, pioneering AI-powered hosting management. If you're from 20i and interested in this integration, we'd love to discuss how this can benefit your customers and business.

## 📞 Contact

- **GitHub**: [@Cbrown35](https://github.com/Cbrown35)
- **Project**: [20i-MCP](https://github.com/Cbrown35/20i-MCP)

---

*Built with ❤️ for the 20i community. Empowering hosting management through AI.*