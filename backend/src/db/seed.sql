-- ============================================================================
-- SEED DATA for CGIWorkFlo.com
-- Description: Demo users for development and testing
-- Password for all users: demo123
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DEMO USERS
-- ----------------------------------------------------------------------------
-- Password hash for 'demo123' (bcrypt, 10 rounds):
-- $2a$10$KMTwu8dJGBBmy7XLFQMH3.Vq77vjIsn8jrah46zX/lHMWUN5DVLcy

INSERT INTO users (id, name, email, password_hash, role, address, phone, franchise_id, created_at, updated_at)
VALUES
  (
    'demo-admin',
    'Admin Demo',
    'admin@demo.com',
    '$2a$10$KMTwu8dJGBBmy7XLFQMH3.Vq77vjIsn8jrah46zX/lHMWUN5DVLcy',
    'admin',
    '123 Admin Street, New York, NY 10001',
    '555-0001',
    NULL,
    datetime('now'),
    datetime('now')
  ),
  (
    'demo-manager',
    'Manager Demo',
    'manager@demo.com',
    '$2a$10$KMTwu8dJGBBmy7XLFQMH3.Vq77vjIsn8jrah46zX/lHMWUN5DVLcy',
    'manager',
    '456 Manager Avenue, Los Angeles, CA 90001',
    '555-0002',
    NULL,
    datetime('now'),
    datetime('now')
  ),
  (
    'demo-franchisee',
    'Franchisee Demo',
    'franchisee@demo.com',
    '$2a$10$KMTwu8dJGBBmy7XLFQMH3.Vq77vjIsn8jrah46zX/lHMWUN5DVLcy',
    'franchisee',
    '789 Business Blvd, Chicago, IL 60601',
    '555-0003',
    NULL,
    datetime('now'),
    datetime('now')
  ),
  (
    'demo-employee',
    'Employee Demo',
    'employee@demo.com',
    '$2a$10$KMTwu8dJGBBmy7XLFQMH3.Vq77vjIsn8jrah46zX/lHMWUN5DVLcy',
    'employee',
    '321 Worker Way, Houston, TX 77001',
    '555-0004',
    'demo-franchisee',
    datetime('now'),
    datetime('now')
  );

-- Note: Employee is linked to Franchisee via franchise_id
