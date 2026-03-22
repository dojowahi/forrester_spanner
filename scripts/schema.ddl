-- 1. Infrastructure & Placements
CREATE PLACEMENT americas OPTIONS (instance_partition="americas-partition");
CREATE PLACEMENT europe OPTIONS (instance_partition="europe-partition");
CREATE PLACEMENT asia OPTIONS (instance_partition="asia-partition");
-- 2. Product & Inventory (Omni-Channel)
CREATE TABLE Products (
ProductId STRING(36) NOT NULL,
Name STRING(MAX) NOT NULL,
Description STRING(MAX),
Price NUMERIC NOT NULL,
Category STRING(100),
ThumbnailUrl STRING(MAX),
DescriptionEmbedding ARRAY<FLOAT32>(vector_length=>768),
ImageEmbedding ARRAY<FLOAT32>(vector_length=>768),
SearchTokens TOKENLIST AS (TOKENIZE_FULLTEXT (CONCAT(Name, ' ', IFNULL(Description, '')))) HIDDEN,
DateGenerated TIMESTAMP OPTIONS (allow_commit_timestamp=true),
) PRIMARY KEY (ProductId);
CREATE TABLE Stores (
StoreId STRING(36) NOT NULL,
StoreName STRING(MAX),
Latitude FLOAT64 NOT NULL,
Longitude FLOAT64 NOT NULL,
S2CellId INT64 NOT NULL,
PlacementKey STRING(MAX) NOT NULL PLACEMENT KEY
) PRIMARY KEY (StoreId);
CREATE TABLE Inventory (
StoreId STRING(36) NOT NULL,
ProductId STRING(36) NOT NULL,
StockCount INT64 NOT NULL,
LastUpdated TIMESTAMP OPTIONS (allow_commit_timestamp=true),
) PRIMARY KEY (StoreId, ProductId), INTERLEAVE IN PARENT Stores ON DELETE
CASCADE;
-- 3. Customers & Loyalty
CREATE TABLE Customers (
CustomerId STRING(36) NOT NULL,
PlacementKey STRING(MAX) NOT NULL PLACEMENT KEY,
FullName STRING(MAX),
Email STRING(MAX),
Latitude FLOAT64 NOT NULL,
Longitude FLOAT64 NOT NULL,
S2CellId INT64 NOT NULL,
LoyaltyTier STRING(20) DEFAULT ('BRONZE'),
LoyaltyPoints INT64 DEFAULT (0),

) PRIMARY KEY (CustomerId);
-- 4. Identity & Activity (TTL enabled)
CREATE TABLE UserSessions (
SessionId STRING(36) NOT NULL,
CustomerId STRING(36),
ActiveCart JSON,
LastEvent TIMESTAMP OPTIONS (allow_commit_timestamp=true),
UserAgent STRING(MAX),
IPAddress STRING(45) -- Moved here for easier session-based fraud tracking
) PRIMARY KEY (SessionId), ROW DELETION POLICY (OLDER_THAN (LastEvent, INTERVAL 7 DAY));
-- 5. Orders & Payments (Fraud Detection Core)
CREATE TABLE Orders (
CustomerId STRING(36) NOT NULL,
OrderId STRING(36) NOT NULL,
StoreId STRING(36),
OrderDate TIMESTAMP OPTIONS (allow_commit_timestamp=true),
TotalAmount NUMERIC,
Status STRING(50),
) PRIMARY KEY (CustomerId, OrderId), INTERLEAVE IN PARENT Customers ON DELETE
CASCADE;
CREATE TABLE OrderItems (
CustomerId STRING(36) NOT NULL,
OrderId STRING(36) NOT NULL,
LineItemId INT64 NOT NULL,
ProductId STRING(36),
Quantity INT64,
Price NUMERIC,
) PRIMARY KEY (CustomerId, OrderId, LineItemId), INTERLEAVE IN PARENT Orders ON
DELETE CASCADE;
CREATE TABLE Payments (
PaymentId STRING(36) NOT NULL,
SessionId STRING(36) NOT NULL,
CustomerId STRING(36) NOT NULL,
Amount NUMERIC NOT NULL,
PaymentMethodToken STRING(MAX), -- Critical for "Shared Card" fraud detection
Status STRING(50),
CreatedAt TIMESTAMP OPTIONS (allow_commit_timestamp=true),
) PRIMARY KEY (PaymentId);

DROP PROPERTY GRAPH IF EXISTS RetailGraph;

CREATE PROPERTY GRAPH RetailGraph
NODE TABLES (
  -- Declare explicit attributes to prevent schema conflict caching
  Customers 
    KEY (CustomerId) 
    PROPERTIES (CustomerId, LoyaltyTier, LoyaltyPoints, Latitude, Longitude),
  Products 
    KEY (ProductId) 
    PROPERTIES (ProductId, Name, Category, Price, Description),
  UserSessions 
    KEY (SessionId) 
    PROPERTIES (SessionId, IPAddress),
  Payments 
    KEY (PaymentId) 
    PROPERTIES (PaymentId, PaymentMethodToken, Amount)
)
EDGE TABLES (
  -- Links users to fraud session clusters
  UserSessions AS BelongsTo
    SOURCE KEY (SessionId) REFERENCES UserSessions (SessionId)
    DESTINATION KEY (CustomerId) REFERENCES Customers (CustomerId),
    
  -- Links Payments to originating Sessions
  Payments AS AuthoredBy
    SOURCE KEY (PaymentId) REFERENCES Payments (PaymentId)
    DESTINATION KEY (SessionId) REFERENCES UserSessions (SessionId),
    
  -- Purchase History maps standard Recommendation node paths
  OrderItems AS Purchased
    SOURCE KEY (CustomerId) REFERENCES Customers (CustomerId)
    DESTINATION KEY (ProductId) REFERENCES Products (ProductId)
);

-- Geospatial S2 Indexes (Unused, removed to save storage)

-- Graph & Geo Optimization Indexes
CREATE INDEX OrderItemsByProductId ON OrderItems(ProductId);
CREATE INDEX PaymentsBySessionId ON Payments(SessionId);

-- 7. Search & Change Streams
CREATE VECTOR INDEX ProductDescriptionIndex ON Products (DescriptionEmbedding)
WHERE DescriptionEmbedding IS NOT NULL
OPTIONS (distance_type='COSINE');
CREATE SEARCH INDEX ProductSearchIndex ON Products (SearchTokens);
-- CREATE CHANGE STREAM RetailChangeStream FOR ALL;

