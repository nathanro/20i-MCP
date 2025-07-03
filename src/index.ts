#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ApiCredentials {
  apiKey: string;
  oauthKey: string;
  combinedKey: string;
}

class TwentyIClient {
  private apiClient: AxiosInstance;
  private credentials: ApiCredentials;

  constructor() {
    this.credentials = this.loadCredentials();
    this.apiClient = axios.create({
      baseURL: 'https://api.20i.com',
      headers: {
        'Authorization': `Bearer ${Buffer.from(this.credentials.apiKey).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    // Add response interceptor for better error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  private loadCredentials(): ApiCredentials {
    // Try environment variables first
    if (process.env.TWENTYI_API_KEY && process.env.TWENTYI_OAUTH_KEY && process.env.TWENTYI_COMBINED_KEY) {
      return {
        apiKey: process.env.TWENTYI_API_KEY,
        oauthKey: process.env.TWENTYI_OAUTH_KEY,
        combinedKey: process.env.TWENTYI_COMBINED_KEY,
      };
    }

    // Fallback to ignor.txt file
    try {
      const credentialsPath = join(process.cwd(), 'ignor.txt');
      const content = readFileSync(credentialsPath, 'utf-8');
      
      const apiKeyMatch = content.match(/Your general API key is:\s*([a-zA-Z0-9]+)/);
      const oauthKeyMatch = content.match(/Your OAuth client key is:\s*([a-zA-Z0-9]+)/);
      const combinedKeyMatch = content.match(/Your combined API key is:\s*([a-zA-Z0-9+]+)/);

      if (!apiKeyMatch || !oauthKeyMatch || !combinedKeyMatch) {
        throw new Error('Could not parse API credentials from ignor.txt');
      }

      return {
        apiKey: apiKeyMatch[1],
        oauthKey: oauthKeyMatch[1],
        combinedKey: combinedKeyMatch[1],
      };
    } catch (error) {
      throw new Error(`Failed to load credentials from environment variables or ignor.txt file: ${error}`);
    }
  }

  async getResellerInfo() {
    // Fetches reseller account information including unique reseller ID
    // Never hardcode reseller IDs - each account has a different one
    const response = await this.apiClient.get('/reseller');
    return response.data;
  }

  async getAccountBalance() {
    // Fetches account balance and billing information
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/accountBalance`);
    return response.data;
  }

  async listDomains() {
    // Use the domain endpoint (not under reseller)
    const response = await this.apiClient.get('/domain');
    return response.data;
  }

  async getDomainInfo(domainId: string) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/domain/${domainId}`);
    return response.data;
  }

  async listHostingPackages() {
    // Use the correct package endpoint to list all packages
    const response = await this.apiClient.get('/package');
    return response.data;
  }

  async getHostingPackageInfo(packageId: string) {
    // Use the correct package endpoint for package information
    const response = await this.apiClient.get(`/package/${packageId}`);
    return response.data;
  }

  async getHostingPackageWebInfo(packageId: string) {
    // Get web-specific package information
    const response = await this.apiClient.get(`/package/${packageId}/web`);
    return response.data;
  }

  async getHostingPackageLimits(packageId: string) {
    // Get package limits and quotas
    const response = await this.apiClient.get(`/package/${packageId}/limits`);
    return response.data;
  }

  async getHostingPackageUsage(packageId: string) {
    // Get package usage statistics
    const response = await this.apiClient.get(`/package/${packageId}/web/usage`);
    return response.data;
  }

  async createHostingPackage(data: any) {
    // Use the correct reseller endpoint for adding web packages
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addWeb`, data);
    return response.data;
  }

