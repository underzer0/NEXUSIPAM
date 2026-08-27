-- =====================================================================
-- BeyondIP Enterprise IPAM — Production MySQL Schema DDL
-- =====================================================================

CREATE DATABASE IF NOT EXISTS ipam_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ipam_db;

-- 1. Datacenters Table
CREATE TABLE IF NOT EXISTS datacenters (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  location VARCHAR(128) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dc_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. VLANs Table
CREATE TABLE IF NOT EXISTS vlans (
  id VARCHAR(64) PRIMARY KEY,
  vlan_id INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  datacenter_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dc_vlan (datacenter_id, vlan_id),
  INDEX idx_vlan_dc (datacenter_id),
  INDEX idx_vlan_number (vlan_id),
  CONSTRAINT fk_vlan_datacenter FOREIGN KEY (datacenter_id) REFERENCES datacenters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Subnets Table
CREATE TABLE IF NOT EXISTS subnets (
  id VARCHAR(64) PRIMARY KEY,
  cidr VARCHAR(64) NOT NULL,
  ip_version VARCHAR(8) NOT NULL DEFAULT 'IPv4',
  segment_type VARCHAR(16) NOT NULL DEFAULT 'Private',
  datacenter_id VARCHAR(64) NOT NULL,
  vlan_id VARCHAR(64) NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dc_cidr (datacenter_id, cidr),
  INDEX idx_subnet_dc (datacenter_id),
  INDEX idx_subnet_vlan (vlan_id),
  INDEX idx_subnet_cidr (cidr),
  CONSTRAINT fk_subnet_datacenter FOREIGN KEY (datacenter_id) REFERENCES datacenters(id) ON DELETE CASCADE,
  CONSTRAINT fk_subnet_vlan FOREIGN KEY (vlan_id) REFERENCES vlans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. IP Addresses Table
CREATE TABLE IF NOT EXISTS ip_addresses (
  id VARCHAR(64) PRIMARY KEY,
  ip_address VARCHAR(64) NOT NULL,
  ip_version VARCHAR(8) NOT NULL DEFAULT 'IPv4',
  subnet_id VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'Active',
  assigned_device VARCHAR(255) DEFAULT '',
  description TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subnet_ip (subnet_id, ip_address),
  INDEX idx_ip_addr (ip_address),
  INDEX idx_ip_subnet (subnet_id),
  INDEX idx_ip_status (status),
  CONSTRAINT fk_ip_subnet FOREIGN KEY (subnet_id) REFERENCES subnets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Activity Logs & Audit Stream Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(64) PRIMARY KEY,
  action VARCHAR(16) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  detail TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_log_action (action),
  INDEX idx_log_entity (entity_type),
  INDEX idx_log_time (timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Users & Credentials Table (Passwords and sensitive tokens are strictly hashed/encrypted)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, -- BCrypt Salted Hash ($2a$10$...)
  role VARCHAR(128) NOT NULL DEFAULT 'Principal Network Architect',
  department VARCHAR(128) DEFAULT 'Infrastructure & Network Engineering',
  organization VARCHAR(128) DEFAULT 'BeyondIP Enterprise',
  location VARCHAR(128) DEFAULT 'Corporate Headquarters',
  phone VARCHAR(32) DEFAULT '',
  bio TEXT,
  primary_datacenter_id VARCHAR(64) DEFAULT '',
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  email_notifications BOOLEAN DEFAULT TRUE,
  collision_alerts BOOLEAN DEFAULT TRUE,
  exhaustion_alerts BOOLEAN DEFAULT TRUE,
  theme_preference VARCHAR(16) DEFAULT 'dark',
  api_key_hash VARCHAR(255) NULL,      -- SHA-256 Hash for fast secure lookup
  api_key_encrypted TEXT NULL,         -- AES-256-GCM Encrypted Token
  api_key_masked VARCHAR(64) NULL,     -- Masked prefix for UI display (e.g. nx_live_ab...12)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. System & Session Config
CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(64) PRIMARY KEY,
  config_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
