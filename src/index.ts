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

/**
 * 20i API Response Format Notes:
 * 
 * The 20i API may return different response formats depending on account status:
 * 
 * 1. Reseller Info (/reseller endpoint):
 *    - Normal: { id: "reseller-id", name: "...", ... }
 *    - UUID only: "0f8b7d7c-d878-4356-9b00-e6210a26fff1" (string)
 *    - Empty/new accounts may return minimal data
 * 
 * 2. Account Balance (/reseller/{id}/accountBalance):
 *    - Normal: { balance: 123.45, currency: "USD", ... }
 *    - Zero balance: May return empty object {} or 404 error
 *    - New accounts: May have no balance endpoint available
 * 
 * Important: Always use console.error() instead of console.log() to avoid
 * polluting the stdio transport used by MCP protocol.
 */

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
    // Credentials loaded successfully
    
    const authHeader = `Bearer ${Buffer.from(this.credentials.apiKey).toString('base64')}`;
    // Authorization header configured
    
    this.apiClient = axios.create({
      baseURL: 'https://api.20i.com',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000, // 30 second timeout
      responseType: 'json', // Ensure axios tries to parse JSON
      transformResponse: [(data) => {
        // If it's already parsed by axios, return it
        if (typeof data === 'object' && data !== null) {
          return data;
        }
        
        // Try to parse if it's a string
        if (typeof data === 'string' && data.trim()) {
          try {
            return JSON.parse(data);
          } catch (e) {
            // Return the string as-is so we can handle it in the interceptor
            return data;
          }
        }
        
        return data;
      }],
    });

    // Add response interceptor for better error handling and JSON validation
    this.apiClient.interceptors.response.use(
      (response) => {
        // Process response

        // Check if response is JSON
        const contentType = response.headers['content-type'];
        
        // If we got a string response that looks like JavaScript object literal, try to convert it
        if (typeof response.data === 'string' && response.data.trim()) {
          const trimmedData = response.data.trim();
          
          // Check if it looks like a JavaScript object literal (starts with 'Loaded' or contains ':' without quotes)
          if (trimmedData.includes(':') && !trimmedData.startsWith('{') && !trimmedData.startsWith('[')) {
            // Invalid response format detected
            throw new Error(`API returned invalid format (JavaScript object literal instead of JSON). This suggests the API endpoint or authentication may be incorrect.`);
          }
          
          // Try to parse as JSON if it's a string
          try {
            response.data = JSON.parse(trimmedData);
          } catch (parseError) {
            // JSON parsing failed
            
            if (contentType && contentType.includes('text/html')) {
              throw new Error(`API returned HTML instead of JSON. Status: ${response.status}. This usually indicates an authentication error or invalid endpoint.`);
            } else {
              throw new Error(`API returned unparseable response: ${trimmedData.substring(0, 100)}...`);
            }
          }
        }
        
        if (response.data === null || response.data === undefined) {
          // Handle null/undefined response
          response.data = {};
        }
        
        return response;
      },
      (error) => {
        // API request failed
        
        // Check if the error response contains HTML
        if (error.response?.headers?.['content-type']?.includes('text/html')) {
          const htmlPreview = typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 200).replace(/<[^>]*>/g, ' ').trim()
            : '';
          throw new Error(`API returned HTML error page (${error.response.status}): ${htmlPreview}`);
        }
        
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
    // 
    // API Response Formats:
    // 1. Normal response: { id: "reseller-id", name: "...", ... }
    // 2. UUID response: "0f8b7d7c-d878-4356-9b00-e6210a26fff1" (string)
    // 3. Empty/zero balance accounts may return different formats
    try {
      const response = await this.apiClient.get('/reseller');
      
      // Handle different response formats
      if (typeof response.data === 'string' && response.data.match(/^[a-f0-9-]{36}$/i)) {
        // API returned just a UUID string
        return { id: response.data };
      }
      
      // Validate response structure
      if (!response.data || typeof response.data !== 'object') {
        throw new Error(`Invalid response from /reseller endpoint: expected object, got ${typeof response.data}`);
      }
      
      return response.data;
    } catch (error: any) {
      // Error occurred - rethrow with original details
      throw error;
    }
  }

  async getAccountBalance() {
    // Fetches account balance and billing information
    // 
    // Note: Accounts with zero balance or new accounts may return different response formats
    // The API may return an empty object {} or specific error for zero-balance accounts
    let resellerId: string | undefined;
    
    try {
      const resellerInfo = await this.getResellerInfo();
      resellerId = resellerInfo?.id;
      
      if (!resellerId) {
        throw new Error('Unable to determine reseller ID from account information');
      }
      
      const response = await this.apiClient.get(`/reseller/${resellerId}/accountBalance`);
      
      // Handle empty response for zero-balance accounts
      if (!response.data || Object.keys(response.data).length === 0) {
        return {
          balance: 0,
          currency: 'USD',
          message: 'Account has zero balance or no balance information available'
        };
      }
      
      return response.data;
    } catch (error: any) {
      // If the API returns 404 or specific error for zero-balance, handle gracefully
      if (error.response?.status === 404 || error.response?.status === 403) {
        return {
          balance: 0,
          currency: 'USD',
          message: 'Balance information not available - account may have zero balance or no payment history',
          resellerId: resellerId
        };
      }
      // Re-throw with more specific error message
      throw new Error(`Failed to retrieve balance for reseller ${resellerId}: ${error.message}`);
    }
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

  async searchDomains(searchTerm: string, options?: {
    suggestions?: boolean;
    tlds?: string[];
  }) {
    // Search for domain availability and suggestions
    // Supports both prefix searching (searches all TLDs) and specific domain names
    // Can also return semantic suggestions for domain names
    //
    // API Endpoint: GET /domain-search/{prefix_or_name}
    // - If searchTerm is a full domain (contains dot), searches that specific domain
    // - If searchTerm is a prefix, searches across all supported TLDs
    // - Multiple domains can be searched by comma separation
    // - Results include availability status and suggestions if enabled
    //
    // Note: Results are streamed and may arrive in different order than requested
    try {
      // Encode the search term to handle special characters and spaces
      const encodedSearchTerm = encodeURIComponent(searchTerm.trim());
      
      // Build query parameters if options provided
      const queryParams = new URLSearchParams();
      if (options?.suggestions !== undefined) {
        queryParams.set('suggestions', options.suggestions.toString());
      }
      if (options?.tlds && options.tlds.length > 0) {
        queryParams.set('tlds', options.tlds.join(','));
      }
      
      const queryString = queryParams.toString();
      const url = `/domain-search/${encodedSearchTerm}${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.apiClient.get(url);
      return response.data;
    } catch (error: any) {
      // Handle rate limiting and usage limits gracefully
      if (error.response?.status === 429) {
        throw new Error('Domain search rate limit exceeded. Please try again later.');
      }
      throw error;
    }
  }

  async getDomainVerificationStatus() {
    // Retrieve domain verification status for all domains
    // Returns a list of all domains with their verification status
    //
    // API Endpoint: GET /domainVerification
    // - Returns verification status for all domains in the account
    // - Shows which domains require registrant verification
    // - Includes verification completion status and requirements
    try {
      const response = await this.apiClient.get('/domainVerification');
      return response.data;
    } catch (error: any) {
      // Handle cases where no domains need verification
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async resendDomainVerificationEmail(packageId: string, domainId: string) {
    // Resend the registrant verification email for a specific domain
    // Used when domain registrant verification is required
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/resendVerificationEmail
    // - Resends verification email to domain registrant
    // - Required for certain domain registrations and transfers
    // - Helps complete domain ownership verification process
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/resendVerificationEmail`, {});
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or verification email not applicable for this domain');
      }
      throw error;
    }
  }

  // Email Security Management Methods
  async getDkimSignature(packageId: string, emailId: string) {
    // Retrieve DKIM signature configuration for a domain
    // Used to check current DKIM authentication settings
    //
    // API Endpoint: GET /package/{packageId}/email/{emailId}/signature
    // - Returns current DKIM signature configuration
    // - Shows selector, key, and signature settings
    // - Used for email authentication verification
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/signature`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { message: 'No DKIM signature configured for this domain' };
      }
      throw error;
    }
  }

  async setDkimSignature(packageId: string, emailId: string, dkimConfig: {
    action: 'set' | 'delete';
    body?: {
      Canonicalization?: string;
      ExpiryTime?: number;
      Flag?: string;
      Granularity?: string;
      IsDefault?: boolean;
      IsStrict?: boolean;
      Note?: string;
      Selector?: string;
      ServiceType?: string;
    };
  }) {
    // Set or delete DKIM signature for email authentication
    // Critical for email deliverability and anti-spoofing
    //
    // API Endpoint: POST /package/{packageId}/email/{emailId}/signature
    // - Configure DKIM signing for outbound email
    // - Set signature parameters like selector and canonicalization
    // - Delete existing DKIM configuration if needed
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}/signature`, dkimConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(`Invalid DKIM configuration: ${error.response?.data?.message || 'Check parameters'}`);
      }
      throw error;
    }
  }

  async getDmarcPolicy(packageId: string, emailId: string) {
    // Retrieve DMARC policy configuration for a domain
    // Used to check current DMARC authentication and policy settings
    //
    // API Endpoint: GET /package/{packageId}/email/{emailId}/dmarc
    // - Returns current DMARC policy configuration
    // - Shows policy actions (none, quarantine, reject)
    // - Includes reporting and alignment settings
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/dmarc`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { message: 'No DMARC policy configured for this domain' };
      }
      throw error;
    }
  }

  async setDmarcPolicy(packageId: string, emailId: string, dmarcConfig: {
    action: 'set' | 'delete';
    body?: {
      Policy?: 'none' | 'quarantine' | 'reject';
      SubdomainPolicy?: 'none' | 'quarantine' | 'reject';
      Percentage?: number;
      ReportingURI?: string;
      ForensicReportingURI?: string;
      AlignmentMode?: 'strict' | 'relaxed';
      ReportingInterval?: number;
      Note?: string;
    };
  }) {
    // Set or delete DMARC policy for email authentication
    // Essential for email security and deliverability
    //
    // API Endpoint: POST /package/{packageId}/email/{emailId}/dmarc
    // - Configure DMARC policy (none, quarantine, reject)
    // - Set reporting URIs for DMARC reports
    // - Configure alignment modes and percentage rollout
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}/dmarc`, dmarcConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(`Invalid DMARC configuration: ${error.response?.data?.message || 'Check policy parameters'}`);
      }
      throw error;
    }
  }

  // PHP Environment Management Methods
  async getAvailablePhpVersions(packageId: string) {
    // Get all available PHP versions for a hosting package
    // Used to determine which PHP versions can be set for the package
    //
    // API Endpoint: GET /package/{packageId}/web/availablePhpVersions
    // - Returns list of available PHP versions
    // - Includes version numbers and display titles
    // - Used for version selection in hosting management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/availablePhpVersions`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support PHP version management');
      }
      throw error;
    }
  }

  async getCurrentPhpVersion(packageId: string) {
    // Get the current PHP version for a hosting package
    // Returns the currently active PHP version string
    //
    // API Endpoint: GET /package/{packageId}/web/phpVersion
    // - Returns current PHP version (e.g., "8.2", "7.4")
    // - Used to check current environment configuration
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/phpVersion`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support PHP version management');
      }
      throw error;
    }
  }

  async setPhpVersion(packageId: string, version: string) {
    // Set the PHP version for a hosting package
    // Critical for application compatibility and development environments
    //
    // API Endpoint: POST /package/{packageId}/web/phpVersion
    // - Sets PHP version for the hosting package
    // - Affects all PHP scripts and applications
    // - May require application restart or cache clearing
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/phpVersion`, {
        value: version
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(`Invalid PHP version: ${version}. Check available versions first.`);
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support PHP version management');
      }
      throw error;
    }
  }

  async getAllowedPhpConfiguration(packageId: string) {
    // Get allowed PHP configuration directives for a hosting package
    // Shows which PHP settings can be customized
    //
    // API Endpoint: GET /package/{packageId}/web/allowedPhpConfiguration
    // - Returns list of configurable PHP directives
    // - Includes directive names, types, and default values
    // - Used for PHP environment customization
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/allowedPhpConfiguration`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support PHP configuration management');
      }
      throw error;
    }
  }

  async getPhpConfig(packageId: string, phpConfigId: string) {
    // Get current PHP configuration for a specific configuration ID
    // Returns current PHP directive values
    //
    // API Endpoint: GET /package/{packageId}/web/phpConfig/{phpConfigId}
    // - Returns current PHP configuration settings
    // - Shows custom directive values and overrides
    // - Used to review current PHP environment setup
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/phpConfig/${phpConfigId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('PHP configuration not found for the specified package and config ID');
      }
      throw error;
    }
  }

  async updatePhpConfig(packageId: string, phpConfigId: string, config: Record<string, string>) {
    // Update PHP configuration directives for a hosting package
    // Allows customization of PHP environment settings
    //
    // API Endpoint: POST /package/{packageId}/web/phpConfig/{phpConfigId}/updateConfig
    // - Updates PHP directive values
    // - Affects PHP behavior for the hosting package
    // - Configuration changes may require time to propagate
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/phpConfig/${phpConfigId}/updateConfig`, {
        config: config
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid PHP configuration values. Check allowed directives and formats.');
      }
      if (error.response?.status === 404) {
        throw new Error('PHP configuration not found for the specified package and config ID');
      }
      throw error;
    }
  }

  // File Permission Management Methods
  async getFilePermissionRecommendations(packageId: string) {
    // Get file permissions that don't match platform recommendations
    // Critical for web hosting security and proper file access
    //
    // API Endpoint: GET /package/{packageId}/web/filePermissions
    // - Returns permission check information
    // - Identifies files with incorrect permissions
    // - Provides platform-recommended security settings
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/filePermissions`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support file permission management');
      }
      throw error;
    }
  }

  async setFilePermissions(packageId: string, permissionCheckId: number, files: Array<{file: string, perms: number}>) {
    // Set file permissions for specific files
    // Corrects file permissions to match security recommendations
    //
    // API Endpoint: POST /package/{packageId}/web/filePermissions
    // - Sets file permissions for security compliance
    // - Requires permission check ID from recommendations
    // - Applies permissions to specified files
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/filePermissions`, {
        permissionCheckId,
        files
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid permission check ID or file permission values');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or permission check ID is invalid');
      }
      throw error;
    }
  }

  async getDirectoryIndexingStatus(packageId: string) {
    // Get directory indexing configuration
    // Controls whether visitors can view directory file listings
    //
    // API Endpoint: GET /package/{packageId}/web/directoryIndexing
    // - Returns current directory indexing state
    // - Important for web security and privacy
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/directoryIndexing`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support directory indexing management');
      }
      throw error;
    }
  }

  async setDirectoryIndexing(packageId: string, enabled: boolean) {
    // Enable or disable directory indexing for security
    // Controls whether visitors can view directory file listings
    //
    // API Endpoint: POST /package/{packageId}/web/directoryIndexing
    // - Enables/disables directory indexing
    // - Critical for web security and privacy
    // - Prevents unauthorized file browsing
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/directoryIndexing`, {
        value: enabled
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid directory indexing value. Must be boolean.');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support directory indexing management');
      }
      throw error;
    }
  }

  async setDirectoryIndex(packageId: string, indexFiles: string[]) {
    // Set directory index files (up to 5) for htaccess configuration
    // Controls which files serve as directory index pages
    //
    // API Endpoint: POST /package/{packageId}/web/directoryIndex
    // - Sets up to 5 files for directory index
    // - Configures htaccess file handling
    // - Defines default files for directory access
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/directoryIndex`, {
        indexFiles: indexFiles.slice(0, 5) // Limit to 5 files as per API spec
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid directory index file list. Maximum 5 files allowed.');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support directory index management');
      }
      throw error;
    }
  }

  // Easy Builder Integration Methods
  async getEasyBuilderInstances(packageId: string) {
    // Get current Easy Builder instances for a hosting package
    // Essential for website builder management and deployment
    //
    // API Endpoint: GET /package/{packageId}/web/easyBuilderInstance
    // - Returns current Easy Builder instances
    // - Shows instance status and configuration
    // - Required for builder management workflows
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/easyBuilderInstance`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support Easy Builder');
      }
      throw error;
    }
  }

  async deleteEasyBuilderInstance(packageId: string, instanceId: string) {
    // Delete an Easy Builder instance
    // Removes website builder deployment and configuration
    //
    // API Endpoint: POST /package/{packageId}/web/easyBuilderInstanceDelete
    // - Deletes Easy Builder instance by ID
    // - Removes associated configuration and files
    // - Irreversible operation - use with caution
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/easyBuilderInstanceDelete`, {
        instanceId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid instance ID or instance cannot be deleted');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or Easy Builder instance not found');
      }
      throw error;
    }
  }

  async installEasyBuilderInstance(packageId: string, instanceId: string) {
    // Install an Easy Builder instance
    // Deploys website builder to hosting package
    //
    // API Endpoint: POST /package/{packageId}/web/easyBuilderInstanceInstall
    // - Installs Easy Builder instance by ID
    // - Sets up builder environment and configuration
    // - Enables website builder functionality
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/easyBuilderInstanceInstall`, {
        instanceId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid instance ID or installation failed');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or Easy Builder instance not found');
      }
      throw error;
    }
  }

  async getEasyBuilderSso(packageId: string, instanceId: string) {
    // Get Easy Builder Single Sign-On URL
    // Provides direct access to builder interface
    //
    // API Endpoint: POST /package/{packageId}/web/easyBuilderSso
    // - Returns SSO URL for Easy Builder instance
    // - Enables seamless access to builder interface
    // - Required for user authentication workflow
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/easyBuilderSso`, {
        instanceId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid instance ID or SSO generation failed');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or Easy Builder instance not found');
      }
      throw error;
    }
  }

  async getEasyBuilderThemes(packageId: string) {
    // Get all available Easy Builder themes
    // Lists templates and design options for website builder
    //
    // API Endpoint: GET /package/{packageId}/web/easyBuilderTheme
    // - Returns available themes and templates
    // - Shows theme metadata and previews
    // - Required for theme selection workflow
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/easyBuilderTheme`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support Easy Builder themes');
      }
      throw error;
    }
  }

  async setEasyBuilderTheme(packageId: string, instanceId: string, themeName: string) {
    // Set Easy Builder theme for instance
    // Applies selected theme to website builder
    //
    // API Endpoint: POST /package/{packageId}/web/easyBuilderTheme
    // - Sets theme for Easy Builder instance
    // - Applies design and layout changes
    // - Updates site appearance immediately
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/easyBuilderTheme`, {
        instanceId,
        themeName
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid instance ID or theme name');
      }
      if (error.response?.status === 404) {
        throw new Error('Package, instance, or theme not found');
      }
      throw error;
    }
  }

  async getWebsiteBuilderSso(packageId: string) {
    // Get Website Builder Single Sign-On URL
    // Provides direct access to traditional website builder
    //
    // API Endpoint: GET /package/{packageId}/web/websiteBuilderSso
    // - Returns SSO URL for Website Builder
    // - Enables seamless access to builder interface
    // - Alternative to Easy Builder for traditional sites
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/websiteBuilderSso`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support Website Builder');
      }
      throw error;
    }
  }

  // WordPress Management Methods
  async isWordPressInstalled(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressIsInstalled`);
    return response.data;
  }

  async reinstallWordPress(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/reinstall`);
    return response.data;
  }

  async getWordPressSettings(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressSettings`);
    return response.data;
  }

  async setWordPressSettings(packageId: string, optionName: string, optionValue: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressSettings`, {
      option_name: optionName,
      option_value: optionValue
    });
    return response.data;
  }

  async getWordPressVersion(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressVersion`);
    return response.data;
  }

  async wordPressSearchReplace(packageId: string, search: string, replace: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressSearchReplace`, {
      search,
      replace
    });
    return response.data;
  }

  async getWordPressPlugins(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressPlugins`);
    return response.data;
  }

  async manageWordPressPlugin(packageId: string, action: 'activate' | 'deactivate' | 'remove', pluginName: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressPlugins`, {
      type: action,
      name: pluginName
    });
    return response.data;
  }

  async installStackCachePlugin(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressInstallStackCache`);
    return response.data;
  }

  async getWordPressThemes(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressThemes`);
    return response.data;
  }

  async manageWordPressTheme(packageId: string, action: 'activate' | 'deactivate' | 'remove', themeName: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressThemes`, {
      type: action,
      name: themeName
    });
    return response.data;
  }

  async getWordPressUsers(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressUsers`);
    return response.data;
  }

  async manageWordPressUser(packageId: string, userData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressUsers`, userData);
    return response.data;
  }

  async getWordPressAdministrators(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressAdministrators`);
    return response.data;
  }

  async getWordPressRoles(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressRoles`);
    return response.data;
  }

  async updateWordPress(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressUpdate`);
    return response.data;
  }

  async getWordPressStaging(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressStaging`);
    return response.data;
  }

  async manageWordPressStaging(packageId: string, type: 'live' | 'staging') {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressStaging`, {
      type
    });
    return response.data;
  }

  async removeWordPressStagingClone(packageId: string, cloneId: number) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressStagingRemoveClone`, {
      id: cloneId
    });
    return response.data;
  }

  async getWordPressChecksum(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressChecksum`);
    return response.data;
  }

  async generateWordPressChecksum(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressChecksum`);
    return response.data;
  }

  async checkWordPressDatabase(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressDbCheck`);
    return response.data;
  }

  // CDN Management Methods
  async getCdnOptions(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cdnOptions`);
    return response.data;
  }

  async getCdnFeatureGroups(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cdnFeatureGroups`);
    return response.data;
  }

  async addCdnFeature(packageId: string, featureData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/addCdnFeature`, featureData);
    return response.data;
  }

  async bulkAddCdnFeatures(packageId: string, featuresData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/bulkAddCdnFeature`, featuresData);
    return response.data;
  }

  async getCdnStats(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cdnStats`);
    return response.data;
  }

  async getCacheReport(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cacheReport`);
    return response.data;
  }

  async purgeCdnCache(packageId: string, url: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/purgeCdnByUrl`, { url });
    return response.data;
  }

  async getStackCacheSettings(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/stackCache`);
    return response.data;
  }

  async setStackCachePolicy(packageId: string, policyData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/stackCache`, policyData);
    return response.data;
  }

  async getCdnSecurityHeaders(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cdnSecurityHeaders`);
    return response.data;
  }

  async updateCdnSecurityHeaders(packageId: string, headersData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/updateCdnSecurityHeaders`, headersData);
    return response.data;
  }

  async deleteCdnSecurityHeaders(packageId: string, headerNames?: string[]) {
    if (headerNames && headerNames.length > 0) {
      // Delete specific headers
      const response = await this.apiClient.post(`/package/${packageId}/web/deleteCdnSecurityHeader`, { headers: headerNames });
      return response.data;
    } else {
      // Delete all headers
      const response = await this.apiClient.post(`/package/${packageId}/web/deleteCdnSecurityHeaders`);
      return response.data;
    }
  }

  async getCdnTrafficDistribution(packageId: string, filters?: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/cdnStatsTrafficDistribution`, filters || {});
    return response.data;
  }

  async assignWebsiteTurbo(websiteTurboId: string, packageId: string) {
    const response = await this.apiClient.post(`/website_turbo/${websiteTurboId}/assignPackage`, { packageId });
    return response.data;
  }

  async unassignWebsiteTurbo(websiteTurboId: string, packageId: string) {
    const response = await this.apiClient.post(`/website_turbo/${websiteTurboId}/unAssignPackage`, { packageId });
    return response.data;
  }

  async orderWebsiteTurboCredits(amount: number) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addWebsiteTurboCredits`, { amount });
    return response.data;
  }

  // Backup and Restore Management Methods
  async listTimelineStorage(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup`);
    return response.data;
  }

  async createSnapshot(packageId: string, snapshotType: 'web' | 'database', databaseId?: string) {
    if (snapshotType === 'database' && databaseId) {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/database/${databaseId}/takeSnapshot`);
      return response.data;
    } else if (snapshotType === 'web') {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/web/takeSnapshot`);
      return response.data;
    } else {
      throw new Error('Invalid snapshot type or missing database ID for database snapshots');
    }
  }

  async listSnapshots(packageId: string, snapshotType: 'web' | 'database', databaseId?: string) {
    if (snapshotType === 'database' && databaseId) {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/database/${databaseId}`);
      return response.data;
    } else if (snapshotType === 'web') {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/web`);
      return response.data;
    } else {
      throw new Error('Invalid snapshot type or missing database ID for database snapshots');
    }
  }

  async restoreSnapshot(packageId: string, restoreData: {
    snapshotType: 'web' | 'database';
    action: 'restore' | 'mysqlrestore';
    restoreAsOf: number;
    restorePath: string;
    target?: string;
    databaseId?: string;
  }) {
    const { snapshotType, databaseId, ...restoreParams } = restoreData;
    
    if (snapshotType === 'database' && databaseId) {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/database/${databaseId}/restoreSnapshot`, restoreParams);
      return response.data;
    } else if (snapshotType === 'web') {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/web/restoreSnapshot`, restoreParams);
      return response.data;
    } else {
      throw new Error('Invalid snapshot type or missing database ID for database snapshots');
    }
  }

  async getSnapshotJobs(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/web/jobs`);
    return response.data;
  }

  async restoreFtpBackup(packageId: string, backupData: {
    filename: string;
    restoreType: 'IntoDirectory' | 'ReplaceMissing' | 'ReplaceAll';
    restoreDatabases: boolean;
  }) {
    const response = await this.apiClient.post(`/package/${packageId}/web/restoreWebsiteBackup`, backupData);
    return response.data;
  }

  async listBackupJobs(packageId: string) {
    // This would typically be combined with other job monitoring endpoints
    const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/web/jobs`);
    return response.data;
  }

  async listMultisiteBackups() {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/backupBulkPackages`);
    return response.data;
  }

  async createMultisiteBackup(packageIds: string[], deleteExisting: boolean = false) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/backupBulkPackages`, {
      id: packageIds,
      delete: deleteExisting
    });
    return response.data;
  }

  async listVpsBackups() {
    // This would list VPS backup services if available
    const response = await this.apiClient.get('/vps');
    return response.data;
  }

  async updateVpsBackup(vpsId: string, backupConfig: any) {
    const response = await this.apiClient.post(`/vps/${vpsId}/backup`, backupConfig);
    return response.data;
  }

  // Advanced Security Management Methods
  async getBlockedIpAddresses(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/blockedIpAddresses`);
    return response.data;
  }

  async setBlockedIpAddresses(packageId: string, ipAddresses?: string[]) {
    const payload = ipAddresses ? { ip_addresses: ipAddresses } : {};
    const response = await this.apiClient.post(`/package/${packageId}/web/blockedIpAddresses`, payload);
    return response.data;
  }

  async addIpBlock(packageId: string, ipAddress: string) {
    // Get current blocked IPs and add the new one
    const currentBlocked = await this.getBlockedIpAddresses(packageId);
    const blockedList = Array.isArray(currentBlocked) ? currentBlocked : [];
    
    if (!blockedList.includes(ipAddress)) {
      blockedList.push(ipAddress);
      return await this.setBlockedIpAddresses(packageId, blockedList);
    }
    
    return { message: 'IP address is already blocked', blocked_ips: blockedList };
  }

  async removeIpBlock(packageId: string, ipAddress: string) {
    // Get current blocked IPs and remove the specified one
    const currentBlocked = await this.getBlockedIpAddresses(packageId);
    const blockedList = Array.isArray(currentBlocked) ? currentBlocked : [];
    
    const updatedList = blockedList.filter(ip => ip !== ipAddress);
    return await this.setBlockedIpAddresses(packageId, updatedList);
  }

  async getBlockedCountries(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/blockedCountries`);
    return response.data;
  }

  async setBlockedCountries(packageId: string, countries: string[], access: string = 'block') {
    const response = await this.apiClient.post(`/package/${packageId}/web/blockedCountries`, {
      countries,
      access
    });
    return response.data;
  }

  async addCountryBlock(packageId: string, countryCode: string, access: string = 'block') {
    // Get current blocked countries and add the new one
    const currentBlocked = await this.getBlockedCountries(packageId);
    const blockedList = Array.isArray(currentBlocked) ? currentBlocked : [];
    
    if (!blockedList.includes(countryCode)) {
      blockedList.push(countryCode);
      return await this.setBlockedCountries(packageId, blockedList, access);
    }
    
    return { message: 'Country is already blocked', blocked_countries: blockedList };
  }

  async removeCountryBlock(packageId: string, countryCode: string) {
    // Get current blocked countries and remove the specified one
    const currentBlocked = await this.getBlockedCountries(packageId);
    const blockedList = Array.isArray(currentBlocked) ? currentBlocked : [];
    
    const updatedList = blockedList.filter(country => country !== countryCode);
    return await this.setBlockedCountries(packageId, updatedList);
  }

  async getMalwareScan(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/malwareScan`);
    return response.data;
  }

  async requestMalwareScan(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/malwareScan`, {
      LockState: 'new'
    });
    return response.data;
  }

  async getMalwareReport(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/malwareReport`);
    return response.data;
  }

  async getEmailSpamBlacklist(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/spamPolicyListBlacklist`);
    return response.data;
  }

  async getEmailSpamWhitelist(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/spamPolicyListWhitelist`);
    return response.data;
  }

  async addTlsCertificate(name: string, periodMonths: number, configuration: any) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addTlsCertificate`, {
      name,
      periodMonths,
      configuration
    });
    return response.data;
  }

  async renewTlsCertificate(certificateId: string, periodMonths: number) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/renewTlsCertificate`, {
      id: certificateId,
      periodMonths
    });
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
        name: 'search_domains',
        description: 'Search for domain availability and get suggestions',
        inputSchema: {
          type: 'object',
          properties: {
            search_term: {
              type: 'string',
              description: 'Domain name or prefix to search for. Can be a full domain name (e.g., "example.com") or a prefix (e.g., "example") to search across all TLDs',
            },
            suggestions: {
              type: 'boolean',
              description: 'Enable domain name suggestions (default: false)',
            },
            tlds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific TLDs to search (optional, defaults to all supported TLDs)',
            },
          },
          required: ['search_term'],
        },
      },
      {
        name: 'get_domain_verification_status',
        description: 'Get domain verification status for all domains',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'resend_domain_verification_email',
        description: 'Resend domain verification email for a specific domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID requiring verification',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'get_dkim_signature',
        description: 'Get DKIM signature configuration for a domain',
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
        name: 'set_dkim_signature',
        description: 'Set or delete DKIM signature for email authentication',
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
            action: {
              type: 'string',
              enum: ['set', 'delete'],
              description: 'Action to perform - set or delete DKIM signature',
            },
            canonicalization: {
              type: 'string',
              description: 'DKIM canonicalization method (optional)',
            },
            selector: {
              type: 'string',
              description: 'DKIM selector (optional)',
            },
            is_default: {
              type: 'boolean',
              description: 'Set as default DKIM signature (optional)',
            },
            note: {
              type: 'string',
              description: 'Note for DKIM configuration (optional)',
            },
          },
          required: ['package_id', 'email_id', 'action'],
        },
      },
      {
        name: 'get_dmarc_policy',
        description: 'Get DMARC policy configuration for a domain',
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
        name: 'set_dmarc_policy',
        description: 'Set or delete DMARC policy for email authentication',
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
            action: {
              type: 'string',
              enum: ['set', 'delete'],
              description: 'Action to perform - set or delete DMARC policy',
            },
            policy: {
              type: 'string',
              enum: ['none', 'quarantine', 'reject'],
              description: 'DMARC policy action (required when action=set)',
            },
            subdomain_policy: {
              type: 'string',
              enum: ['none', 'quarantine', 'reject'],
              description: 'DMARC policy for subdomains (optional)',
            },
            percentage: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Percentage of emails to apply policy to (optional, default 100)',
            },
            reporting_uri: {
              type: 'string',
              description: 'URI for aggregate reports (optional)',
            },
            alignment_mode: {
              type: 'string',
              enum: ['strict', 'relaxed'],
              description: 'DMARC alignment mode (optional, default relaxed)',
            },
            note: {
              type: 'string',
              description: 'Note for DMARC configuration (optional)',
            },
          },
          required: ['package_id', 'email_id', 'action'],
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
        name: 'get_current_php_version',
        description: 'Get the current PHP version for a hosting package',
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
              description: 'PHP version to set (e.g., "8.2", "7.4")',
            },
          },
          required: ['package_id', 'version'],
        },
      },
      {
        name: 'get_php_config_options',
        description: 'Get allowed PHP configuration directives for a hosting package',
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
        name: 'get_php_config',
        description: 'Get current PHP configuration for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            config_id: {
              type: 'string',
              description: 'PHP configuration ID',
            },
          },
          required: ['package_id', 'config_id'],
        },
      },
      {
        name: 'update_php_config',
        description: 'Update PHP configuration directives for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            config_id: {
              type: 'string',
              description: 'PHP configuration ID',
            },
            config: {
              type: 'object',
              description: 'PHP configuration directives as key-value pairs',
              additionalProperties: {
                type: 'string',
              },
            },
          },
          required: ['package_id', 'config_id', 'config'],
        },
      },
      {
        name: 'is_wordpress_installed',
        description: 'Check if WordPress is installed on a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to check',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'reinstall_wordpress',
        description: 'Reinstall WordPress on a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to reinstall WordPress on',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_wordpress_settings',
        description: 'Get WordPress settings for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get settings for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_wordpress_settings',
        description: 'Set WordPress settings for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to set settings for',
            },
            option_name: {
              type: 'string',
              description: 'WordPress option name to set',
            },
            option_value: {
              type: 'string',
              description: 'WordPress option value to set',
            },
          },
          required: ['package_id', 'option_name', 'option_value'],
        },
      },
      {
        name: 'get_wordpress_version',
        description: 'Get the WordPress version for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get WordPress version for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'wordpress_search_replace',
        description: 'Perform WordPress search and replace operation',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to perform search/replace on',
            },
            search: {
              type: 'string',
              description: 'Text to search for',
            },
            replace: {
              type: 'string',
              description: 'Text to replace with',
            },
          },
          required: ['package_id', 'search', 'replace'],
        },
      },
      {
        name: 'get_wordpress_plugins',
        description: 'Get list of WordPress plugins for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get plugins for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'manage_wordpress_plugin',
        description: 'Activate, deactivate, or remove WordPress plugin',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to manage plugin for',
            },
            action: {
              type: 'string',
              enum: ['activate', 'deactivate', 'remove'],
              description: 'Action to perform on the plugin',
            },
            plugin_name: {
              type: 'string',
              description: 'Name of the plugin to manage',
            },
          },
          required: ['package_id', 'action', 'plugin_name'],
        },
      },
      {
        name: 'install_stackcache_plugin',
        description: 'Install StackCache plugin for WordPress',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to install StackCache plugin for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_wordpress_themes',
        description: 'Get list of WordPress themes for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get themes for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'manage_wordpress_theme',
        description: 'Activate, deactivate, or remove WordPress theme',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to manage theme for',
            },
            action: {
              type: 'string',
              enum: ['activate', 'deactivate', 'remove'],
              description: 'Action to perform on the theme',
            },
            theme_name: {
              type: 'string',
              description: 'Name of the theme to manage',
            },
          },
          required: ['package_id', 'action', 'theme_name'],
        },
      },
      {
        name: 'get_wordpress_users',
        description: 'Get WordPress users for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get users for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'update_wordpress',
        description: 'Update WordPress to the latest version',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to update WordPress for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_wordpress_staging',
        description: 'Check WordPress staging status',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to check staging for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'manage_wordpress_staging',
        description: 'Clone WordPress site between live and staging',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to manage staging for',
            },
            type: {
              type: 'string',
              enum: ['live', 'staging'],
              description: 'Copy from live to staging or staging to live',
            },
          },
          required: ['package_id', 'type'],
        },
      },
      {
        name: 'get_cdn_options',
        description: 'Get list of all available CDN features',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get CDN options for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_cdn_feature_groups',
        description: 'Get CDN feature groups',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get CDN feature groups for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'add_cdn_feature',
        description: 'Add a single CDN feature',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to add CDN feature to',
            },
            feature_data: {
              type: 'object',
              description: 'CDN feature configuration data',
            },
          },
          required: ['package_id', 'feature_data'],
        },
      },
      {
        name: 'bulk_add_cdn_features',
        description: 'Bulk add multiple CDN features',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to add CDN features to',
            },
            features_data: {
              type: 'object',
              description: 'Multiple CDN features configuration data',
            },
          },
          required: ['package_id', 'features_data'],
        },
      },
      {
        name: 'get_cdn_stats',
        description: 'Get CDN usage statistics',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get CDN stats for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_cache_report',
        description: 'Get CDN cache report (requires Website Turbo)',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get cache report for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'purge_cdn_cache',
        description: 'Purge CDN cache by URL',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to purge cache for',
            },
            url: {
              type: 'string',
              description: 'URL to purge from CDN cache',
            },
          },
          required: ['package_id', 'url'],
        },
      },
      {
        name: 'get_stackcache_settings',
        description: 'Get StackCache performance settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get StackCache settings for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_stackcache_policy',
        description: 'Set StackCache policy for CSS, images, and JavaScript',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to set StackCache policy for',
            },
            policy_data: {
              type: 'object',
              description: 'StackCache policy configuration',
            },
          },
          required: ['package_id', 'policy_data'],
        },
      },
      {
        name: 'get_cdn_security_headers',
        description: 'Get CDN security headers',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get security headers for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'update_cdn_security_headers',
        description: 'Update CDN security headers',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to update security headers for',
            },
            headers_data: {
              type: 'object',
              description: 'Security headers configuration',
            },
          },
          required: ['package_id', 'headers_data'],
        },
      },
      {
        name: 'delete_cdn_security_headers',
        description: 'Delete CDN security headers',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to delete security headers for',
            },
            header_names: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific header names to delete (optional, deletes all if not provided)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_cdn_traffic_distribution',
        description: 'Get CDN traffic distribution by country',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get traffic distribution for',
            },
            filters: {
              type: 'object',
              description: 'Optional filters for traffic data',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'assign_website_turbo',
        description: 'Assign package to Website Turbo service',
        inputSchema: {
          type: 'object',
          properties: {
            website_turbo_id: {
              type: 'string',
              description: 'Website Turbo service ID',
            },
            package_id: {
              type: 'string',
              description: 'Hosting package ID to assign',
            },
          },
          required: ['website_turbo_id', 'package_id'],
        },
      },
      {
        name: 'order_website_turbo_credits',
        description: 'Order Website Turbo credits',
        inputSchema: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'Amount of Website Turbo credits to order',
            },
          },
          required: ['amount'],
        },
      },
      {
        name: 'list_timeline_storage',
        description: 'List timeline storage items for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to list timeline storage for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'create_snapshot',
        description: 'Create immediate snapshot of web files or database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to create snapshot for',
            },
            snapshot_type: {
              type: 'string',
              enum: ['web', 'database'],
              description: 'Type of snapshot to create',
            },
            database_id: {
              type: 'string',
              description: 'Database ID (required for database snapshots)',
            },
          },
          required: ['package_id', 'snapshot_type'],
        },
      },
      {
        name: 'list_snapshots',
        description: 'List available snapshots for web files or database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to list snapshots for',
            },
            snapshot_type: {
              type: 'string',
              enum: ['web', 'database'],
              description: 'Type of snapshots to list',
            },
            database_id: {
              type: 'string',
              description: 'Database ID (required for database snapshots)',
            },
          },
          required: ['package_id', 'snapshot_type'],
        },
      },
      {
        name: 'restore_snapshot',
        description: 'Restore from timeline snapshot with precise control',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to restore snapshot for',
            },
            snapshot_type: {
              type: 'string',
              enum: ['web', 'database'],
              description: 'Type of snapshot to restore',
            },
            action: {
              type: 'string',
              enum: ['restore', 'mysqlrestore'],
              description: 'Restore action type',
            },
            restore_as_of: {
              type: 'number',
              description: 'UNIX timestamp to restore from',
            },
            restore_path: {
              type: 'string',
              description: 'Path to restore to',
            },
            target: {
              type: 'string',
              description: 'Optional target for restore operation',
            },
            database_id: {
              type: 'string',
              description: 'Database ID (required for database snapshots)',
            },
          },
          required: ['package_id', 'snapshot_type', 'action', 'restore_as_of', 'restore_path'],
        },
      },
      {
        name: 'get_snapshot_jobs',
        description: 'Get snapshot job status and progress',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get snapshot jobs for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'restore_ftp_backup',
        description: 'Restore backup file uploaded via FTP',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to restore backup for',
            },
            filename: {
              type: 'string',
              description: 'Backup filename to restore',
            },
            restore_type: {
              type: 'string',
              enum: ['IntoDirectory', 'ReplaceMissing', 'ReplaceAll'],
              description: 'How to restore the backup',
            },
            restore_databases: {
              type: 'boolean',
              description: 'Whether to restore databases',
              default: false,
            },
          },
          required: ['package_id', 'filename', 'restore_type'],
        },
      },
      {
        name: 'list_backup_jobs',
        description: 'List backup and restore job progress',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to list backup jobs for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'list_multisite_backups',
        description: 'List multisite backup information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_multisite_backup',
        description: 'Create bulk backups across multiple packages',
        inputSchema: {
          type: 'object',
          properties: {
            package_ids: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of package IDs to backup',
            },
            delete_existing: {
              type: 'boolean',
              description: 'Whether to delete existing backups',
              default: false,
            },
          },
          required: ['package_ids'],
        },
      },
      {
        name: 'list_vps_backups',
        description: 'List VPS backup services',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'update_vps_backup',
        description: 'Configure VPS backup settings',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'VPS ID to configure backup for',
            },
            backup_config: {
              type: 'object',
              description: 'Backup configuration settings',
            },
          },
          required: ['vps_id', 'backup_config'],
        },
      },
      {
        name: 'get_blocked_ip_addresses',
        description: 'Retrieve blocked IP addresses for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to get blocked IPs for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_blocked_ip_addresses',
        description: 'Set blocked IP addresses for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to set blocked IPs for',
            },
            ip_addresses: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of IP addresses or CIDR ranges to block',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'add_ip_block',
        description: 'Add a single IP address to the block list',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to add IP block to',
            },
            ip_address: {
              type: 'string',
              description: 'IP address or CIDR range to block',
            },
          },
          required: ['package_id', 'ip_address'],
        },
      },
      {
        name: 'remove_ip_block',
        description: 'Remove an IP address from the block list',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to remove IP block from',
            },
            ip_address: {
              type: 'string',
              description: 'IP address or CIDR range to unblock',
            },
          },
          required: ['package_id', 'ip_address'],
        },
      },
      {
        name: 'get_blocked_countries',
        description: 'Retrieve blocked countries for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to get blocked countries for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_blocked_countries',
        description: 'Set blocked countries for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to set blocked countries for',
            },
            countries: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of ISO 3166 country codes to block',
            },
            access: {
              type: 'string',
              description: 'Access type configuration (default: "block")',
              default: 'block',
            },
          },
          required: ['package_id', 'countries'],
        },
      },
      {
        name: 'add_country_block',
        description: 'Add a single country to the block list',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to add country block to',
            },
            country_code: {
              type: 'string',
              description: 'ISO 3166 country code to block (e.g., "CN", "RU")',
            },
            access: {
              type: 'string',
              description: 'Access type configuration (default: "block")',
              default: 'block',
            },
          },
          required: ['package_id', 'country_code'],
        },
      },
      {
        name: 'remove_country_block',
        description: 'Remove a country from the block list',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to remove country block from',
            },
            country_code: {
              type: 'string',
              description: 'ISO 3166 country code to unblock',
            },
          },
          required: ['package_id', 'country_code'],
        },
      },
      {
        name: 'get_malware_scan',
        description: 'Get malware scan status and results for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to get malware scan for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'request_malware_scan',
        description: 'Request a new malware scan for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to scan for malware',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_malware_report',
        description: 'Get detailed malware report for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to get malware report for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_email_spam_blacklist',
        description: 'Get email spam blacklist configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'Email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_email_spam_whitelist',
        description: 'Get email spam whitelist configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'Email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'add_tls_certificate',
        description: 'Order a premium TLS/SSL certificate',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Certificate name/identifier',
            },
            period_months: {
              type: 'number',
              description: 'Certificate validity period in months',
            },
            configuration: {
              type: 'object',
              description: 'Certificate configuration details',
            },
          },
          required: ['name', 'period_months', 'configuration'],
        },
      },
      {
        name: 'renew_tls_certificate',
        description: 'Renew an existing TLS/SSL certificate',
        inputSchema: {
          type: 'object',
          properties: {
            certificate_id: {
              type: 'string',
              description: 'Certificate ID to renew',
            },
            period_months: {
              type: 'number',
              description: 'Renewal period in months',
            },
          },
          required: ['certificate_id', 'period_months'],
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
      {
        name: 'get_file_permission_recommendations',
        description: 'Get file permissions that do not match platform recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to check file permissions for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_file_permissions',
        description: 'Set file permissions for specific files',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to set file permissions for',
            },
            permission_check_id: {
              type: 'number',
              description: 'The permission check ID from recommendations',
            },
            files: {
              type: 'array',
              description: 'Array of files and their permissions',
              items: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    description: 'File path',
                  },
                  perms: {
                    type: 'number',
                    description: 'Permission value (e.g., 644, 755)',
                  },
                },
                required: ['file', 'perms'],
              },
            },
          },
          required: ['package_id', 'permission_check_id', 'files'],
        },
      },
      {
        name: 'get_directory_indexing_status',
        description: 'Get directory indexing configuration for security',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to check directory indexing for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_directory_indexing',
        description: 'Enable or disable directory indexing for security',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to configure directory indexing for',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable directory indexing',
            },
          },
          required: ['package_id', 'enabled'],
        },
      },
      {
        name: 'set_directory_index',
        description: 'Set directory index files for htaccess configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to configure directory index for',
            },
            index_files: {
              type: 'array',
              description: 'Array of index files (max 5)',
              items: {
                type: 'string',
              },
              maxItems: 5,
            },
          },
          required: ['package_id', 'index_files'],
        },
      },
      {
        name: 'get_easy_builder_instances',
        description: 'Get current Easy Builder instances for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get Easy Builder instances for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'delete_easy_builder_instance',
        description: 'Delete an Easy Builder instance',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the Easy Builder instance',
            },
            instance_id: {
              type: 'string',
              description: 'The Easy Builder instance ID to delete',
            },
          },
          required: ['package_id', 'instance_id'],
        },
      },
      {
        name: 'install_easy_builder_instance',
        description: 'Install an Easy Builder instance',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to install Easy Builder instance in',
            },
            instance_id: {
              type: 'string',
              description: 'The Easy Builder instance ID to install',
            },
          },
          required: ['package_id', 'instance_id'],
        },
      },
      {
        name: 'get_easy_builder_sso',
        description: 'Get Easy Builder Single Sign-On URL',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the Easy Builder instance',
            },
            instance_id: {
              type: 'string',
              description: 'The Easy Builder instance ID for SSO',
            },
          },
          required: ['package_id', 'instance_id'],
        },
      },
      {
        name: 'get_easy_builder_themes',
        description: 'Get all available Easy Builder themes',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get Easy Builder themes for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_easy_builder_theme',
        description: 'Set Easy Builder theme for instance',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the Easy Builder instance',
            },
            instance_id: {
              type: 'string',
              description: 'The Easy Builder instance ID to set theme for',
            },
            theme_name: {
              type: 'string',
              description: 'The name of the theme to apply',
            },
          },
          required: ['package_id', 'instance_id', 'theme_name'],
        },
      },
      {
        name: 'get_website_builder_sso',
        description: 'Get Website Builder Single Sign-On URL',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get Website Builder SSO for',
            },
          },
          required: ['package_id'],
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
        try {
          const resellerInfo = await twentyIClient.getResellerInfo();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(resellerInfo, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get reseller info: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_account_balance':
        try {
          const accountBalance = await twentyIClient.getAccountBalance();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(accountBalance, null, 2),
              },
            ],
          };
        } catch (error: any) {
          // Handle "balance not available" case gracefully
          if (error.message && error.message.includes('Balance information not available')) {
            // Return a successful response with zero balance information
            const gracefulResponse = {
              balance: 0,
              currency: 'USD',
              message: 'Balance information not available - account may have zero balance or no payment history',
              status: 'unavailable'
            };
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(gracefulResponse, null, 2),
                },
              ],
            };
          }
          
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get account balance: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'list_domains':
        try {
          const domains = await twentyIClient.listDomains();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(domains, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to list domains: ${error.message}`,
            { originalError: error.toString() }
          );
        }

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

      case 'search_domains':
        try {
          const searchResults = await twentyIClient.searchDomains(
            args.search_term as string,
            {
              suggestions: args.suggestions as boolean,
              tlds: args.tlds as string[],
            }
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(searchResults, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to search domains: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_domain_verification_status':
        try {
          const verificationStatus = await twentyIClient.getDomainVerificationStatus();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(verificationStatus, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get domain verification status: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'resend_domain_verification_email':
        try {
          const emailResult = await twentyIClient.resendDomainVerificationEmail(
            args.package_id as string,
            args.domain_id as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(emailResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to resend domain verification email: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_dkim_signature':
        try {
          const dkimSignature = await twentyIClient.getDkimSignature(
            args.package_id as string,
            args.email_id as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dkimSignature, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get DKIM signature: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'set_dkim_signature':
        try {
          const dkimConfig = {
            action: args.action as 'set' | 'delete',
            body: args.action === 'set' ? {
              Canonicalization: args.canonicalization as string,
              Selector: args.selector as string,
              IsDefault: args.is_default as boolean,
              Note: args.note as string,
            } : undefined,
          };
          
          const dkimResult = await twentyIClient.setDkimSignature(
            args.package_id as string,
            args.email_id as string,
            dkimConfig
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dkimResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to set DKIM signature: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_dmarc_policy':
        try {
          const dmarcPolicy = await twentyIClient.getDmarcPolicy(
            args.package_id as string,
            args.email_id as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dmarcPolicy, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get DMARC policy: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'set_dmarc_policy':
        try {
          const dmarcConfig = {
            action: args.action as 'set' | 'delete',
            body: args.action === 'set' ? {
              Policy: args.policy as 'none' | 'quarantine' | 'reject',
              SubdomainPolicy: args.subdomain_policy as 'none' | 'quarantine' | 'reject',
              Percentage: args.percentage as number,
              ReportingURI: args.reporting_uri as string,
              AlignmentMode: args.alignment_mode as 'strict' | 'relaxed',
              Note: args.note as string,
            } : undefined,
          };
          
          const dmarcResult = await twentyIClient.setDmarcPolicy(
            args.package_id as string,
            args.email_id as string,
            dmarcConfig
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dmarcResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to set DMARC policy: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_php_versions':
        try {
          const phpVersions = await twentyIClient.getAvailablePhpVersions(args.package_id as string);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(phpVersions, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get PHP versions: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_current_php_version':
        try {
          const currentVersion = await twentyIClient.getCurrentPhpVersion(args.package_id as string);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(currentVersion, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get current PHP version: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'set_php_version':
        try {
          const versionResult = await twentyIClient.setPhpVersion(
            args.package_id as string,
            args.version as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(versionResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to set PHP version: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_php_config_options':
        try {
          const configOptions = await twentyIClient.getAllowedPhpConfiguration(args.package_id as string);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(configOptions, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get PHP configuration options: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_php_config':
        try {
          const phpConfig = await twentyIClient.getPhpConfig(
            args.package_id as string,
            args.config_id as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(phpConfig, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get PHP configuration: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'update_php_config':
        try {
          const updateResult = await twentyIClient.updatePhpConfig(
            args.package_id as string,
            args.config_id as string,
            args.config as Record<string, string>
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(updateResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to update PHP configuration: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'is_wordpress_installed':
        const wpInstalled = await twentyIClient.isWordPressInstalled(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpInstalled, null, 2),
            },
          ],
        };

      case 'reinstall_wordpress':
        const wpReinstall = await twentyIClient.reinstallWordPress(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpReinstall, null, 2),
            },
          ],
        };

      case 'get_wordpress_settings':
        const wpSettings = await twentyIClient.getWordPressSettings(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpSettings, null, 2),
            },
          ],
        };

      case 'set_wordpress_settings':
        const wpSetSettings = await twentyIClient.setWordPressSettings(
          args.package_id as string,
          args.option_name as string,
          args.option_value as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpSetSettings, null, 2),
            },
          ],
        };

      case 'get_wordpress_version':
        const wpVersion = await twentyIClient.getWordPressVersion(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpVersion, null, 2),
            },
          ],
        };

      case 'wordpress_search_replace':
        const wpSearchReplace = await twentyIClient.wordPressSearchReplace(
          args.package_id as string,
          args.search as string,
          args.replace as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpSearchReplace, null, 2),
            },
          ],
        };

      case 'get_wordpress_plugins':
        const wpPlugins = await twentyIClient.getWordPressPlugins(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpPlugins, null, 2),
            },
          ],
        };

      case 'manage_wordpress_plugin':
        const wpPluginManage = await twentyIClient.manageWordPressPlugin(
          args.package_id as string,
          args.action as 'activate' | 'deactivate' | 'remove',
          args.plugin_name as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpPluginManage, null, 2),
            },
          ],
        };

      case 'install_stackcache_plugin':
        const stackCache = await twentyIClient.installStackCachePlugin(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stackCache, null, 2),
            },
          ],
        };

      case 'get_wordpress_themes':
        const wpThemes = await twentyIClient.getWordPressThemes(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpThemes, null, 2),
            },
          ],
        };

      case 'manage_wordpress_theme':
        const wpThemeManage = await twentyIClient.manageWordPressTheme(
          args.package_id as string,
          args.action as 'activate' | 'deactivate' | 'remove',
          args.theme_name as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpThemeManage, null, 2),
            },
          ],
        };

      case 'get_wordpress_users':
        const wpUsers = await twentyIClient.getWordPressUsers(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpUsers, null, 2),
            },
          ],
        };

      case 'update_wordpress':
        const wpUpdate = await twentyIClient.updateWordPress(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpUpdate, null, 2),
            },
          ],
        };

      case 'get_wordpress_staging':
        const wpStaging = await twentyIClient.getWordPressStaging(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpStaging, null, 2),
            },
          ],
        };

      case 'manage_wordpress_staging':
        const wpStagingManage = await twentyIClient.manageWordPressStaging(
          args.package_id as string,
          args.type as 'live' | 'staging'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpStagingManage, null, 2),
            },
          ],
        };

      case 'get_cdn_options':
        const cdnOptions = await twentyIClient.getCdnOptions(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cdnOptions, null, 2),
            },
          ],
        };

      case 'get_cdn_feature_groups':
        const cdnFeatureGroups = await twentyIClient.getCdnFeatureGroups(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cdnFeatureGroups, null, 2),
            },
          ],
        };

      case 'add_cdn_feature':
        const addedCdnFeature = await twentyIClient.addCdnFeature(
          args.package_id as string,
          args.feature_data as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addedCdnFeature, null, 2),
            },
          ],
        };

      case 'bulk_add_cdn_features':
        const bulkAddedFeatures = await twentyIClient.bulkAddCdnFeatures(
          args.package_id as string,
          args.features_data as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(bulkAddedFeatures, null, 2),
            },
          ],
        };

      case 'get_cdn_stats':
        const cdnStats = await twentyIClient.getCdnStats(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cdnStats, null, 2),
            },
          ],
        };

      case 'get_cache_report':
        const cacheReport = await twentyIClient.getCacheReport(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cacheReport, null, 2),
            },
          ],
        };

      case 'purge_cdn_cache':
        const purgeResult = await twentyIClient.purgeCdnCache(
          args.package_id as string,
          args.url as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(purgeResult, null, 2),
            },
          ],
        };

      case 'get_stackcache_settings':
        const stackCacheSettings = await twentyIClient.getStackCacheSettings(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stackCacheSettings, null, 2),
            },
          ],
        };

      case 'set_stackcache_policy':
        const stackCachePolicy = await twentyIClient.setStackCachePolicy(
          args.package_id as string,
          args.policy_data as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stackCachePolicy, null, 2),
            },
          ],
        };

      case 'get_cdn_security_headers':
        const securityHeaders = await twentyIClient.getCdnSecurityHeaders(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(securityHeaders, null, 2),
            },
          ],
        };

      case 'update_cdn_security_headers':
        const updatedHeaders = await twentyIClient.updateCdnSecurityHeaders(
          args.package_id as string,
          args.headers_data as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedHeaders, null, 2),
            },
          ],
        };

      case 'delete_cdn_security_headers':
        const deletedHeaders = await twentyIClient.deleteCdnSecurityHeaders(
          args.package_id as string,
          args.header_names as string[]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deletedHeaders, null, 2),
            },
          ],
        };

      case 'get_cdn_traffic_distribution':
        const trafficDistribution = await twentyIClient.getCdnTrafficDistribution(
          args.package_id as string,
          args.filters as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(trafficDistribution, null, 2),
            },
          ],
        };

      case 'assign_website_turbo':
        const assignResult = await twentyIClient.assignWebsiteTurbo(
          args.website_turbo_id as string,
          args.package_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(assignResult, null, 2),
            },
          ],
        };

      case 'order_website_turbo_credits':
        const turboCredits = await twentyIClient.orderWebsiteTurboCredits(args.amount as number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(turboCredits, null, 2),
            },
          ],
        };

      case 'list_timeline_storage':
        const timelineStorage = await twentyIClient.listTimelineStorage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(timelineStorage, null, 2),
            },
          ],
        };

      case 'create_snapshot':
        const snapshotResult = await twentyIClient.createSnapshot(
          args.package_id as string,
          args.snapshot_type as 'web' | 'database',
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(snapshotResult, null, 2),
            },
          ],
        };

      case 'list_snapshots':
        const snapshots = await twentyIClient.listSnapshots(
          args.package_id as string,
          args.snapshot_type as 'web' | 'database',
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(snapshots, null, 2),
            },
          ],
        };

      case 'restore_snapshot':
        const restoreResult = await twentyIClient.restoreSnapshot(args.package_id as string, {
          snapshotType: args.snapshot_type as 'web' | 'database',
          action: args.action as 'restore' | 'mysqlrestore',
          restoreAsOf: args.restore_as_of as number,
          restorePath: args.restore_path as string,
          target: args.target as string,
          databaseId: args.database_id as string
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(restoreResult, null, 2),
            },
          ],
        };

      case 'get_snapshot_jobs':
        const snapshotJobs = await twentyIClient.getSnapshotJobs(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(snapshotJobs, null, 2),
            },
          ],
        };

      case 'restore_ftp_backup':
        const ftpRestoreResult = await twentyIClient.restoreFtpBackup(args.package_id as string, {
          filename: args.filename as string,
          restoreType: args.restore_type as 'IntoDirectory' | 'ReplaceMissing' | 'ReplaceAll',
          restoreDatabases: args.restore_databases as boolean
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ftpRestoreResult, null, 2),
            },
          ],
        };

      case 'list_backup_jobs':
        const backupJobs = await twentyIClient.listBackupJobs(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(backupJobs, null, 2),
            },
          ],
        };

      case 'list_multisite_backups':
        const multisiteBackups = await twentyIClient.listMultisiteBackups();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(multisiteBackups, null, 2),
            },
          ],
        };

      case 'create_multisite_backup':
        const multisiteBackupResult = await twentyIClient.createMultisiteBackup(
          args.package_ids as string[],
          args.delete_existing as boolean
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(multisiteBackupResult, null, 2),
            },
          ],
        };

      case 'list_vps_backups':
        const vpsBackups = await twentyIClient.listVpsBackups();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsBackups, null, 2),
            },
          ],
        };

      case 'update_vps_backup':
        const vpsBackupUpdate = await twentyIClient.updateVpsBackup(
          args.vps_id as string,
          args.backup_config as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsBackupUpdate, null, 2),
            },
          ],
        };

      case 'get_blocked_ip_addresses':
        const blockedIps = await twentyIClient.getBlockedIpAddresses(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(blockedIps, null, 2),
            },
          ],
        };

      case 'set_blocked_ip_addresses':
        const setIpBlocks = await twentyIClient.setBlockedIpAddresses(
          args.package_id as string,
          args.ip_addresses as string[]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setIpBlocks, null, 2),
            },
          ],
        };

      case 'add_ip_block':
        const addIpBlock = await twentyIClient.addIpBlock(
          args.package_id as string,
          args.ip_address as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addIpBlock, null, 2),
            },
          ],
        };

      case 'remove_ip_block':
        const removeIpBlock = await twentyIClient.removeIpBlock(
          args.package_id as string,
          args.ip_address as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(removeIpBlock, null, 2),
            },
          ],
        };

      case 'get_blocked_countries':
        const blockedCountries = await twentyIClient.getBlockedCountries(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(blockedCountries, null, 2),
            },
          ],
        };

      case 'set_blocked_countries':
        const setCountryBlocks = await twentyIClient.setBlockedCountries(
          args.package_id as string,
          args.countries as string[],
          args.access as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setCountryBlocks, null, 2),
            },
          ],
        };

      case 'add_country_block':
        const addCountryBlock = await twentyIClient.addCountryBlock(
          args.package_id as string,
          args.country_code as string,
          args.access as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addCountryBlock, null, 2),
            },
          ],
        };

      case 'remove_country_block':
        const removeCountryBlock = await twentyIClient.removeCountryBlock(
          args.package_id as string,
          args.country_code as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(removeCountryBlock, null, 2),
            },
          ],
        };

      case 'get_malware_scan':
        const malwareScan = await twentyIClient.getMalwareScan(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(malwareScan, null, 2),
            },
          ],
        };

      case 'request_malware_scan':
        const requestScan = await twentyIClient.requestMalwareScan(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(requestScan, null, 2),
            },
          ],
        };

      case 'get_malware_report':
        const malwareReport = await twentyIClient.getMalwareReport(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(malwareReport, null, 2),
            },
          ],
        };

      case 'get_email_spam_blacklist':
        const spamBlacklist = await twentyIClient.getEmailSpamBlacklist(
          args.package_id as string,
          args.email_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(spamBlacklist, null, 2),
            },
          ],
        };

      case 'get_email_spam_whitelist':
        const spamWhitelist = await twentyIClient.getEmailSpamWhitelist(
          args.package_id as string,
          args.email_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(spamWhitelist, null, 2),
            },
          ],
        };

      case 'add_tls_certificate':
        const tlsCertificate = await twentyIClient.addTlsCertificate(
          args.name as string,
          args.period_months as number,
          args.configuration as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tlsCertificate, null, 2),
            },
          ],
        };

      case 'renew_tls_certificate':
        const renewCertificate = await twentyIClient.renewTlsCertificate(
          args.certificate_id as string,
          args.period_months as number
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(renewCertificate, null, 2),
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

      case 'get_file_permission_recommendations':
        const { package_id: permPackageId } = request.params.arguments as any;
        const permissionRecommendations = await twentyIClient.getFilePermissionRecommendations(permPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(permissionRecommendations, null, 2),
            },
          ],
        };

      case 'set_file_permissions':
        const { package_id: setPermPackageId, permission_check_id, files } = request.params.arguments as any;
        const setPermissionsResult = await twentyIClient.setFilePermissions(setPermPackageId, permission_check_id, files);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setPermissionsResult, null, 2),
            },
          ],
        };

      case 'get_directory_indexing_status':
        const { package_id: dirIndexPackageId } = request.params.arguments as any;
        const directoryIndexingStatus = await twentyIClient.getDirectoryIndexingStatus(dirIndexPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(directoryIndexingStatus, null, 2),
            },
          ],
        };

      case 'set_directory_indexing':
        const { package_id: setDirIndexPackageId, enabled } = request.params.arguments as any;
        const setDirectoryIndexingResult = await twentyIClient.setDirectoryIndexing(setDirIndexPackageId, enabled);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setDirectoryIndexingResult, null, 2),
            },
          ],
        };

      case 'set_directory_index':
        const { package_id: setDirIndexFilesPackageId, index_files } = request.params.arguments as any;
        const setDirectoryIndexResult = await twentyIClient.setDirectoryIndex(setDirIndexFilesPackageId, index_files);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setDirectoryIndexResult, null, 2),
            },
          ],
        };

      case 'get_easy_builder_instances':
        const { package_id: easyBuilderPackageId } = request.params.arguments as any;
        const easyBuilderInstances = await twentyIClient.getEasyBuilderInstances(easyBuilderPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(easyBuilderInstances, null, 2),
            },
          ],
        };

      case 'delete_easy_builder_instance':
        const { package_id: deleteEasyBuilderPackageId, instance_id: deleteInstanceId } = request.params.arguments as any;
        const deleteEasyBuilderResult = await twentyIClient.deleteEasyBuilderInstance(deleteEasyBuilderPackageId, deleteInstanceId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deleteEasyBuilderResult, null, 2),
            },
          ],
        };

      case 'install_easy_builder_instance':
        const { package_id: installEasyBuilderPackageId, instance_id: installInstanceId } = request.params.arguments as any;
        const installEasyBuilderResult = await twentyIClient.installEasyBuilderInstance(installEasyBuilderPackageId, installInstanceId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(installEasyBuilderResult, null, 2),
            },
          ],
        };

      case 'get_easy_builder_sso':
        const { package_id: ssoEasyBuilderPackageId, instance_id: ssoInstanceId } = request.params.arguments as any;
        const easyBuilderSso = await twentyIClient.getEasyBuilderSso(ssoEasyBuilderPackageId, ssoInstanceId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(easyBuilderSso, null, 2),
            },
          ],
        };

      case 'get_easy_builder_themes':
        const { package_id: themesEasyBuilderPackageId } = request.params.arguments as any;
        const easyBuilderThemes = await twentyIClient.getEasyBuilderThemes(themesEasyBuilderPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(easyBuilderThemes, null, 2),
            },
          ],
        };

      case 'set_easy_builder_theme':
        const { package_id: setThemeEasyBuilderPackageId, instance_id: setThemeInstanceId, theme_name } = request.params.arguments as any;
        const setEasyBuilderThemeResult = await twentyIClient.setEasyBuilderTheme(setThemeEasyBuilderPackageId, setThemeInstanceId, theme_name);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setEasyBuilderThemeResult, null, 2),
            },
          ],
        };

      case 'get_website_builder_sso':
        const { package_id: websiteBuilderSsoPackageId } = request.params.arguments as any;
        const websiteBuilderSso = await twentyIClient.getWebsiteBuilderSso(websiteBuilderSsoPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(websiteBuilderSso, null, 2),
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