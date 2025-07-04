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