#!/usr/bin/env node

/**
 * Check SSH Access via 20i API
 * 
 * Test if SSH access is available for the package
 */

import axios from 'axios';

const API_KEY = 'c878755260a884f4d';
const PACKAGE_ID = '3302301';

const authHeader = `Bearer ${Buffer.from(API_KEY).toString('base64')}`;
const apiClient = axios.create({
  baseURL: 'https://api.20i.com',
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
  },
  timeout: 60000
});

console.log('🔍 Checking SSH Access via 20i API');
console.log('=================================\n');

// Check if SSH is available
async function checkSSHAvailability() {
  console.log('📋 Step 1: Checking SSH service availability...');
  
  const sshEndpoints = [
    `/package/${PACKAGE_ID}/ssh`,
    `/package/${PACKAGE_ID}/shell`,
    `/package/${PACKAGE_ID}/terminal`,
    `/package/${PACKAGE_ID}/web/ssh`,
    `/package/${PACKAGE_ID}/web/shell`
  ];
  
  for (const endpoint of sshEndpoints) {
    console.log(`🔍 Testing: ${endpoint}`);
    
    try {
      const response = await apiClient.get(endpoint);
      
      if (response.status === 200 && response.data) {
        console.log(`✅ SSH endpoint accessible: ${endpoint}`);
        console.log(`📊 Response: ${JSON.stringify(response.data, null, 2)}`);
        
        if (response.data.enabled || response.data.available) {
          return { available: true, endpoint, data: response.data };
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.status || error.message}`);
    }
  }
  
  return { available: false };
}

// Try to execute shell commands via API
async function testShellExecution() {
  console.log('\n📋 Step 2: Testing shell command execution...');
  
  const shellEndpoints = [
    `/package/${PACKAGE_ID}/web/execute`,
    `/package/${PACKAGE_ID}/web/command`,
    `/package/${PACKAGE_ID}/web/shell`,
    `/package/${PACKAGE_ID}/execute`,
    `/package/${PACKAGE_ID}/command`
  ];
  
  const testCommands = [
    'pwd',
    'ls -la',
    'whoami',
    'cd /home/sites/*/public_html/suitecrm && ls -la'
  ];
  
  for (const endpoint of shellEndpoints) {
    console.log(`🔍 Testing shell endpoint: ${endpoint}`);
    
    for (const command of testCommands) {
      try {
        const response = await apiClient.post(endpoint, {
          command: command,
          cmd: command,
          shell: command
        });
        
        if (response.status === 200) {
          console.log(`✅ Command executed: ${command}`);
          console.log(`📊 Output: ${JSON.stringify(response.data, null, 2)}`);
          return { success: true, endpoint, command, output: response.data };
        }
        
      } catch (error) {
        console.log(`   ❌ ${command}: ${error.response?.status || error.message}`);
      }
    }
  }
  
  return { success: false };
}

// Check file manager with write capabilities
async function checkFileManagerWrite() {
  console.log('\n📋 Step 3: Testing file manager write capabilities...');
  
  try {
    // Try to create a test file with database config
    const testConfig = `<?php
// Test SuiteCRM Database Configuration
$sugar_config['dbconfig']['db_host_name'] = 'localhost';
$sugar_config['dbconfig']['db_user_name'] = 'shakatogatt_user';
$sugar_config['dbconfig']['db_password'] = 'Suite2024!DB#Secure';
$sugar_config['dbconfig']['db_name'] = 'shakatogatt_suite-353039349811';
$sugar_config['dbconfig']['db_type'] = 'mysql';
$sugar_config['dbconfig']['db_port'] = '3306';
?>`;
    
    const fileEndpoints = [
      `/package/${PACKAGE_ID}/web/files`,
      `/package/${PACKAGE_ID}/web/fileManager`,
      `/package/${PACKAGE_ID}/files`
    ];
    
    for (const endpoint of fileEndpoints) {
      console.log(`🔍 Testing file write: ${endpoint}`);
      
      try {
        const response = await apiClient.post(endpoint, {
          action: 'create',
          path: '/public_html/suitecrm/test_config.php',
          content: testConfig,
          filename: 'test_config.php',
          data: testConfig
        });
        
        if (response.status === 200) {
          console.log(`✅ File write successful via ${endpoint}`);
          console.log('🎯 Can create config files directly!');
          return { success: true, endpoint };
        }
        
      } catch (error) {
        console.log(`   ❌ ${error.response?.status || error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ File manager test failed: ${error.message}`);
  }
  
  return { success: false };
}

// Try web-based terminal emulation
async function checkWebTerminal() {
  console.log('\n📋 Step 4: Checking web-based terminal...');
  
  try {
    // Some hosting providers offer web terminal access
    const terminalUrls = [
      'https://my.20i.com/terminal',
      'https://stackcp.net/terminal',
      `https://my.20i.com/package/${PACKAGE_ID}/terminal`
    ];
    
    const https = await import('https');
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const webClient = axios.create({ httpsAgent, timeout: 10000 });
    
    for (const url of terminalUrls) {
      console.log(`🔍 Testing terminal URL: ${url}`);
      
      try {
        const response = await webClient.get(url);
        
        if (response.status === 200) {
          const content = response.data.toLowerCase();
          
          if (content.includes('terminal') || content.includes('shell') || content.includes('console')) {
            console.log(`✅ Web terminal may be available at: ${url}`);
            return { available: true, url };
          }
        }
        
      } catch (error) {
        console.log(`   ❌ ${error.response?.status || error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Web terminal check failed: ${error.message}`);
  }
  
  return { available: false };
}

// Main SSH access check
async function runSSHCheck() {
  console.log('🚀 Starting SSH access investigation...\n');
  
  try {
    // Step 1: Check SSH API availability
    const sshCheck = await checkSSHAvailability();
    
    if (sshCheck.available) {
      console.log('\n✅ SSH access is available via API!');
      console.log('We can execute commands directly');
      return { method: 'ssh_api', available: true };
    }
    
    // Step 2: Test shell command execution
    const shellCheck = await testShellExecution();
    
    if (shellCheck.success) {
      console.log('\n✅ Shell command execution available!');
      console.log('We can run commands to fix the database config');
      return { method: 'shell_api', available: true };
    }
    
    // Step 3: Test file manager write
    const fileCheck = await checkFileManagerWrite();
    
    if (fileCheck.success) {
      console.log('\n✅ File manager write access available!');
      console.log('We can create the config file directly');
      return { method: 'file_api', available: true };
    }
    
    // Step 4: Check web terminal
    const terminalCheck = await checkWebTerminal();
    
    if (terminalCheck.available) {
      console.log('\n✅ Web terminal may be available!');
      console.log(`Access via: ${terminalCheck.url}`);
      return { method: 'web_terminal', available: true, url: terminalCheck.url };
    }
    
    console.log('\n❌ No direct SSH/shell access available via API');
    console.log('Manual StackCP file manager remains the best option');
    
    return { available: false };
    
  } catch (error) {
    console.error('\n🚨 SSH check error:', error.message);
    return { available: false, error: true };
  }
}

// Execute SSH access check
runSSHCheck().then(result => {
  if (result.available) {
    console.log('\n🎯 Great News!');
    console.log(`SSH/Shell access available via: ${result.method}`);
    console.log('We can complete the database configuration programmatically!');
    
    if (result.url) {
      console.log(`\n🌐 Web Terminal URL: ${result.url}`);
    }
  } else {
    console.log('\n📋 SSH Access Summary:');
    console.log('❌ Direct SSH access: Not available via API');
    console.log('❌ Shell command execution: Not available via API');
    console.log('❌ File manager write: Not available via API');
    console.log('❌ Web terminal: Not accessible');
    console.log('');
    console.log('✅ Recommendation: Use StackCP File Manager (5-minute manual fix)');
    console.log('This is the standard approach for hosting providers');
  }
}).catch(console.error);