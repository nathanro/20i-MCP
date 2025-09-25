-- Database initialization script for 20i MCP Server
-- This script creates the necessary database and user for the application

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS mcp_server;

-- Create user if it doesn't exist
CREATE USER IF NOT EXISTS 'mcp_user'@'%' IDENTIFIED BY '${POSTGRES_PASSWORD}';

-- Grant privileges on the database
GRANT ALL PRIVILEGES ON mcp_server.* TO 'mcp_user'@'%';

-- Grant privileges on all databases (optional, for development)
-- GRANT ALL PRIVILEGES ON *.* TO 'mcp_user'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Switch to the database
USE mcp_server;

-- Create tables for application data
CREATE TABLE IF NOT EXISTS mcp_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    data JSON,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS mcp_logs (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSON,
    INDEX idx_session_id (session_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_level (level)
);

CREATE TABLE IF NOT EXISTS mcp_metrics (
    id VARCHAR(36) PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE NOT NULL,
    tags JSON,
    INDEX idx_metric_name (metric_name),
    INDEX idx_timestamp (timestamp)
);

CREATE TABLE IF NOT EXISTS mcp_api_requests (
    id VARCHAR(36) PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL,
    user_agent VARCHAR(255),
    ip_address VARCHAR(45),
    INDEX idx_timestamp (timestamp),
    INDEX idx_endpoint (endpoint),
    INDEX idx_status_code (status_code)
);

-- Create indexes for better performance
CREATE INDEX idx_mcp_sessions_user_expires ON mcp_sessions(user_id, expires_at);
CREATE INDEX idx_mcp_logs_timestamp_level ON mcp_logs(timestamp, level);
CREATE INDEX idx_mcp_metrics_name_timestamp ON mcp_metrics(metric_name, timestamp);

-- Create views for common queries
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT id, user_id, created_at, expires_at, 
       JSON_UNQUOTE(JSON_EXTRACT(data, '$.user_agent')) as user_agent,
       JSON_UNQUOTE(JSON_EXTRACT(data, '$.ip_address')) as ip_address
FROM mcp_sessions 
WHERE expires_at > CURRENT_TIMESTAMP;

CREATE OR REPLACE VIEW v_api_requests_summary AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_requests,
    AVG(response_time) as avg_response_time,
    MAX(response_time) as max_response_time
FROM mcp_api_requests
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Create stored procedures for maintenance
DELIMITER //

CREATE PROCEDURE cleanup_expired_sessions()
BEGIN
    DELETE FROM mcp_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    SELECT ROW_COUNT() as deleted_rows;
END //

CREATE PROCEDURE cleanup_old_logs(IN days_to_keep INT)
BEGIN
    DELETE FROM mcp_logs WHERE timestamp < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL days_to_keep DAY);
    SELECT ROW_COUNT() as deleted_rows;
END //

CREATE PROCEDURE cleanup_old_metrics(IN days_to_keep INT)
BEGIN
    DELETE FROM mcp_metrics WHERE timestamp < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL days_to_keep DAY);
    SELECT ROW_COUNT() as deleted_rows;
END //

DELIMITER ;

-- Create triggers for automatic cleanup
DELIMITER //

CREATE TRIGGER before_mcp_sessions_insert
BEFORE INSERT ON mcp_sessions
FOR EACH ROW
BEGIN
    -- Ensure session ID is not null
    IF NEW.id IS NULL THEN
        SET NEW.id = UUID();
    END IF;
    
    -- Ensure expires_at is in the future
    IF NEW.expires_at <= CURRENT_TIMESTAMP THEN
        SET NEW.expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR);
    END IF;
END //

DELIMITER ;

-- Grant necessary privileges to the application user
GRANT SELECT, INSERT, UPDATE, DELETE ON mcp_server.* TO 'mcp_user'@'%';

-- Set default character set and collation
ALTER DATABASE mcp_server CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Show completion message
SELECT 'Database initialization completed successfully' as message;