  async listCloudServers() {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/cloudServer`);
    return response.data;
  }

  async createCloudServer(data: any) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addCloudServer`, data);
    return response.data;
  }

  async getDnsRecords(domainId: string) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/domain/${domainId}/dns`);
    return response.data;
  }

  async updateDnsRecord(domainId: string, recordData: any) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/domain/${domainId}/dns`, recordData);
    return response.data;
  }

  async registerDomain(domainData: {
    name: string;
    years: number;
    contact: {
      organisation?: string;
      name: string;
      address: string;
      telephone: string;
      email: string;
      cc: string;
      pc: string;
      sp: string;
      city: string;
    };
    privacyService?: boolean;
    nameservers?: string[];
    stackUser?: string;
  }) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addDomain`, domainData);
    return response.data;
  }

  // Premium Email Management Methods
  async orderPremiumMailbox(configuration: any, forUser?: string) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addPremiumMailbox`, {
      configuration,
      forUser
    });
    return response.data;
  }

  async renewPremiumMailbox(id: string) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/renewPremiumMailbox`, {
      id
    });
    return response.data;
  }

  // Package Email Management Methods
  async getEmailConfiguration(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}`);
    return response.data;
  }

  async updateEmailConfiguration(packageId: string, emailId: string, config: any) {
    const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}`, config);
    return response.data;
  }

  async getMailboxConfiguration(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/mailbox`);
    return response.data;
  }

  async getEmailForwarders(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/forwarder`);
    return response.data;
  }

  async getAllEmailForwarders(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/allMailForwarders`);
    return response.data;
  }

  async generateWebmailUrl(packageId: string, emailId: string, mailboxId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}/webmail`, {
      id: mailboxId
    });
    return response.data;
  }

  // MySQL Database Management Methods
  async getMysqlDatabases(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/mysqlDatabases`);
    return response.data;
  }

  async getMysqlUsers(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/mysqlUsers`);
    return response.data;
  }

  // MSSQL Database Management Methods
  async getMssqlDatabases(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/mssqlDatabases`);
    return response.data;
  }

  // SSL Certificate Management Methods
  async getSslCertificates(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/certificates`);
    return response.data;
  }

  async addFreeSSL(packageId: string, domains: string[]) {
    const response = await this.apiClient.post(`/package/${packageId}/web/freeSSL`, {
      domains
    });
    return response.data;
  }

  async getForceSSL(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/forceSSL`);
    return response.data;
  }

  async setForceSSL(packageId: string, enabled: boolean) {
    const response = await this.apiClient.post(`/package/${packageId}/web/forceSSL`, {
      enabled
    });
    return response.data;
  }

  // Bandwidth and Statistics Methods
  async getBandwidthStats(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/bandwidthStats`);
    return response.data;
  }

  async getDiskUsage(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/diskUsage`);
    return response.data;
  }

  async getAccessLogs(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/logs`);
    return response.data;
  }

  // VPS Management Methods
  async listVPS() {
    const response = await this.apiClient.get('/vps');
    return response.data;
  }

  async getVPSInfo(vpsId: string) {
    const response = await this.apiClient.get(`/vps/${vpsId}`);
    return response.data;
  }

  async listManagedVPS() {
    const response = await this.apiClient.get('/managed_vps');
    return response.data;
  }

  async getManagedVPSInfo(managedVpsId: string) {
    const response = await this.apiClient.get(`/managed_vps/${managedVpsId}`);
    return response.data;
  }

  // Subdomain Management Methods
  async createSubdomain(packageId: string, subdomain: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/subdomains`, {
      name: subdomain
    });
    return response.data;
  }

  async removeSubdomain(packageId: string, subdomain: string) {
    const response = await this.apiClient.delete(`/package/${packageId}/web/subdomains/${subdomain}`);
    return response.data;
  }

  async listSubdomains(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/subdomains`);
    return response.data;
  }

  // MySQL Management Methods
  async createMysqlDatabase(packageId: string, name: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/mysqlDatabases`, {
      name
    });
    return response.data;
  }

  async createMysqlUser(packageId: string, username: string, password: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/mysqlUsers`, {
      username,
      password
    });
    return response.data;
  }

  // Email Management Methods  
  async createEmailAccount(packageId: string, email: string, password: string) {
    // Split email into local and domain parts
    const [local, domain] = email.split('@');
    const response = await this.apiClient.post(`/package/${packageId}/email`, {
      local,
      domain,
      password
    });
    return response.data;
  }

  async createEmailForwarder(packageId: string, source: string, destinations: string[]) {
    const [local, domain] = source.split('@');
    const response = await this.apiClient.post(`/package/${packageId}/email/forwarder`, {
      local,
      domain,
      destinations
    });
    return response.data;
  }

  // PHP Management Methods
  async getPhpVersions(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/phpVersion`);
    return response.data;
  }

  async setPhpVersion(packageId: string, version: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/phpVersion`, {
      version
    });
    return response.data;
  }

  // Application Management Methods
  async listApplications(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/applications`);
    return response.data;
  }

  async installApplication(packageId: string, applicationId: string, path: string, config?: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/applications`, {
      applicationId,
      path,
      ...config
    });
    return response.data;
  }

  // FTP Management Methods
  async createFtpUser(packageId: string, username: string, password: string, path?: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/ftp`, {
      username,
      password,
      path: path || '/'
    });
    return response.data;
  }

  async listFtpUsers(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/ftp`);
    return response.data;
  }

  async manageDirectories(packageId: string, action: 'create' | 'delete', path: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/directories`, {
      action,
      path
    });
    return response.data;
  }

}

const server = new Server(
  {
    name: '20i-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const twentyIClient = new TwentyIClient();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_reseller_info',
        description: 'Get reseller account information and overview',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_account_balance',
        description: 'Get account balance and billing information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_domains',
        description: 'List all domains in the reseller account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_domain_info',
        description: 'Get detailed information about a specific domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain_id: {
              type: 'string',
              description: 'The domain ID to get information for',
            },
          },
          required: ['domain_id'],
        },
      },
      {
        name: 'list_hosting_packages',
        description: 'List all hosting packages in the reseller account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_hosting_package_info',
        description: 'Get detailed information about a specific hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get information for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'create_hosting_package',
        description: 'Create a new hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            domain_name: {
              type: 'string',
              description: 'Domain name for the hosting package',
            },
            package_type: {
              type: 'string',
              description: 'Type of hosting package (e.g., "shared", "reseller")',
            },
            username: {
              type: 'string',
              description: 'Username for the hosting account',
            },
            password: {
              type: 'string',
              description: 'Password for the hosting account',
            },
          },
          required: ['domain_name', 'package_type', 'username', 'password'],
        },
      },
      {
        name: 'get_hosting_package_web_info',
        description: 'Get web-specific hosting package information',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get web information for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_hosting_package_limits',
        description: 'Get hosting package limits and quotas',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get limits for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_hosting_package_usage',
        description: 'Get hosting package usage statistics',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get usage statistics for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'list_cloud_servers',
        description: 'List all cloud servers in the reseller account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_cloud_server',
        description: 'Create a new cloud server',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              description: 'Cloud provider (e.g., "aws", "digitalocean")',
            },
            size: {
              type: 'string',
              description: 'Server size/specification',
            },
            location: {
              type: 'string',
              description: 'Server location/region',
            },
            name: {
              type: 'string',
              description: 'Name for the cloud server',
            },
          },
          required: ['provider', 'size', 'location', 'name'],
        },
      },
      {
        name: 'get_dns_records',
        description: 'Get DNS records for a specific domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain_id: {
              type: 'string',
              description: 'The domain ID to get DNS records for',
            },
          },
          required: ['domain_id'],
        },
      },
      {
        name: 'update_dns_record',
        description: 'Add or update DNS records for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain_id: {
              type: 'string',
              description: 'The domain ID to update DNS records for',
            },
            record_type: {
              type: 'string',
              description: 'DNS record type (A, AAAA, CNAME, MX, TXT, etc.)',
            },
            name: {
              type: 'string',
              description: 'DNS record name/subdomain',
            },
            value: {
              type: 'string',
              description: 'DNS record value',
            },
            ttl: {
              type: 'number',
              description: 'Time to live (TTL) for the DNS record',
              default: 3600,
            },
          },
          required: ['domain_id', 'record_type', 'name', 'value'],
        },
      },
      {
        name: 'register_domain',
        description: 'Register a new domain name',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Domain name to register (e.g., example.com)',
            },
            years: {
              type: 'number',
              description: 'Number of years to register for',
              default: 1,
            },
            contact: {
              type: 'object',
              description: 'Contact information for domain registration',
              properties: {
                name: {
                  type: 'string',
                  description: 'Contact person name',
                },
                organisation: {
                  type: 'string',
                  description: 'Organisation name (optional)',
                },
                address: {
                  type: 'string',
                  description: 'Street address',
                },
                city: {
                  type: 'string',
                  description: 'City',
                },
                sp: {
                  type: 'string',
                  description: 'State/Province',
                },
                pc: {
                  type: 'string',
                  description: 'Postal code',
                },
                cc: {
                  type: 'string',
                  description: 'Country code (e.g., GB, US)',
                },
                telephone: {
                  type: 'string',
                  description: 'Phone number',
                },
                email: {
                  type: 'string',
                  description: 'Email address',
                },
              },
              required: ['name', 'address', 'city', 'sp', 'pc', 'cc', 'telephone', 'email'],
            },
            privacy_service: {
              type: 'boolean',
              description: 'Enable domain privacy protection',
              default: false,
            },
            nameservers: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Custom nameservers (optional, defaults to 20i nameservers)',
            },
            stack_user: {
              type: 'string',
              description: 'Stack user to grant access to (optional)',
            },
          },
          required: ['name', 'years', 'contact'],
        },
      },
      {
        name: 'order_premium_mailbox',
        description: 'Order a premium mailbox service',
        inputSchema: {
          type: 'object',
          properties: {
            mailbox_id: {
              type: 'string',
              description: 'The mailbox ID (e.g., "m11111")',
            },
            local: {
              type: 'string',
              description: 'The local part before @ symbol',
            },
            domain: {
              type: 'string',
              description: 'The domain part after @ symbol',
            },
            for_user: {
              type: 'string',
              description: 'Optional user to assign mailbox to',
            },
          },
          required: ['mailbox_id', 'local', 'domain'],
        },
      },
      {
        name: 'renew_premium_mailbox',
        description: 'Renew a premium mailbox subscription',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The premium mailbox ID to renew',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_email_configuration',
        description: 'Get email configuration for a domain in a package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_mailbox_configuration',
        description: 'Get mailbox configuration for an email domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_email_forwarders',
        description: 'Get email forwarders for a specific email domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_all_email_forwarders',
        description: 'Get all email forwarders for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'generate_webmail_url',
        description: 'Generate a webmail single sign-on URL',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
            mailbox_id: {
              type: 'string',
              description: 'The mailbox ID',
            },
          },
          required: ['package_id', 'email_id', 'mailbox_id'],
        },
      },
      {
        name: 'get_mysql_databases',
        description: 'Get MySQL databases for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_mysql_users',
        description: 'Get MySQL users for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_mssql_databases',
        description: 'Get MSSQL databases for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_ssl_certificates',
        description: 'Get SSL certificates for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'add_free_ssl',
        description: 'Add free SSL certificate for domains',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domains: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of domain names for SSL certificate',
            },
          },
          required: ['package_id', 'domains'],
        },
      },
      {
        name: 'get_force_ssl',
        description: 'Get Force HTTPS/SSL status for a package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_force_ssl',
        description: 'Enable or disable Force HTTPS/SSL for a package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable or disable Force HTTPS',
            },
          },
          required: ['package_id', 'enabled'],
        },
      },
      {
        name: 'get_bandwidth_stats',
        description: 'Get bandwidth statistics for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_disk_usage',
        description: 'Get disk usage statistics for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_access_logs',
        description: 'Get access logs for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'list_vps',
        description: 'List all VPS servers',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_vps_info',
        description: 'Get detailed information about a VPS server',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get information for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'list_managed_vps',
        description: 'List all managed VPS servers',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_managed_vps_info',
        description: 'Get detailed information about a managed VPS server',
        inputSchema: {
          type: 'object',
          properties: {
            managed_vps_id: {
              type: 'string',
              description: 'The managed VPS ID to get information for',
            },
          },
          required: ['managed_vps_id'],
        },
      },
      {
        name: 'create_subdomain',
        description: 'Create a subdomain for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            subdomain: {
              type: 'string',
              description: 'The subdomain name to create',
            },
          },
          required: ['package_id', 'subdomain'],
        },
      },
      {
        name: 'remove_subdomain',
        description: 'Remove a subdomain from a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            subdomain: {
              type: 'string',
              description: 'The subdomain name to remove',
            },
          },
          required: ['package_id', 'subdomain'],
        },
      },
      {
        name: 'list_subdomains',
        description: 'List all subdomains for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'create_mysql_database',
        description: 'Create a MySQL database for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            name: {
              type: 'string',
              description: 'The database name',
            },
          },
          required: ['package_id', 'name'],
        },
      },
      {
        name: 'create_mysql_user',
        description: 'Create a MySQL user for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            username: {
              type: 'string',
              description: 'The username for the MySQL user',
            },
            password: {
              type: 'string',
              description: 'The password for the MySQL user',
            },
          },
          required: ['package_id', 'username', 'password'],
        },
      },
      {
        name: 'create_email_account',
        description: 'Create an email account for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email: {
              type: 'string',
              description: 'The email address to create',
            },
            password: {
              type: 'string',
              description: 'The password for the email account',
            },
          },
          required: ['package_id', 'email', 'password'],
        },
      },
      {
        name: 'create_email_forwarder',
        description: 'Create an email forwarder for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            source: {
              type: 'string',
              description: 'The source email address',
            },
            destinations: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of destination email addresses',
            },
          },
          required: ['package_id', 'source', 'destinations'],
        },
      },
      {
        name: 'get_php_versions',
        description: 'Get available PHP versions for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_php_version',
        description: 'Set the PHP version for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            version: {
              type: 'string',
              description: 'The PHP version to set (e.g., "8.1", "8.2")',
            },
          },
          required: ['package_id', 'version'],
        },
      },
      {
        name: 'list_applications',
        description: 'List available applications for installation',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'install_application',
        description: 'Install an application on a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            application_id: {
              type: 'string',
              description: 'The application ID to install',
            },
            path: {
              type: 'string',
              description: 'The installation path',
            },
            config: {
              type: 'object',
              description: 'Optional configuration parameters for the application',
            },
          },
          required: ['package_id', 'application_id', 'path'],
        },
      },
      {
        name: 'create_ftp_user',
        description: 'Create an FTP user for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            username: {
              type: 'string',
              description: 'The FTP username',
            },
            password: {
              type: 'string',
              description: 'The FTP password',
            },
            path: {
              type: 'string',
              description: 'The FTP access path (defaults to root)',
            },
          },
          required: ['package_id', 'username', 'password'],
        },
      },
      {
        name: 'list_ftp_users',
        description: 'List all FTP users for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'manage_directories',
        description: 'Create or delete directories in a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            action: {
              type: 'string',
              enum: ['create', 'delete'],
              description: 'The action to perform (create or delete)',
            },
            path: {
              type: 'string',
              description: 'The directory path',
            },
          },
          required: ['package_id', 'action', 'path'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    
    if (!args) {
      throw new McpError(ErrorCode.InvalidRequest, 'Missing arguments');
    }

    switch (name) {
      case 'get_reseller_info':
        const resellerInfo = await twentyIClient.getResellerInfo();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resellerInfo, null, 2),
            },
          ],
        };

      case 'get_account_balance':
        const accountBalance = await twentyIClient.getAccountBalance();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(accountBalance, null, 2),
            },
          ],
        };

      case 'list_domains':
        const domains = await twentyIClient.listDomains();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(domains, null, 2),
            },
          ],
        };

      case 'get_domain_info':
        const domainInfo = await twentyIClient.getDomainInfo(args.domain_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(domainInfo, null, 2),
            },
          ],
        };

      case 'list_hosting_packages':
        const packages = await twentyIClient.listHostingPackages();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packages, null, 2),
            },
          ],
        };

      case 'get_hosting_package_info':
        const packageInfo = await twentyIClient.getHostingPackageInfo(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageInfo, null, 2),
            },
          ],
        };

      case 'create_hosting_package':
        const newPackage = await twentyIClient.createHostingPackage({
          domain_name: args.domain_name,
          package_type: args.package_type,
          username: args.username,
          password: args.password,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newPackage, null, 2),
            },
          ],
        };

      case 'get_hosting_package_web_info':
        const packageWebInfo = await twentyIClient.getHostingPackageWebInfo(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageWebInfo, null, 2),
            },
          ],
        };

      case 'get_hosting_package_limits':
        const packageLimits = await twentyIClient.getHostingPackageLimits(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageLimits, null, 2),
            },
          ],
        };

      case 'get_hosting_package_usage':
        const packageUsage = await twentyIClient.getHostingPackageUsage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageUsage, null, 2),
            },
          ],
        };

      case 'list_cloud_servers':
        const servers = await twentyIClient.listCloudServers();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(servers, null, 2),
            },
          ],
        };

      case 'create_cloud_server':
        const newServer = await twentyIClient.createCloudServer({
          provider: args.provider,
          size: args.size,
          location: args.location,
          name: args.name,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newServer, null, 2),
            },
          ],
        };

      case 'get_dns_records':
        const dnsRecords = await twentyIClient.getDnsRecords(args.domain_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsRecords, null, 2),
            },
          ],
        };

      case 'update_dns_record':
        const updatedDns = await twentyIClient.updateDnsRecord(args.domain_id as string, {
          record_type: args.record_type,
          name: args.name,
          value: args.value,
          ttl: args.ttl || 3600,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedDns, null, 2),
            },
          ],
        };

      case 'register_domain':
        const registeredDomain = await twentyIClient.registerDomain({
          name: args.name as string,
          years: args.years as number,
          contact: args.contact as any,
          privacyService: args.privacy_service as boolean,
          nameservers: args.nameservers as string[],
          stackUser: args.stack_user as string,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(registeredDomain, null, 2),
            },
          ],
        };

      case 'order_premium_mailbox':
        const premiumMailbox = await twentyIClient.orderPremiumMailbox({
          id: args.mailbox_id,
          local: args.local,
          domain: args.domain,
        }, args.for_user as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(premiumMailbox, null, 2),
            },
          ],
        };

      case 'renew_premium_mailbox':
        const renewedMailbox = await twentyIClient.renewPremiumMailbox(args.id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(renewedMailbox, null, 2),
            },
          ],
        };

      case 'get_email_configuration':
        const emailConfig = await twentyIClient.getEmailConfiguration(args.package_id as string, args.email_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailConfig, null, 2),
            },
          ],
        };

      case 'get_mailbox_configuration':
        const mailboxConfig = await twentyIClient.getMailboxConfiguration(args.package_id as string, args.email_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mailboxConfig, null, 2),
            },
          ],
        };

      case 'get_email_forwarders':
        const emailForwarders = await twentyIClient.getEmailForwarders(args.package_id as string, args.email_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailForwarders, null, 2),
            },
          ],
        };

      case 'get_all_email_forwarders':
        const allForwarders = await twentyIClient.getAllEmailForwarders(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allForwarders, null, 2),
            },
          ],
        };

      case 'generate_webmail_url':
        const webmailUrl = await twentyIClient.generateWebmailUrl(args.package_id as string, args.email_id as string, args.mailbox_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(webmailUrl, null, 2),
            },
          ],
        };

      case 'get_mysql_databases':
        const mysqlDatabases = await twentyIClient.getMysqlDatabases(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mysqlDatabases, null, 2),
            },
          ],
        };

      case 'get_mysql_users':
        const mysqlUsers = await twentyIClient.getMysqlUsers(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mysqlUsers, null, 2),
            },
          ],
        };

      case 'get_mssql_databases':
        const mssqlDatabases = await twentyIClient.getMssqlDatabases(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mssqlDatabases, null, 2),
            },
          ],
        };

      case 'get_ssl_certificates':
        const sslCertificates = await twentyIClient.getSslCertificates(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sslCertificates, null, 2),
            },
          ],
        };

      case 'add_free_ssl':
        const freeSSL = await twentyIClient.addFreeSSL(args.package_id as string, args.domains as string[]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(freeSSL, null, 2),
            },
          ],
        };

      case 'get_force_ssl':
        const forceSSLStatus = await twentyIClient.getForceSSL(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(forceSSLStatus, null, 2),
            },
          ],
        };

      case 'set_force_ssl':
        const forceSSLResult = await twentyIClient.setForceSSL(args.package_id as string, args.enabled as boolean);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(forceSSLResult, null, 2),
            },
          ],
        };

      case 'get_bandwidth_stats':
        const bandwidthStats = await twentyIClient.getBandwidthStats(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(bandwidthStats, null, 2),
            },
          ],
        };

      case 'get_disk_usage':
        const diskUsage = await twentyIClient.getDiskUsage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(diskUsage, null, 2),
            },
          ],
        };

      case 'get_access_logs':
        const accessLogs = await twentyIClient.getAccessLogs(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(accessLogs, null, 2),
            },
          ],
        };

      case 'list_vps':
        const vpsList = await twentyIClient.listVPS();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsList, null, 2),
            },
          ],
        };

      case 'get_vps_info':
        const vpsInfo = await twentyIClient.getVPSInfo(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsInfo, null, 2),
            },
          ],
        };

      case 'list_managed_vps':
        const managedVpsList = await twentyIClient.listManagedVPS();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(managedVpsList, null, 2),
            },
          ],
        };

      case 'get_managed_vps_info':
        const managedVpsInfo = await twentyIClient.getManagedVPSInfo(args.managed_vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(managedVpsInfo, null, 2),
            },
          ],
        };

      case 'create_subdomain':
        const newSubdomain = await twentyIClient.createSubdomain(args.package_id as string, args.subdomain as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newSubdomain, null, 2),
            },
          ],
        };

      case 'remove_subdomain':
        const removedSubdomain = await twentyIClient.removeSubdomain(args.package_id as string, args.subdomain as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(removedSubdomain, null, 2),
            },
          ],
        };

      case 'list_subdomains':
        const subdomains = await twentyIClient.listSubdomains(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(subdomains, null, 2),
            },
          ],
        };

      case 'create_mysql_database':
        const newDatabase = await twentyIClient.createMysqlDatabase(args.package_id as string, args.name as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newDatabase, null, 2),
            },
          ],
        };

      case 'create_mysql_user':
        const newMysqlUser = await twentyIClient.createMysqlUser(
          args.package_id as string,
          args.username as string,
          args.password as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newMysqlUser, null, 2),
            },
          ],
        };

      case 'create_email_account':
        const newEmailAccount = await twentyIClient.createEmailAccount(
          args.package_id as string,
          args.email as string,
          args.password as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newEmailAccount, null, 2),
            },
          ],
        };

      case 'create_email_forwarder':
        const newEmailForwarder = await twentyIClient.createEmailForwarder(
          args.package_id as string,
          args.source as string,
          args.destinations as string[]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newEmailForwarder, null, 2),
            },
          ],
        };

      case 'get_php_versions':
        const phpVersions = await twentyIClient.getPhpVersions(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(phpVersions, null, 2),
            },
          ],
        };

      case 'set_php_version':
        const setPhpVersionResult = await twentyIClient.setPhpVersion(args.package_id as string, args.version as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setPhpVersionResult, null, 2),
            },
          ],
        };

      case 'list_applications':
        const applications = await twentyIClient.listApplications(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(applications, null, 2),
            },
          ],
        };

      case 'install_application':
        const installedApp = await twentyIClient.installApplication(
          args.package_id as string,
          args.application_id as string,
          args.path as string,
          args.config
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(installedApp, null, 2),
            },
          ],
        };

      case 'create_ftp_user':
        const newFtpUser = await twentyIClient.createFtpUser(
          args.package_id as string,
          args.username as string,
          args.password as string,
          args.path as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newFtpUser, null, 2),
            },
          ],
        };

      case 'list_ftp_users':
        const ftpUsers = await twentyIClient.listFtpUsers(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ftpUsers, null, 2),
            },
          ],
        };

      case 'manage_directories':
        const directoryResult = await twentyIClient.manageDirectories(
          args.package_id as string,
          args.action as 'create' | 'delete',
          args.path as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(directoryResult, null, 2),
            },
          ],
        };

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('20i MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});